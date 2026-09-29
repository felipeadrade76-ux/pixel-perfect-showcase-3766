-- Phase 6: fiscal draft preparation without external issuance.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

INSERT INTO public.clientes (
  id, nome, documento, cidade, uf, email
) VALUES (
  'f1000000-0000-4000-8000-000000000001',
  'Cliente Fiscal',
  '12345678901',
  'Itajuba',
  'MG',
  'fiscal@example.com'
);

INSERT INTO public.ordens (
  id, cliente_id, cliente, tipo_maquina, problema, itens
) VALUES (
  'f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000001',
  'Cliente Fiscal',
  'Motosserra',
  'Reparo fiscal',
  '[{"id":"f1000000-0000-4000-8000-000000000003","descricao":"Mao de obra","tipo":"Mão de obra","valor":150}]'::jsonb
);

SELECT public.ritmeia_preparar_nfse(
  'f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000004',
  'homologacao'
);

DO $$
DECLARE v_status text; v_total numeric; v_nome text; v_os text;
BEGIN
  SELECT status, valor_servicos, tomador->>'nome', servico->>'numero_os'
    INTO v_status, v_total, v_nome, v_os
  FROM public.documentos_fiscais
  WHERE id='f1000000-0000-4000-8000-000000000004';

  IF v_status <> 'rascunho' OR v_total <> 150 OR v_nome <> 'Cliente Fiscal' OR v_os IS NULL THEN
    RAISE EXCEPTION 'Fiscal snapshot was not prepared correctly';
  END IF;
END $$;

-- Snapshot stays frozen if customer master data changes later.
UPDATE public.clientes
SET nome='Cliente Fiscal Atualizado'
WHERE id='f1000000-0000-4000-8000-000000000001';

DO $$
DECLARE v_nome text;
BEGIN
  SELECT tomador->>'nome' INTO v_nome
  FROM public.documentos_fiscais
  WHERE id='f1000000-0000-4000-8000-000000000004';

  IF v_nome <> 'Cliente Fiscal' THEN
    RAISE EXCEPTION 'Fiscal snapshot changed with master customer data';
  END IF;
END $$;

-- A second account cannot read the fiscal draft.
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.documentos_fiscais;
  IF n <> 0 THEN RAISE EXCEPTION 'Fiscal RLS disclosed another account'; END IF;
END $$;

RESET ROLE;
SELECT 'PHASE6_FISCAL_DRAFT_TESTS_PASSED' AS result;
