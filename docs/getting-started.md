# Getting Started

This guide gets you from zero to your first trust score, delegation, and
underwriting decision in under five minutes.

> If you prefer to read the full reference, see
> [docs/ARCHITECTURE.md](ARCHITECTURE.md), [docs/API.md](API.md), and
> [docs/DEPLOYMENT.md](DEPLOYMENT.md).

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20.0.0 | The service uses `node:20-alpine` in Docker |
| npm | ≥ 10 | Bundled with Node 20 |
| An Algorand endpoint | public testnet works | Defaults point at AlgoNode |

You do **not** need an Algorand wallet, ALGO, or a database to run the
service. The Algorand public testnet is the default data source.

## 2. Install

```bash
git clone https://github.com/sachn-cs/agent-passport.git
cd agent-passport
npm install
cp .env.example .env
```

The `.env.example` file works as-is. It points at the AlgoNode testnet,
disables x402 payments, and uses sensible defaults for every other
variable.

## 3. Run

```bash
# Development with hot reload
npm run dev

# or, production-style
npm run build && npm start
```

The service binds to `http://localhost:3000`. Confirm it is alive:

```bash
curl -i http://localhost:3000/health
# 200 OK
# {"status":"ok","service":"Agent Passport", ...}
```

## 4. Make Your First Call

### Trust score

```bash
curl -s "http://localhost:3000/score?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX" | jq
```

You will get back a JSON object with a `trustScore` (0–100), a
`riskLevel` (`low` / `medium` / `high` / `critical`), a sub-score
`breakdown`, an `onChain` block, and an `explanation` array.

### Full passport

```bash
curl -s "http://localhost:3000/passport?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX" | jq
```

### Underwriting decision

```bash
curl -s "http://localhost:3000/underwrite?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX" | jq
```

### Health & metrics

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/ready        # 200 or 503
curl -s http://localhost:3000/metrics      # Prometheus format
```

## 5. Use the SDK

### TypeScript

```bash
mkdir my-agent && cd my-agent
npm install @agent-passport/sdk
```

```typescript
// index.ts
import { AgentPassportClient } from '@agent-passport/sdk';

const client = new AgentPassportClient({
  baseUrl: 'http://localhost:3000',
});

const score = await client.getScore(
  'GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX',
);

console.log('Trust score:', score.trustScore, score.riskLevel);
```

```bash
npx tsx index.ts
# Trust score: 78 low
```

### Python

```bash
mkdir my-agent && cd my-agent
python -m venv .venv && source .venv/bin/activate
pip install agent-passport-sdk
```

```python
# main.py
from agent_passport import AgentPassportClient

client = AgentPassportClient(base_url="http://localhost:3000")
score = client.get_score(
    "GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX"
)
print("Trust score:", score["trustScore"], score["riskLevel"])
```

```bash
python main.py
# Trust score: 78 low
```

## 6. Run the Test Suite

```bash
npm test                  # Full suite, including E2E
SKIP_E2E=1 npm test       # Skip the E2E suite that hits the public testnet
npm run lint
npm run typecheck
```

The Python and TypeScript SDKs have their own test commands:

```bash
cd sdk && npm test
cd sdk/python && pytest
```

## 7. Try the On-Chain Endpoints (Optional)

The `/delegate` and `/revoke` routes submit transactions to the Algorand
registry contract. To enable them:

```bash
# 1. Deploy the contracts to testnet
npm run deploy-registry
npm run deploy-reputation

# 2. Set the resulting app IDs and the operator mnemonic in .env
REGISTRY_APP_ID=12345
REPUTATION_APP_ID=67890
OPERATOR_MNEMONIC="word1 word2 ... word25"

# 3. Restart the service
npm run dev
```

Now `POST /delegate` and `POST /revoke` will work. Without these env vars
the routes return `503 REGISTRY_NOT_CONFIGURED`.

## 8. Where to Go Next

| Goal | Read |
|------|------|
| Understand the scoring algorithm | [docs/TRUST-SCORING.md](TRUST-SCORING.md) |
| See the full HTTP surface | [docs/openapi.yaml](openapi.yaml) or [docs/API.md](API.md) |
| Deploy to production | [docs/DEPLOYMENT.md](DEPLOYMENT.md) |
| Wire up metrics & alerts | [docs/OBSERVABILITY.md](OBSERVABILITY.md) |
| Understand the threat model | [docs/SECURITY.md](SECURITY.md) |
| Run load tests | [load-tests/EXECUTION.md](../load-tests/EXECUTION.md) |
| Add a wallet to the sanctions list | [docs/SANCTIONS-INTEGRATION.md](SANCTIONS-INTEGRATION.md) |
| Publish to the Bazaar | `GET /discovery/search` and `docs/bazaar-metadata.json` |

Welcome aboard!
