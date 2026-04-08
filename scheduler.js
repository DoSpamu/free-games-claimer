/**
 * Long-running daemon / scheduler for free-games-claimer.
 *
 * Usage (replaces the one-shot CMD in docker-compose):
 *   node scheduler.js
 *
 * Key env vars:
 *   CRON_SCHEDULE   cron expression, default "0 7 * * *" (every day at 07:00)
 *   TZ              timezone for cron, default "Europe/Warsaw"
 *   RUN_ON_START    set to "1" to also run immediately on container start
 *   HEALTH_PORT     HTTP port for /health and POST /run, default 8080
 *   DISCORD_WEBHOOK Discord webhook URL (optional)
 *   LOG_LEVEL       DEBUG | INFO | WARN | ERROR (default INFO)
 *
 * HTTP API:
 *   GET  /health  → JSON status
 *   POST /run     → trigger a run immediately (returns 409 if already running)
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import { createRequire } from 'node:module';
import logger from './src/logger.js';
import {
  notifyJobStart,
  notifySuccess,
  notifyEmpty,
  notifyError,
  notifyJobSummary,
} from './src/discord.js';

// ---------------------------------------------------------------------------
// node-cron (dynamic import so missing dep gives a clear error)
// ---------------------------------------------------------------------------
let cron;
try {
  const require = createRequire(import.meta.url);
  cron = require('node-cron');
} catch {
  logger.error('node-cron not found. Run: npm install node-cron');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 7 * * *';
const TZ            = process.env.TZ             || 'Europe/Warsaw';
const HEALTH_PORT   = parseInt(process.env.HEALTH_PORT || '8080', 10);
const RUN_ON_START  = process.env.RUN_ON_START   === '1';

const SCRIPTS = [
  { name: 'Steam',        file: 'steam-games'  },
  { name: 'Epic Games',   file: 'epic-games'   },
  { name: 'Prime Gaming', file: 'prime-gaming' },
  { name: 'GOG',          file: 'gog'          },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let isRunning  = false;
let lastRun    = null;     // ISO string
let lastStatus = 'never'; // 'running' | 'ok' | 'partial' | 'error'
let runCount   = 0;

// ---------------------------------------------------------------------------
// Script runner
// ---------------------------------------------------------------------------

/**
 * Run `node <file>` as a child process.
 * Resolves with exit code; never rejects (so one failure doesn't abort the rest).
 */
const runScript = (file, name) => new Promise(resolve => {
  logger.info(`  → Running: ${name} (node ${file}.js)`);
  const proc = spawn('node', [`${file}.js`], {
    stdio: 'inherit',
    env: process.env,
  });

  const timeout = setTimeout(() => {
    logger.warn(`  ⚠ ${name} is taking very long – still waiting…`);
  }, 10 * 60 * 1000); // warn after 10 min

  proc.on('exit', code => {
    clearTimeout(timeout);
    if (code === 0) {
      logger.info(`  ✓ ${name} finished OK`);
    } else {
      logger.warn(`  ✗ ${name} exited with code ${code}`);
    }
    resolve(code ?? 1);
  });

  proc.on('error', err => {
    clearTimeout(timeout);
    logger.error(`  ✗ ${name} process error: ${err.message}`);
    resolve(1);
  });
});

// ---------------------------------------------------------------------------
// Main job
// ---------------------------------------------------------------------------
const runJob = async () => {
  if (isRunning) {
    logger.warn('Job already running – skipping trigger.');
    return;
  }

  isRunning  = true;
  lastStatus = 'running';
  runCount++;
  const job  = logger.job(`Run #${runCount}`);
  const summary = {};
  const platforms = SCRIPTS.map(s => s.name);

  try {
    await notifyJobStart(platforms);
  } catch (e) {
    logger.warn(`Discord start notification failed: ${e.message}`);
  }

  for (const { name, file } of SCRIPTS) {
    try {
      const code = await runScript(file, name);
      // We can't easily know how many games were claimed without parsing db files.
      // Scripts already handle their own Apprise notifications.
      // Set claimed=0 here so the summary shows ℹ️; individual scripts send ✅ via Apprise.
      summary[name] = { claimed: code === 0 ? 0 : 0, error: code !== 0 };

      if (code !== 0) {
        await notifyError(name, new Error(`Script exited with code ${code}`)).catch(() => {});
      }
    } catch (err) {
      logger.error(`${name} threw: ${err.message}`);
      summary[name] = { claimed: 0, error: true };
      await notifyError(name, err).catch(() => {});
    }
  }

  const durationMs = job.elapsed();
  job.done();

  const allOk    = Object.values(summary).every(v => !v.error);
  const anyError = Object.values(summary).some(v => v.error);
  lastStatus = anyError ? (allOk ? 'error' : 'partial') : 'ok';
  lastRun    = new Date().toISOString();

  // Send summary + empty notification if nothing was claimed
  // (individual scripts handle success notifications via their own notify())
  try {
    await notifyJobSummary(durationMs, summary);
  } catch (e) {
    logger.warn(`Discord summary notification failed: ${e.message}`);
  }

  isRunning = false;
};

// ---------------------------------------------------------------------------
// HTTP server  – /health and POST /run
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/health') {
    const task = cron.getTasks?.()?.get?.('main');
    res.writeHead(200);
    res.end(JSON.stringify({
      status:     'ok',
      running:    isRunning,
      lastRun,
      lastStatus,
      runCount,
      schedule:   CRON_SCHEDULE,
      timezone:   TZ,
      uptime:     Math.floor(process.uptime()),
    }, null, 2));

  } else if (req.method === 'POST' && req.url === '/run') {
    if (isRunning) {
      res.writeHead(409);
      res.end(JSON.stringify({ error: 'Job already running' }));
    } else {
      res.writeHead(202);
      res.end(JSON.stringify({ message: 'Job triggered' }));
      setImmediate(() => runJob().catch(e => logger.error('Manual run error:', e.message)));
    }

  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.on('error', err => logger.error(`HTTP server error: ${err.message}`));

server.listen(HEALTH_PORT, () => {
  logger.info(`Health server listening on :${HEALTH_PORT}  (GET /health | POST /run)`);
});

// ---------------------------------------------------------------------------
// Cron schedule
// ---------------------------------------------------------------------------
if (!cron.validate(CRON_SCHEDULE)) {
  logger.error(`Invalid CRON_SCHEDULE: "${CRON_SCHEDULE}"`);
  process.exit(1);
}

cron.schedule(CRON_SCHEDULE, () => {
  logger.info(`Cron fired: ${CRON_SCHEDULE} (TZ: ${TZ})`);
  runJob().catch(e => logger.error('Scheduled run error:', e.message));
}, { timezone: TZ });

logger.info(`Scheduler ready.  Cron: "${CRON_SCHEDULE}"  TZ: ${TZ}`);
logger.info(`Next run: every day at 07:00 ${TZ}`);

// ---------------------------------------------------------------------------
// Optional: run immediately on container start
// ---------------------------------------------------------------------------
if (RUN_ON_START) {
  logger.info('RUN_ON_START=1 – triggering immediate run…');
  setImmediate(() => runJob().catch(e => logger.error('Start run error:', e.message)));
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
const shutdown = signal => {
  logger.info(`${signal} received – shutting down…`);
  server.close();
  // Give running scripts ~30s to finish
  if (isRunning) {
    logger.info('Waiting up to 30s for running job to finish…');
    setTimeout(() => process.exit(0), 30_000).unref();
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
