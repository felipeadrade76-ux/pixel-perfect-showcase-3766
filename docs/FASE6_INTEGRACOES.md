# Fase 6 — integrações e preparação para operação real

Status: **implementação de software concluída** no branch `feature/ritmeia-v12-integracoes`.
A ativação fiscal real permanece bloqueada por dados/credenciais externos da oficina e não pode ser
simulada como concluída.

## Entregas concluídas no código

- PWA instalável com manifest e service worker;
- service worker sem cache de clientes, OS, financeiro ou páginas autenticadas;
- health check para hospedagem;
- login por e-mail/senha e Google opcional, sem mostrar Google antes de configurar o provedor;
- atualização de dados ao retomar o app;
- scripts de preflight, backup e migração remota com trava explícita;
- CNPJ alfanumérico compatível;
- documentos fiscais protegidos por RLS;
- snapshot fiscal do cliente/OS, separado do cadastro mestre;
- mão de obra e peças separadas para não somar peças ao valor de serviço da NFS-e;
- invalidação de rascunho fiscal quando a OS muda;
- numeração DPS persistente, monotônica e idempotente por conta/série;
- construção da DPS Nacional v1.01;
- assinatura XMLDSig server-side usando certificado A1/PFX;
- mTLS para a API Nacional;
- envio de DPS, leitura de rejeição e tratamento de falha transitória;
- reconciliação por ID da DPS antes de qualquer retry de POST;
- consulta da NFS-e pela chave de acesso;
- persistência da chave e XML após emissão;
- produção fiscal bloqueada por padrão;
- perfil fiscal nacional obrigatório antes de habilitar o botão de emissão;
- adaptador municipal genérico deliberadamente bloqueado até existir implementação concreta.

## Segurança

- certificado e senha nunca entram em variável `VITE_`;
- service role do Supabase é exclusivamente server-side;
- browser autenticado não altera diretamente status, número, chave ou XML fiscal;
- produção exige `NFSE_ALLOW_PRODUCTION=yes`;
- API fiscal exige HTTPS;
- retries preservam a mesma série/número DPS;
- se um POST terminar sem confirmação, a próxima tentativa consulta a DPS antes de reenviar;
- nenhum segredo, certificado, dump ou chave privada é versionado.

## Perfil fiscal obrigatório

Antes de habilitar a emissão real, o servidor exige:

- `NFSE_CNPJ`;
- `NFSE_MUNICIPIO_IBGE`;
- `NFSE_CODIGO_SERVICO` (6 dígitos);
- `NFSE_SERIE_DPS`;
- `NFSE_OP_SIMP_NAC`;
- `NFSE_REG_ESP_TRIB`;
- `NFSE_TRIB_ISSQN`;
- `NFSE_TP_RET_ISSQN`;
- `NFSE_REG_AP_TRIB_SN` quando aplicável;
- URL HTTPS do ambiente Nacional;
- certificado A1/PFX + senha no servidor;
- inscrição municipal/código municipal do serviço quando exigidos pela parametrização.

Esses valores devem ser confirmados com o cadastro fiscal real da oficina e o emissor usado hoje.
A Ritmeia não inventa regime, município, código de serviço ou retenção.

## Homologação externa

Para declarar **ativação fiscal real**, ainda é necessário fornecer/provisionar fora do repositório:

1. município da oficina e código IBGE correto;
2. regime/enquadramento tributário;
3. CNPJ/IM e código de serviço efetivamente usados;
4. confirmação de uso do Emissor Nacional ou identificação do provedor municipal;
5. certificado/credencial fiscal;
6. Supabase de homologação sob controle do projeto;
7. hospedagem de homologação;
8. emissão real de uma NFS-e em ambiente de testes/restrito;
9. teste real de rejeição/reconciliação;
10. teste em celular e desktop reais.

Sem esses itens externos, não é tecnicamente honesto afirmar que uma nota foi emitida em homologação.

## Banco remoto

Nunca aplicar migrations por tentativa.

```sh
bash scripts/phase6-remote-preflight.sh
bash scripts/phase6-backup.sh
RITMEIA_APPLY_MIGRATIONS=YES_I_HAVE_A_BACKUP \
  bash scripts/phase6-apply-migrations.sh
```

## QA do código

O HEAD da Fase 6 exige CI integralmente verde em:

- build e TypeScript estrito;
- ESLint sem erros/avisos;
- testes unitários;
- DPS XML + assinatura;
- transporte/rejeição/retry;
- PostgreSQL descartável com RLS, snapshot fiscal e sequência DPS;
- browser/Chromium;
- PWA;
- container/SSR.

Nenhum merge em `main`, deploy, migração remota ou ativação de produção deve ocorrer sem
autorização explícita.
