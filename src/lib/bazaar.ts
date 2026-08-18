/**
 * Static Bazaar catalog loaded from docs/bazaar-metadata.json at startup.
 * In production this would come from a registry or x402 bazaar service;
 * for now we ship a single self-listing. (M5)
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface CatalogEntry {
  id: string;
  type: string;
  category: string;
  name: string;
  description: string;
  tags: string[];
  endpoints: Record<string, string>;
  pricing: Record<string, string>;
  health: string;
}

let catalogCache: CatalogEntry[] | null = null;

function loadCatalog(): CatalogEntry[] {
  if (catalogCache) return catalogCache;
  const paths = [
    join(process.cwd(), 'data', 'bazaar-metadata.json'),
    join(process.cwd(), 'docs', 'bazaar-metadata.json'),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const data = readFileSync(p, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          catalogCache = parsed as CatalogEntry[];
          return catalogCache;
        }
        // OpenAPI-style file: extract x-bazaar block + endpoints.
        if (parsed && typeof parsed === 'object') {
          const info = parsed.info || {};
          const bazaar = parsed['x-bazaar'] || {};
          const tagList = Array.isArray(bazaar.tags) ? bazaar.tags : [];
          catalogCache = [
            {
              id: String(bazaar.id || 'agent-passport'),
              type: String(bazaar.type || 'service'),
              category: String(bazaar.category || 'trust'),
              name: String(info.title || 'Agent Passport'),
              description: String(info.description || ''),
              tags: tagList,
              endpoints: parsed.paths && typeof parsed.paths === 'object'
                ? Object.fromEntries(
                  Object.keys(parsed.paths).slice(0, 50).map(p => [p, p]),
                )
                : {},
              pricing: {},
              health: '/health',
            },
          ];
          return catalogCache;
        }
      } catch { /* fall through to default */ }
    }
  }
  catalogCache = [
    {
      id: 'agent-passport',
      type: 'service',
      category: 'trust',
      name: 'Agent Passport',
      description:
        'Stateless trust scoring, delegation, credit, sybil, reputation, ' +
        'and underwriting for AI agents on Algorand',
      tags: ['trust', 'scoring', 'algorand', 'agent', 'wallet', 'x402'],
      endpoints: {
        score: '/score',
        passport: '/passport',
        underwrite: '/underwrite',
        counterparty: '/counterparty-check',
        delegate: '/delegate',
        revoke: '/revoke',
      },
      pricing: {
        score: '0.001 USDC',
        passport: '0.005 USDC',
        underwrite: '0.01 USDC',
        counterparty: '0.01 USDC',
      },
      health: '/health',
    },
  ];
  return catalogCache;
}

export function getBazaarCatalog(): CatalogEntry[] {
  return loadCatalog();
}

/** Test-only: clear cache. */
export function resetBazaarCache(): void {
  catalogCache = null;
}