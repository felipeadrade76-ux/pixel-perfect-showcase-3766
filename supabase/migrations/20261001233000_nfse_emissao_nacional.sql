-- Phase 6: durable national NFS-e sequence and emission state.
-- Service-role only mutation. Authenticated browsers remain read-only for fiscal documents.

ALTER TABLE public.documentos_fiscais
  ADD COLUMN IF NOT EXISTS serie_dps integer,
  ADD COLUMN IF NOT EXISTS numero_dps bigint,
  ADD COLUMN IF NOT EXISTS id_dps text,
  ADD COLUMN IF NOT EXISTS chave_acesso text,
  ADD COLUMN IF NOT EXISTS xml_nfse text,
  ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_tentativa_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_http_status integer;

ALTER TABLE public.documentos_fiscais
  ADD CONSTRAINT documentos_fiscais_serie_dps_check
    CHECK (serie_dps IS NULL OR serie_dps BETWEEN 1 AND 99999),
  ADD CONSTRAINT documentos_fiscais_numero_dps_check
    CHECK (numero_dps IS NULL OR numero_dps BETWEEN 1 AND 999999999999999);

CREATE UNIQUE INDEX documentos_fiscais_dps_unique
  ON public.documentos_fiscais (user_id, serie_dps, numero_dps)
  WHERE serie_dps IS NOT NULL AND numero_dps IS NOT NULL;

CREATE UNIQUE INDEX documentos_fiscais_chave_acesso_unique
  ON public.documentos_fiscais (chave_acesso)
  WHERE chave_acesso IS NOT NULL;

CREATE TABLE public.nfse_dps_contadores (
  user_id uuid NOT NULL,
  serie integer NOT NULL CHECK (serie BETWEEN 1 AND 99999),
  proximo_numero bigint NOT NULL DEFAULT 1
    CHECK (proximo_numero BETWEEN 1 AND 1000000000000000),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, serie)
);

REVOKE ALL ON public.nfse_dps_contadores FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.nfse_dps_contadores TO service_role;

ALTER TABLE public.nfse_dps_contadores ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ritmeia_reservar_dps(
  p_user_id uuid,
  p_documento_id uuid,
  p_serie integer
)
RETURNS public.documentos_fiscais
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $ritmeia$
DECLARE
  v_doc public.documentos_fiscais%ROWTYPE;
  v_numero bigint;
BEGIN
  IF p_serie < 1 OR p_serie > 99999 THEN
    RAISE EXCEPTION 'Serie DPS invalida';
  END IF;

  SELECT *
    INTO v_doc
  FROM public.documentos_fiscais
  WHERE id = p_documento_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento fiscal nao encontrado';
  END IF;

  IF v_doc.status = 'emitido' THEN
    RETURN v_doc;
  END IF;

  IF v_doc.serie_dps IS NOT NULL AND v_doc.numero_dps IS NOT NULL THEN
    IF v_doc.serie_dps <> p_serie THEN
      RAISE EXCEPTION 'Documento ja reservou outra serie DPS';
    END IF;
    RETURN v_doc;
  END IF;

  INSERT INTO public.nfse_dps_contadores (user_id, serie, proximo_numero)
  VALUES (p_user_id, p_serie, 2)
  ON CONFLICT (user_id, serie)
  DO UPDATE SET
    proximo_numero = public.nfse_dps_contadores.proximo_numero + 1,
    atualizado_em = now()
  RETURNING proximo_numero - 1 INTO v_numero;

  IF v_numero < 1 OR v_numero > 999999999999999 THEN
    RAISE EXCEPTION 'Sequencia DPS esgotada';
  END IF;

  UPDATE public.documentos_fiscais
  SET
    serie_dps = p_serie,
    numero_dps = v_numero,
    provedor = 'nacional',
    status = CASE WHEN status = 'rascunho' THEN 'pronto' ELSE status END
  WHERE id = p_documento_id
    AND user_id = p_user_id
  RETURNING * INTO v_doc;

  RETURN v_doc;
END
$ritmeia$;

REVOKE ALL ON FUNCTION public.ritmeia_reservar_dps(uuid,uuid,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ritmeia_reservar_dps(uuid,uuid,integer)
  TO service_role;
