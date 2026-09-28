# Fase 4 — identidade e interface Ritmeia

Status: concluída no branch `feature/oficinia-v10-layout-mobile`.

## Escopo fechado

- identidade visual Ritmeia aplicada às superfícies do produto;
- símbolo vetorial e favicon próprios do produto;
- interface deliberadamente somente clara, inclusive quando o dispositivo prefere modo escuro;
- navegação mobile com barra inferior e desktop com sidebar;
- login, dashboard, ordens, nova entrada, detalhe da OS, agenda e financeiro padronizados;
- cobranças assistidas alinhadas ao mesmo sistema visual;
- estados de carregamento, erro, vazio, 404 e consentimento OAuth tratados;
- áreas clicáveis e ações principais dimensionadas para toque;
- foco visível, link de pular conteúdo e respeito a `prefers-reduced-motion`;
- proteção contra overflow horizontal verificada no fluxo de navegador em viewport móvel;
- shell desktop coberto por teste de navegador;
- textos e metadados principais atualizados para Ritmeia.

## Decisões de produto preservadas

- nenhuma conexão bancária foi adicionada;
- confirmação de recebimento continua manual;
- nenhuma emissão fiscal falsa ou incompleta foi adicionada nesta fase;
- cadastro reutilizável de clientes e integração real de NFS-e ficam para fase funcional posterior;
- nenhuma publicação, merge em `main` ou migração em banco remoto faz parte desta fase.

## Validação

A conclusão exige o workflow completo verde no HEAD desta branch:

- build e typecheck;
- regressões unitárias;
- ESLint sem erros ou avisos;
- smoke SSR/Node;
- container de produção;
- Chromium/Playwright com Supabase simulado;
- banco PostgreSQL descartável, RLS, concorrência e regras de cobrança.

A Fase 4 só deve ser considerada encerrada quando o CI do commit final estiver integralmente verde.
