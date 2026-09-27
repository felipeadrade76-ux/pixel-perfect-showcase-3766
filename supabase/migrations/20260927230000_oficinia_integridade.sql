-- Phase 2: atomic numbering, optimistic versioning and transactional/manual payments.
-- Apply only to a test database first. Existing duplicate per-owner numbers must be resolved before unique index.
ALTER TABLE public.ordens ADD COLUMN IF NOT EXISTS revisao bigint NOT NULL DEFAULT 0;
CREATE SEQUENCE IF NOT EXISTS public.oficinia_os_seq;
SELECT setval('public.oficinia_os_seq', GREATEST(
  (SELECT COALESCE(MAX(substring(numero from '^OS-([0-9]+)$')::bigint), 0) + 1 FROM public.ordens), 1
), false);
CREATE UNIQUE INDEX IF NOT EXISTS ordens_user_numero_unique ON public.ordens(user_id, numero);

CREATE OR REPLACE FUNCTION public.oficinia_numero_os()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.numero := 'OS-' || lpad(nextval('public.oficinia_os_seq'::regclass)::text, 4, '0');
  NEW.pagamentos := '[]'::jsonb;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS oficinia_gerar_numero_os ON public.ordens;
CREATE TRIGGER oficinia_gerar_numero_os BEFORE INSERT ON public.ordens
FOR EACH ROW EXECUTE FUNCTION public.oficinia_numero_os();
REVOKE ALL ON SEQUENCE public.oficinia_os_seq FROM PUBLIC, anon, authenticated;

-- Increment version whenever a row changes, including updates through older clients or MCP.
CREATE OR REPLACE FUNCTION public.oficinia_incrementar_revisao()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.revisao := OLD.revisao + 1;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS oficinia_revisao ON public.ordens;
CREATE TRIGGER oficinia_revisao BEFORE UPDATE ON public.ordens
FOR EACH ROW EXECUTE FUNCTION public.oficinia_incrementar_revisao();

CREATE OR REPLACE FUNCTION public.oficinia_registrar_pagamento(
  p_ordem uuid, p_pagamento_id uuid, p_valor numeric, p_forma text
) RETURNS public.ordens
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ordem public.ordens%ROWTYPE;
  v_total numeric;
  v_pago numeric;
  v_valor numeric;
  v_id text := p_pagamento_id::text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_forma IS NULL OR p_pagamento_id IS NULL OR p_valor IS NULL OR p_valor <= 0 OR p_valor <> round(p_valor, 2)
     OR p_forma NOT IN ('Pix','Dinheiro','Cartão') THEN
    RAISE EXCEPTION 'Dados de pagamento inválidos';
  END IF;
  SELECT * INTO v_ordem FROM public.ordens
    WHERE id = p_ordem AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_ordem.pagamentos) p WHERE p->>'id' = v_id) THEN
    RETURN v_ordem; -- Same request retried after a network timeout: no duplicate.
  END IF;
  SELECT COALESCE(sum((i->>'valor')::numeric),0) INTO v_total
    FROM jsonb_array_elements(v_ordem.itens) i;
  SELECT COALESCE(sum((p->>'valor')::numeric),0) INTO v_pago
    FROM jsonb_array_elements(v_ordem.pagamentos) p;
  v_valor := round(p_valor,2);
  IF v_total - v_pago < v_valor THEN RAISE EXCEPTION 'Pagamento excede o saldo disponível'; END IF;
  UPDATE public.ordens SET
    pagamentos = v_ordem.pagamentos || jsonb_build_array(jsonb_build_object(
      'id', v_id, 'valor', v_valor, 'forma', p_forma, 'data', now()
    )),
    historico = v_ordem.historico || jsonb_build_array(jsonb_build_object(
      'data', now(), 'texto', 'Pagamento de ' || to_char(v_valor,'FM999999999990D00') ||
      ' registrado manualmente via ' || p_forma
    ))
  WHERE id = p_ordem AND user_id = auth.uid()
  RETURNING * INTO v_ordem;
  RETURN v_ordem;
END $$;
REVOKE ALL ON FUNCTION public.oficinia_registrar_pagamento(uuid,uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oficinia_registrar_pagamento(uuid,uuid,numeric,text) TO authenticated;

-- An authenticated client may edit only operational fields. Payment JSON can be
-- changed exclusively by the owner-checked RPC above, not by a stale browser update.
REVOKE UPDATE ON public.ordens FROM authenticated;
GRANT UPDATE (
  cliente, telefone, tipo_maquina, marca, modelo, serie, problema,
  observacoes, prazo, status, concluida_em, entregue_em, historico, itens
) ON public.ordens TO authenticated;

-- Reject invalid money and reductions of order total below already received amounts.
CREATE OR REPLACE FUNCTION public.oficinia_validar_saldo()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_total numeric; v_pago numeric;
BEGIN
  IF jsonb_typeof(NEW.itens) <> 'array' OR jsonb_typeof(NEW.pagamentos) <> 'array' THEN
    RAISE EXCEPTION 'Itens e pagamentos devem ser listas';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.itens) i
    WHERE jsonb_typeof(i->'valor') <> 'number'
       OR (i->>'valor')::numeric < 0
       OR (i->>'valor')::numeric <> round((i->>'valor')::numeric, 2)
  ) OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.pagamentos) p
    WHERE jsonb_typeof(p->'valor') <> 'number'
       OR (p->>'valor')::numeric <= 0
       OR (p->>'valor')::numeric <> round((p->>'valor')::numeric, 2)
  ) THEN RAISE EXCEPTION 'Valores monetários inválidos'; END IF;
  SELECT COALESCE(sum((i->>'valor')::numeric),0) INTO v_total
  FROM jsonb_array_elements(NEW.itens) i;
  SELECT COALESCE(sum((p->>'valor')::numeric),0) INTO v_pago
  FROM jsonb_array_elements(NEW.pagamentos) p;
  IF v_pago > v_total THEN RAISE EXCEPTION 'Total inferior aos pagamentos registrados'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS oficinia_validar_saldo ON public.ordens;
CREATE TRIGGER oficinia_validar_saldo BEFORE INSERT OR UPDATE ON public.ordens
FOR EACH ROW EXECUTE FUNCTION public.oficinia_validar_saldo();

-- Do not erase received-payment history through an ordinary OS deletion.
CREATE OR REPLACE FUNCTION public.oficinia_bloquear_exclusao_paga()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF jsonb_array_length(OLD.pagamentos) > 0 THEN
    RAISE EXCEPTION 'Ordens com pagamento registrado não podem ser excluídas';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS oficinia_bloquear_exclusao_paga ON public.ordens;
CREATE TRIGGER oficinia_bloquear_exclusao_paga BEFORE DELETE ON public.ordens
FOR EACH ROW EXECUTE FUNCTION public.oficinia_bloquear_exclusao_paga();
