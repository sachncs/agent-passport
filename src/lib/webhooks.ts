/**
 * Webhook subscriptions for reputation events.
 *
 * Operators register a URL; when a reputation event is recorded for a
 * subscribed wallet, we POST the event JSON to the URL.
 *
 * v0.2.0 features:
 * - HMAC signing per subscriber (X-Webhook-Signature header)
 * - SSRF protection (URL validation rejects private IPs, non-HTTPS in prod)
 * - Persistence to data/webhooks.json
 */

import { createHmac, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { logger } from './logger';

interface WebhookSubscriber {
  id: string;
  wallet: string;
  url: string;
  secret: string;
  createdAt: string;
}

const PERSISTENCE_PATH = process.env.WEBHOOKS_PERSISTENCE_PATH
  || join(process.cwd(), 'data', 'webhooks.json');
const PERSISTENCE_DISABLED = process.env.NODE_ENV === 'test';

const subscribers: Map<string, WebhookSubscriber> = new Map();
let loaded = false;

function loadFromDisk(): void {
  if (loaded) return;
  loaded = true;
  if (PERSISTENCE_DISABLED) return;
  try {
    if (existsSync(PERSISTENCE_PATH)) {
      const data = readFileSync(PERSISTENCE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        for (const sub of parsed) {
          if (sub && typeof sub.id === 'string') {
            subscribers.set(sub.id, sub as WebhookSubscriber);
          }
        }
      }
    }
  } catch (e) {
    logger.warn('Failed to load webhook subscribers', { error: String(e) });
  }
}

function persistToDisk(): void {
  if (PERSISTENCE_DISABLED) return;
  try {
    const dir = dirname(PERSISTENCE_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = PERSISTENCE_PATH + '.tmp';
    writeFileSync(
      tmp,
      JSON.stringify(Array.from(subscribers.values()), null, 2),
      { mode: 0o600 },
    );
    renameSync(tmp, PERSISTENCE_PATH);
  } catch (e) {
    logger.warn('Failed to persist webhook subscribers', { error: String(e) });
  }
}

function isPrivateOrLoopback(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower === '0.0.0.0' || lower === '::1' || lower === '[::1]') return true;
  if (lower.startsWith('127.') || lower.startsWith('10.') || lower.startsWith('192.168.')) return true;
  if (lower.startsWith('169.254.')) return true; // link-local / AWS metadata
  if (lower.startsWith('172.')) {
    const second = parseInt(lower.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (lower.endsWith('.local') || lower.endsWith('.internal')) return true;
  return false;
}

export interface UrlValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validate a webhook URL. Rejects:
 * - Non-http(s) schemes
 * - URLs with userinfo (user:pass@host)
 * - Fragments
 * - Loopback / private / link-local hostnames
 * - In production (NODE_ENV=production), non-HTTPS
 */
export function validateWebhookUrl(url: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'Malformed URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Protocol must be http or https' };
  }
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'HTTPS required in production' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Userinfo not allowed' };
  }
  if (parsed.hash) {
    return { ok: false, reason: 'Fragment not allowed' };
  }
  if (isPrivateOrLoopback(parsed.hostname)) {
    return { ok: false, reason: 'Private/loopback/link-local hosts are not allowed' };
  }
  return { ok: true };
}

export function addSubscriber(wallet: string, url: string): WebhookSubscriber {
  loadFromDisk();
  const sub: WebhookSubscriber = {
    id: randomUUID(),
    wallet,
    url,
    secret: randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''),
    createdAt: new Date().toISOString(),
  };
  subscribers.set(sub.id, sub);
  persistToDisk();
  return sub;
}

export function removeSubscriber(id: string): boolean {
  loadFromDisk();
  const deleted = subscribers.delete(id);
  if (deleted) persistToDisk();
  return deleted;
}

export function listSubscribers(wallet?: string): WebhookSubscriber[] {
  loadFromDisk();
  const all = Array.from(subscribers.values());
  return wallet ? all.filter(s => s.wallet === wallet) : all;
}

function sign(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

/** Fire-and-forget POST to all subscribers of a wallet. */
export async function fireWebhook(
  wallet: string,
  payload: unknown,
): Promise<void> {
  loadFromDisk();
  const subs = listSubscribers(wallet);
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.allSettled(subs.map(async (sub) => {
    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': sub.id,
          'X-Webhook-Signature': sign(sub.secret, body),
          'X-Webhook-Timestamp': new Date().toISOString(),
        },
        body,
        signal: AbortSignal.timeout(3_000),
      });
      if (!res.ok) {
        logger.warn('Webhook delivery non-2xx', { id: sub.id, url: sub.url, status: res.status });
      }
    } catch (e) {
      logger.warn('Webhook delivery failed', { id: sub.id, url: sub.url, error: String(e) });
    }
  }));
}

/** Test-only: clear all subscribers and reset load flag. */
export function clearSubscribers(): void {
  subscribers.clear();
  loaded = false;
}