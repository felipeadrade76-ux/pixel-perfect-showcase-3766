-- Assisted payment workflow: no bank account, Pix key or bank API is stored.
-- "informado" means the client CLAIMED payment, not verified receipt.
CREATE TABLE public.cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  ordem_id uuid NOT NULL REFERENCES public.ordens(id) ON DELETE CASCADE,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  forma text NOT NULL CHECK (forma IN ('Pix','Dinheiro','Cartão')),
  status text NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando','informado','confirmado','cancelado')),
  criada_em timestamptz NOT NULL DEFAULT now(),
  informada_em timestamptz,
  confirmada_em timestamptz,
  CONSTRAINT cobranca_confirmada_consistente CHECK (
    (status = 'confirmado') = (confirmada_em IS NOT NULL)
  )
);
CREATE INDEX cobrancas_user_ordem_idx ON public.cobrancas(user_id,ordem_id,criada_em DESC);
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono consulta suas cobrancas" ON public.cobrancas FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Dono cria cobrancas para suas ordens" ON public.cobrancas FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'aguardando'
    AND informada_em IS NULL AND confirmada_em IS NULL AND EXISTS (
    SELECT 1 FROM public.ordens o WHERE o.id = ordem_id AND o.user_id = auth.uid()
  ));
GRANT SELECT ON public.cobrancas TO authenticated;
GRANT ALL ON public.cobrancas TO service_role;
-- The client never gets UPDATE permission: every state transition uses a narrow RPC.

CREATE OR REPLACE FUNCTION public.oficinia_marcar_cobranca(
  p_cobranca uuid, p_estado text
) RETURNS public.cobrancas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.cobrancas%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_estado NOT IN ('informado','cancelado') THEN
    RAISE EXCEPTION 'Transição de cobrança inválida';
  END IF;
  SELECT * INTO v FROM public.cobrancas
  WHERE id=p_cobranca AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança não encontrada'; END IF;
  IF v.status='confirmado' THEN RAISE EXCEPTION 'Recebimento já confirmado'; END IF;
  IF v.status='cancelado' THEN RAISE EXCEPTION 'Cobrança cancelada'; END IF;
  IF p_estado='informado' AND v.status='informado' THEN RETURN v; END IF;
  UPDATE public.cobrancas SET status=p_estado,
    informada_em=CASE WHEN p_estado='informado' THEN now() ELSE informada_em END
  WHERE id=v.id RETURNING * INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.oficinia_marcar_cobranca(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.oficinia_marcar_cobranca(uuid,text) TO authenticated;

-- One transaction: lock intent -> locked payment RPC -> mark confirmed.
-- The payment ID is the intent UUID. Repeated requests cannot create two receipts.
CREATE OR REPLACE FUNCTION public.oficinia_confirmar_cobranca(
 p_cobranca uuid
) RETURNS public.cobrancas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.cobrancas%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  SELECT * INTO v FROM public.cobrancas WHERE id=p_cobranca AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança não encontrada'; END IF;
  IF v.status='confirmado' THEN RETURN v; END IF;
  IF v.status='cancelado' THEN RAISE EXCEPTION 'Cobrança cancelada'; END IF;
  PERFORM public.oficinia_registrar_pagamento(v.ordem_id,v.id,v.valor,v.forma);
  UPDATE public.cobrancas SET status='confirmado',confirmada_em=now()
  WHERE id=v.id RETURNING * INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.oficinia_confirmar_cobranca(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.oficinia_confirmar_cobranca(uuid) TO authenticated;

-- New requests are serialized against other charges and receipts for the same OS.
-- The request UUID is reused after an uncertain network response.
CREATE OR REPLACE FUNCTION public.oficinia_criar_cobranca(
  p_ordem uuid, p_id uuid, p_valor numeric, p_forma text
) RETURNS public.cobrancas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_os public.ordens%ROWTYPE;
  v_cobranca public.cobrancas%ROWTYPE;
  v_total numeric;
  v_pago numeric;
  v_reservado numeric;
BEGIN
  IF auth.uid() IS NULL OR p_id IS NULL OR p_valor IS NULL OR p_valor <= 0
    OR p_valor <> round(p_valor,2) OR p_forma IS NULL
    OR p_forma NOT IN ('Pix','Dinheiro','Cartão') THEN
    RAISE EXCEPTION 'Dados da cobrança inválidos';
  END IF;
  SELECT * INTO v_os FROM public.ordens WHERE id=p_ordem AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada'; END IF;
  SELECT * INTO v_cobranca FROM public.cobrancas WHERE id=p_id;
  IF FOUND THEN
    IF v_cobranca.user_id <> auth.uid() OR v_cobranca.ordem_id <> p_ordem
      OR v_cobranca.valor <> p_valor OR v_cobranca.forma <> p_forma THEN
      RAISE EXCEPTION 'Identificador já usado em outra cobrança';
    END IF;
    RETURN v_cobranca;
  END IF;
  SELECT coalesce(sum((i->>'valor')::numeric),0) INTO v_total
    FROM jsonb_array_elements(v_os.itens) i;
  SELECT coalesce(sum((p->>'valor')::numeric),0) INTO v_pago
    FROM jsonb_array_elements(v_os.pagamentos) p;
  SELECT coalesce(sum(valor),0) INTO v_reservado FROM public.cobrancas
    WHERE ordem_id=p_ordem AND status IN ('aguardando','informado');
  IF v_total - v_pago - v_reservado < p_valor THEN
    RAISE EXCEPTION 'Valor excede o saldo ainda não solicitado';
  END IF;
  INSERT INTO public.cobrancas (id,user_id,ordem_id,valor,forma)
    VALUES (p_id,auth.uid(),p_ordem,p_valor,p_forma)
    RETURNING * INTO v_cobranca;
  RETURN v_cobranca;
END $$;
REVOKE ALL ON FUNCTION public.oficinia_criar_cobranca(uuid,uuid,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.oficinia_criar_cobranca(uuid,uuid,numeric,text) TO authenticated;
