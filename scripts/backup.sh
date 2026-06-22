#!/bin/bash
set -euo pipefail

# Agent Passport — PostgreSQL backup script
# Usage: ./backup.sh [output_dir]

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${OUTPUT_DIR}/agent_passport_${TIMESTAMP}.sql.gz"

# Config from environment or defaults
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-agent_passport}"

mkdir -p "$OUTPUT_DIR"

echo "Backing up ${PGDATABASE} from ${PGHOST}:${PGPORT}..."

pg_dump \
  -h "$PGHOST" \
  -p "$PGPORT" \
  -U "$PGUSER" \
  -d "$PGDATABASE" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip > "$BACKUP_FILE"

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup saved: ${BACKUP_FILE} (${FILESIZE})"

# Retention: keep last 30 daily backups
BACKUP_COUNT=$(ls -1 "${OUTPUT_DIR}"/agent_passport_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 30 ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - 30))
  ls -1t "${OUTPUT_DIR}"/agent_passport_*.sql.gz | tail -n "$REMOVE_COUNT" | xargs rm -f
  echo "Removed ${REMOVE_COUNT} old backups (keeping 30)"
fi

echo "Done."
