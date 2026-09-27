<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Arquitetura

- Estado das ordens vive em `src/lib/oficina-store.ts` (store com `useSyncExternalStore`, sincronizado com a tabela `ordens` do Lovable Cloud, RLS por `user_id`); telas usam só esse módulo.
- Agentes externos acessam via MCP em `src/lib/mcp/` com OAuth; tools usam o token do usuário (RLS), nunca chave admin.
