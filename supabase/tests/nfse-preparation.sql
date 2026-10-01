-- Phase 6: fiscal draft preparation without external issuance.
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  false
);

INSERT INTO public.clientes (
  id,
  nome,
  documento,
  cidade,
  uf,
  email
) VALUES (
  'f1000000-0000-4000-8000-000000000001',
  'Cliente Fiscal',
  '12345678901',
  'Itajuba',
  'MG',
  'fiscal@example.com'
);

INSERT INTO public.ordens (
  id,
  cliente_id,
  cliente,
  tipo_maquina,
  problema,
  itens
) VALUES (
  'f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000001',
  'Cliente Fiscal',
  'Motosserra',
  'Reparo fiscal',
  '[
    {"id":"f1000000-0000-4000-8000-000000000003","descricao":"Mao de obra","tipo":"Mão de obra","valor":150},
    {"id":"f1000000-0000-4000-8000-000000000005","descricao":"Peca","tipo":"Peça","valor":50}
  ]'::jsonb
);

SELECT public.ritmeia_preparar_nfse(
  'f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000004',
  'homologacao'
);

-- A repeated preparation request with a new id must reuse the active draft.
SELECT public.ritmeia_preparar_nfse(
  'f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000006',
  'homologacao'
);

DO $ritmeia$
DECLARE
  v_status text;
  v_total numeric;
  v_pecas numeric;
  v_total_ordem numeric;
  v_nome text;
  v_os text;
  v_count integer;
BEGIN
  SELECT
    status,
    valor_servicos,
    valor_pecas,
    valor_total_ordem,
    tomador->>'nome',
    servico->>'numero_os'
    INTO
      v_status,
      v_total,
      v_pecas,
      v_total_ordem,
      v_nome,
      v_os
  FROM public.documentos_fiscais
  WHERE id = 'f1000000-0000-4000-8000-000000000004';

  SELECT count(*)
    INTO v_count
  FROM public.documentos_fiscais
  WHERE ordem_id = 'f1000000-0000-4000-8000-000000000002'
    AND status = 'rascunho';

  IF v_status <> 'rascunho'
    OR v_total <> 150
    OR v_pecas <> 50
    OR v_total_ordem <> 200
    OR v_nome <> 'Cliente Fiscal'
    OR v_os IS NULL THEN
    RAISE EXCEPTION 'Fiscal snapshot was not prepared correctly';
  END IF;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Repeated preparation created duplicate active fiscal drafts';
  END IF;
END
$ritmeia$;

-- The snapshot stays frozen when the master customer is edited.
UPDATE public.clientes
SET nome = 'Cliente Fiscal Atualizado'
WHERE id = 'f1000000-0000-4000-8000-000000000001';

DO $ritmeia$
DECLARE
  v_nome text;
BEGIN
  SELECT tomador->>'nome'
    INTO v_nome
  FROM public.documentos_fiscais
  WHERE id = 'f1000000-0000-4000-8000-000000000004';

  IF v_nome <> 'Cliente Fiscal' THEN
    RAISE EXCEPTION 'Fiscal snapshot changed with master customer data';
  END IF;
END
$ritmeia$;

-- Changing the OS invalidates an unissued draft; the next preparation creates a fresh snapshot.
UPDATE public.ordens
SET itens = '[
  {"id":"f1000000-0000-4000-8000-000000000003","descricao":"Mao de obra atualizada","tipo":"Mão de obra","valor":200},
  {"id":"f1000000-0000-4000-8000-000000000005","descricao":"Peca","tipo":"Peça","valor":50}
]'::jsonb
WHERE id = 'f1000000-0000-4000-8000-000000000002';

SELECT public.ritmeia_preparar_nfse(
  'f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000008',
  'homologacao'
);

DO $ritmeia$
DECLARE
  v_old_status text;
  v_new_status text;
  v_new_services numeric;
  v_active_count integer;
BEGIN
  SELECT status
    INTO v_old_status
  FROM public.documentos_fiscais
  WHERE id = 'f1000000-0000-4000-8000-000000000004';

  SELECT status, valor_servicos
    INTO v_new_status, v_new_services
  FROM public.documentos_fiscais
  WHERE id = 'f1000000-0000-4000-8000-000000000008';

  SELECT count(*)
    INTO v_active_count
  FROM public.documentos_fiscais
  WHERE ordem_id = 'f1000000-0000-4000-8000-000000000002'
    AND status IN ('rascunho','pronto','enviando');

  IF v_old_status <> 'cancelado'
    OR v_new_status <> 'rascunho'
    OR v_new_services <> 200
    OR v_active_count <> 1 THEN
    RAISE EXCEPTION 'Stale fiscal draft was not replaced safely';
  END IF;
END
$ritmeia$;

-- Authenticated browser clients cannot write fiscal status directly.
DO $ritmeia$
DECLARE
  v_blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.documentos_fiscais (
      id,
      ordem_id,
      cliente_id,
      valor_servicos,
      valor_pecas,
      valor_total_ordem,
      ordem_revisao,
      tomador,
      servico
    ) VALUES (
      'f1000000-0000-4000-8000-000000000007',
      'f1000000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000001',
      1,
      0,
      1,
      0,
      '{}'::jsonb,
      '{}'::jsonb
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_blocked := true;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Direct fiscal writes were allowed';
  END IF;
END
$ritmeia$;

-- A second account cannot read the first account's fiscal draft.
SELECT set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  false
);

DO $ritmeia$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*)
    INTO v_count
  FROM public.documentos_fiscais;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Fiscal RLS disclosed another account';
  END IF;
END
$ritmeia$;

RESET ROLE;

-- CNPJ alphanumeric compatibility after the 2026 fiscal migration.
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  false
);

INSERT INTO public.clientes (nome, documento)
VALUES ('Empresa CNPJ Alfanumerico', '12ABC34501DE35');

RESET ROLE;

SELECT 'PHASE6_FISCAL_DRAFT_TESTS_PASSED' AS result;
