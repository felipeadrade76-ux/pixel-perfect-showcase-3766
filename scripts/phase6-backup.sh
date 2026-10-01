#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Configure DATABASE_URL no ambiente privado.}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/ritmeia-pre-migration-$STAMP.dump"

echo "Criando backup lógico antes de qualquer migração..."
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$OUT"
test -s "$OUT"
echo "Backup criado: $OUT"
