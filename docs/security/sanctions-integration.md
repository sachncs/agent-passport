# Sanctions & KYC Data Integration

> **Status: future integration.** The service does not currently
> integrate with any sanctions or KYC provider. This document
> describes the integration pattern for a future addition.

The current fraud detection uses heuristic sybil clustering
(creation clustering, interaction density, balance similarity,
circular activity, etc.) plus the wallet's on-chain history. For
production compliance with US OFAC, EU AMLD5/6, or FATF Travel
Rule, integrate a real sanctions screening provider.

## Recommended providers

### 1. Chainalysis KYT (Know Your Transaction)

- **Best for:** Real-time transaction monitoring, sanctions
  screening
- **Integration:** REST API, webhooks
- **Cost:** Enterprise pricing (contact sales)
- **Docs:** https://go.chainalysis.com/chainalysis-kyc-docs.html

```typescript
// Future location: src/lib/sanctions-chainalysis.ts
import { logger } from './logger';

const CHAINALYSIS_API_KEY = process.env.CHAINALYSIS_API_KEY;
const CHAINALYSIS_BASE_URL = 'https://api.chainalysis.com/api/kyt/v2';

export async function checkSanctions(
  walletAddress: string
): Promise<{ sanctioned: boolean; exposure: number; risk: string }> {
  if (!CHAINALYSIS_API_KEY) {
    return { sanctioned: false, exposure: 0, risk: 'unknown' };
  }

  try {
    const res = await fetch(
      `${CHAINALYSIS_BASE_URL}/addresses/${walletAddress}`,
      {
        headers: {
          'Authorization': `Bearer ${CHAINALYSIS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      logger.warn('Chainalysis API error', { status: res.status });
      return { sanctioned: false, exposure: 0, risk: 'error' };
    }

    const data = await res.json();
    const sanctioned = data.category === 'Sanctions';
    const exposure = data.totalReceived || 0;

    return {
      sanctioned,
      exposure,
      risk: sanctioned ? 'critical' : exposure > 0 ? 'high' : 'low',
    };
  } catch (err) {
    logger.error('Sanctions check failed', { error: String(err) });
    return { sanctioned: false, exposure: 0, risk: 'error' };
  }
}
```

### 2. Elliptic

- **Best for:** AML/CFT compliance, counterparty risk
- **Integration:** REST API
- **Cost:** Enterprise pricing
- **Docs:** https://docs.elliptic.co/

### 3. OFAC SDN List (Free)

- **Best for:** Basic sanctions screening (US-only)
- **Integration:** Download CSV, local lookup
- **Cost:** Free (US government data)
- **Source:** https://www.treasury.gov/ofac/downloads/sdn.csv

A local SDN lookup is the lightest-weight option: download the CSV
on a schedule, parse it, and store wallet addresses in a sorted
array or bloom filter. Lookup is O(log n) or O(1) and has no
runtime cost beyond the initial parse.

## Integration pattern

When the integration is added, the recommended seam is in
`src/lib/sybil.ts:detectSybil` — augment the result with a
`sanctions` field:

```typescript
export interface SybilResult {
  // ... existing fields
  sanctions?: {
    provider: 'chainalysis' | 'elliptic' | 'ofac-sdn';
    sanctioned: boolean;
    exposure: number;
    risk: 'low' | 'medium' | 'high' | 'critical' | 'error';
    checkedAt: string;
  };
}
```

The underwriting engine should treat `sanctions.sanctioned` as
an automatic deny:

```typescript
if (sybilResult.sanctions?.sanctioned) {
  return {
    approved: false,
    recommendedLimit: 0,
    riskLevel: 'critical',
    confidence: sybilResult.confidence,
    compositeScore: 0,
    factors: [...factors, {
      name: 'sanctions',
      score: 0,
      weight: 1.0,
      contribution: 0,
      status: 'negative',
    }],
    explanation: [`Wallet sanctioned per ${sybilResult.sanctions.provider}`],
  };
}
```

## Migration steps

1. Sign up for Chainalysis KYT or preferred provider
2. Add `CHAINALYSIS_API_KEY` to environment
3. Create `src/lib/sanctions-chainalysis.ts` (skeleton above)
4. Wire into `detectSybil` in `src/sybil.ts`
5. Cache results with TTL 24h to reduce API calls
6. Set up monitoring/alerting for API failures
7. Add a runbook under `alerts/runbooks/`
8. Update the threat model in
   [threat-model.md](threat-model.md)

## Compliance notes

- **OFAC compliance:** US entities must screen against SDN list
- **EU AMLD5/6:** Requires KYC for crypto transactions above
  thresholds
- **Travel Rule:** VASP-to-VASP transfers require originator /
  beneficiary info
- **Audit log:** Store every sanctions check result for regulatory
  review

## See also

- [threat-model.md](threat-model.md) § Trust assumptions
- [../concepts/sybil-detection.md](../concepts/sybil-detection.md)
- [../concepts/credit-and-underwriting.md](../concepts/credit-and-underwriting.md)
