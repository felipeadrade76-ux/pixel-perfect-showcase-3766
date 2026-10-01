#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Configure DATABASE_URL no ambiente privado.}"

echo "Executando preflight SOMENTE LEITURA..."
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/deployment-preflight.sql
echo "RITMEIA_REMOTE_PREFLIGHT_PASSED"
