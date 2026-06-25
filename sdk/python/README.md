# Agent Passport Python SDK

Python SDK for the [Agent Passport](https://github.com/anomalyco/agent-passport) service. Provides typed access to trust scoring, delegation, credit, sybil, reputation, underwriting, graph analytics, and passport generation for Algorand wallets.

## Installation

```bash
pip install agent-passport-sdk
```

## Quickstart

```python
from agent_passport import AgentPassportClient

client = AgentPassportClient(
    base_url="https://passport.example.com",
    api_key="your-api-key",  # optional
    timeout=30,
    retries=3,
)

score = client.get_score("GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX")
print(score["trustScore"], score["riskLevel"])
```

## Methods

### Trust
- `get_score(wallet)` — Composite trust score
- `get_delegation(wallet)` — Delegation graph trust
- `check_counterparty(buyer)` — Merchant counterparty check
- `check_sybil(wallet)` — Sybil cluster risk
- `get_trust_graph(wallet)` — Full trust graph analytics
- `underwrite(wallet)` — Underwriting decision

### Reputation
- `get_reputation(wallet)` — Current reputation
- `record_reputation_event(wallet, event_type, amount=None, counterparty=None, idempotency_key=None)` — Record on-chain event

### Credit
- `estimate_credit(wallet, amount=None)` — Credit capacity

### Passport
- `get_passport(wallet)` — Full passport document
- `create_passport(wallet)` — Explicit alias for `get_passport`

### On-chain (requires `REGISTRY_APP_ID > 0`)
- `endorse(EndorsementRequest(sponsor, agent, amount, idempotency_key=None))` — Submit on-chain delegation
- `revoke(RevocationRequest(sponsor, agent, idempotency_key=None))` — Submit on-chain revocation

### Health
- `health()` — Service health check

## x402 Payment Helper

```python
from agent_passport import (
    AgentPassportClient,
    PaymentRequirements,
    PaymentProof,
)

def sign_payment(req: PaymentRequirements) -> PaymentProof:
    # Use your wallet to sign a USDC payment to req.pay_to
    return PaymentProof(payment_header="signed-tx-here")

client = AgentPassportClient(
    base_url="https://passport.example.com",
    on_payment_required=sign_payment,
)
```

## Error Handling

```python
from agent_passport import (
    AgentPassportClient,
    NotFoundError,
    RateLimitError,
    PaymentRequiredError,
    AgentPassportError,
)

try:
    score = client.get_score(wallet)
except NotFoundError:
    print("Wallet not found on testnet")
except RateLimitError as e:
    print(f"Back off for {e.retry_after}s")
except PaymentRequiredError as e:
    print(f"Pay {e.requirements['amount']} to {e.requirements['payTo']}")
except AgentPassportError as e:
    print(f"Error {e.status_code}: {e}")
```

## Idempotency

```python
from agent_passport import EndorsementRequest

client.endorse(EndorsementRequest(
    sponsor=SPONSOR,
    agent=AGENT,
    amount=1000,
    idempotency_key="order-12345",
))
# Retry with the same key + same body returns cached response.
# Same key + different body raises IdempotencyError.
```

## Validation

All wallet arguments are validated client-side:

```python
client.get_score("not-a-wallet")
# raises ValidationError: Invalid Algorand wallet address
```

## Versioning

This SDK follows [Semantic Versioning](https://semver.org/).
- PATCH: bug fixes
- MINOR: new methods or types
- MAJOR: breaking changes

See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT
