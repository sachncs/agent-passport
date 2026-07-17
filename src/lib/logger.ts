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
const LOG_FILE = config.logFile;
const LOG_ERROR_FILE = config.logErrorFile;

let logStream: fs.WriteStream | null = null;
let errorStream: fs.WriteStream | null = null;

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

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function writeOutput(line: string, level: LogLevel): void {
  if (logStream) logStream.write(line + '\n');
  if (errorStream && (level === 'error' || level === 'warn')) errorStream.write(line + '\n');
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'debug') console.debug(line);
  else console.log(line);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('debug')) {
      writeOutput(formatEntry({ level: 'debug', message, timestamp: new Date().toISOString(), ...meta }), 'debug');
    }
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('info')) {
      writeOutput(formatEntry({ level: 'info', message, timestamp: new Date().toISOString(), ...meta }), 'info');
    }
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('warn')) {
      writeOutput(formatEntry({ level: 'warn', message, timestamp: new Date().toISOString(), ...meta }), 'warn');
    }
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('error')) {
      writeOutput(formatEntry({ level: 'error', message, timestamp: new Date().toISOString(), ...meta }), 'error');
    }
  },
};

/** Closes the file streams. Call from graceful shutdown. */
export function closeLoggerStreams(): void {
  logStream?.end();
  errorStream?.end();
  logStream = null;
  errorStream = null;
}
