/**
 * Sanctions Screening Provider
 *
 * Default in-memory implementation. Real deployers replace this with
 * a Chainalysis / Elliptic adapter via the `SanctionsProvider` interface
 * (see setSanctionsProvider in a follow-up PR).
 *
 * The provider is called from the underwriting and counterparty-check
 * paths before any approval decision. A match returns `status: 'denied'`;
 * the caller surfaces this in the response envelope.
 *
 * Configurable via env:
 *   SANCTIONS_EXTRA_DENY=addr1,addr2   additional deny-listed addresses
 *
 * ponytail: dropped AllowAllProvider + BlockAllProvider + the
 * SANCTIONS_PROVIDER env switch. The Memory provider is the only
 * consumer (default), and the other two were speculative escape
 * hatches never wired anywhere.
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

const DEFAULT_DENY_LIST: ReadonlySet<string> = new Set<string>([
  // Placeholder addresses — populate via SANCTIONS_EXTRA_DENY env var
  // (comma-separated) at runtime.
]);

function loadExtraDenyList(): Set<string> {
  const extra = process.env.SANCTIONS_EXTRA_DENY;
  if (!extra) return new Set();
  return new Set(extra.split(',').map(s => s.trim()).filter(Boolean));
}

class MemorySanctionsProvider implements SanctionsProvider {
  public readonly name = 'memory';
  private denyList: ReadonlySet<string>;

  constructor() {
    this.denyList = this.buildDenyList();
  }

  private buildDenyList(): ReadonlySet<string> {
    const extra = loadExtraDenyList();
    if (extra.size > 0) {
      logger.info('Loaded sanctions deny list', { size: extra.size });
    }
    return new Set([...DEFAULT_DENY_LIST, ...extra]);
  }

  /** Test-only: rebuild the deny list from current env. */
  refresh(): void {
    this.denyList = this.buildDenyList();
  }

  async check(wallet: string): Promise<SanctionsResult> {
    const checkedAt = new Date().toISOString();
    if (this.denyList.has(wallet)) {
      return { status: 'denied', reason: 'wallet_on_deny_list', provider: this.name, checkedAt };
    }
    return { status: 'allowed', provider: this.name, checkedAt };
  }
}

let provider: SanctionsProvider = new MemorySanctionsProvider();

export function getSanctionsProvider(): SanctionsProvider {
  return provider;
}

/**
 * Test-only injection point. Real deployments swap providers via a
 * future setSanctionsProvider() in the boot path (see docs/security.md
 * § 14.5 Sanctions).
 */
export function setSanctionsProvider(p: SanctionsProvider): void {
  provider = p;
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