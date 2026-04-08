/**
 * Structured logger with levels and timestamps.
 * Outputs to stdout — visible in `docker logs`.
 *
 * LOG_LEVEL env var controls minimum level (default: INFO).
 */

const LEVELS = {
  DEBUG: { priority: 0, prefix: '[DEBUG]' },
  INFO:  { priority: 1, prefix: '[INFO ]' },
  WARN:  { priority: 2, prefix: '[WARN ]' },
  ERROR: { priority: 3, prefix: '[ERROR]' },
};

const MIN_LEVEL = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
const MIN_PRIORITY = LEVELS[MIN_LEVEL]?.priority ?? 1;

const log = (level, ...args) => {
  const lvl = LEVELS[level];
  if (!lvl || lvl.priority < MIN_PRIORITY) return;
  const ts = new Date().toISOString().replace('T', ' ').replace('Z', '');
  const out = level === 'ERROR' ? console.error : console.log;
  out(`${ts} ${lvl.prefix}`, ...args);
};

export const logger = {
  debug: (...a) => log('DEBUG', ...a),
  info:  (...a) => log('INFO',  ...a),
  warn:  (...a) => log('WARN',  ...a),
  error: (...a) => log('ERROR', ...a),

  /** Log start of a named job, returns a function to call on finish. */
  job: (name) => {
    const t0 = Date.now();
    log('INFO', `>>> JOB START: ${name}`);
    return {
      done: (msg = '') => {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
        log('INFO', `<<< JOB END:   ${name} (${elapsed}s)${msg ? ' – ' + msg : ''}`);
        return Date.now() - t0;
      },
      elapsed: () => Date.now() - t0,
    };
  },
};

export default logger;
