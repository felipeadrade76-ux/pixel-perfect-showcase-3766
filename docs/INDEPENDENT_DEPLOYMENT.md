# OficinIA — execução independente e opção de retorno ao Lovable

## Decisão de arquitetura

O repositório GitHub é a fonte do código. As fases novas ficam em branches e PRs encadeadas, sem mexer em `main` ou no site publicado enquanto não houver homologação. Voltar ao Lovable é uma escolha futura: o código anterior e o projeto original permanecem disponíveis. **Não executar migrações de um ambiente no outro sem conferir e fazer backup.**

A aplicação existente é TanStack Start (SSR) + React, não um site HTML estático. Ela precisa de hospedagem compatível com o servidor e de Supabase para login, OS, pagamentos manuais e cobranças assistidas. O pacote de build `@lovable.dev/vite-tanstack-config` e as rotas MCP ainda são dependências de código provenientes do Lovable; **independência de créditos/editor não equivale a remoção de toda dependência do SDK**. Migrar esse build para uma configuração neutra é trabalho de validação separado.

## Ambiente próprio (sem conta bancária)

1. Crie um projeto Supabase controlado pela oficina ou configure um banco de teste já existente. Antes de mover dados, confira backup, titulares e permissões. Não usar a instância publicada do Lovable como ambiente de teste.
2. Copie `.env.example` para `.env.local` e preencha somente com a URL e a chave **publishable** do seu projeto. Não envie valores no chat nem faça commit. `SUPABASE_SERVICE_ROLE_KEY` fica **apenas em um runtime de servidor confiável**, se necessário; nunca em `VITE_*`.
3. Execute as migrações na ordem dos arquivos em `supabase/migrations/` em banco novo. Para banco com dados, rode `supabase/tests/deployment-preflight.sql` e resolva divergências primeiro. Migrações não são aplicadas automaticamente por GitHub Actions.
4. Ajuste Auth → URL Configuration para a origem de teste e o URL de produção depois de escolher a hospedagem. Para Google, configure o provedor no **Supabase Auth** e a URL de callback aprovada; o botão de Google usa agora `supabase.auth.signInWithOAuth`, sem SDK de login Lovable. O login por e-mail e senha não exige o Google.
5. Execute `bun install --frozen-lockfile`, `bun run build`, `bunx tsc --noEmit` e `bunx eslint . --max-warnings 0`. O GitHub CI também sobe PostgreSQL descartável para testar transações e RLS.
6. Escolha e configure uma hospedagem para o **servidor** TanStack Start, não uma hospedagem apenas de arquivos estáticos. Configure as variáveis no painel de segredos dessa hospedagem; associe um domínio/URL de teste primeiro.
7. Faça smoke test em celular e desktop com **duas contas fictícias**: login, OS nova, itens, pagamento, cobrança assistida, aviso informado, confirmação, atualização do dashboard, sessão, rede interrompida e concorrência.
8. Só depois decida aprovar PRs, migrar dados, apontar domínio e publicar. A versão Lovable original fica preservada até a troca deliberada.

### A cobrança assistida não é um banco digital

Não se conecta a banco/conta/chave Pix e não consulta extrato. `aguardando` e `informado` não contam como dinheiro recebido. O responsável confere o dinheiro fora da OficinIA e então confirma manualmente; a operação de baixa no banco de dados da aplicação é transacional e idempotente.

## Plano de fases

| Etapa | Escopo | Critério de pronto |
| --- | --- | --- |
| Fases 1–2 | Ordens, financeiro manual, integridade e cobranças assistidas | Código e testes de DB/CI verdes; homologação de UI ainda necessária |
| Infra independente (fase atual) | Retirar dependência do login Lovable, template de ambiente, CI e implantação separada | Build sem variáveis do Lovable, banco próprio e teste remoto |
| Experiência mobile | Navegação, acessibilidade, mensagens, formulários e testes em telas pequenas | Testes de UI e uso real por operadores |
| Operação da oficina | Busca, filtros, dados de cliente/máquina, relatórios, impressão, exportação e recuperação | Requisitos confirmados com usuário e testes automatizados |
| Piloto | Backup, contas, privacidade, domínio, observabilidade, correções | Homologação com dados fictícios e aceite antes de dados reais |

**Status atual:** infraestrutura independente em desenvolvimento. Não anunciar aplicativo finalizado ou publicado até verificar cada critério. O retorno ao Lovable continua opcional; não pressupor sincronização automática de branches ou bancos.
