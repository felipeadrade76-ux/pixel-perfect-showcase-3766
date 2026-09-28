-- Phase 5: customer/equipment ownership, reuse and order links.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);

INSERT INTO public.clientes (
  id, nome, telefone, documento, email, cidade, uf
) VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'Cliente recorrente',
  '(35) 99999-0000',
  '12345678901',
  'cliente@example.com',
  'Itajubá',
  'MG'
);

INSERT INTO public.equipamentos (
  id, cliente_id, tipo, marca, modelo, serie
) VALUES (
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  'Motosserra',
  'Stihl',
  'MS 170',
  'SERIE-FASE5-A'
);

INSERT INTO public.ordens (
  id, cliente_id, equipamento_id, cliente, telefone, tipo_maquina, marca, modelo, serie, problema
) VALUES (
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'Cliente recorrente',
  '(35) 99999-0000',
  'Motosserra',
  'Stihl',
  'MS 170',
  'SERIE-FASE5-A',
  'Não liga'
);

DO $$
DECLARE c integer; e integer; linked uuid;
BEGIN
  SELECT count(*) INTO c FROM public.clientes;
  SELECT count(*) INTO e FROM public.equipamentos;
  SELECT cliente_id INTO linked FROM public.ordens
    WHERE id='a1000000-0000-4000-8000-000000000003';
  IF c < 1 OR e < 1 OR linked <> 'a1000000-0000-4000-8000-000000000001'::uuid THEN
    RAISE EXCEPTION 'Reusable customer/equipment links were not stored';
  END IF;
END $$;

-- Another customer's equipment cannot be attached to this customer's order.
INSERT INTO public.clientes (id, nome)
VALUES ('a1000000-0000-4000-8000-000000000004','Outro cliente');
INSERT INTO public.equipamentos (id, cliente_id, tipo)
VALUES (
  'a1000000-0000-4000-8000-000000000005',
  'a1000000-0000-4000-8000-000000000004',
  'Gerador'
);

DO $$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.ordens (
      id, cliente_id, equipamento_id, cliente, tipo_maquina, problema
    ) VALUES (
      'a1000000-0000-4000-8000-000000000006',
      'a1000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000005',
      'Cliente recorrente',
      'Gerador',
      'Teste inválido'
    );
  EXCEPTION WHEN raise_exception THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Cross-customer equipment link was accepted'; END IF;
END $$;

-- Repeated fiscal document is rejected for the same workshop account.
DO $$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.clientes (nome, documento)
    VALUES ('Duplicado','12345678901');
  EXCEPTION WHEN unique_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Duplicate customer document was accepted'; END IF;
END $$;

-- RLS and composite ownership stop another authenticated account from reusing records.
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
DO $$
DECLARE n integer; blocked boolean := false;
BEGIN
  SELECT count(*) INTO n FROM public.clientes;
  IF n <> 0 THEN RAISE EXCEPTION 'Customer RLS disclosed another account'; END IF;

  BEGIN
    INSERT INTO public.equipamentos (cliente_id, tipo)
    VALUES ('a1000000-0000-4000-8000-000000000001','Roçadeira');
  EXCEPTION WHEN foreign_key_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Cross-account equipment ownership was accepted'; END IF;
END $$;

INSERT INTO public.clientes (id, nome)
VALUES ('b1000000-0000-4000-8000-000000000001','Cliente B');
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.clientes;
  IF n <> 1 THEN RAISE EXCEPTION 'User B did not see precisely its own customer'; END IF;
END $$;

RESET ROLE;
SELECT 'PHASE5_CUSTOMERS_EQUIPMENT_TESTS_PASSED' AS result;
