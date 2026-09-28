# Fase 5 — clientes, máquinas e preparação fiscal

Status: implementação no branch `feature/ritmeia-v11-clientes`.

## Objetivo

Parar de redigitar o mesmo cliente e a mesma máquina em cada ordem de serviço, sem quebrar o
histórico existente e sem misturar a integração fiscal real com a estrutura de dados.

## Entregas

- cadastro mestre de clientes;
- busca por nome, telefone e CPF/CNPJ;
- CPF/CNPJ, e-mail e endereço preparados para uso fiscal;
- cadastro de máquinas por cliente;
- reutilização de tipo, marca, modelo e número de série;
- nova OS vinculada ao cliente e, quando escolhido, ao equipamento;
- nome/telefone e dados da máquina continuam gravados na própria OS como fotografia histórica;
- ficha do cliente com máquinas e histórico de OS vinculadas;
- isolamento por usuário via RLS e chaves compostas de propriedade;
- bloqueio de vínculo entre equipamento e cliente errados;
- criação de cliente/máquina com UUID estável para retry após resposta de rede incerta;
- paginação do cadastro e limpeza de estado na troca de conta.

## NFS-e

Esta fase **não emite NFS-e**. Ela prepara o cadastro que a integração fiscal real poderá reutilizar:
documento, e-mail, CEP, endereço, cidade e UF.

A emissão real fica para a Fase 6, porque depende do município/provedor, credenciais e regras fiscais.
Quando a nota for emitida, os dados usados deverão ser preservados em uma fotografia fiscal da nota,
sem depender de alterações futuras no cadastro mestre.

## Compatibilidade

Ordens antigas continuam válidas com `cliente_id` e `equipamento_id` nulos. Nenhum casamento
automático por nome/telefone é feito, evitando ligar históricos antigos ao cliente errado.

## Validação da fase

Para considerar a Fase 5 encerrada, o HEAD precisa passar:

- build e TypeScript estrito;
- ESLint sem erros ou avisos;
- testes unitários das Fases 1–5;
- Chromium com criação de cliente/máquina, histórico e preenchimento de cliente recorrente;
- PostgreSQL descartável com RLS, propriedade e vínculos;
- testes financeiros/concorrrência anteriores;
- container e smoke SSR.

Não há merge, deploy nem migração em banco remoto nesta fase sem autorização explícita.
