# OficinIA — Fase 2: validação e implantação segura

**Não executar a migration diretamente na oficina em produção sem backup e homologação.**
As migrações devem ser aplicadas em ordem: schema inicial, `20260927230000_oficinia_integridade.sql`, `20260927233000_cobranca_assistida.sql` e `20260928010000_auditoria_regressao.sql`. Nunca pular a última: ela protege cobranças pendentes de pagamentos manuais e alterações de itens. A execução no GitHub Actions usa PostgreSQL descartável e simula duas contas autenticadas; ela **não altera o Lovable Cloud**.

## Antes de aplicar no Supabase/Lovable Cloud

1. Faça backup/export da tabela `public.ordens`, inclusive JSON de itens, pagamentos e histórico.
2. Verifique duplicidade anterior de números por usuário:
   ```sql
   SELECT user_id, numero, count(*)
   FROM public.ordens GROUP BY user_id, numero HAVING count(*) > 1;
   ```
   A migração deliberadamente falha ao criar índice único se houver duplicações; **não renumere automaticamente históricos antigos** sem confirmar o procedimento com a oficina.
3. Verifique registros inválidos antes de instalar a validação de saldo:
   ```sql
   SELECT id, numero, itens, pagamentos FROM public.ordens
   WHERE jsonb_typeof(itens) <> 'array' OR jsonb_typeof(pagamentos) <> 'array';
   ```
4. Aplique as migrações em ambiente de teste e confira as permissões `authenticated`, o trigger de versão, a RPC `oficinia_registrar_pagamento` e as três RPCs de cobrança assistida.
5. Confirme que o código da branch de desenvolvimento e a migração foram ativados **juntos**. Código novo sem migration falha no RPC; migration com código antigo pode impedir updates financeiros antigos, por segurança.

## Homologação funcional com dados fictícios

- Entrar como usuário A, criar duas ordens ao mesmo tempo e confirmar números diferentes.
- Entrar como usuário B; nenhuma OS de A deve aparecer, inclusive por URL/UUID ou pela ferramenta MCP.
- Sem conexão: criar/editar uma OS deve mostrar erro, sem mensagem falsa de salvamento. Reconectar e conferir que não surgiu OS duplicada.
- Editar a mesma OS em dois dispositivos: a segunda edição com revisão antiga deve ser recusada, sem sobrescrever histórico ou pagamento da primeira.
- Registrar Pix fictício de R$ 50 em uma OS de R$ 100; repetir a mesma requisição deve manter **um** lançamento de R$ 50.
- Enviar dois pagamentos de R$ 80 simultaneamente para uma OS de R$ 100: somente um pode ser aceito.
- Registrar um pagamento de R$ 101 para OS de R$ 100: operação deve falhar.
- Tentar reduzir peças/mão de obra abaixo do já pago: operação deve falhar.
- Excluir OS sem pagamentos com confirmação: só desaparecer após resposta do banco. Excluir OS com pagamento deve ser recusado.
- Consultar histórico, lista, agenda e financeiro após recarregar a página e após novo login.
- Com cobrança de R$ 80 pendente numa OS de R$ 100, recusar pagamento manual de R$ 30 e redução de itens a R$ 70; aceitar R$ 20 adicional e depois confirmar os R$ 80 exatamente uma vez.
- Confirmar que marcar «cliente informou» não altera recebido e que uma baixa com o ID de uma cobrança não deixa reserva fantasma.
- Conferir mais de mil OS e avisos, inclusive após uma falha de rede na segunda página.
- Reexecutar os testes de navegador do relatório `docs/AUDITORIA_FASES_1_3.md` na revisão final.

## Critérios para liberar o piloto

- Build, TypeScript, lint e testes SQL/concor­rência devem estar verdes na **última revisão** da branch.
- A migration deve estar aplicada e homologada na instância real, em ambiente apropriado.
- Testes de interface e rede em telefone simples e duas contas devem ser conferidos.
- Somente depois aprovar PRs e publicar; não usar dados ou pagamentos reais antes desses itens.
