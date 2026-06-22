# Agent Passport: Delegated Trust Infrastructure

A pay-per-query trust and underwriting API for AI agents, using delegated-underwriting and x402 micropayments on Algorand.

## Overview

Agent Passport lets AI agents build credibility via sponsor delegations and exposes their trust profile to API providers. Merchants call `GET /passport?wallet=<addr>`, pay a few cents in USDC via x402, and receive a JSON trust report with a composite Trust Score (0-100), sub-scores, and explainable reasons.

Internally, the system maintains a directed sponsor graph where each wallet has a credit budget comprising base budget, delegated credit, earned credit from repayments, and outstanding debt from defaults.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL and ALGO_MNEMONIC
npm run migrate
npm run seed
npm run dev
```

Server runs at `http://localhost:3000`.

### Docker

```bash
docker compose up
```

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Merchant /  │────▶│  Agent Passport  │────▶│  Algorand    │
│  AI Agent    │     │  API (Express)   │     │  USDC (x402) │
└──────────────┘     └────────┬─────────┘     └──────────────┘
                              │
                     ┌────────▼─────────┐     ┌──────────────┐
                     │  PostgreSQL      │     │  Dashboard   │
                     │  (Prisma ORM)    │     │  (Oat UI)    │
                     └──────────────────┘     └──────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system design.

## API Endpoints

### Premium (x402 Payment Required)

| Method | Endpoint | Fee | Description |
|--------|----------|-----|-------------|
| `GET` | `/passport?wallet=...` | $0.005 | Full trust profile with scores, risk level, and explanations |
| `POST` | `/delegate` | $0.01 | Sponsor delegates credit to agent |
| `POST` | `/revoke` | $0.01 | Revoke a delegation |
| `POST` | `/underwrite` | $0.005 | Credit decision with capacity and default analysis |
| `POST` | `/counterparty-check` | $0.01 | Merchant-facing trust lookup |

### Free

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/verify?wallet=...` | Lightweight wallet check with flags |
| `GET` | `/discovery/search?q=trust` | Bazaar service discovery |
| `GET` | `/health` | Health check with DB connectivity |

### Admin (API Key Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/wallet/:address` | Full wallet details |
| `GET` | `/admin/graph` | Sponsor graph (nodes + edges) |
| `GET` | `/admin/stats` | System-wide statistics |
| `GET` | `/admin/delegations` | List all delegations |
| `GET` | `/admin/audit-log` | Audit trail |
| `POST` | `/admin/blacklist` | Blacklist a wallet |
| `DELETE` | `/admin/blacklist/:address` | Remove from blacklist |
| `POST` | `/admin/fraud-check/:address` | Run fraud detection |
| `POST` | `/admin/cache/clear` | Clear expired cache |
| `POST` | `/admin/maintenance/prune-risk-signals` | Prune old risk signals |
| `POST` | `/admin/maintenance/cleanup-idempotency` | Clean expired idempotency records |

See [docs/API.md](docs/API.md) for complete request/response schemas.

## x402 Payment Flow

```
Client                Server                 Algorand
  │                     │                       │
  │  GET /passport      │                       │
  │────────────────────▶│                       │
  │                     │                       │
  │  402 + requirements │                       │
  │◀────────────────────│                       │
  │                     │                       │
  │  [Pay USDC to payTo]│                       │
  │────────────────────────────────────────────▶│
  │                     │                       │
  │  GET /passport      │                       │
  │  + x402-payment     │                       │
  │────────────────────▶│  Verify on-chain      │
  │                     │──────────────────────▶│
  │                     │◀──────────────────────│
  │  200 + trust profile│                       │
  │◀────────────────────│                       │
```

The `x402-payment` header format:

```
x402-payment: <paymentToken> <transactionId> [network]
```

## Trust Scoring

Composite score from weighted sub-scores:

| Component | Weight | Description |
|-----------|--------|-------------|
| Age | 0.20 | Linear + logarithmic ramp over 730 days |
| Sponsor | 0.25 | Average sponsor trust score + count bonus |
| Activity | 0.20 | Transaction volume and consistency |
| Risk | 0.15 | Sybil risk penalty |
| Velocity | 0.10 | Spike detection vs historical average |
| Compliance | 0.10 | Sanctions, mixer, scam flag penalties |

| Risk Level | Score Range |
|------------|-------------|
| `low` | 70-100 |
| `medium` | 45-69 |
| `high` | 20-44 |
| `critical` | 0-19 |

See [docs/TRUST-SCORING.md](docs/TRUST-SCORING.md) for algorithm details.

## Sponsor Graph

```
SEED_A (budget: 10000) ──3000──▶ SPONSOR_X ──500──▶ AGENT_Z
                                        └──300──▶ AGENT_W
SEED_B (budget: 5000)  ──2000──▶ SPONSOR_Y ──400──▶ AGENT_V
                                        └──200──▶ AGENT_Z
```

**Credit Capacity:** `baseBudget + earnedCredit + incoming - outgoing`

**Default Propagation:** Losses distribute proportionally up the sponsor chain.

**Earned Credit:** Grows at 10% of repayments, capped at 5x base + incoming.

## Security

- **Payment verification** — on-chain USDC transfer confirmation
- **Caller identity** — payer derived from verified transaction sender
- **Idempotency** — payment tokens single-use per endpoint
- **Authorization** — delegate/revoke restricted to sponsor wallet
- **Rate limiting** — global + per-wallet + per-endpoint
- **Input validation** — Zod schemas, base32 wallet regex
- **Body limit** — 100KB payload cap
- **Request timeout** — 30s default
- **Dashboard auth** — API key required
- **Audit logging** — all state changes recorded with actor/IP
- **Fraud detection** — velocity, sybil clustering, sanctions proximity

See [docs/SECURITY.md](docs/SECURITY.md) for threat model and details.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `ALGO_NETWORK` | testnet | Algorand network |
| `ALGO_MNEMONIC` | — | Merchant wallet mnemonic (required) |
| `ALGO_USDC_ASSET_ID` | 10458941 | USDC ASA ID |
| `ADMIN_API_KEY` | — | Admin API key (required for admin/dashboard) |
| `X402_PASSPORT_FEE_USDC` | 0.005 | /passport fee |
| `X402_DELEGATE_FEE_USDC` | 0.01 | /delegate and /revoke fee |
| `X402_UNDERWRITE_FEE_USDC` | 0.005 | /underwrite fee |
| `X402_COUNTERPARTY_FEE_USDC` | 0.01 | /counterparty-check fee |
| `TRUST_WEIGHT_*` | various | Trust scoring weights |
| `RATE_LIMIT_*` | various | Rate limit configuration |
| `CORS_ALLOWED_ORIGINS` | localhost:3000 | CORS origins |
| `REQUEST_TIMEOUT_MS` | 30000 | Request timeout |

## cURL Examples

```bash
# Get trust profile (returns 402 first)
curl -i http://localhost:3000/passport?wallet=SEED_A_001

# After paying, retry with payment header
curl -H "x402-payment: <token> <txnId>" \
  http://localhost:3000/passport?wallet=SEED_A_001

# Delegate credit
curl -X POST http://localhost:3000/delegate \
  -H "Content-Type: application/json" \
  -d '{"sponsor":"SEED_A_001","agent":"AGENT_Z_001","amount":500}'

# Free wallet check
curl http://localhost:3000/verify?wallet=AGENT_Z_001

# Admin: view graph
curl -H "X-Admin-API-Key: your-key" http://localhost:3000/admin/graph
```

## Development

```bash
npm run dev          # Start with hot reload
npm run build        # Build TypeScript
npm run typecheck    # Type checking
npm run test         # Run tests (154 passing)
npm run lint         # ESLint
npm run migrate      # Run Prisma migrations
npm run seed         # Seed test data
npm run studio       # Open Prisma Studio
```

## Project Structure

```
src/
├── index.ts                    # Express server, middleware stack
├── seed.ts                     # Database seeder
├── types/index.ts              # TypeScript interfaces
├── middleware/
│   ├── x402.ts                 # x402 paywall + idempotency + verification
│   ├── admin-auth.ts           # API key authentication
│   ├── validate.ts             # Zod schema validation
│   ├── rate-limit-wallet.ts    # Per-wallet rate limiting
│   ├── request-id.ts           # X-Request-ID propagation
│   └── error-handler.ts        # Structured error handling
├── routes/
│   ├── index.ts                # Router + Bazaar discovery + health
│   ├── passport.ts             # GET /passport — trust profile
│   ├── delegate.ts             # POST /delegate + /revoke
│   ├── underwrite.ts           # POST /underwrite — credit decision
│   ├── verify.ts               # GET /verify — lightweight check
│   ├── counterparty-check.ts   # POST /counterparty-check
│   └── admin.ts                # Admin dashboard endpoints
├── services/
│   ├── trust-scoring.ts        # Trust score algorithm (pure computation)
│   ├── sponsor-graph.ts        # Graph operations + credit capacity
│   ├── algorand.ts             # Algorand USDC payment verification
│   ├── fraud-monitor.ts        # Fraud detection (velocity, sybil, sanctions)
│   └── cache.ts                # Trust lookup caching with TTL
├── lib/
│   ├── db.ts                   # PrismaClient singleton
│   ├── graph.ts                # Cycle detection, BFS traversal
│   ├── logger.ts               # Structured JSON logging
│   └── validation.ts           # Zod schemas
├── middleware/__tests__/        # 60 tests
├── lib/__tests__/              # 77 tests
└── services/__tests__/         # 17 tests (154 total)
prisma/
└── schema.prisma               # 10 models
public/
└── dashboard.html              # Operator dashboard (Oat UI)
docs/
├── ARCHITECTURE.md             # System architecture
├── API.md                      # API reference
├── SECURITY.md                 # Security model
├── TRUST-SCORING.md            # Trust algorithm
├── DEPLOYMENT.md               # Deployment guide
├── openapi.yaml                # OpenAPI 3.0 spec
├── postman-collection.json     # Postman collection
└── bazaar-metadata.json        # Bazaar discovery metadata
```

## License

MIT
