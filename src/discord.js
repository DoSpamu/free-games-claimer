/**
 * Discord webhook notifications.
 *
 * Set env var DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
 *
 * Exports:
 *   notifyFromHtml(title, html)                        – called by util.notify(); converts game-list HTML to embed
 *   notifyOnline(platforms, schedule, tz)              – container came online
 *   notifyJobStart(platforms)                          – job started
 *   notifySuccess(platform, games)                     – games claimed
 *   notifyEmpty(platforms)                             – nothing to claim
 *   notifyError(platform, error)                       – script threw / exited non-zero
 *   notifyErrorWithScreenshot(platform, error, path)   – error + screenshot attachment
 *   notifyJobSummary(durationMs, summary)              – end-of-job digest
 *   notifyWeeklyDigest(stats)                          – weekly claimed-games summary
 *   notifyUpstreamUpdate(commitUrl, date)              – upstream repo has new commits
 */

import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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
      return;
    } catch (err) {
      if (attempt === retries) {
        logger.warn(`Discord notification failed after ${retries} attempts: ${err.message}`);
        return;
      }
      const delay = 1000 * 2 ** (attempt - 1);
      logger.debug(`Discord attempt ${attempt} failed, retrying in ${delay}ms…`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

/**
 * POST multipart/form-data to Discord webhook — used for file attachments.
 * Sends embed JSON + one binary file (e.g. screenshot PNG).
 */
const postWithFile = async (embeds, filePath) => {
  if (!WEBHOOK_URL) return;
  if (!filePath) return post({ embeds });

  let fileData;
  try {
    fileData = fs.readFileSync(filePath);
  } catch {
    logger.warn(`Discord: screenshot not readable (${filePath}), sending embed only`);
    return post({ embeds });
  }

  const filename = path.basename(filePath);
  const boundary = `----FGCBoundary${Date.now()}`;
  const payloadJson = JSON.stringify({
    embeds: embeds.map(e => ({ ...e, image: { url: `attachment://${filename}` } })),
  });

  const CRLF = '\r\n';
  const parts = [
    `--${boundary}${CRLF}`,
    `Content-Disposition: form-data; name="payload_json"${CRLF}`,
    `Content-Type: application/json${CRLF}${CRLF}`,
    payloadJson, CRLF,
    `--${boundary}${CRLF}`,
    `Content-Disposition: form-data; name="files[0]"; filename="${filename}"${CRLF}`,
    `Content-Type: image/png${CRLF}${CRLF}`,
  ];

  const header = Buffer.from(parts.join(''));
  const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
  const body   = Buffer.concat([header, fileData, footer]);

  const url = new URL(WEBHOOK_URL);
  const lib = url.protocol === 'https:' ? https : http;

  await new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          'User-Agent': 'free-games-claimer/1.0',
        },
        timeout: 15_000,
      },
      res => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          res.resume(); resolve();
        } else {
          let data = '';
          res.on('data', c => (data += c));
          res.on('end', () => reject(new Error(`Discord HTTP ${res.statusCode}: ${data.slice(0, 200)}`)));
        }
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Discord file upload timed out')); });
    req.write(body);
    req.end();
  }).catch(e => {
    logger.warn(`Discord screenshot upload failed: ${e.message} – retrying without screenshot`);
    return post({ embeds });
  });
};

const ts = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Called once when the container/scheduler starts.
 * Lets you know the daemon is alive even before the first job runs.
 */
export const notifyOnline = async (platforms = [], schedule = '', tz = '') => {
  await post({
    embeds: [{
      title: '🟢 Claimer online',
      color: 0x57F287,
      description:
        `Scheduler uruchomiony i gotowy.\n\n` +
        (platforms.length ? `**Platformy:** ${platforms.join(', ')}\n` : '') +
        (schedule ? `**Harmonogram:** \`${schedule}\` (${tz})\n` : ''),
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};

/**
 * Convert HTML game list (from html_game_list()) to Discord markdown embed.
 * Called automatically by util.notify() — no changes needed in platform scripts.
 */
export const notifyFromHtml = async (title, html) => {
  if (!WEBHOOK_URL) return;

  const text = html
    .replace(/<a href="([^"]+)">([^<]+)<\/a>/gi, '[$2]($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .trim();

  await post({
    embeds: [{
      title: `✅ ${title}`,
      color: 0x57F287,
      description: text.slice(0, 2000) || '(brak szczegółów)',
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};

export const notifyJobStart = async (platforms = []) => {
  await post({
    embeds: [{
      title: '🚀 Claimer uruchomiony',
      color: 0xFEE75C,
      description: platforms.length
        ? `Platformy do sprawdzenia: **${platforms.join(', ')}**`
        : 'Rozpoczynam sprawdzanie platform…',
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};

export const notifySuccess = async (platform, games = []) => {
  const lines = games
    .map(g => g.url ? `• [${g.title}](${g.url})` : `• ${g.title}`)
    .join('\n') || '• (brak szczegółów)';

  await post({
    embeds: [{
      title: `✅ Odebrano gry – ${platform}`,
      color: 0x57F287,
      description: lines,
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};

export const notifyEmpty = async (platforms = []) => {
  await post({
    embeds: [{
      title: 'ℹ️ Brak nowych gier do odebrania',
      color: 0x5865F2,
      description:
        `Sprawdzone platformy: **${platforms.join(', ')}**\n\n` +
        'Brak nowych ofert – skrypt wykonał się poprawnie.',
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};

export const notifyError = async (platform, error) => {
  const message = error?.message || String(error);
  const stack = (error?.stack || String(error))
    .split('\n').slice(0, 6).join('\n').slice(0, 800);

  await post({
    embeds: [{
      title: `❌ Błąd – ${platform}`,
      color: 0xED4245,
      description:
        `**Komunikat:**\n\`\`\`\n${message.slice(0, 300)}\n\`\`\`` +
        (stack ? `\n**Stack trace:**\n\`\`\`\n${stack}\n\`\`\`` : ''),
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};

/**
 * Like notifyError but attaches the most recent screenshot PNG as an image.
 * @param {string} platform
 * @param {Error|string} error
 * @param {string|null} screenshotPath  absolute path to .png, or null to skip
 */
export const notifyErrorWithScreenshot = async (platform, error, screenshotPath = null) => {
  if (!WEBHOOK_URL) return;

  const message = error?.message || String(error);
  const stack = (error?.stack || String(error))
    .split('\n').slice(0, 6).join('\n').slice(0, 800);

  const embed = {
    title: `❌ Błąd – ${platform}`,
    color: 0xED4245,
    description:
      `**Komunikat:**\n\`\`\`\n${message.slice(0, 300)}\n\`\`\`` +
      (stack ? `\n**Stack trace:**\n\`\`\`\n${stack}\n\`\`\`` : ''),
    timestamp: ts(),
    footer: { text: screenshotPath ? 'free-games-claimer • screenshot dołączony' : 'free-games-claimer' },
  };

  await postWithFile([embed], screenshotPath);
};

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

/**
 * Weekly Sunday digest — total games claimed in the last 7 days per platform.
 * @param {{ platform: string, count: number, titles: string[] }[]} stats
 */
export const notifyWeeklyDigest = async (stats = []) => {
  const total = stats.reduce((n, s) => n + s.count, 0);

  const lines = stats.map(s =>
    s.count > 0
      ? `✅ **${s.platform}**: ${s.count} gier\n${s.titles.map(t => `  • ${t}`).join('\n')}`
      : `ℹ️ **${s.platform}**: brak`
  );

  await post({
    embeds: [{
      title: total > 0
        ? `📅 Tygodniowe podsumowanie – ${total} gier`
        : '📅 Tygodniowe podsumowanie – brak nowych gier',
      color: total > 0 ? 0x9B59B6 : 0x5865F2, // purple / blurple
      description: lines.join('\n\n') || 'Brak danych.',
      timestamp: ts(),
      footer: { text: 'free-games-claimer • ostatnie 7 dni' },
    }],
  });
};

/**
 * Sent when upstream repo has commits newer than last known.
 */
export const notifyUpstreamUpdate = async (commitUrl, commitDate) => {
  await post({
    embeds: [{
      title: '🔄 Dostępna aktualizacja upstream',
      color: 0xF1C40F,
      description:
        `Repozytorium [p-adamiec/free-games-claimer](https://github.com/p-adamiec/free-games-claimer/tree/enhanced) ` +
        `ma nowe commity.\n\n` +
        `**Ostatni commit:** ${commitDate}\n` +
        `**Link:** ${commitUrl}\n\n` +
        `Rozważ przebudowanie obrazu w Portainerze.`,
      timestamp: ts(),
      footer: { text: 'free-games-claimer' },
    }],
  });
};
