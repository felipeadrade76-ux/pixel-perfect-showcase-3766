# Fase 6 — integrações e preparação para operação real

Status: iniciada no branch `feature/ritmeia-v12-integracoes`.

## Objetivos

- preparar homologação real sem tocar no ambiente publicado atual;
- transformar a Ritmeia em PWA instalável;
- validar Supabase/Auth em ambiente próprio;
- preparar integração de NFS-e sem expor certificados ou senhas no navegador;
- criar health check para hospedagem;
- executar migrações apenas depois de backup e validação do destino;
- testar conta real de homologação, múltiplos dispositivos e rede instável.

## NFS-e

A Fase 6 separa configuração pública de segredos fiscais.

Variáveis como certificado digital e senha são exclusivamente de servidor. O navegador nunca recebe
esses valores. O provedor fica desativado por padrão.

Antes de ativar a emissão real precisamos identificar:
- município da oficina e código IBGE;
- enquadramento tributário atual;
- emissor/provedor efetivamente usado hoje;
- CNPJ e inscrição municipal necessários à emissão;
- código(s) de serviço;
- forma de autenticação/certificado exigida pelo provedor.

Somente depois disso entra a implementação do adaptador concreto, primeiro em homologação.

## PWA

A aplicação agora possui manifest e service worker. O service worker não armazena páginas
autenticadas, ordens, clientes ou financeiro em cache: somente o ativo visual público da marca.

## Segurança

- nenhum segredo fiscal usa prefixo `VITE_`;
- nenhum certificado é commitado;
- `/api/health` expõe apenas indicadores booleanos de prontidão, nunca valores secretos;
- NFS-e inicia com `NFSE_PROVIDER=disabled`;
- produção fiscal não será habilitada automaticamente.

## Deploy

O blueprint opcional de homologação foi atualizado para a Ritmeia e aponta para esta branch.
Importá-lo numa conta de hospedagem continua sendo uma ação manual e deliberada.

Nenhum deploy, merge, migração remota ou ativação fiscal faz parte deste commit.
