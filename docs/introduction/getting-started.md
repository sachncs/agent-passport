# Getting Started

This guide gets you from zero to your first trust score, delegation,
and underwriting decision in under five minutes.

> If you prefer to read the full reference, see the
> [docs/README.md](../README.md) index.

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
git clone https://github.com/sachncs/agent-passport.git
cd agent-passport
npm install
cp .env.example .env
```

The `.env.example` file works as-is. It points at the AlgoNode testnet,
disables x402 payments, and uses sensible defaults for every other
variable. See [../operations/environment-variables.md](../operations/environment-variables.md)
for the full env-var table.

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
`breakdown`, an `onChain` block, and an `explanation` array. See
[../concepts/trust-scoring.md](../concepts/trust-scoring.md) for the
math.

### Full passport

```bash
curl -s "http://localhost:3000/passport?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX" | jq
```

The passport bundles trust, delegation, sybil, reputation, credit,
on-chain context, and a tamper-evident SHA-256 checksum. See
[../concepts/passport-document.md](../concepts/passport-document.md).

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

See [../api/health.md](../api/health.md) for the full health surface.

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

See [../development/sdk-typescript.md](../development/sdk-typescript.md).

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

See [../development/sdk-python.md](../development/sdk-python.md).

## 6. Run the Test Suite

```bash
npm test                           # Unit tests (integration suite excluded by default)
npm run test:integration           # Live testnet E2E + integration suite
npm run lint
npm run typecheck
```

The Python and TypeScript SDKs have their own test commands:

```bash
cd sdk && npm test
cd sdk/python && pytest
```

See [../development/testing.md](../development/testing.md).

## 7. Try the On-Chain Endpoints (Optional)

The `/delegate` and `/revoke` routes submit transactions to the Algorand
registry contract. To enable them:

```bash
# 1. Fund a deployer wallet with ≥0.1 ALGO on testnet
#    (https://testnet.algoexplorer.io/dispenser)

# 2. Deploy the contracts
DEPLOYER_MNEMONIC="word1 word2 ... word25" npm run deploy-registry
DEPLOYER_MNEMONIC="word1 word2 ... word25" npm run deploy-reputation

# 3. Set the resulting app IDs and the operator mnemonic in .env
REGISTRY_APP_ID=12345
REPUTATION_APP_ID=67890
OPERATOR_MNEMONIC="word1 word2 ... word25"

# 4. Restart the service
npm run dev
```

Now `POST /delegate` and `POST /revoke` will work. Without these env
vars the routes return `503 REGISTRY_NOT_CONFIGURED`. See
[../architecture/smart-contracts.md](../architecture/smart-contracts.md)
and [../security/operator-wallet.md](../security/operator-wallet.md).

## 8. Where to Go Next

| Goal | Read |
|------|------|
| Understand the scoring algorithm | [../concepts/trust-scoring.md](../concepts/trust-scoring.md) |
| See the full HTTP surface | [../api/README.md](../api/README.md) or [../api/openapi.yaml](../api/openapi.yaml) |
| Deploy to production | [../operations/deployment.md](../operations/deployment.md) |
| Wire up metrics & alerts | [../operations/observability.md](../operations/observability.md) |
| Understand the threat model | [../security/threat-model.md](../security/threat-model.md) |
| Run load tests | [../operations/load-testing.md](../operations/load-testing.md) |
| Add a wallet to the sanctions list | [../security/sanctions-integration.md](../security/sanctions-integration.md) |
| Publish to the Bazaar | `GET /discovery/search` and [../api/health.md](../api/health.md) |

Welcome aboard!
