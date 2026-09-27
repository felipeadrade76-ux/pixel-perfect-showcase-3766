CREATE TABLE public.ordens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  numero text NOT NULL,
  cliente text NOT NULL,
  telefone text,
  tipo_maquina text NOT NULL,
  marca text,
  modelo text,
  serie text,
  problema text NOT NULL,
  observacoes text,
  prazo timestamptz,
  status text NOT NULL DEFAULT 'Recebida',
  criada_em timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz,
  entregue_em timestamptz,
  historico jsonb NOT NULL DEFAULT '[]'::jsonb,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  pagamentos jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX ordens_user_idx ON public.ordens(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens TO authenticated;
GRANT ALL ON public.ordens TO service_role;
ALTER TABLE public.ordens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia suas ordens" ON public.ordens FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);