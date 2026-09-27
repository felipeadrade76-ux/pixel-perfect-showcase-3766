# OficinIA — infraestrutura independente (Fase 3)

## Escopo e resultado

Código no GitHub, build e servidor TanStack Start + Nitro/Node, Dockerfile e migrações SQL reproduzíveis. A hospedagem não exige créditos, editor ou execução do Lovable. O login por e-mail/Google usa Supabase Auth; o login Google depende de configuração do provedor **no Supabase escolhido**. O antigo pacote de build e o SDK de login do Lovable saíram desta branch. O protocolo MCP ainda utiliza a biblioteca `@lovable.dev/mcp-js` como dependência npm, mas seu endpoint está mantido no próprio repositório; ativar um servidor OAuth compatível no Supabase pode exigir configuração adicional.

**Fase 3 (código de infraestrutura): pronta para a Fase 4 de layout.** O projeto Supabase remoto, hospedagem/domínio e homologação com contas reais são ações de implantação, a executar na Fase 6 com os respectivos acessos e consentimento. Não há deploy, merge na `main` nem migração no banco publicado.

## Desenvolvimento sem conta bancária ou Lovable

Pré-requisitos: Node.js 20+, Bun e Docker para iniciar Supabase local (instruções oficiais: https://supabase.com/docs/guides/local-development/cli/getting-started).

```sh
git checkout feature/oficinia-v09-independente
bun install --frozen-lockfile
npx supabase start
npx supabase status
cp .env.example .env.local
```

O `supabase/` já existe; **não execute `supabase init` por cima dele**. Preencha `.env.local` com a URL local da API e a chave publishable/anon informadas pelo `supabase status`. Em ambiente local use a URL que o navegador consegue alcançar. Nunca armazene tokens de administração no repositório nem configure `SUPABASE_SERVICE_ROLE_KEY` com prefixo `VITE_`. O `supabase/config.toml` desta branch usa o identificador local `oficinia-local`, não o ref do projeto Lovable original.

```sh
bun run dev
bun run build
bunx tsc --noEmit
bunx eslint . --max-warnings 0
```

Se alterar migrations locais, use `npx supabase db reset` **somente no banco LOCAL descartável**. Nunca use `--linked` para tentar limpar dados reais. O CI testa as regras de transação, RLS, pagamentos e cobranças com PostgreSQL separado, sem tocar em Supabase externo.

## Servidor independente e imagem de produção

`vite.config.ts` usa os plugins públicos do TanStack Start, React, Tailwind e Nitro, com preset Node. `bun run build` gera `.output/` e `bun run start` executa `.output/server/index.mjs`. O workflow executa smoke tests de SSR na porta local, incluindo abertura de `/` e `/login`, usando **chaves fictícias**.

Também existe `Dockerfile` multi-stage com usuário sem privilégios e `.dockerignore` que exclui arquivos de ambiente. Exemplo de execução local com dados do seu projeto (não use credenciais reais diretamente na linha de comando compartilhada):

```sh
docker build -t oficinia-test \
  --build-arg VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY .
docker run --rm -p 3000:3000 \
  --env-file .env.local oficinia-test
```

As variáveis `VITE_*` são **públicas e incorporadas no build**. Mesmo sendo publishable, só as forneça nos painéis privados da plataforma. Nunca passe senhas, tokens privados, chave service-role ou `sb_secret_*` como argumentos de build. Configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` no ambiente do servidor.

`render.yaml` é um blueprint **opcional** para criar um serviço de teste com Docker; não instala nem publica nada sozinho. A plataforma lê as variáveis solicitadas do painel quando o proprietário importa o repositório. Escolha o branch de homologação, revise o plano/custo e só então confirme a criação. Como o app possui SSR e rota MCP, não basta hospedar os arquivos HTML numa hospedagem estática. Mais informações sobre hospedagem: https://tanstack.com/start/latest/docs/framework/react/guide/hosting.

## Banco próprio remoto — reservado para implantação

1. Criar um Supabase sob controle da oficina, separado do banco publicado do Lovable.
2. Fazer backup e rodar `supabase/tests/deployment-preflight.sql` no ambiente de destino para conferir esquema, duplicações e formato de JSON.
3. Aplicar as migrations em ordem, em banco NOVO ou validado. Conferir funções, grants e RLS; nenhuma migration é aplicada pelo CI ao banco real.
4. Configurar URL de teste e URLs de retorno no Supabase Auth. Habilitar Google somente se houver provedor Google configurado; e-mail/senha funciona sem Google.
5. Testar duas contas fictícias e navegação no celular, perda de rede, concorrência, cobranças e pagamentos. Após aceite, planejar migração de dados e troca de domínio. **Não utilizar dados de pagamento reais antes desse aceite.**

## Financeiro manual e reversibilidade

A OficinIA registra pedidos e recebimentos como um controle **operacional**, não consulta extratos, não transfere dinheiro nem se conecta a conta/chave Pix. O aviso `informado` nunca aumenta o valor recebido; apenas a confirmação após conferência gera a baixa.

A versão Lovable publicada e a `main` ficam intactas até autorização explícita. Voltar ao Lovable futuramente é possível mediante revisão de compatibilidade entre branches, variáveis, autenticação e bancos, mas não haverá sincronização automática entre bancos ou garantia de que a configuração de build independente seja aceita pelo editor sem adaptações.

## Fronteira das próximas fases

- **Fase 4:** layout, responsividade e experiência no celular.
- **Fase 5:** rotinas, relatórios, exportação e aprimoramentos operacionais.
- **Fase 6:** criar/provisionar serviço real, aplicar migrations ao ambiente escolhido após backup, testar fluxos ponta a ponta com contas de teste e, com aprovação, publicar.
