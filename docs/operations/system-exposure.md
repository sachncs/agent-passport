# System Exposure Cap

The underwriting decision engine adds the recommended credit limit
to a **cumulative system exposure** counter, capped at
`MAX_SYSTEM_EXPOSURE = 100_000` USDC. The cap is a "bank reserve
requirement" — the sum of all approved credit across all wallets
must not exceed reserves.

## Why

Without a cap, a misconfigured underwriting engine could approve
unbounded credit. The cap is the second line of defense behind
per-wallet trust thresholds.

## The math

`capToSystemCapacity(recommendedLimit)` at
`src/lib/system-exposure.ts:110`:

```typescript
const remaining = Math.max(0, MAX_SYSTEM_EXPOSURE - totalSystemExposure);
return Math.round(Math.min(recommendedLimit, remaining) * 100) / 100;
```

- `MAX_SYSTEM_EXPOSURE = 100_000`
- `totalSystemExposure` is the sum of every approved `recommendedLimit`
- The function returns the smaller of the requested limit and the
  remaining capacity, rounded to two decimals
- When fully saturated, the function returns `0` (deny any new
  approval)

## Persistence

Cumulative exposure is persisted to
`EXPOSURE_PERSISTENCE_PATH` (default `data/system-exposure.json`):

```json
{
  "total": 42350.50,
  "updatedAt": "2026-06-25T08:25:00.000Z"
}
```

The file is rewritten on every `addSystemExposure` call.
On startup, `loadFromDisk` reads the file and restores the total
(if `total` is a finite number ≥ 0).

A corrupt or missing file is non-fatal — the service starts with
`totalSystemExposure = 0` and logs a warning.

## Lifecycle

| Function | Where | Purpose |
|----------|-------|---------|
| `getSystemExposure()` | `src/lib/system-exposure.ts:65` | Read the current total |
| `addSystemExposure(amount)` | `src/lib/system-exposure.ts:73` | Add + persist + notify |
| `resetSystemExposure()` | `src/lib/system-exposure.ts:84` | Test helper; clears the total |
| `setSystemExposure(amount)` | `src/lib/system-exposure.ts:94` | Restore from disk (called by `loadFromDisk`) |
| `capToSystemCapacity(limit)` | `src/lib/system-exposure.ts:110` | The cap math |
| `onExposureChange(listener)` | `src/lib/system-exposure.ts:119` | Subscribe to changes |

## Listener pattern

Listeners can subscribe to exposure changes via `onExposureChange`:

```typescript
import { onExposureChange } from './lib/system-exposure';

const unsubscribe = onExposureChange((newTotal) => {
  console.log('Total exposure now:', newTotal);
});

// Later:
unsubscribe();
```

Listener errors are caught and swallowed — they will not crash the
service.

## Multi-replica

The exposure counter is in-memory per replica, persisted to a JSON
file. In a multi-replica deployment:

- Each replica has its own counter.
- The persisted file is **not** shared between replicas.
- The effective system exposure is `N × totalSystemExposure`.

For strict consistency, back the counter with Redis (`INCRBY` with
a single key, or a SQL `UPDATE ... RETURNING`).

## Reset semantics

`resetSystemExposure` is exported for tests and for operators who
need to wipe the counter. In production, the service has no admin
endpoint for this — the file must be deleted manually and the
service restarted.

## See also

- [environment-variables.md](environment-variables.md) § System exposure cap
- [../concepts/credit-and-underwriting.md](../concepts/credit-and-underwriting.md)
- [../security/threat-model.md](../security/threat-model.md) § System exposure cap
