/**
 * Discord webhook notifications.
 *
 * Set env var DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
 *
 * Exports:
 *   notifyJobStart(platforms)          – job started
 *   notifySuccess(platform, games)     – games claimed
 *   notifyEmpty(platforms)             – nothing to claim (all platforms done, 0 new)
 *   notifyError(platform, error)       – script threw / exited non-zero
 *   notifyJobSummary(durationMs, rows) – end-of-job digest
 */

import https from 'node:https';
import http from 'node:http';
import logger from './logger.js';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** POST JSON to Discord webhook with retry (exponential backoff). */
const post = async (payload, retries = 3) => {
  if (!WEBHOOK_URL) return;

  const body = JSON.stringify(payload);
  const url = new URL(WEBHOOK_URL);
  const lib = url.protocol === 'https:' ? https : http;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const req = lib.request(
          {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
              'User-Agent': 'free-games-claimer/1.0',
            },
            timeout: 10_000,
          },
          res => {
            // 204 No Content is the normal Discord response
            if (res.statusCode >= 200 && res.statusCode < 300) {
              res.resume();
              resolve();
            } else {
              let data = '';
              res.on('data', c => (data += c));
              res.on('end', () =>
                reject(new Error(`Discord HTTP ${res.statusCode}: ${data.slice(0, 200)}`))
              );
            }
          }
        );
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Discord request timed out')); });
        req.write(body);
        req.end();
      });
      return; // success
    } catch (err) {
      if (attempt === retries) {
        logger.warn(`Discord notification failed after ${retries} attempts: ${err.message}`);
        return; // swallow – notifications must never crash the claimer
      }
      const delay = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
      logger.debug(`Discord attempt ${attempt} failed, retrying in ${delay}ms…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

const ts = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sent at the very beginning of a run.
 * @param {string[]} platforms  e.g. ['Epic', 'GOG', 'Prime Gaming', 'Steam']
 */
export const notifyJobStart = async (platforms = []) => {
  await post({
    embeds: [{
      title: '🚀 Claimer uruchomiony',
      color: 0xFEE75C, // yellow
      description: platforms.length
        ? `Platformy do sprawdzenia: **${platforms.join(', ')}**`
        : 'Rozpoczynam sprawdzanie platform…',
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};

/**
 * Sent when at least one game was claimed on a platform.
 * @param {string} platform  e.g. 'Epic Games'
 * @param {{ title: string, url?: string }[]} games
 */
export const notifySuccess = async (platform, games = []) => {
  const lines = games
    .map(g => g.url ? `• [${g.title}](${g.url})` : `• ${g.title}`)
    .join('\n') || '• (brak szczegółów)';

  await post({
    embeds: [{
      title: `✅ Odebrano gry – ${platform}`,
      color: 0x57F287, // green
      description: lines,
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};

/**
 * Sent at the end of a full run when nothing new was claimed on any platform.
 * @param {string[]} platforms
 */
export const notifyEmpty = async (platforms = []) => {
  await post({
    embeds: [{
      title: 'ℹ️ Brak nowych gier do odebrania',
      color: 0x5865F2, // blurple
      description:
        `Sprawdzone platformy: **${platforms.join(', ')}**\n\n` +
        'Brak nowych ofert – skrypt wykonał się poprawnie.',
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};

/**
 * Sent when a script throws or exits with non-zero code.
 * @param {string} platform
 * @param {Error|string} error
 */
export const notifyError = async (platform, error) => {
  const message = error?.message || String(error);
  const stack = (error?.stack || String(error))
    .split('\n')
    .slice(0, 6)
    .join('\n')
    .slice(0, 800);

  await post({
    embeds: [{
      title: `❌ Błąd – ${platform}`,
      color: 0xED4245, // red
      description:
        `**Komunikat:**\n\`\`\`\n${message.slice(0, 300)}\n\`\`\`` +
        (stack ? `\n**Stack trace:**\n\`\`\`\n${stack}\n\`\`\`` : ''),
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};

/**
 * End-of-job digest embed.
 * @param {number} durationMs
 * @param {Record<string, { claimed: number, error: boolean, games?: {title:string}[] }>} summary
 *   e.g. { 'Epic Games': { claimed: 2, error: false, games: [...] }, 'GOG': { claimed: 0, error: false } }
 */
export const notifyJobSummary = async (durationMs, summary = {}) => {
  const elapsed = (durationMs / 1000).toFixed(1);
  const entries = Object.entries(summary);
  const totalClaimed = entries.reduce((n, [, v]) => n + (v.claimed || 0), 0);
  const hasError = entries.some(([, v]) => v.error);

  const lines = entries.map(([platform, r]) => {
    if (r.error) return `❌ **${platform}**: błąd`;
    if (r.claimed > 0) return `✅ **${platform}**: ${r.claimed} gier`;
    return `ℹ️ **${platform}**: brak nowych`;
  });

  await post({
    embeds: [{
      title: hasError
        ? '📋 Podsumowanie – z błędami'
        : totalClaimed > 0
          ? `📋 Podsumowanie – odebrano ${totalClaimed} gier`
          : '📋 Podsumowanie – brak nowych gier',
      color: hasError ? 0xED4245 : totalClaimed > 0 ? 0x57F287 : 0x5865F2,
      description: lines.join('\n'),
      fields: [{ name: 'Czas wykonania', value: `${elapsed}s`, inline: true }],
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};
