-- OficinIA deployment preflight: READ ONLY. No customer rows, names or payment details.
-- Run against the intended TEST/preview instance before either migration.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_schema() AS current_schema;
SELECT to_regclass('public.ordens') IS NOT NULL AS ordens_exists;
SELECT
  count(*) AS ordens_count,
  count(*) FILTER (WHERE jsonb_typeof(itens) IS DISTINCT FROM 'array') AS invalid_items_shape,
  count(*) FILTER (WHERE jsonb_typeof(pagamentos) IS DISTINCT FROM 'array') AS invalid_payments_shape,
  count(*) FILTER (WHERE numero !~ '^OS-[0-9]+$') AS legacy_number_format
FROM public.ordens;
SELECT count(*) AS duplicate_owner_numbers
FROM (
  SELECT user_id,numero FROM public.ordens
  GROUP BY user_id,numero HAVING count(*) > 1
) duplicates;
SELECT
  to_regclass('public.cobrancas') IS NOT NULL AS charges_table_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ordens' AND column_name='revisao'
  ) AS order_revision_exists,
  to_regprocedure('public.oficinia_registrar_pagamento(uuid,uuid,numeric,text)') IS NOT NULL AS payment_rpc_exists,
  to_regprocedure('public.oficinia_criar_cobranca(uuid,uuid,numeric,text)') IS NOT NULL AS charge_rpc_exists;
ROLLBACK;
