# Sanctions & KYC Data Integration

The current fraud monitor uses heuristic sanctions proximity detection (graph distance from known sanctioned addresses). For production compliance, integrate a real sanctions screening provider.

## Recommended Providers

### 1. Chainalysis KYT (Know Your Transaction)
- **Best for**: Real-time transaction monitoring, sanctions screening
- **Integration**: REST API, webhooks
- **Cost**: Enterprise pricing (contact sales)
- **Docs**: https://go.chainalysis.com/chainalysis-kyc-docs.html

```typescript
// src/services/sanctions-chainalysis.ts
import { logger } from '../lib/logger';

const CHAINALYSIS_API_KEY = process.env.CHAINALYSIS_API_KEY;
const CHAINALYSIS_BASE_URL = 'https://api.chainalysis.com/api/kyt/v2';

export async function checkSanctions(
  walletAddress: string
): Promise<{ sanctioned: boolean; exposure: number; risk: string }> {
  if (!CHAINALYSIS_API_KEY) {
    // Fallback to heuristic detection
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
- **Best for**: AML/CFT compliance, counterparty risk
- **Integration**: REST API
- **Cost**: Enterprise pricing
- **Docs**: https://docs.elliptic.co/

### 3. OFAC SDN List (Free)
- **Best for**: Basic sanctions screening (US-only)
- **Integration**: Download CSV, local lookup
- **Cost**: Free (US government data)
- **Source**: https://www.treasury.gov/ofac/downloads/sdn.csv

## Integration Pattern

```typescript
// In fraud-monitor.ts, replace heuristic sanctions with real data:

import { checkSanctions } from './sanctions-chainalysis';

export async function runFraudCheck(walletAddress: string) {
  // ... existing checks ...

  // Real sanctions screening
  const sanctions = await checkSanctions(walletAddress);

  if (sanctions.sanctioned) {
    riskSignals.push({
      type: 'sanctions_proximity',
      severity: 'critical',
      value: 1,
      details: `Wallet directly sanctioned by ${sanctions.provider}`,
    });
  }

  // ... rest of fraud check ...
}
```

## Migration Steps

1. Sign up for Chainalysis KYT or preferred provider
2. Add `CHAINALYSIS_API_KEY` to environment
3. Create `src/services/sanctions-chainalysis.ts` with the provider SDK
4. Update `src/services/fraud-monitor.ts` to call real sanctions API
5. Cache results in `RiskSignal` table (TTL: 24h) to reduce API calls
6. Set up monitoring/alerting for API failures

## Compliance Notes

- **OFAC compliance**: US entities must screen against SDN list
- **EU AMLD5/6**: Requires KYC for crypto transactions above thresholds
- **Travel Rule**: VASP-to-VASP transfers require originator/beneficiary info
- Store audit logs of all sanctions checks for regulatory review
