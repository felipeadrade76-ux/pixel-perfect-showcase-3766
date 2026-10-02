-- Ritmeia deployment preflight: READ ONLY.
-- It reports schema/count health only; it does not print customer names, documents or payment details.
BEGIN READ ONLY;

SELECT current_database() AS database_name, current_schema() AS current_schema;

SELECT
  to_regclass('public.ordens') IS NOT NULL AS ordens_exists,
  to_regclass('public.clientes') IS NOT NULL AS clientes_exists,
  to_regclass('public.equipamentos') IS NOT NULL AS equipamentos_exists,
  to_regclass('public.cobrancas') IS NOT NULL AS cobrancas_exists,
  to_regclass('public.documentos_fiscais') IS NOT NULL AS documentos_fiscais_exists;

SELECT
  count(*) AS ordens_count,
  count(*) FILTER (WHERE jsonb_typeof(itens) IS DISTINCT FROM 'array') AS invalid_items_shape,
  count(*) FILTER (WHERE jsonb_typeof(pagamentos) IS DISTINCT FROM 'array') AS invalid_payments_shape,
  count(*) FILTER (WHERE numero !~ '^OS-[0-9]+$') AS legacy_number_format
FROM public.ordens;

SELECT count(*) AS duplicate_owner_numbers
FROM (
  SELECT user_id, numero
  FROM public.ordens
  GROUP BY user_id, numero
  HAVING count(*) > 1
) duplicates;

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ordens' AND column_name='revisao'
  ) AS order_revision_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ordens' AND column_name='cliente_id'
  ) AS customer_link_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ordens' AND column_name='equipamento_id'
  ) AS equipment_link_exists,
  to_regprocedure('public.oficinia_registrar_pagamento(uuid,uuid,numeric,text)') IS NOT NULL
    AS payment_rpc_exists,
  to_regprocedure('public.oficinia_criar_cobranca(uuid,uuid,numeric,text)') IS NOT NULL
    AS charge_rpc_exists,
  to_regprocedure('public.ritmeia_preparar_nfse(uuid,uuid,text)') IS NOT NULL
    AS nfse_draft_rpc_exists;

SELECT
  count(*) AS clientes_count,
  count(*) FILTER (
    WHERE documento IS NOT NULL
      AND documento !~ '^[0-9]{11}$'
      AND documento !~ '^[A-Z0-9]{14}$'
  ) AS invalid_fiscal_documents,
  count(*) FILTER (WHERE uf IS NOT NULL AND uf !~ '^[A-Z]{2}$') AS invalid_uf
FROM public.clientes;

SELECT count(*) AS equipamentos_count FROM public.equipamentos;

SELECT
  count(*) AS fiscal_documents_count,
  count(*) FILTER (WHERE status='emitido') AS emitted_count,
  count(*) FILTER (WHERE ambiente='producao') AS production_fiscal_rows
FROM public.documentos_fiscais;

ROLLBACK;
