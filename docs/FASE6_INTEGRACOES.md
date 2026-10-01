# Fase 6 — integrações e preparação para operação real

Status: em execução no branch `feature/ritmeia-v12-integracoes`.

## Objetivos

- preparar homologação real sem tocar no ambiente publicado atual;
- transformar a Ritmeia em PWA instalável;
- validar Supabase/Auth em ambiente próprio;
- preparar NFS-e sem expor certificado ou senha no navegador;
- criar health check para hospedagem;
- exigir backup e preflight antes de qualquer migração remota;
- melhorar retomada/múltiplos dispositivos;
- bloquear produção fiscal até liberação deliberada.

## Entregue no código

- manifest + service worker PWA;
- service worker só guarda o ícone público da marca, nunca clientes/OS/financeiro;
- `/api/health` mínimo, sem vazar configuração fiscal;
- login Google escondido até `VITE_GOOGLE_AUTH_ENABLED=true`;
- atualização automática ao voltar para o app/focar a janela;
- scripts de preflight, backup e aplicação de migrations com trava explícita;
- cadastro compatível com CNPJ alfanumérico de 2026;
- tabela de documentos fiscais com RLS;
- RPC idempotente para preparar rascunho fiscal;
- snapshot do tomador e serviço, preservado mesmo se o cadastro mestre mudar;
- mão de obra e peças congeladas em valores separados;
- browser não pode alterar status fiscal diretamente;
- configuração NFS-e server-only, HTTPS obrigatório e produção bloqueada por padrão;
- testes de banco, navegador, PWA e configuração fiscal.

## NFS-e

A Ritmeia já consegue preparar um rascunho fiscal seguro a partir de uma OS vinculada a cliente,
mas **não transmite uma nota ainda**. Isso é intencional: o adaptador de emissão depende do
emissor correto da oficina.

Para emissão direta pelo Sistema Nacional, a documentação oficial atual usa DPS em XML,
compactada em GZip/Base64 e enviada em JSON para `POST /nfse`, com certificado digital/mTLS
quando exigido pela API. Municípios também podem manter emissor próprio, então não é seguro
assumir o Sistema Nacional sem identificar o caso concreto.

Dados externos ainda necessários para fechar a emissão:

- município da oficina e código IBGE;
- regime/enquadramento atual;
- portal/emissor utilizado hoje;
- CNPJ do prestador;
- inscrição municipal, quando aplicável;
- código/subitem de serviço usado nas notas;
- tipo de autenticação exigida pelo emissor;
- certificado A1/PFX e senha somente se a integração escolhida exigir certificado.

Produção só pode ficar pronta com `NFSE_ALLOW_PRODUCTION=yes` no servidor. Homologação é o
padrão.

## Banco remoto

Nunca aplicar migrations por tentativa.

Ordem obrigatória:

```sh
bash scripts/phase6-remote-preflight.sh
bash scripts/phase6-backup.sh
RITMEIA_APPLY_MIGRATIONS=YES_I_HAVE_A_BACKUP \
  bash scripts/phase6-apply-migrations.sh
```

Esses scripts exigem `DATABASE_URL` em ambiente privado. O CI nunca recebe a URL real.

## Portões para encerrar a Fase 6

A fase só pode ser marcada como concluída quando:

1. CI do HEAD estiver integralmente verde.
2. Município/regime/provedor fiscal estiverem identificados.
3. Emissão NFS-e passar no ambiente de homologação correto.
4. Erro/rejeição e retry fiscal forem validados sem duplicar nota.
5. Supabase de homologação estiver provisionado sob controle do projeto.
6. Backup + preflight + migrations tiverem sido validados no ambiente de homologação.
7. Login por e-mail estiver testado; Google só se o provedor estiver configurado.
8. Fluxo completo for testado em celular e desktop, inclusive retomada/rede instável.
9. Nenhuma conexão bancária tiver sido adicionada.
10. Produção, `main` e banco publicado permanecerem intocados até autorização explícita.

## Referência técnica oficial

- https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/documentacao-atual
- esquema de produção usado como referência: NFS-e v1.01 / 09-02-2026

Nenhuma credencial fiscal deve ser commitada.
