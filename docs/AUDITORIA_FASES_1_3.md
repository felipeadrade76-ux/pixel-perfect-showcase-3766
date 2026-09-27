# OficinIA — auditoria de regressão das Fases 1, 2 e 3

## Decisão de qualidade

**Liberado para desenvolver a Fase 4 (layout), condicionado a manter as migrações e regressões desta auditoria na linha de desenvolvimento.** Não equivale a certificação de ausência absoluta de bugs nem à liberação do piloto/produção. O backend remoto novo, login real do provedor Google, backups e testes em dispositivos físicos ficam como gates obrigatórios da Fase 6.

Branch `audit/oficinia-fases-1-3`, derivada da branch da Fase 3. O sistema Lovable publicado e a `main` não foram modificados.

## Erros reais identificados e corrigidos

1. **Cobrança pendente versus pagamento manual:** era possível lançar um recebimento separado que consumisse o saldo reservado para uma cobrança já criada, fazendo a futura confirmação falhar. A migration `20260928010000_auditoria_regressao.sql` preserva a reserva e impede reduzir itens abaixo do valor pago + reservado.
2. **Recibo com identificador de cobrança:** era possível registrar um recibo com ID de cobrança, deixar o pedido como pendente e reservar seu valor pela segunda vez. A operação agora exige valor e forma compatíveis e confirma a cobrança na mesma transação.
3. **Troca de conta durante requisição:** a resposta atrasada de criar OS, editar, receber ou excluir poderia atualizar a interface de outra sessão. O store agora verifica um contador de sessão separado do contador de consultas; o estado de tentativas de pagamento é limpo na troca.
4. **Listagens limitadas:** ordens e avisos financeiros dependiam da primeira página padrão do Supabase; agora consultam páginas ordenadas e só substituem a lista depois da conclusão sem erro.
5. **Mensagens financeiras enganosas:** confirmação de recebimento seguida de falha para atualizar a tela poderia aparentar que a baixa falhou; a interface distingue confirmação no banco de atualização visual. O formulário admite retomada com o mesmo ID após resposta de rede incerta.
6. **Avisos desatualizados:** o financeiro atualiza avisos ao mudar as ordens e quando a página recupera foco, descartando consultas antigas. O mês é calculado explicitamente na data local.
7. **Blueprint de homologação:** o `render.yaml` deixa de depender implicitamente da `main`, que ainda corresponde ao site antigo; exige revisão antes de implantação definitiva.

## Testes automatizados de regressão

- **SQL real (PostgreSQL 16 descartável):** migrations na ordem, duas contas e RLS, permissões, números únicos, transações, pagamentos parciais, saldo, deduplicação, duas confirmações, cobranças concorrentes, recusa de overbooking, redução de itens e conversão do pedido em recibo.
- **Bun (store isolado):** paginação acima de mil ordens, resposta atrasada após logout, criação enquanto troca de conta, falha na página posterior sem mostrar lista incompleta, retry com UUID idempotente e validação monetária.
- **Chromium real com Supabase simulado:** acesso anônimo e login inválido; tamanho de tela equivalente a celular; usuário fictício cria OS, adiciona item, prepara cobrança, marca aviso de cliente, confirma recebimento e consulta o financeiro. As respostas do Supabase são simuladas deliberadamente: não há alteração de dados reais.
- **Infra independente:** build, TypeScript, lint, servidor SSR em Node, imagem Docker em execução e respostas HTTP. A CLI de Supabase remoto não é chamada pelo CI.

Acompanhe a última execução na página de Actions da PR de auditoria. Cada release deve usar a execução verde correspondente ao **commit HEAD exato**, não um resultado antigo.

## O que ainda NÃO foi testado de ponta a ponta

- Criação e configuração de um Supabase próprio remoto, URLs OAuth, conta Google real e hospedagem independente pública.
- Aplicação das migrations a um banco remoto com backup validado, dados legados reais e plano de reversão.
- Dois telefones físicos, iOS/Safari, câmera e rede celular fraca/offline em cenário real.
- Sincronização entre aparelhos com alterações concorrentes usando serviço remoto, integração MCP externa OAuth com emissor configurado e execução contínua em produção.
- Conciliação bancária automática: **não existe por escolha de produto**. A confirmação segue manual.

## Regras para seguir

Continuar a Fase 4 em branch filha desta auditoria, mantendo o CI verde. Não mesclar PRs, não aplicar migrações no banco Lovable, não publicar e não afirmar que recebimentos foram verificados pelo banco externo sem autorização e validação na Fase 6. Ao optar por voltar ao Lovable, testar novamente o build e o esquema porque os ambientes não se sincronizam automaticamente.
