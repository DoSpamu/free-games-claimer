/**
 * Long-running daemon / scheduler for free-games-claimer.
 *
 * Key env vars:
 *   CRON_SCHEDULE     cron expression for daily run, default "0 7 * * *"
 *   TZ                timezone, default "Europe/Warsaw"
 *   RUN_ON_START      "1" to also run immediately on container start
 *   HEALTH_PORT       HTTP port for /health and POST /run, default 8080
 *   CLAIM_STEAM/EPIC/PRIME/GOG  "0" to disable a platform (default all "1")
 *   RETRY_FAILED      "1" (default) to retry failed platforms after 30 min
 *   WEEKLY_DIGEST     "1" (default) to send weekly Sunday summary
 *   DISCORD_WEBHOOK   Discord webhook URL (optional)
 *   LOG_LEVEL         DEBUG | INFO | WARN | ERROR (default INFO)
 *
 * HTTP API:
 *   GET  /health  → JSON status
 *   POST /run     → trigger a run immediately (409 if already running)
 */

import { spawn }        from 'node:child_process';
import http             from 'node:http';
import https            from 'node:https';
import fs               from 'node:fs/promises';
import fsSync           from 'node:fs';
import path             from 'node:path';
import { createRequire } from 'node:module';
import logger           from './src/logger.js';
import {
  notifyOnline,
  notifyJobStart,
  notifyError,
  notifyErrorWithScreenshot,
  notifyJobSummary,
  notifyWeeklyDigest,
  notifyUpstreamUpdate,
} from './src/discord.js';

// ---------------------------------------------------------------------------
// node-cron
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
const CRON_SCHEDULE  = process.env.CRON_SCHEDULE  || '0 7 * * *';
const TZ             = process.env.TZ             || 'Europe/Warsaw';
const HEALTH_PORT    = parseInt(process.env.HEALTH_PORT || '8080', 10);
const RUN_ON_START   = process.env.RUN_ON_START   === '1';
const RETRY_FAILED   = process.env.RETRY_FAILED   !== '0'; // default true
const WEEKLY_DIGEST  = process.env.WEEKLY_DIGEST  !== '0'; // default true

const ALL_SCRIPTS = [
  { name: 'Steam',        file: 'steam-games',  env: 'CLAIM_STEAM',  creds: () => process.env.STEAM_USERNAME },
  { name: 'Epic Games',   file: 'epic-games',   env: 'CLAIM_EPIC',   creds: () => process.env.EG_EMAIL    || process.env.EMAIL },
  { name: 'Prime Gaming', file: 'prime-gaming', env: 'CLAIM_PRIME',  creds: () => process.env.PG_EMAIL    || process.env.EMAIL },
  { name: 'GOG',          file: 'gog',          env: 'CLAIM_GOG',    creds: () => process.env.GOG_EMAIL   || process.env.EMAIL },
];

const SCRIPTS = ALL_SCRIPTS.filter(s => process.env[s.env] !== '0');

if (SCRIPTS.length === 0) {
  logger.error('All platforms disabled (CLAIM_* = 0). Enable at least one.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let isRunning  = false;
let lastRun    = null;
let lastStatus = 'never';
let runCount   = 0;
const retryTimers = new Set();

// ---------------------------------------------------------------------------
// Startup checks
// ---------------------------------------------------------------------------

/** Warn when VNC has no password — port 6080 is open to anyone on the network. */
const checkVncPassword = () => {
  if (!process.env.VNC_PASSWORD) {
    logger.warn('VNC_PASSWORD not set — noVNC on :6080 is accessible without a password!');
  }
};

/** Warn about enabled platforms that have no credentials configured. */
const validateCredentials = () => {
  for (const s of SCRIPTS) {
    if (!s.creds()) {
      logger.warn(`No credentials found for ${s.name} (platform is enabled but email/username not set)`);
    }
  }
};

/** Check if upstream repo has new commits since last known SHA. Notify on Discord if so. */
const checkUpstreamVersion = async () => {
  const shaFile = path.resolve('data', 'upstream-sha.txt');
  const apiUrl  = 'https://api.github.com/repos/p-adamiec/free-games-claimer/commits?sha=enhanced&per_page=1';

  try {
    const json = await new Promise((resolve, reject) => {
      const req = https.get(apiUrl, { headers: { 'User-Agent': 'free-games-claimer' } }, res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error('JSON parse failed')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
    });

    if (!Array.isArray(json) || !json[0]?.sha) return;

    const latestSha  = json[0].sha;
    const commitDate = json[0].commit?.author?.date?.slice(0, 10) || '?';
    const commitUrl  = json[0].html_url || 'https://github.com/p-adamiec/free-games-claimer/commits/enhanced';

    let knownSha = '';
    try { knownSha = (await fs.readFile(shaFile, 'utf8')).trim(); } catch { /* first run */ }

    if (!knownSha) {
      // First run — just store, don't notify
      await fs.mkdir(path.dirname(shaFile), { recursive: true });
      await fs.writeFile(shaFile, latestSha);
      logger.info(`Upstream version recorded: ${latestSha.slice(0, 7)} (${commitDate})`);
    } else if (knownSha !== latestSha) {
      logger.info(`Upstream update available: ${knownSha.slice(0, 7)} → ${latestSha.slice(0, 7)} (${commitDate})`);
      await fs.writeFile(shaFile, latestSha);
      await notifyUpstreamUpdate(commitUrl, commitDate).catch(() => {});
    } else {
      logger.debug(`Upstream up to date: ${latestSha.slice(0, 7)}`);
    }
  } catch (e) {
    logger.debug(`Upstream version check failed: ${e.message}`);
  }
};

// ---------------------------------------------------------------------------
// Screenshot finder — looks for newest PNG written after jobStartTime
// ---------------------------------------------------------------------------
const findRecentScreenshot = async (afterMs) => {
  const dir = path.resolve('data', 'screenshots');
  try {
    const files = await fs.readdir(dir);
    const pngs  = files.filter(f => f.endsWith('.png'));
    const stats = await Promise.all(
      pngs.map(async f => {
        const full = path.join(dir, f);
        const st   = await fs.stat(full);
        return { path: full, mtime: st.mtimeMs };
      })
    );
    const newest = stats
      .filter(s => s.mtime >= afterMs)
      .sort((a, b) => b.mtime - a.mtime)[0];
    return newest?.path || null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Script runner
// ---------------------------------------------------------------------------
const runScript = (file, name) => new Promise(resolve => {
  logger.info(`  → Running: ${name} (node ${file}.js)`);
  const proc = spawn('node', [`${file}.js`], { stdio: 'inherit', env: process.env });

  const slowTimer = setTimeout(() => {
    logger.warn(`  ⚠ ${name} is taking very long — still waiting…`);
  }, 10 * 60 * 1000);

  proc.on('exit', code => {
    clearTimeout(slowTimer);
    if (code === 0) logger.info(`  ✓ ${name} finished OK`);
    else            logger.warn(`  ✗ ${name} exited with code ${code}`);
    resolve(code ?? 1);
  });

  proc.on('error', err => {
    clearTimeout(slowTimer);
    logger.error(`  ✗ ${name} process error: ${err.message}`);
    resolve(1);
  });
});

// ---------------------------------------------------------------------------
// Retry scheduler — retries a single failed script after 30 min
// ---------------------------------------------------------------------------
const scheduleRetry = ({ name, file }) => {
  const DELAY = 30 * 60 * 1000;
  logger.info(`  ↺ Scheduling retry for ${name} in 30 minutes`);

  const timer = setTimeout(async () => {
    retryTimers.delete(timer);
    logger.info(`  ↺ Retrying ${name}…`);
    const jobStart = Date.now();
    const code     = await runScript(file, name);

    if (code !== 0) {
      const screenshot = await findRecentScreenshot(jobStart);
      await notifyErrorWithScreenshot(
        `${name} (retry)`,
        new Error(`Retry also failed (exit code ${code})`),
        screenshot
      ).catch(() => {});
    } else {
      logger.info(`  ✓ ${name} retry succeeded`);
    }
  }, DELAY);

  retryTimers.add(timer);
};

// ---------------------------------------------------------------------------
// Main job
// ---------------------------------------------------------------------------
const runJob = async () => {
  if (isRunning) {
    logger.warn('Job already running — skipping trigger.');
    return;
  }

  isRunning  = true;
  lastStatus = 'running';
  runCount++;
  const job      = logger.job(`Run #${runCount}`);
  const jobStart = Date.now();
  const summary  = {};
  const platforms = SCRIPTS.map(s => s.name);

  await notifyJobStart(platforms).catch(e =>
    logger.warn(`Discord start notification failed: ${e.message}`)
  );

  for (const { name, file } of SCRIPTS) {
    try {
      const code = await runScript(file, name);
      summary[name] = { claimed: 0, error: code !== 0 };

      if (code !== 0) {
        const screenshot = await findRecentScreenshot(jobStart);
        await notifyErrorWithScreenshot(name, new Error(`Script exited with code ${code}`), screenshot)
          .catch(() => {});

        if (RETRY_FAILED) scheduleRetry({ name, file });
      }
    } catch (err) {
      logger.error(`${name} threw: ${err.message}`);
      summary[name] = { claimed: 0, error: true };

      const screenshot = await findRecentScreenshot(jobStart);
      await notifyErrorWithScreenshot(name, err, screenshot).catch(() => {});

      if (RETRY_FAILED) scheduleRetry({ name, file });
    }
  }

  const durationMs = job.elapsed();
  job.done();

  const anyError = Object.values(summary).some(v => v.error);
  lastStatus = anyError ? 'partial' : 'ok';
  lastRun    = new Date().toISOString();

  await notifyJobSummary(durationMs, summary).catch(e =>
    logger.warn(`Discord summary notification failed: ${e.message}`)
  );

  isRunning = false;
};

// ---------------------------------------------------------------------------
// Weekly digest — reads lowdb JSON files, counts claims in last 7 days
// ---------------------------------------------------------------------------
const DB_FILES = [
  { platform: 'Steam',        file: 'steam.json'        },
  { platform: 'Epic Games',   file: 'epic-games.json'   },
  { platform: 'Prime Gaming', file: 'prime-gaming.json' },
  { platform: 'GOG',          file: 'gog.json'          },
];

const getWeeklyStats = async () => {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stats  = [];

  for (const { platform, file } of DB_FILES) {
    const enabled = SCRIPTS.some(s => s.name === platform);
    if (!enabled) continue;

    try {
      const raw  = await fs.readFile(path.resolve('data', file), 'utf8');
      const db   = JSON.parse(raw);
      const games = Array.isArray(db.games) ? db.games : [];

      const claimed = games.filter(g => {
        if (g.status !== 'claimed') return false;
        // time field: "2026-04-08 07:00:00.000" or ISO string
        const t = g.time ? new Date(g.time.replace(' ', 'T') + (g.time.includes('T') ? '' : 'Z')).getTime() : 0;
        return t >= since;
      });

      stats.push({ platform, count: claimed.length, titles: claimed.map(g => g.title).filter(Boolean) });
    } catch {
      stats.push({ platform, count: 0, titles: [] });
    }
  }

  return stats;
};

const runWeeklyDigest = async () => {
  logger.info('Weekly digest: collecting stats…');
  try {
    const stats = await getWeeklyStats();
    await notifyWeeklyDigest(stats);
    logger.info(`Weekly digest sent (${stats.reduce((n, s) => n + s.count, 0)} games total)`);
  } catch (e) {
    logger.error(`Weekly digest failed: ${e.message}`);
  }
};

// ---------------------------------------------------------------------------
// HTTP server — /health and POST /run
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status:    'ok',
      running:   isRunning,
      lastRun,
      lastStatus,
      runCount,
      schedule:  CRON_SCHEDULE,
      timezone:  TZ,
      uptime:    Math.floor(process.uptime()),
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

// ---------------------------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------------------------

if (!cron.validate(CRON_SCHEDULE)) {
  logger.error(`Invalid CRON_SCHEDULE: "${CRON_SCHEDULE}"`);
  process.exit(1);
}

// 1. Sync startup checks
checkVncPassword();
validateCredentials();
logger.info(`Enabled platforms: ${SCRIPTS.map(s => s.name).join(', ')}`);

// 2. Start HTTP server
server.listen(HEALTH_PORT, () => {
  logger.info(`Health server on :${HEALTH_PORT}  (GET /health | POST /run)`);
});

// 3. Daily job cron
cron.schedule(CRON_SCHEDULE, () => {
  logger.info(`Cron fired: ${CRON_SCHEDULE} (TZ: ${TZ})`);
  runJob().catch(e => logger.error('Scheduled run error:', e.message));
}, { timezone: TZ });

logger.info(`Scheduler ready.  Cron: "${CRON_SCHEDULE}"  TZ: ${TZ}`);

// 4. Weekly digest cron (Sundays at 10:00)
if (WEEKLY_DIGEST) {
  const DIGEST_CRON = '0 10 * * 0';
  cron.schedule(DIGEST_CRON, () => {
    runWeeklyDigest().catch(e => logger.error('Weekly digest cron error:', e.message));
  }, { timezone: TZ });
  logger.info(`Weekly digest enabled (${DIGEST_CRON} ${TZ})`);
}

// 5. Async background startup tasks (non-blocking)
Promise.resolve()
  .then(() => checkUpstreamVersion())
  .then(() => notifyOnline(SCRIPTS.map(s => s.name), CRON_SCHEDULE, TZ))
  .catch(e => logger.warn(`Startup async task failed: ${e.message}`));

// 6. Optional immediate run
if (RUN_ON_START) {
  logger.info('RUN_ON_START=1 — triggering immediate run…');
  setImmediate(() => runJob().catch(e => logger.error('Start run error:', e.message)));
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
const shutdown = signal => {
  logger.info(`${signal} received — shutting down…`);
  for (const t of retryTimers) clearTimeout(t);
  server.close();
  if (isRunning) {
    logger.info('Waiting up to 30s for running job to finish…');
    setTimeout(() => process.exit(0), 30_000).unref();
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
