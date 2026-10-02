-- Phase 6: service-only DPS reservation must be idempotent and monotonic.

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

INSERT INTO public.clientes (id, nome, documento, cidade, uf)
VALUES (
  'f2000000-0000-4000-8000-000000000001',
  'Cliente Emissao',
  '12345678902',
  'Itajuba',
  'MG'
);

INSERT INTO public.ordens (
  id, cliente_id, cliente, tipo_maquina, problema, itens
) VALUES (
  'f2000000-0000-4000-8000-000000000002',
  'f2000000-0000-4000-8000-000000000001',
  'Cliente Emissao',
  'Motosserra',
  'Teste de emissao',
  '[{"id":"f2000000-0000-4000-8000-000000000003","descricao":"Mao de obra","tipo":"Mão de obra","valor":80}]'::jsonb
);

SELECT public.ritmeia_preparar_nfse(
  'f2000000-0000-4000-8000-000000000002',
  'f2000000-0000-4000-8000-000000000004',
  'homologacao'
);

RESET ROLE;
SET ROLE service_role;

SELECT public.ritmeia_reservar_dps(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'f2000000-0000-4000-8000-000000000004',
  1601
);

DO $ritmeia$
DECLARE v_serie integer; v_numero bigint;
BEGIN
  SELECT serie_dps, numero_dps
    INTO v_serie, v_numero
  FROM public.documentos_fiscais
  WHERE id='f2000000-0000-4000-8000-000000000004';

  IF v_serie <> 1601 OR v_numero <> 1 THEN
    RAISE EXCEPTION 'First DPS reservation is invalid: %, %', v_serie, v_numero;
  END IF;
END
$ritmeia$;

-- Retry of the same fiscal document must reuse exactly the same number.
SELECT public.ritmeia_reservar_dps(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'f2000000-0000-4000-8000-000000000004',
  1601
);

DO $ritmeia$
DECLARE v_numero bigint; v_proximo bigint;
BEGIN
  SELECT numero_dps INTO v_numero
  FROM public.documentos_fiscais
  WHERE id='f2000000-0000-4000-8000-000000000004';

  SELECT proximo_numero INTO v_proximo
  FROM public.nfse_dps_contadores
  WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND serie=1601;

  IF v_numero <> 1 OR v_proximo <> 2 THEN
    RAISE EXCEPTION 'Retry consumed another DPS number: %, %', v_numero, v_proximo;
  END IF;
END
$ritmeia$;

RESET ROLE;
SELECT 'PHASE6_DPS_SEQUENCE_TESTS_PASSED' AS result;
