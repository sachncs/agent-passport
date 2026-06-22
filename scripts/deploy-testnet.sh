#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Agent Passport Testnet Deployment ==="
echo ""

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Error: docker not found"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || COMPOSE_CMD="docker compose" || COMPOSE_CMD="docker-compose"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

# Check .env file
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo "Creating .env from .env.example..."
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo "Please edit .env with your configuration before continuing."
  echo "Required: ALGO_MNEMONIC, ADMIN_API_KEY, DATABASE_URL"
  exit 1
fi

# Source .env to check required vars
source "$PROJECT_DIR/.env"

missing_vars=()
[ -z "${ALGO_MNEMONIC:-}" ] && missing_vars+=("ALGO_MNEMONIC")
[ -z "${ADMIN_API_KEY:-}" ] && missing_vars+=("ADMIN_API_KEY")

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo "Error: Missing required environment variables:"
  printf '  - %s\n' "${missing_vars[@]}"
  echo "Please set them in .env"
  exit 1
fi

echo "1. Starting PostgreSQL..."
$COMPOSE_CMD up -d postgres
echo "Waiting for PostgreSQL to be ready..."
sleep 5

echo "2. Running database migrations..."
cd "$PROJECT_DIR"
npx prisma migrate deploy

echo "3. Seeding database..."
npx tsx src/seed.ts || echo "Warning: Seed failed (may already be seeded)"

echo "4. Starting Agent Passport API..."
$COMPOSE_CMD up -d api

echo ""
echo "=== Deployment Complete ==="
echo "API:        http://localhost:${PORT:-3000}"
echo "Dashboard:  http://localhost:${PORT:-3000}/dashboard.html"
echo "Health:     http://localhost:${PORT:-3000}/health"
echo "Network:    ${ALGO_NETWORK:-testnet}"
echo ""
echo "Admin API:  Use header X-Admin-API-Key: ${ADMIN_API_KEY}"
echo ""
echo "To view logs: $COMPOSE_CMD logs -f api"
echo "To stop:      $COMPOSE_CMD down"
