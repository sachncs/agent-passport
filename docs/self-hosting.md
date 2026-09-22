# Self-hosting and deployment

Agent Passport v1.0 is a self-hosted service. The supported deployment unit
is the API container or a Node process behind a reverse proxy. Hosted accounts,
managed billing, and a managed sanctions feed are not part of this release.

## Production configuration

Start from `.env.example` and set, at minimum:

```bash
NODE_ENV=production
HMAC_SECRET=<32-or-more-random-characters>
CORS_ALLOWED_ORIGINS=https://your-console.example
```

Point `ALGOD_URL`, `INDEXER_URL`, and their tokens at the Algorand environment
you intend to use. Keep `OPERATOR_MNEMONIC` and `DEPLOYER_MNEMONIC` in a KMS or
secret manager; do not put them in an image or repository.

## Docker

```bash
docker build --build-arg GIT_COMMIT="$(git rev-parse HEAD)" -t agent-passport-api:1.0.0 .
docker run --rm --env-file .env -p 3000:3000 agent-passport-api:1.0.0
```

The image is multi-stage, runs as `appuser`, uses `tini`, and has a liveness
healthcheck on `/health`. Use `/ready` as the dependency-aware readiness probe
in a load balancer or orchestrator.

## Replicas and persistence

Read endpoints scale horizontally. The idempotency, rate-limit,
system-exposure, and webhook subscriber stores are process-local in v1.0.
Set `REPLICA_COUNT=1` unless you provide a shared implementation for those
stores; the service emits a boot warning when replicas exceed one.

For the full environment matrix, alert rules, shutdown behavior, and SLO
profiles, see [Operations](operations.md) and [Architecture](architecture.md).
