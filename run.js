/**
 * One-shot runner z powiadomieniami Discord dla startu / braku gier / błędów.
 *
 * Powiadomienia o sukcesie (✅) wysyła już util.notify() w każdym skrypcie platformy.
 * Ten plik obsługuje tylko: start kontenera, brak gier, błąd + screenshot.
 *
 * Użycie: node run.js <skrypt1> <skrypt2> ...
 * Przykład: node run.js prime-gaming gog epic-games aliexpress
 */

import { spawn }                          from 'node:child_process';
import { readFile, readdir, stat }        from 'node:fs/promises';
import path                               from 'node:path';
import logger                             from './src/logger.js';
import {
  notifyOnline,
  notifyEmpty,
  notifyErrorWithScreenshot,
} from './src/discord.js';

// ---------------------------------------------------------------------------
// Mapowania
// ---------------------------------------------------------------------------
const NAMES = {
  'prime-gaming': 'Prime Gaming',
  'epic-games':   'Epic Games',
  'gog':          'GOG',
  'steam-games':  'Steam',
  'aliexpress':   'AliExpress',
};

const DB_FILES = {
  'prime-gaming': 'prime-gaming.json',
  'epic-games':   'epic-games.json',
  'gog':          'gog.json',
  'steam-games':  'steam.json',
  'aliexpress':   null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Zlicz gry ze statusem 'claimed' w pliku lowdb JSON. */
const countClaimed = async (file) => {
  if (!file) return 0;
  try {
    const raw = await readFile(path.resolve('data', file), 'utf8');
    const db  = JSON.parse(raw);
    return (db.games || []).filter(g => g.status === 'claimed').length;
  } catch {
    return 0;
  }
};

/** Najnowszy screenshot .png zapisany po czasie `afterMs`. */
const findRecentScreenshot = async (afterMs) => {
  const dir = path.resolve('data', 'screenshots');
  try {
    const files = await readdir(dir);
    const pngs  = files.filter(f => f.endsWith('.png'));
    const stats = await Promise.all(
      pngs.map(async f => {
        const full = path.join(dir, f);
        const s    = await stat(full);
        return { path: full, mtime: s.mtimeMs };
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

/** Uruchom skrypt platformy, zwróć exit code. */
const runScript = (script) => new Promise(resolve => {
  const proc = spawn('node', [`${script}.js`], { stdio: 'inherit', env: process.env });
  proc.on('exit',  code => resolve(code ?? 1));
  proc.on('error', err  => { logger.error(`Process error: ${err.message}`); resolve(1); });
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const scripts = process.argv.slice(2);

if (scripts.length === 0) {
  logger.error('Użycie: node run.js <skrypt1> <skrypt2> ...');
  logger.error('Przykład: node run.js prime-gaming gog epic-games aliexpress');
  process.exit(1);
}

const platforms = scripts.map(s => NAMES[s] || s);
logger.info(`Platformy: ${platforms.join(', ')}`);

// 1. Powiadomienie o starcie kontenera
await notifyOnline(platforms).catch(() => {});

// 2. Każda platforma po kolei
for (const script of scripts) {
  const name      = NAMES[script] || script;
  const dbFile    = DB_FILES[script];
  const startTime = Date.now();

  const countBefore = await countClaimed(dbFile);
  logger.info(`→ ${name}`);

  const code       = await runScript(script);
  const countAfter = await countClaimed(dbFile);
  const newGames   = countAfter - countBefore;

  if (code !== 0) {
    // Błąd — znajdź screenshot i wyślij powiadomienie
    const screenshot = await findRecentScreenshot(startTime);
    logger.warn(`✗ ${name} zakończył się kodem ${code}${screenshot ? ' (screenshot dołączony)' : ''}`);
    await notifyErrorWithScreenshot(
      name,
      new Error(`Skrypt zakończył się z kodem ${code}`),
      screenshot,
    ).catch(() => {});

  } else if (newGames <= 0) {
    // Sukces ale brak nowych gier — util.notify() nie został wywołany, więc my informujemy
    logger.info(`ℹ ${name}: brak nowych gier`);
    await notifyEmpty([name]).catch(() => {});

  } else {
    // Gry odebrane — util.notify() w skrypcie platformy już wysłał ✅
    logger.info(`✓ ${name}: ${newGames} nowych gier (powiadomienie wysłane przez skrypt)`);
  }
}

logger.info('Wszystkie platformy sprawdzone.');
