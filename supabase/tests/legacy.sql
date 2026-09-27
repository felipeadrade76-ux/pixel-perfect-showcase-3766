-- Simulates existing owner data before the Phase 2 migration is applied.
INSERT INTO public.ordens (id,user_id,numero,cliente,tipo_maquina,problema)
VALUES ('99999999-9999-4999-8999-999999999999',
'cccccccc-cccc-4ccc-8ccc-cccccccccccc','OS-0042',
'Cliente legado','Motosserra','Histórico anterior');
