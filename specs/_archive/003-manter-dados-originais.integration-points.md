# Pontos de Integração: Preservação de Dados Originais

**Data**: 2025-09-29  
**Fonte**: Análises das tarefas T001–T004

## Visão Geral

Os scripts atuais de ingestão (`fauna.ts`, `flora.ts`, `ocorrencia.ts`) seguem um fluxo semelhante:

1. **Download do DwC-A** com `processaZip()`.
2. **Transformações específicas** por tipo de dado (fauna, flora ou ocorrências).
3. **Verificação de versão** na coleção `ipts` para evitar reprocessamento desnecessário.
4. **Limpeza e reimportação** completa dos dados transformados na coleção principal (`taxa` ou `ocorrencias`).
5. **Atualização de metadados** na coleção `ipts` e criação de índices.

Para preservar dados originais, precisamos interceptar o fluxo imediatamente após o download e antes das transformações destrutivas. Esta documentação identifica os pontos exatos onde novas funções de preservação devem ser conectadas, bem como considerações específicas de cada script.

## `packages/ingest/src/fauna.ts`

### Fluxo Atual

| Etapa | Descrição                                                         | Localização                                              |
| ----- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| 1     | Download e parsing do DwC-A                                       | `processaFaunaZip()` → `processaZip(url)`                |
| 2     | Transformações específicas (filtro de ranks, distribuição, nomes) | `processaFauna()`                                        |
| 3     | Verificação de versão IPT                                         | `iptsCol.findOne({ _id: ipt.id })`                       |
| 4     | Remoção total de registros de `Animalia`                          | `collection.deleteMany({ kingdom: 'Animalia' })`         |
| 5     | Inserção em lotes de 5000 documentos transformados                | `insertMany` dentro do laço                              |
| 6     | Upsert do IPT com tag/set `fauna`                                 | `iptsCol.updateOne(..., { ipt: 'fauna', set: 'fauna' })` |
| 7     | Criação de índices padrão em `taxa`                               | `collection.createIndexes([...])`                        |

### Pontos de Integração Recomendados

1. **Captura de Dados Originais**: Após `const { json, ipt } = await processaFaunaZip(url)` e antes de `const faunaJson = processaFauna(json)`.
   - Necessário armazenar `json` bruto em `taxaOriginal` com metadados de ingestão e referência ao IPT.
   - O ID base pode ser derivado da chave do objeto retornado por `processaZip`.
2. **Transformações**: `processaFauna(json)` modifica o objeto original in-place. Para preservar os brutos, devemos trabalhar sobre uma cópia profunda ou aplicar transformações em uma nova estrutura retornada.
3. **Inserção na Coleção Principal**: Ao inserir em `taxa`, incluir referência (`original_reference`) ao documento preservado.
4. **Controles de versão**: O bloco `if (dbVersion === ipt.version)` atualmente apenas loga. Precisaremos adicionar retorno antecipado **após** confirmar que dados originais estão sincronizados.

### Observações Relevantes

- `processaFauna` normaliza campos críticos (distribuição, vernacular names, classification). Estes dados não podem ser perdidos na versão original.
- Logs e mensagens estão em inglês; considerar padronização futura.

## `packages/ingest/src/flora.ts`

### Fluxo Atual

Muito semelhante à fauna, com diferenças específicas de dados (vegetationType, endemism). Principais etapas idênticas, mudando apenas o filtro de limpeza (`$or: [{ kingdom: 'Plantae' }, { kingdom: 'Fungi' }]`).

### Pontos de Integração Recomendados

1. **Preservação de Originais**: Após `const { json, ipt } = await processaFloraZip(url)` e antes de `processaFlora(json)`.
2. **Transformações**: `processaFlora` altera o objeto original ao remover `vegetationType`, reorganizar `distribution`, etc. Necessário copiar dados antes das mutações.
3. **Referência Bidirecional**: Ao inserir transformados em `taxa`, incluir `original_reference` com `_id` do documento de `taxaOriginal`.
4. **Bug Atual**: Log dentro do bloco de versão imprime "Fauna already on version"; corrigir durante refatoração.

### Observações Relevantes

- Flora e Fungi compartilham o mesmo script; `collection_type` nos dados originais deve refletir o reino dominante por recurso.
- Necessário registrar domínio fitogeográfico, endemismo e vegetationType no documento original sem normalizações.

## `packages/ingest/src/ocorrencia.ts`

### Fluxo Atual

1. **Carregamento de Configuração**: `occurrences.csv` define recursos IPT e metadados.
2. **Verificação de Versão Concorrente**: `runWithConcurrency` processa até 10 IPTs em paralelo usando `getEml` + `processaEml`.
3. **Download**: `processaZip(archiveUrl, true, 5000)` retorna um iterador SQLite por lotes (`Iterable<[string, Record]>`).
4. **Limpeza**: `ocorrenciasCol.deleteMany({ iptId: ipt.id })` remove dados existentes do IPT específico.
5. **Transformação**: Cada documento é mapeado para incluir `geoPoint`, normalização de país/estado, parsing de datas, `canonicalName`, etc.
6. **Inserção Resiliente**: `safeInsertMany` divide lotes para respeitar limites BSON (16 MB).
7. **Atualização IPT**: `iptsCol.updateOne(..., { tag, ipt: repositorio, kingdom })` atualiza metadados.
8. **Tratamento de Falhas**: Repositórios inatingíveis são marcados em `failedIpts` para evitar repetição.

### Pontos de Integração Recomendados

1. **Preservação Antes da Transformação**: `processaZip(..., true, 5000)` retorna lotes de pares `[id, json]`. Precisamos:
   - Persistir cada registro original antes de aplicar transformações.
   - Registrar metadados por IPT (tag, repositorio, version) no documento original.
2. **Estados de Processamento**: Controlar `processing_status` (sucesso, falha, fallback) em `ocorrenciasOriginal` para permitir reprocessamento seletivo.
3. **Fallback**: Em caso de erro na transformação, devemos copiar dados originais para `ocorrencias` (conforme requisitos de fallback).
4. **Concorrência**: Integrar com o futuro `gerenciador-bloqueios` para evitar múltiplas ingestões simultâneas.

### Observações Relevantes

- O script é executado em contexto top-level (sem função `main`), importante ao introduzir novas dependências.
- `process.exit` é chamado no final, então exceções não tratadas encerram o processo com erro.
- Normalizações atuais (e.g., `normalizeCountryName`) devem ser mantidas apenas no documento transformado para preservar o valor bruto.

## `packages/ingest/src/lib/dwca.ts`

### Responsabilidades

- **Download** do arquivo ZIP (`downloadWithTimeout`).
- **Extração** para `.temp/` e limpeza posterior.
- **Parsing** do `meta.xml` e `eml.xml`.
- **Construção** de objetos JSON (`buildJson`) ou iteradores SQLite (`buildSqlite`).

### Pontos de Integração Relevantes

1. **Metadados IPT**: `processaZip` retorna `ipt` já processado (via `processaEml`). Esses metadados devem acompanhar tanto os dados originais quanto os transformados.
2. **Estrutura do Retorno**:
   - `buildJson`: objeto em memória `Record<string, Record<string, unknown>>`.
   - `buildSqlite`: iterador p/ lotes de `[id, Record]`, ideal para streaming.
3. **Limpeza de Temporários**: O diretório `.temp` é removido sempre; quaisquer novas capturas de dados devem ocorrer antes do retorno.
4. **Tratamento de Erros 404**: Erros de recurso inexistente são propagados; scripts chamadores já tratam estes casos com saída limpa.

### Considerações de Preservação

- Para fauna/flora, o objeto JSON completo pode ser armazenado diretamente em `taxaOriginal`.
- Para ocorrências, é necessário percorrer o iterador duas vezes (uma para originais e outra para transformados) ou armazenar cada lote antes de transformá-lo.
- Ajustes em `processaZip` devem manter compatibilidade com chamadas existentes.

## Ações Propostas (Resumo)

1. **Introduzir camada de preservação** logo após `processaZip`, antes de qualquer mutação.
2. **Criar coleções** `taxaOriginal` e `ocorrenciasOriginal` com índices adequados (ver T006).
3. **Anexar metadados IPT** aos documentos originais (ID, versão, timestamp, fonte).
4. **Manter transformações atuais inalteradas**, operando sobre cópias ou pipelines separados.
5. **Adicionar referências cruzadas** (`original_reference`) ao inserir documentos transformados.
6. **Garantir idempotência**: se versões não mudaram, pular inserções tanto de originais quanto transformados.

## Plano de Índices para Coleções Originais (T006)

### Coleção `taxaOriginal`

| Índice                                                                                    | Tipo      | Objetivo                                                              |
| ----------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| `{ collection_type: 1, iptId: 1, ipt_record_id: 1 }`                                      | Único     | Evitar duplicidades por recurso IPT e registrar entradas individuais. |
| `{ iptId: 1, ipt_version: 1 }`                                                            | Não único | Consultas rápidas por versão para pular reprocessamentos.             |
| `{ 'processing_status.is_processed': 1, 'processing_status.last_transform_attempt': -1 }` | Não único | Recuperar documentos pendentes ou com falha para pipelines offline.   |
| `{ 'ingestion_metadata.timestamp': -1 }`                                                  | Não único | Auditoria cronológica de ingestões.                                   |

### Coleção `ocorrenciasOriginal`

| Índice                                              | Tipo      | Objetivo                                                    |
| --------------------------------------------------- | --------- | ----------------------------------------------------------- |
| `{ iptId: 1, ipt_record_id: 1 }`                    | Único     | Garantir univocidade por ocorrência dentro do IPT.          |
| `{ iptId: 1, 'processing_status.is_processed': 1 }` | Não único | Selecionar rapidamente registros não transformados por IPT. |
| `{ 'ingestion_metadata.timestamp': -1 }`            | Não único | Auditoria e ordenação temporal.                             |
| `{ collection_type: 1, ipt_version: 1 }`            | Não único | Relatórios por tipo de coleção e versão do IPT.             |

### Considerações Gerais

- Índices devem ser criados apenas após inserção inicial para evitar sobrecarga durante importação massiva.
- As chaves únicas preservam consistência entre execuções repetidas do mesmo IPT.
- Os campos sugeridos aproveitam o modelo definido em `data-model.md` (`OriginalDocument.processing_status`).
- Para ambientes shard, aplicar estratégia `collection_type + iptId` conforme indicado em `data-model.md`.

Esses pontos orientarão a implementação das próximas fases (testes de contrato, refatoração core e pipelines).
