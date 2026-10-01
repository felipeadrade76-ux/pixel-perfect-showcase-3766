#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?Configure DATABASE_URL no ambiente privado.}"

if [[ "${RITMEIA_APPLY_MIGRATIONS:-}" != "YES_I_HAVE_A_BACKUP" ]]; then
  echo "Bloqueado: defina RITMEIA_APPLY_MIGRATIONS=YES_I_HAVE_A_BACKUP somente depois do backup e preflight." >&2
  exit 2
fi

migrations=(
  supabase/migrations/20260927193602_fd1d9671-18d6-440f-a56d-3b5e9af0b8db.sql
  supabase/migrations/20260927230000_oficinia_integridade.sql
  supabase/migrations/20260927233000_cobranca_assistida.sql
  supabase/migrations/20260928010000_auditoria_regressao.sql
  supabase/migrations/20260928220000_clientes_equipamentos.sql
  supabase/migrations/20260929010000_preparacao_nfse.sql
  supabase/migrations/20261001090000_cnpj_alfanumerico.sql
)

for migration in "${migrations[@]}"; do
  echo "Aplicando $migration"
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration"
done

echo "RITMEIA_MIGRATIONS_APPLIED"
