-- Regression cases found by Fases 1-3 audit; runs AFTER previous SQL and concurrency tests.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

INSERT INTO public.ordens (id,cliente,tipo_maquina,problema,itens)
VALUES ('eeeeeeee-0000-4000-8000-000000000001','Auditoria','Motosserra','Teste',
  '[{"id":"eeeeeeee-0000-4000-8000-000000000002","descricao":"Serviço","tipo":"Mão de obra","valor":100}]'::jsonb);
SELECT public.oficinia_criar_cobranca(
 'eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003',80,'Pix');

-- An unrelated direct manual receipt cannot consume reserved money.
DO $$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  PERFORM public.oficinia_registrar_pagamento(
  'eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000004',30,'Dinheiro');
 EXCEPTION WHEN raise_exception THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Manual payment consumed a pending charge reservation'; END IF;
END $$;

-- Editing down the total must also preserve unconfirmed commitments.
DO $$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  UPDATE public.ordens
  SET itens='[{"id":"eeeeeeee-0000-4000-8000-000000000002","descricao":"Serviço","tipo":"Mão de obra","valor":70}]'::jsonb
  WHERE id='eeeeeeee-0000-4000-8000-000000000001';
 EXCEPTION WHEN raise_exception THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Item edit invalidated a pending charge'; END IF;
END $$;

-- A forged receipt using a legitimate charge ID but wrong details is blocked.
DO $$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  PERFORM public.oficinia_registrar_pagamento(
  'eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003',10,'Pix');
 EXCEPTION WHEN raise_exception THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Charge request ID was reused with a different receipt amount'; END IF;
END $$;

-- R$20 free + R$80 reserved; notification is not money received.
SELECT public.oficinia_registrar_pagamento(
 'eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000005',20,'Dinheiro');
DO $$
DECLARE received numeric; reserved numeric;
BEGIN
 SELECT coalesce(sum((p->>'valor')::numeric),0) INTO received
 FROM public.ordens o CROSS JOIN LATERAL jsonb_array_elements(o.pagamentos) p
 WHERE o.id='eeeeeeee-0000-4000-8000-000000000001';
 SELECT coalesce(sum(valor),0) INTO reserved FROM public.cobrancas
 WHERE ordem_id='eeeeeeee-0000-4000-8000-000000000001' AND status='aguardando';
 IF received <> 20 OR reserved <> 80 THEN RAISE EXCEPTION 'Reservation/receipt separation failed'; END IF;
END $$;

SELECT public.oficinia_marcar_cobranca('eeeeeeee-0000-4000-8000-000000000003','informado');
SELECT public.oficinia_confirmar_cobranca('eeeeeeee-0000-4000-8000-000000000003');
SELECT public.oficinia_confirmar_cobranca('eeeeeeee-0000-4000-8000-000000000003');

DO $$
DECLARE received numeric; count_payments integer; confirmed text;
BEGIN
 SELECT coalesce(sum((p->>'valor')::numeric),0), count(*) INTO received,count_payments
 FROM public.ordens o CROSS JOIN LATERAL jsonb_array_elements(o.pagamentos) p
 WHERE o.id='eeeeeeee-0000-4000-8000-000000000001';
 SELECT status INTO confirmed FROM public.cobrancas
 WHERE id='eeeeeeee-0000-4000-8000-000000000003';
 IF received <> 100 OR count_payments <> 2 OR confirmed <> 'confirmado'
 THEN RAISE EXCEPTION 'Reserved charge confirmation was not atomic/idempotent'; END IF;
END $$;

-- No new charges after order is fully paid; cancellation not permitted for a confirmed receipt.
DO $$
DECLARE rejected boolean := false;
BEGIN
 BEGIN
  PERFORM public.oficinia_criar_cobranca(
  'eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000006',1,'Pix');
 EXCEPTION WHEN raise_exception THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Created charge on settled order'; END IF;
 rejected := false;
 BEGIN
  PERFORM public.oficinia_marcar_cobranca('eeeeeeee-0000-4000-8000-000000000003','cancelado');
 EXCEPTION WHEN raise_exception THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cancelled a confirmed receipt'; END IF;
END $$;
RESET ROLE;
SELECT 'AUDIT_PHASES_1_3_REGRESSIONS_PASSED' AS result;
