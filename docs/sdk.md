# SDK installation and examples

Agent Passport v1.0 ships two clients. Both call the API you operate; neither
implies a hosted Agent Passport account or managed billing service.

## TypeScript

```bash
npm install @agent-passport/sdk@1.0.0
```

```ts
import { AgentPassportClient } from "@agent-passport/sdk";

const client = new AgentPassportClient({
  baseUrl: "http://localhost:3000",
});

const result = await client.getScore(
  "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A",
);
console.log(result.trustScore, result.riskLevel);
```

## Python

```bash
python -m pip install agent-passport-sdk==1.0.0
```

```python
from agent_passport import AgentPassportClient

client = AgentPassportClient(base_url="http://localhost:3000")
result = client.get_score(
    "GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"
)
print(result.trust_score, result.risk_level)
```

## Production integration

Set the client `baseUrl`/`base_url` to your own API deployment. For mutating
requests, configure the API's HMAC secret and send the SDK's idempotency
helpers where applicable. The server still owns authentication, replay
protection, rate limits, payment verification, and the final decision boundary.

Retries are bounded and should only be enabled for idempotent reads unless the
caller supplies a stable `Idempotency-Key`. See [API authentication and
idempotency](api.md) and the package READMEs in [`sdk/`](../sdk/).
