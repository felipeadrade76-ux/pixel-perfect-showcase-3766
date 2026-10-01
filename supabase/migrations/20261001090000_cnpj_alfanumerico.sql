-- 2026 fiscal compatibility: CPF stays 11 digits; CNPJ may contain letters.
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_documento_check;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_documento_check
  CHECK (
    documento IS NULL
    OR documento ~ '^[0-9]{11}$'
    OR documento ~ '^[A-Z0-9]{14}$'
  );
