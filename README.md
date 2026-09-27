# OficinIA

Sistema de ordens de serviço para oficina de máquinas, com financeiro manual e cobranças assistidas.

## Desenvolvimento independente

Este repositório preserva a opção de usar o Lovable no futuro, mas as próximas etapas são desenvolvidas e testadas no GitHub. Para preparar um ambiente com Supabase próprio e uma hospedagem compatível com TanStack Start, veja [o guia de implantação independente](docs/INDEPENDENT_DEPLOYMENT.md).

A aplicação **não** se conecta a contas bancárias. Aviso de pagamento pelo cliente não é confirmação de recebimento.

## Rodar localmente

```sh
cp .env.example .env.local
# Preencha os valores PUBLICÁVEIS do seu projeto Supabase; nunca envie senhas ao GitHub.
bun install --frozen-lockfile
bun run dev
```

O banco precisa das migrações em `supabase/migrations/`. Em qualquer banco com dados, confira backup e execute a pré-verificação antes. O CI testa as migrações com um banco descartável; não modifica o banco da oficina.

```sh
bun run build
bunx tsc --noEmit
bunx eslint . --max-warnings 0
```

**Aplicativo publicado original (sem as novas fases):** https://pixel-perfect-showcase-3766.lovable.app. Não tratar PRs não mescladas como produção.

## Histórico e opção de retorno

O projeto começou no [Lovable](https://lovable.dev/projects/5db34274-051b-4c1d-9760-57bf4636978c). As PRs das fases ficam em branches separadas, sem reescrever histórico ou substituir o banco original. Reutilizar o Lovable posteriormente é opcional, após testar compatibilidade e migrações.
