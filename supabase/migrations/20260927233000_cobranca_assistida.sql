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
GRANT SELECT, INSERT ON public.cobrancas TO authenticated;
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
