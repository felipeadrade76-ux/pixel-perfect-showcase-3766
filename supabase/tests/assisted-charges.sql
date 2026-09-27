-- This test runs after phase2.sql in disposable PostgreSQL.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
DO $$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  INSERT INTO public.cobrancas (id,ordem_id,valor,forma,status,confirmada_em)
  VALUES ('aaaaaaaa-0000-4000-8000-000000000009',
  '11111111-1111-4111-8111-111111111111',20,'Pix','confirmado',now());
 EXCEPTION WHEN check_violation OR insufficient_privilege THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'User forged a confirmed payment'; END IF;
END $$;
SELECT public.oficinia_criar_cobranca('11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-0000-4000-8000-000000000001',30,'Pix');
-- The same request ID is safe to retry after a lost response.
SELECT public.oficinia_criar_cobranca('11111111-1111-4111-8111-111111111111',
 'aaaaaaaa-0000-4000-8000-000000000001',30,'Pix');
DO $
DECLARE n integer; blocked boolean := false;
BEGIN
 SELECT count(*) INTO n FROM public.cobrancas WHERE ordem_id='11111111-1111-4111-8111-111111111111';
 IF n <> 1 THEN RAISE EXCEPTION 'Duplicate charge intent created'; END IF;
 BEGIN
  PERFORM public.oficinia_criar_cobranca('11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-0000-4000-8000-000000000002',30,'Pix');
 EXCEPTION WHEN raise_exception THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Overcommitted charge request accepted'; END IF;
 blocked := false;
 BEGIN
  PERFORM public.oficinia_criar_cobranca('11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-0000-4000-8000-000000000001',10,'Pix');
 EXCEPTION WHEN raise_exception THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Conflicting charge retry accepted'; END IF;
END $;
SELECT public.oficinia_marcar_cobranca('aaaaaaaa-0000-4000-8000-000000000001','informado');
-- Client notice does not change received balance.
DO $$
DECLARE n integer;
BEGIN
 SELECT jsonb_array_length(pagamentos) INTO n FROM public.ordens WHERE id='11111111-1111-4111-8111-111111111111';
 IF n <> 1 THEN RAISE EXCEPTION 'Unconfirmed intent counted as paid'; END IF;
END $$;
SELECT public.oficinia_confirmar_cobranca('aaaaaaaa-0000-4000-8000-000000000001');
SELECT public.oficinia_confirmar_cobranca('aaaaaaaa-0000-4000-8000-000000000001');
DO $$
DECLARE n integer; s text;
BEGIN
 SELECT jsonb_array_length(pagamentos) INTO n FROM public.ordens WHERE id='11111111-1111-4111-8111-111111111111';
 SELECT status INTO s FROM public.cobrancas WHERE id='aaaaaaaa-0000-4000-8000-000000000001';
 IF n <> 2 OR s <> 'confirmado' THEN RAISE EXCEPTION 'Charge was not confirmed exactly once'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
DO $$
DECLARE n integer; blocked boolean := false;
BEGIN
 SELECT count(*) INTO n FROM public.cobrancas WHERE id='aaaaaaaa-0000-4000-8000-000000000001';
 IF n <> 0 THEN RAISE EXCEPTION 'Cross-account intent readable'; END IF;
 BEGIN
  PERFORM public.oficinia_confirmar_cobranca('aaaaaaaa-0000-4000-8000-000000000001');
 EXCEPTION WHEN raise_exception THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-account charge confirmation allowed'; END IF;
END $$;
RESET ROLE;
SELECT 'ASSISTED_CHARGES_TESTS_PASSED' AS result;
