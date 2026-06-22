import * as fs from 'fs';
import * as path from 'path';

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

const configuredLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const LOG_FILE = process.env.LOG_FILE;
const LOG_ERROR_FILE = process.env.LOG_ERROR_FILE;

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
  if (logStream) {
    logStream.write(line + '\n');
  }
  if (errorStream && (level === 'error' || level === 'warn')) {
    errorStream.write(line + '\n');
  }
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else if (level === 'debug') {
    console.debug(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('debug')) {
      const line = formatEntry({ level: 'debug', message, timestamp: new Date().toISOString(), ...meta });
      writeOutput(line, 'debug');
    }
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('info')) {
      const line = formatEntry({ level: 'info', message, timestamp: new Date().toISOString(), ...meta });
      writeOutput(line, 'info');
    }
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('warn')) {
      const line = formatEntry({ level: 'warn', message, timestamp: new Date().toISOString(), ...meta });
      writeOutput(line, 'warn');
    }
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (shouldLog('error')) {
      const line = formatEntry({ level: 'error', message, timestamp: new Date().toISOString(), ...meta });
      writeOutput(line, 'error');
    }
  },
};

export function createRequestLogger(requestId: string) {
  return {
    info: (message: string, meta?: Record<string, unknown>) =>
      logger.info(message, { requestId, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) =>
      logger.warn(message, { requestId, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) =>
      logger.error(message, { requestId, ...meta }),
    debug: (message: string, meta?: Record<string, unknown>) =>
      logger.debug(message, { requestId, ...meta }),
  };
}
