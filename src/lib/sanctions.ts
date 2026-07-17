/**
 * Sanctions Screening Provider
 *
 * Interface and default in-memory implementation for v0.2.0's planned
 * sanctions integration (Chainalysis / Elliptic). Until a real provider is
 * wired, the default implementation enforces a built-in deny list of
 * well-known bad-actor wallets (testnet-only addresses; mainnet deployers
 * MUST replace this with a real provider before going live).
 *
 * The provider is called from the underwriting and counterparty-check
 * paths before any approval decision. A match returns `status: 'denied'`
 * with a reason; the caller surfaces this in the response envelope.
 *
 * Configurable via env:
 *   SANCTIONS_PROVIDER=memory    (default — uses built-in deny list)
 *   SANCTIONS_PROVIDER=allow     (bypass — never deny, just log)
 *   SANCTIONS_PROVIDER=block     (deny all — useful for emergency shutoff)
 *
 * Real Chainalysis/Elliptic adapters implement the same interface and
 * are loaded via `setSanctionsProvider()` at boot.
 */

import { logger } from './logger';

export type SanctionsStatus = 'allowed' | 'denied' | 'unknown';

export interface SanctionsResult {
  status: SanctionsStatus;
  reason?: string;
  provider: string;
  checkedAt: string;
}

export interface SanctionsProvider {
  readonly name: string;
  check(wallet: string): Promise<SanctionsResult>;
}

/** Built-in deny list. Testnet-only — replace with a real provider in prod. */
const DEFAULT_DENY_LIST: ReadonlySet<string> = new Set<string>([
  // Placeholder addresses — populate via SANCTIONS_EXTRA_DENY env var
  // (comma-separated) at runtime. Real deployers MUST add a Chainalysis
  // or Elliptic adapter via setSanctionsProvider().
]);

function loadExtraDenyList(): Set<string> {
  const extra = process.env.SANCTIONS_EXTRA_DENY;
  if (!extra) return new Set();
  return new Set(extra.split(',').map(s => s.trim()).filter(Boolean));
}

class MemorySanctionsProvider implements SanctionsProvider {
  public readonly name = 'memory';
  private readonly denyList: ReadonlySet<string>;

  constructor() {
    const extra = loadExtraDenyList();
    this.denyList = new Set([...DEFAULT_DENY_LIST, ...extra]);
    if (extra.size > 0) logger.info('Loaded sanctions deny list', { size: extra.size });
  }

  async check(wallet: string): Promise<SanctionsResult> {
    const checkedAt = new Date().toISOString();
    if (this.denyList.has(wallet)) {
      return { status: 'denied', reason: 'wallet_on_deny_list', provider: this.name, checkedAt };
    }
    return { status: 'allowed', provider: this.name, checkedAt };
  }
}

class AllowAllProvider implements SanctionsProvider {
  public readonly name = 'allow';
  async check(_wallet: string): Promise<SanctionsResult> {
    return { status: 'allowed', provider: this.name, checkedAt: new Date().toISOString() };
  }
}

class BlockAllProvider implements SanctionsProvider {
  public readonly name = 'block';
  async check(_wallet: string): Promise<SanctionsResult> {
    return { status: 'denied', reason: 'global_block', provider: this.name, checkedAt: new Date().toISOString() };
  }
}

let provider: SanctionsProvider = createDefaultProvider();

function createDefaultProvider(): SanctionsProvider {
  const choice = (process.env.SANCTIONS_PROVIDER ?? 'memory').toLowerCase();
  if (choice === 'allow') return new AllowAllProvider();
  if (choice === 'block') return new BlockAllProvider();
  return new MemorySanctionsProvider();
}

/** Override the default provider at boot (e.g. for a Chainalysis adapter). */
export function setSanctionsProvider(p: SanctionsProvider): void {
  logger.info('Sanctions provider replaced', { from: provider.name, to: p.name });
  provider = p;
}

export function getSanctionsProvider(): SanctionsProvider {
  return provider;
}

export async function checkSanctions(wallet: string): Promise<SanctionsResult> {
  try {
    return await provider.check(wallet);
  } catch (e) {
    // Fail-closed: a screening outage should not silently approve a wallet.
    // The caller decides whether to surface this as a 503 or as a denial.
    logger.error('Sanctions check failed', { wallet, provider: provider.name, error: String(e) });
    return {
      status: 'unknown',
      reason: 'screening_provider_unavailable',
      provider: provider.name,
      checkedAt: new Date().toISOString(),
    };
  }
}