import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  walletAddress?: string;
  action?: string;
  duration?: number;
  error?: string;
  meta?: Record<string, unknown>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const configuredLevel: LogLevel = config.logLevel;
const LOG_FORMAT: 'json' | 'pretty' = config.logFormat;
const LOG_FILE = config.logFile;
const LOG_ERROR_FILE = config.logErrorFile;

let logStream: fs.WriteStream | null = null;
let errorStream: fs.WriteStream | null = null;
const STDOUT_DISABLED = process.env.LOG_STDOUT === 'false';

if (LOG_FILE) {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
}

if (LOG_ERROR_FILE) {
  const dir = path.dirname(LOG_ERROR_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  errorStream = fs.createWriteStream(LOG_ERROR_FILE, { flags: 'a' });
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel];
}

/**
 * Sanitize a string for log emission: strip ANSI escapes, collapse CR/LF/TAB
 * to single spaces, cap length. Prevents log injection (CRLF in user input
 * could corrupt Datadog/Splunk which expect one-line-per-event JSON).
 * (M1)
 */
function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    let s = value.replace(/\r\n|\r|\n|\t/g, ' ');
    // eslint-disable-next-line no-control-regex
    s = s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    if (s.length > 4096) s = s.slice(0, 4096) + '...[truncated]';
    return s;
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitize(v);
    }
    return out;
  }
  return value;
}

export const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m',  // cyan
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
}
export const LEVEL_RESET = '\x1b[0m'
export const LEVEL_PADDED: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
}

export function formatEntry(entry: LogEntry): string {
  return JSON.stringify(sanitize(entry))
}

export function formatPretty(entry: LogEntry, useColor = process.stdout.isTTY): string {
  const ts = entry.timestamp
  const level = LEVEL_PADDED[entry.level]
  const color = useColor ? LEVEL_COLORS[entry.level] : ''
  const reset = useColor ? LEVEL_RESET : ''
  const { level: _l, timestamp: _t, message: _m, ...rest } = entry
  const meta = Object.keys(rest).length
    ? ' ' + JSON.stringify(sanitize(rest))
    : ''
  return `${ts} ${color}${level}${reset} ${entry.message}${meta}`
}

function writeOutput(line: string, level: LogLevel, pretty: string): void {
  if (logStream) logStream.write(line + '\n')
  if (errorStream && (level === 'error' || level === 'warn')) {
    errorStream.write(line + '\n')
  }
  if (STDOUT_DISABLED) return
  const out = LOG_FORMAT === 'json' ? line : pretty
  if (level === 'error') console.error(out)
  else if (level === 'warn') console.warn(out)
  else if (level === 'debug') console.debug(out)
  else console.log(out)
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('debug')) {
      const entry = {
        level: 'debug', message, timestamp: new Date().toISOString(), ...meta,
      }
      writeOutput(
        formatEntry(entry),
        'debug',
        formatPretty(entry),
      )
    }
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('info')) {
      const entry = {
        level: 'info', message, timestamp: new Date().toISOString(), ...meta,
      }
      writeOutput(
        formatEntry(entry),
        'info',
        formatPretty(entry),
      )
    }
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('warn')) {
      const entry = {
        level: 'warn', message, timestamp: new Date().toISOString(), ...meta,
      }
      writeOutput(
        formatEntry(entry),
        'warn',
        formatPretty(entry),
      )
    }
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('error')) {
      const entry = {
        level: 'error', message, timestamp: new Date().toISOString(), ...meta,
      }
      writeOutput(
        formatEntry(entry),
        'error',
        formatPretty(entry),
      )
    }
  },
}

/** Closes the file streams. Call from graceful shutdown. */
export function closeLoggerStreams(): void {
  logStream?.end();
  errorStream?.end();
  logStream = null;
  errorStream = null;
}