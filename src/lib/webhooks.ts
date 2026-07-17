/**
 * Webhook subscriptions for reputation events.
 *
 * Operators register a URL; when a reputation event is recorded for a
 * subscribed wallet, we POST the event JSON to the URL.
 *
 * In-memory only — restart loses subscribers. For durability, swap the
 * Map for Redis / a database; the interface stays the same.
 *
 * v0.2.0 roadmap item. Implementation is intentionally minimal — HMAC
 * signing, retry, dead-letter queues are deferred until a real consumer
 * exists.
 */

import { randomUUID } from 'crypto';
import { logger } from './logger';

export interface WebhookSubscriber {
  id: string;
  wallet: string;
  url: string;
  createdAt: string;
}

const subscribers: Map<string, WebhookSubscriber> = new Map();

export function addSubscriber(wallet: string, url: string): WebhookSubscriber {
  const sub: WebhookSubscriber = {
    id: randomUUID(),
    wallet,
    url,
    createdAt: new Date().toISOString(),
  };
  subscribers.set(sub.id, sub);
  return sub;
}

export function removeSubscriber(id: string): boolean {
  return subscribers.delete(id);
}

export function listSubscribers(wallet?: string): WebhookSubscriber[] {
  const all = Array.from(subscribers.values());
  return wallet ? all.filter(s => s.wallet === wallet) : all;
}

/** Fire-and-forget POST to all subscribers of a wallet. */
export async function fireWebhook(wallet: string, payload: unknown): Promise<void> {
  const subs = listSubscribers(wallet);
  if (subs.length === 0) return;

  await Promise.allSettled(subs.map(async (sub) => {
    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Id': sub.id },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        logger.warn('Webhook delivery non-2xx', { id: sub.id, url: sub.url, status: res.status });
      }
    } catch (e) {
      logger.warn('Webhook delivery failed', { id: sub.id, url: sub.url, error: String(e) });
    }
  }));
}

/** Test-only: clear all subscribers. */
export function clearSubscribers(): void {
  subscribers.clear();
}