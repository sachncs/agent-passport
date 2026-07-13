# TypeScript SDK (`@agent-passport/sdk`)

JavaScript / TypeScript SDK for the [Agent Passport](https://github.com/sachncs/agent-passport) service. Provides strongly-typed access to trust scoring, delegation, credit, sybil, reputation, underwriting, graph analytics, and passport generation for Algorand wallets.

## Installation

```bash
npm install @agent-passport/sdk
```

## Quickstart

```typescript
import { AgentPassportClient } from '@agent-passport/sdk';

const client = new AgentPassportClient({
  baseUrl: 'https://passport.example.com',
  apiKey: process.env.PASSPORT_API_KEY,  // optional
  timeout: 30_000,                        // optional, default 30s
  retries: 3,                             // optional, default 3
});

const score = await client.getScore('GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX');
console.log(score.trustScore, score.riskLevel);
```

## Methods

### Trust

- `getScore(wallet)` — Composite trust score
- `getDelegation(wallet)` — Delegation graph trust
- `checkCounterparty(buyer)` — Merchant counterparty check
- `checkSybil(wallet)` — Sybil cluster risk
- `getTrustGraph(wallet)` — Full trust graph analytics
- `underwrite(wallet)` — Underwriting decision

### Reputation

- `getReputation(wallet)` — Current reputation
- `recordReputationEvent(wallet, eventType, options)` — Record on-chain event

### Credit

- `estimateCredit(wallet, amount?)` — Credit capacity

### Passport

- `getPassport(wallet)` — Full passport document
- `createPassport({ wallet })` — Explicit alias for `getPassport`

### On-chain (requires `REGISTRY_APP_ID > 0` and `OPERATOR_MNEMONIC` set)

- `endorse({ sponsor, agent, amount, idempotencyKey? })` — Submit on-chain delegation
- `revoke({ sponsor, agent, idempotencyKey? })` — Submit on-chain revocation

### Health

- `health()` — Service health check

## x402 Payment Helper

The SDK can automatically handle x402 payment requirements:

```typescript
import { AgentPassportClient } from '@agent-passport/sdk';
import { signAlgorandPayment } from './my-payment-signer';

const client = new AgentPassportClient({
  baseUrl: 'https://passport.example.com',
  onPaymentRequired: async (requirements) => {
    // Sign a USDC payment to satisfy the requirements
    const paymentHeader = await signAlgorandPayment(requirements);
    return { paymentHeader };
  },
});

// If the endpoint requires payment, the SDK will:
// 1. Receive 402 with requirements
// 2. Invoke onPaymentRequired
// 3. Retry with x-payment header
const score = await client.getScore(wallet);
```

## Error Handling

All errors extend `AgentPassportError`:

```typescript
import { AgentPassportClient, NotFoundError, RateLimitError, PaymentRequiredError } from '@agent-passport/sdk';

try {
  const score = await client.getScore(wallet);
} catch (error) {
  if (error instanceof NotFoundError) {
    // wallet not found on testnet
  } else if (error instanceof RateLimitError) {
    // back off for error.retryAfter seconds
  } else if (error instanceof PaymentRequiredError) {
    // pay error.requirements
  } else if (error instanceof AgentPassportError) {
    // generic
  }
}
```

## Idempotency

For mutating calls, pass an `idempotencyKey` to safely retry:

```typescript
await client.endorse({
  sponsor: SPONSOR,
  agent: AGENT,
  amount: 1000,
  idempotencyKey: 'order-12345',
});

// If you retry with the same key + same body, the cached response is returned.
// If you retry with the same key + different body, an IdempotencyError is thrown.
```

See [../operations/idempotency.md](../operations/idempotency.md) for the
server-side semantics.

## Validation

All wallet arguments are validated client-side:

```typescript
await client.getScore('not-a-wallet');
// throws ValidationError: Invalid Algorand wallet address
```

## Versioning

This SDK follows [Semantic Versioning](https://semver.org/).

- PATCH: bug fixes, no API change
- MINOR: new methods or types, backward-compatible
- MAJOR: breaking changes

See [CHANGELOG.md](https://github.com/sachncs/agent-passport/blob/master/sdk/CHANGELOG.md).

## On-chain prerequisites

The `endorse()` and `revoke()` methods submit transactions to
`registry.teal` and require the service to be configured with
`REGISTRY_APP_ID > 0` and `OPERATOR_MNEMONIC`. Without these, the
service returns `503 REGISTRY_NOT_CONFIGURED`. See
[../architecture/smart-contracts.md](../architecture/smart-contracts.md).

## License

MIT
