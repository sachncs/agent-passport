/**
 * Build metadata captured at compile time.
 *
 * ponytail: a hand-written `package.json` read is fine — Node's fs API
 * keeps this dependency-free. Captured once at module load so route
 * handlers don't hit the filesystem.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface BuildInfo {
  version: string;
  node: string;
  startedAt: string;
}

function readVersion(): string {
  for (const p of [
    join(process.cwd(), 'package.json'),
    join(process.cwd(), '..', 'package.json'),
    join(__dirname, '..', '..', 'package.json'),
  ]) {
    try {
      if (existsSync(p)) {
        const data = JSON.parse(readFileSync(p, 'utf-8'));
        if (typeof data.version === 'string') return data.version;
      }
    } catch {
      // try next path
    }
  }
  return '0.0.0';
}

export const packageVersion = readVersion();
export const buildInfo: BuildInfo = {
  version: packageVersion,
  node: process.version,
  startedAt: new Date().toISOString(),
};