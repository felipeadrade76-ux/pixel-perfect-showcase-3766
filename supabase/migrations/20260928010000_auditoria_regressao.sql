-- Regression audit for Fases 1-3: charge reservation must survive manual payments
-- and item edits. Applied AFTER assisted-charge migration.
-- A pending charge is a reservation, NOT a confirmed payment.

CREATE OR REPLACE FUNCTION public.oficinia_registrar_pagamento(
  p_ordem uuid, p_pagamento_id uuid, p_valor numeric, p_forma text
) RETURNS public.ordens
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ordem public.ordens%ROWTYPE;
  v_total numeric;
  v_pago numeric;
  v_reservado numeric;
  v_id text := p_pagamento_id::text;
  v_cobranca public.cobrancas%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_forma IS NULL OR p_pagamento_id IS NULL OR p_valor IS NULL OR p_valor <= 0
     OR p_valor <> round(p_valor, 2) OR p_forma NOT IN ('Pix','Dinheiro','Cartão')
  THEN RAISE EXCEPTION 'Dados de pagamento inválidos'; END IF;

  SELECT * INTO v_ordem FROM public.ordens
  WHERE id = p_ordem AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_ordem.pagamentos) p WHERE p->>'id' = v_id
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_ordem.pagamentos) p
      WHERE p->>'id' = v_id AND (p->>'valor')::numeric = p_valor AND p->>'forma' = p_forma
    ) THEN RAISE EXCEPTION 'Identificador já utilizado para outro pagamento'; END IF;
    RETURN v_ordem;
  END IF;

  SELECT * INTO v_cobranca FROM public.cobrancas
  WHERE id = p_pagamento_id AND user_id = auth.uid();
  IF FOUND AND (
    v_cobranca.ordem_id <> p_ordem OR v_cobranca.valor <> p_valor
    OR v_cobranca.forma <> p_forma OR v_cobranca.status = 'cancelado'
  ) THEN
    RAISE EXCEPTION 'Identificador de cobrança incompatível com pagamento';
  END IF;

  -- A payment with the matching charge UUID converts that reservation into a
  -- receipt in the same transaction. An unrelated manual payment must leave
  -- enough balance for all other outstanding charge requests.
  SELECT coalesce(sum((i->>'valor')::numeric),0) INTO v_total
  FROM jsonb_array_elements(v_ordem.itens) i;
  SELECT coalesce(sum((p->>'valor')::numeric),0) INTO v_pago
  FROM jsonb_array_elements(v_ordem.pagamentos) p;
  SELECT coalesce(sum(c.valor),0) INTO v_reservado
  FROM public.cobrancas c
  WHERE c.ordem_id = p_ordem
    AND c.status IN ('aguardando','informado')
    AND c.id <> p_pagamento_id;
  IF v_total - v_pago - v_reservado < p_valor THEN
    RAISE EXCEPTION 'Pagamento excede o saldo livre após cobranças pendentes';
  END IF;

  UPDATE public.ordens SET
    pagamentos = v_ordem.pagamentos || jsonb_build_array(jsonb_build_object(
      'id', v_id, 'valor', p_valor, 'forma', p_forma, 'data', now()
    )),
    historico = v_ordem.historico || jsonb_build_array(jsonb_build_object(
      'data', now(), 'texto', 'Pagamento de ' || to_char(p_valor,'FM999999999990D00') ||
      ' registrado manualmente via ' || p_forma
    ))
  WHERE id = p_ordem AND user_id = auth.uid()
  RETURNING * INTO v_ordem;
  RETURN v_ordem;
END $$;
REVOKE ALL ON FUNCTION public.oficinia_registrar_pagamento(uuid,uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oficinia_registrar_pagamento(uuid,uuid,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.oficinia_validar_saldo()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_total numeric;
  v_pago numeric;
  v_reservado numeric;
BEGIN
  IF jsonb_typeof(NEW.itens) <> 'array' OR jsonb_typeof(NEW.pagamentos) <> 'array'
  THEN RAISE EXCEPTION 'Itens e pagamentos devem ser listas'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.itens) i
    WHERE jsonb_typeof(i->'valor') <> 'number'
      OR (i->>'valor')::numeric < 0
      OR (i->>'valor')::numeric <> round((i->>'valor')::numeric,2)
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.pagamentos) p
    WHERE jsonb_typeof(p->'valor') <> 'number'
      OR (p->>'valor')::numeric <= 0
      OR (p->>'valor')::numeric <> round((p->>'valor')::numeric,2)
  ) THEN RAISE EXCEPTION 'Valores monetários inválidos'; END IF;
  SELECT coalesce(sum((i->>'valor')::numeric),0) INTO v_total
  FROM jsonb_array_elements(NEW.itens) i;
  SELECT coalesce(sum((p->>'valor')::numeric),0) INTO v_pago
  FROM jsonb_array_elements(NEW.pagamentos) p;

  IF v_pago > v_total THEN RAISE EXCEPTION 'Total inferior aos pagamentos registrados'; END IF;
  IF TG_OP = 'UPDATE' THEN
    -- During confirmation, the matching payment UUID has already been appended
    -- while charge status is still pending, so do NOT count it twice.
    SELECT coalesce(sum(c.valor),0) INTO v_reservado
    FROM public.cobrancas c
    WHERE c.ordem_id = NEW.id AND c.status IN ('aguardando','informado')
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.pagamentos) p
        WHERE p->>'id' = c.id::text
      );
    IF v_pago + v_reservado > v_total THEN
      RAISE EXCEPTION 'Total inferior ao recebido e às cobranças pendentes';
    END IF;
  END IF;
  RETURN NEW;
END $$;
