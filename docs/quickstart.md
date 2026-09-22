# Five-minute local quickstart

This is the shortest supported path to a working Agent Passport service. It
runs the API against the public Algorand testnet and does not require a wallet
or a database.

## Prerequisites

- Node.js 22.23.1 (`.nvmrc` is the source of truth)
- npm 10+
- `curl` and, optionally, `jq`

## Run the API

```bash
git clone https://github.com/sachncs/agent-passport.git
cd agent-passport
npm ci
cp .env.example .env
npm run build
npm start
```

In a second terminal, check liveness:

```bash
curl -s http://localhost:3000/health | jq
```

`/health` is a process liveness check and should return `200` even when the
configured Algorand endpoint is unavailable. `/ready` is dependency-aware and
may return `503` until Algorand is reachable.

## Make a first request

Use a valid 58-character Algorand address:

```bash
curl -s \
  'http://localhost:3000/score?wallet=GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A' \
  | jq '{wallet, trustScore, riskLevel, explanation}'
```

The result is evidence, not identity proof. Read [known limitations](known-limitations.md)
before using a score to gate money, access, or delegation.

## Run the console locally

The Next.js console is a separate deployment but uses the same API contract:

```bash
npm run dev --workspace=@agent-passport/web
```

Open `http://localhost:3001`. Set `NEXT_PUBLIC_API_BASE_URL` when the API is
not running at `http://localhost:3000`.

## Next steps

- [SDK installation and examples](sdk.md)
- [Self-hosting and deployment](self-hosting.md)
- [First API request and endpoint semantics](api.md)
- [Algorithm and scoring reference](concepts.md)
