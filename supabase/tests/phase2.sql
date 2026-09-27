-- Exercise real SQL migrations with two simulated authenticated users (no production data).
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
INSERT INTO public.ordens (id, cliente, tipo_maquina, problema, itens)
VALUES ('11111111-1111-4111-8111-111111111111','Teste A','Motosserra','Não liga',
'[{"id":"00000000-0000-4000-8000-000000000001","descricao":"Peça","tipo":"Peça","valor":100}]'::jsonb);
INSERT INTO public.ordens (id, cliente, tipo_maquina, problema, itens)
VALUES ('33333333-3333-4333-8333-333333333333','Teste A2','Roçadeira','Falha',
'[{"id":"00000000-0000-4000-8000-000000000002","descricao":"Peça","tipo":"Peça","valor":100}]'::jsonb);
DO $$
DECLARE n integer;
BEGIN
 SELECT count(distinct numero) INTO n FROM public.ordens;
 IF n <> 2 THEN RAISE EXCEPTION 'OS numbers collided'; END IF;
 IF EXISTS (SELECT 1 FROM public.ordens WHERE substring(numero from 'OS-([0-9]+)')::bigint <= 42) THEN
   RAISE EXCEPTION 'New OS number did not advance legacy data';
 END IF;
END $$;

SELECT public.oficinia_registrar_pagamento(
'11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',50,'Pix');
-- Same request after uncertain network response must not generate a second receipt.
SELECT public.oficinia_registrar_pagamento(
'11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',50,'Pix');
DO $$
DECLARE n integer; v numeric; blocked boolean := false;
BEGIN
 SELECT jsonb_array_length(pagamentos), (pagamentos->0->>'valor')::numeric
 INTO n,v FROM public.ordens WHERE id='11111111-1111-4111-8111-111111111111';
 IF n <> 1 OR v <> 50 THEN RAISE EXCEPTION 'Idempotency failed'; END IF;
 BEGIN
   PERFORM public.oficinia_registrar_pagamento(
    '11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555',60,'Dinheiro');
 EXCEPTION WHEN raise_exception THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Overpayment was accepted'; END IF;
END $$;

-- Reusing the same receipt ID with different payment details is not a valid retry.
DO $$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  PERFORM public.oficinia_registrar_pagamento(
   '11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',40,'Pix');
 EXCEPTION WHEN raise_exception THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Conflicting idempotency request accepted'; END IF;
END $$;

-- Direct manipulation of payment JSON must be denied to regular authenticated clients.
DO $$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  UPDATE public.ordens SET pagamentos='[]'::jsonb
  WHERE id='11111111-1111-4111-8111-111111111111';
 EXCEPTION WHEN insufficient_privilege THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Direct payment update allowed'; END IF;
END $$;

-- Reducing total below money received must be rejected even when editing items.
DO $$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  UPDATE public.ordens SET itens='[]'::jsonb
  WHERE id='11111111-1111-4111-8111-111111111111';
 EXCEPTION WHEN raise_exception THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Paid order total could be reduced to zero'; END IF;
END $$;

-- Version compare-and-swap: outdated browser edits must affect zero rows.
DO $$
DECLARE old_revision bigint; rows_changed integer;
BEGIN
 SELECT revisao - 1 INTO old_revision FROM public.ordens
 WHERE id='11111111-1111-4111-8111-111111111111';
 UPDATE public.ordens SET cliente='Wrong stale value'
 WHERE id='11111111-1111-4111-8111-111111111111' AND revisao=old_revision;
 GET DIAGNOSTICS rows_changed = ROW_COUNT;
 IF rows_changed <> 0 THEN RAISE EXCEPTION 'Stale update succeeded'; END IF;
END $$;

-- A paid order cannot be deleted.
DO $$
DECLARE blocked boolean := false;
BEGIN
 BEGIN
  DELETE FROM public.ordens WHERE id='11111111-1111-4111-8111-111111111111';
 EXCEPTION WHEN raise_exception THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Paid order was deleted'; END IF;
END $$;

-- User B cannot see, edit or receive a result for user A's order.
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
DO $$
DECLARE n integer; blocked boolean := false;
BEGIN
 SELECT count(*) INTO n FROM public.ordens;
 IF n <> 0 THEN RAISE EXCEPTION 'RLS disclosed another account'; END IF;
 BEGIN
  PERFORM public.oficinia_registrar_pagamento(
  '11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666666',10,'Pix');
 EXCEPTION WHEN raise_exception THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'RLS allowed cross-account payment'; END IF;
END $$;
INSERT INTO public.ordens (id, cliente, tipo_maquina, problema)
VALUES ('22222222-2222-4222-8222-222222222222','Teste B','Gerador','Sem energia');
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.ordens;
 IF n <> 1 THEN RAISE EXCEPTION 'User B did not see precisely its own order'; END IF;
END $$;
RESET ROLE;
SELECT 'PHASE2_SQL_TESTS_PASSED' AS result;
