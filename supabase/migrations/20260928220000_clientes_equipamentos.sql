-- Phase 5: reusable customers and equipment registry.
-- Keeps the denormalized customer/equipment fields on orders as historical snapshots.
-- New foreign keys link future orders to the reusable master records.

CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  nome text NOT NULL CHECK (btrim(nome) <> ''),
  telefone text,
  documento text,
  email text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clientes_id_user_unique UNIQUE (id, user_id)
);

CREATE INDEX clientes_user_nome_idx ON public.clientes (user_id, lower(nome));
CREATE UNIQUE INDEX clientes_user_documento_unique
  ON public.clientes (user_id, documento)
  WHERE documento IS NOT NULL AND btrim(documento) <> '';

GRANT SELECT, INSERT, UPDATE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia seus clientes" ON public.clientes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  cliente_id uuid NOT NULL,
  tipo text NOT NULL CHECK (btrim(tipo) <> ''),
  marca text,
  modelo text,
  serie text,
  apelido text,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipamentos_id_user_unique UNIQUE (id, user_id),
  CONSTRAINT equipamentos_cliente_owner_fk
    FOREIGN KEY (cliente_id, user_id)
    REFERENCES public.clientes(id, user_id)
    ON DELETE RESTRICT
);

CREATE INDEX equipamentos_user_cliente_idx ON public.equipamentos (user_id, cliente_id);
CREATE UNIQUE INDEX equipamentos_user_serie_unique
  ON public.equipamentos (user_id, serie)
  WHERE serie IS NOT NULL AND btrim(serie) <> '';

GRANT SELECT, INSERT, UPDATE ON public.equipamentos TO authenticated;
GRANT ALL ON public.equipamentos TO service_role;
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia seus equipamentos" ON public.equipamentos FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.ordens
  ADD COLUMN IF NOT EXISTS cliente_id uuid,
  ADD COLUMN IF NOT EXISTS equipamento_id uuid;

ALTER TABLE public.ordens
  ADD CONSTRAINT ordens_cliente_owner_fk
    FOREIGN KEY (cliente_id, user_id)
    REFERENCES public.clientes(id, user_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT ordens_equipamento_owner_fk
    FOREIGN KEY (equipamento_id, user_id)
    REFERENCES public.equipamentos(id, user_id)
    ON DELETE RESTRICT;

CREATE INDEX ordens_cliente_idx ON public.ordens (user_id, cliente_id);
CREATE INDEX ordens_equipamento_idx ON public.ordens (user_id, equipamento_id);

CREATE OR REPLACE FUNCTION public.ritmeia_atualizar_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END $$;

CREATE TRIGGER ritmeia_clientes_timestamp
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.ritmeia_atualizar_timestamp();

CREATE TRIGGER ritmeia_equipamentos_timestamp
BEFORE UPDATE ON public.equipamentos
FOR EACH ROW EXECUTE FUNCTION public.ritmeia_atualizar_timestamp();

CREATE OR REPLACE FUNCTION public.ritmeia_validar_vinculo_ordem()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_cliente uuid;
BEGIN
  IF NEW.equipamento_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Equipamento exige cliente vinculado';
  END IF;
  SELECT cliente_id INTO v_cliente
    FROM public.equipamentos
    WHERE id = NEW.equipamento_id AND user_id = NEW.user_id;
  IF v_cliente IS NULL OR v_cliente <> NEW.cliente_id THEN
    RAISE EXCEPTION 'Equipamento não pertence ao cliente da ordem';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER ritmeia_validar_vinculo_ordem
BEFORE INSERT OR UPDATE OF cliente_id, equipamento_id, user_id ON public.ordens
FOR EACH ROW EXECUTE FUNCTION public.ritmeia_validar_vinculo_ordem();

-- The operational browser may change links only through its own row and RLS.
GRANT UPDATE (cliente_id, equipamento_id) ON public.ordens TO authenticated;
