#!/bin/bash
set -euo pipefail

# Agent Passport — PostgreSQL restore script
# Usage: ./restore.sh <backup_file.sql.gz>

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "File not found: $BACKUP_FILE"
  exit 1
fi

# Config from environment or defaults
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-agent_passport}"

echo "Restoring ${PGDATABASE} from ${BACKUP_FILE}..."
echo "WARNING: This will drop and recreate all data in ${PGDATABASE}."

read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

gunzip -c "$BACKUP_FILE" | psql \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$PGDATABASE" \
  --single-transaction

echo "Restore complete."
