-- Phase 6: fiscal preparation and immutable-ish NFS-e draft snapshots.
-- This does NOT transmit or issue an invoice. It only freezes the operational data
-- that a future provider adapter will use after the workshop's fiscal configuration is confirmed.

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ordens_id_user_unique' AND conrelid = 'public.ordens'::regclass
  ) THEN
    ALTER TABLE public.ordens
      ADD CONSTRAINT ordens_id_user_unique UNIQUE (id, user_id);
  END IF;
END $;

CREATE TABLE public.documentos_fiscais (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  ordem_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','pronto','enviando','emitido','rejeitado','cancelado')),
  ambiente text NOT NULL DEFAULT 'homologacao'
    CHECK (ambiente IN ('homologacao','producao')),
  provedor text NOT NULL DEFAULT 'nao_configurado',
  valor_servicos numeric(14,2) NOT NULL CHECK (valor_servicos >= 0),
  valor_pecas numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_pecas >= 0),
  valor_total_ordem numeric(14,2) NOT NULL CHECK (valor_total_ordem >= 0),
  tomador jsonb NOT NULL,
  servico jsonb NOT NULL,
  numero_nfse text,
  codigo_verificacao text,
  protocolo text,
  xml_url text,
  pdf_url text,
  erro_codigo text,
  erro_mensagem text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  emitido_em timestamptz,
  CONSTRAINT documentos_fiscais_ordem_owner_fk
    FOREIGN KEY (ordem_id, user_id)
    REFERENCES public.ordens(id, user_id)
    ON DELETE RESTRICT,
  CONSTRAINT documentos_fiscais_cliente_owner_fk
    FOREIGN KEY (cliente_id, user_id)
    REFERENCES public.clientes(id, user_id)
    ON DELETE RESTRICT
);

CREATE INDEX documentos_fiscais_user_ordem_idx
  ON public.documentos_fiscais (user_id, ordem_id, criado_em DESC);

CREATE UNIQUE INDEX documentos_fiscais_ordem_rascunho_unique
  ON public.documentos_fiscais (user_id, ordem_id)
  WHERE status IN ('rascunho','pronto','enviando');

GRANT SELECT ON public.documentos_fiscais TO authenticated;
GRANT ALL ON public.documentos_fiscais TO service_role;
ALTER TABLE public.documentos_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono le seus documentos fiscais"
  ON public.documentos_fiscais FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER ritmeia_documentos_fiscais_timestamp
BEFORE UPDATE ON public.documentos_fiscais
FOR EACH ROW EXECUTE FUNCTION public.ritmeia_atualizar_timestamp();

CREATE OR REPLACE FUNCTION public.ritmeia_preparar_nfse(
  p_ordem uuid,
  p_documento_id uuid,
  p_ambiente text DEFAULT 'homologacao'
)
RETURNS public.documentos_fiscais
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordem public.ordens%ROWTYPE;
  v_cliente public.clientes%ROWTYPE;
  v_total numeric(14,2);
  v_pecas numeric(14,2);
  v_total_ordem numeric(14,2);
  v_doc public.documentos_fiscais%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_ambiente NOT IN ('homologacao','producao') THEN
    RAISE EXCEPTION 'Ambiente fiscal invalido';
  END IF;

  SELECT * INTO v_ordem
  FROM public.ordens
  WHERE id = p_ordem AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem nao encontrada';
  END IF;

  IF v_ordem.cliente_id IS NULL THEN
    RAISE EXCEPTION 'A ordem precisa estar vinculada a um cliente cadastrado';
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = v_ordem.cliente_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente nao encontrado';
  END IF;

  IF v_cliente.documento IS NULL OR v_cliente.cidade IS NULL OR v_cliente.uf IS NULL THEN
    RAISE EXCEPTION 'Complete CPF/CNPJ e cidade/UF antes de preparar a NFS-e';
  END IF;

  SELECT coalesce(sum((item->>'valor')::numeric), 0)
    INTO v_total
  FROM jsonb_array_elements(v_ordem.itens) AS item
  WHERE item->>'tipo' = 'Mão de obra';

  SELECT coalesce(sum((item->>'valor')::numeric), 0)
    INTO v_pecas
  FROM jsonb_array_elements(v_ordem.itens) AS item
  WHERE item->>'tipo' = 'Peça';

  v_total_ordem := v_total + v_pecas;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'A ordem precisa ter mao de obra com valor antes de preparar a NFS-e';
  END IF;

  SELECT * INTO v_doc
  FROM public.documentos_fiscais
  WHERE user_id = auth.uid()
    AND ordem_id = v_ordem.id
    AND status IN ('rascunho','pronto','enviando')
  ORDER BY criado_em DESC
  LIMIT 1;

  IF v_doc.id IS NOT NULL THEN
    RETURN v_doc;
  END IF;

  INSERT INTO public.documentos_fiscais (
    id,
    user_id,
    ordem_id,
    cliente_id,
    status,
    ambiente,
    provedor,
    valor_servicos,
    valor_pecas,
    valor_total_ordem,
    tomador,
    servico
  ) VALUES (
    p_documento_id,
    auth.uid(),
    v_ordem.id,
    v_cliente.id,
    'rascunho',
    p_ambiente,
    'nao_configurado',
    v_total,
    v_pecas,
    v_total_ordem,
    jsonb_build_object(
      'nome', v_cliente.nome,
      'documento', v_cliente.documento,
      'email', v_cliente.email,
      'telefone', v_cliente.telefone,
      'cep', v_cliente.cep,
      'logradouro', v_cliente.logradouro,
      'numero', v_cliente.numero,
      'complemento', v_cliente.complemento,
      'bairro', v_cliente.bairro,
      'cidade', v_cliente.cidade,
      'uf', v_cliente.uf
    ),
    jsonb_build_object(
      'ordem_id', v_ordem.id,
      'numero_os', v_ordem.numero,
      'problema', v_ordem.problema,
      'tipo_maquina', v_ordem.tipo_maquina,
      'marca', v_ordem.marca,
      'modelo', v_ordem.modelo,
      'itens', v_ordem.itens
    )
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING * INTO v_doc;

  IF v_doc.id IS NULL THEN
    SELECT * INTO v_doc
    FROM public.documentos_fiscais
    WHERE id = p_documento_id AND user_id = auth.uid();

    IF v_doc.id IS NULL THEN
      RAISE EXCEPTION 'Nao foi possivel recuperar o rascunho fiscal';
    END IF;

    IF v_doc.ordem_id <> v_ordem.id OR v_doc.ambiente <> p_ambiente THEN
      RAISE EXCEPTION 'Identificador fiscal ja utilizado em outra preparacao';
    END IF;
  END IF;

  RETURN v_doc;
END $;

REVOKE ALL ON FUNCTION public.ritmeia_preparar_nfse(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ritmeia_preparar_nfse(uuid,uuid,text) TO authenticated;
