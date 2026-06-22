# API Reference

Base URL: `http://localhost:3000`

Stateless service — no authentication required.

## Endpoints

### GET /score

Compute trust score for an Algorand wallet.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wallet` | string | Yes | Algorand wallet address (58-char base32, `^[A-Z2-7]{58}$`) |

**Response (200):**

```json
{
  "wallet": "SEED_A_001",
  "trustScore": 78,
  "riskLevel": "low",
  "approved": true,
  "recommendedLimit": 585,
  "breakdown": {
    "ageScore": 82,
    "activityScore": 65,
    "volumeScore": 70,
    "velocityScore": 100,
    "complianceScore": 100
  },
  "onChain": {
    "balanceAlgo": 45.2,
    "totalTxns": 120,
    "assetCount": 8,
    "appCount": 3,
    "accountAgeDays": 412,
    "firstSeenRound": 42000000,
    "lastSeenRound": 64600000
  },
  "explanation": [
    "1+ year wallet history",
    "120 transactions — active wallet",
    "Balance: 45.20 ALGO — well-funded",
    "8 assets — diverse portfolio",
    "Strong overall trust profile"
  ]
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Invalid wallet address (must be 58-char base32) |
| 429 | Rate limit exceeded |
| 500 | Internal server error or Algorand API failure |

---

### GET /health

Health check.

**Response (200):**

```json
{
  "status": "ok",
  "service": "Trust Scoring Service",
  "version": "0.1.0",
  "network": "testnet",
  "timestamp": "2026-06-22T10:00:00.000Z"
}
```

---

## Error Format

All errors return:

```json
{
  "error": "Error message",
  "statusCode": 400
}
```

## Rate Limits

| Scope | Limit | Window |
|-------|-------|--------|
| Global | 100 requests | 1 minute |
