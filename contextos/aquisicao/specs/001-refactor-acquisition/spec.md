# Feature Specification: Refatoração para Contexto de Aquisição Apenas

**Feature Branch**: `001-refactor-acquisition` _(branch lógico — todo trabalho será comitado em `main`)_
**Created**: 2026-05-05
**Status**: Draft
**Input**: User description: "Refatorar todo o projeto, focando no contexto de aquisição e eliminando os contextos de Enriquecimento e Apresentação. Apenas buscar dados nos IPTs de Espécies (fauna e flora) e ocorrências, transformar e criar as collections `occurrences` e `taxa` no MongoDB `dwc2json`. Sem Docker, sem GitHub Actions, sem interface. Três scripts para Windows 11 (Update MongoDB - Fauna / Flora / Ocorrências) executados manualmente. Linguagem de alto desempenho (Go). Credenciais apenas em `.env` local. Limpeza completa do repositório e documentação."

## Clarifications

### Session 2026-05-05

- Q: Como conciliar o fluxo do speckit com a regra "nunca criar branch"? → A: Usar `-DryRun` e materializar `specs/001-refactor-acquisition/spec.md` direto em `main`.
- Q: Qual linguagem de alto desempenho para os scripts Windows? → A: **Go** — gera 3 executáveis `.exe` independentes.
- Q: Onde ficam as credenciais MongoDB? → A: Apenas em arquivo `.env` local (gitignorado). Repositório nunca contém credenciais.
- Q: Estratégia de atualização das collections? → A: **Upsert por chave estável** (`taxonID` para `taxa`, `occurrenceID` para `occurrences`); registros não vistos no DwC-A da execução atual são removidos ao final (escopados pela `source` do script).
- Q: Alvos de performance/escala? → A: **Equilibrado** — fauna ≤ 2 min, flora ≤ 2 min, ocorrências ≤ 30 min para 5M registros. Streaming + bulk writes de 5–10k documentos por lote.
- Q: Escopo do schema harmonizado em `taxa` e `occurrences`? → A: **Passthrough completo** — o documento MongoDB espelha **todos** os campos do DwC-A original, com normalização mínima de tipos (datas ISO 8601, números numéricos, coordenadas como `double`). Máxima fidelidade, zero perda de informação.
- Q: Como detectar versão do IPT e disparar atualização? → A: **Sempre baixa e processa** o DwC-A atual. O script loga `pubDate` e `version` lidos do `eml.xml`, persiste o histórico em uma collection `ingest_runs`, e avisa (sem pular) quando a versão atual coincide com a última processada.
- Q: Como distribuir os binários `.exe`? → A: **Build local apenas** — `*.exe` permanecem gitignorados; o operador compila com `go build ./cmd/...` (ou comando equivalente documentado no README) após o clone.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Atualizar coleção `taxa` com espécies de Fauna (Priority: P1)

O operador (Eduardo) executa o script "Update MongoDB - Fauna" em sua máquina Windows 11. O script baixa o DwC-A mais recente do IPT de fauna, parseia os registros taxonômicos, transforma para o schema harmonizado e popula/atualiza a coleção `taxa` no banco `dwc2json` com os táxons de fauna. Durante a execução, mensagens verbosas no terminal informam cada passo (download, parsing, escrita em lote, totalizadores).

**Why this priority**: Sem dados taxonômicos populados, o banco `dwc2json` não cumpre seu propósito. Fauna e flora são igualmente críticos; este é o primeiro a estabelecer o padrão de pipeline e prova ponta-a-ponta.

**Independent Test**: Executar o `.exe` em uma máquina Windows 11 com MongoDB acessível e `.env` configurado. Validar que: (a) logs verbosos aparecem, (b) `db.taxa.countDocuments({source: "fauna"})` retorna número compatível com o IPT, (c) script termina com código de saída zero.

**Acceptance Scenarios**:

1. **Given** MongoDB acessível e `.env` válido, **When** o operador executa "Update MongoDB - Fauna", **Then** a coleção `taxa` contém os registros de fauna do IPT e o terminal exibe logs detalhados de cada etapa.
2. **Given** uma execução anterior já populou a coleção, **When** o operador executa o script novamente, **Then** o estado final é consistente (sem duplicatas, com atualização incremental ou substituição limpa).
3. **Given** MongoDB inacessível, **When** o operador executa o script, **Then** o script encerra com mensagem de erro clara e código de saída diferente de zero, sem deixar a coleção em estado parcial.

---

### User Story 2 - Atualizar coleção `taxa` com espécies de Flora (Priority: P1)

O operador executa o script "Update MongoDB - Flora", que baixa o DwC-A do IPT de flora e popula/atualiza a mesma coleção `taxa` (compartilhada com fauna), distinguindo registros pela origem (`source: "flora"`).

**Why this priority**: Equivalente em valor a US1; juntos eles compõem a base taxonômica completa. Compartilhar a coleção `taxa` exige que o pipeline de fauna e flora preserve a integridade do outro grupo.

**Independent Test**: Executar `.exe` de flora isoladamente. Validar que adiciona registros de flora sem afetar registros de fauna previamente carregados (se houver).

**Acceptance Scenarios**:

1. **Given** `.env` com `IPT_FLORA_URL` válido, **When** o operador executa "Update MongoDB - Flora", **Then** registros de flora são gravados em `taxa` com marca de origem identificável.
2. **Given** registros de fauna já presentes em `taxa`, **When** o script de flora roda, **Then** os registros de fauna permanecem inalterados.

---

### User Story 3 - Atualizar coleção `occurrences` com registros de ocorrência (Priority: P1)

O operador executa o script "Update MongoDB - Ocorrências", que baixa o DwC-A do IPT de ocorrências (volume potencialmente alto — milhões de registros), parseia em streaming, transforma e popula a coleção `occurrences` no banco `dwc2json`.

**Why this priority**: Ocorrências são o coração da plataforma. O script difere dos de espécies pelo volume — exige processamento por lotes/streaming e logs de progresso percentual.

**Independent Test**: Executar `.exe` de ocorrências em ambiente com MongoDB e `.env`. Validar logs de progresso em batches, contagem final compatível com o DwC-A, e tempo total registrado no log.

**Acceptance Scenarios**:

1. **Given** IPT de ocorrências disponível, **When** o operador executa o script, **Then** a coleção `occurrences` é populada e o log informa progresso periódico (ex.: "100.000 registros processados em 45s").
2. **Given** o DwC-A contém ~5 milhões de registros, **When** o script roda, **Then** o uso de memória permanece estável (streaming) e a execução completa sem OOM.
3. **Given** falha de rede no meio do download, **When** o script tenta novamente ou aborta, **Then** a falha é reportada de forma clara e a coleção não fica em estado parcial inconsistente.

---

### User Story 4 - Repositório minimalista refletindo apenas o contexto de Aquisição (Priority: P2)

Após implementar os três scripts, o repositório é limpo: removidos `packages/web`, `packages/transform` (loaders/enrichers), Dockerfiles, `.github/workflows`, `cron-dashboard`, configurações de Astro/React/Tailwind, scripts Python utilitários não-essenciais. A documentação (README, CLAUDE.md) é reescrita refletindo o novo escopo. Restam apenas: código Go dos 3 scripts, `.env.example`, `.gitignore`, README, e este spec.

**Why this priority**: É o entregável final que torna a simplicidade visível. Sem isso, o repo continua aparentando complexidade que não existe mais.

**Independent Test**: Após a limpeza, listar o conteúdo da raiz do repositório e dos pacotes — não deve haver código de UI, enriquecimento, Docker ou Actions. README descreve apenas as 3 operações de update.

**Acceptance Scenarios**:

1. **Given** o repositório após limpeza, **When** alguém inspeciona a raiz, **Then** vê apenas estrutura mínima focada em aquisição (código Go, `.env.example`, README, `go.mod`, `go.sum`).
2. **Given** o novo README, **When** um novo operador o lê, **Then** entende em poucos minutos como rodar os 3 scripts.
3. **Given** o `.gitignore`, **When** o operador cria um `.env` local, **Then** o arquivo não é rastreado pelo git.

---

### Edge Cases

- **IPT indisponível ou URL alterada**: Script reporta erro de rede claro com URL tentada e código de saída ≠ 0.
- **DwC-A corrompido ou schema inesperado**: Script reporta linha/registro problemático sem abortar todo o lote (ou aborta com mensagem clara, conforme política).
- **MongoDB inacessível ou credenciais inválidas**: Script reporta falha de autenticação/conexão de forma clara antes de iniciar download desnecessário.
- **`.env` ausente ou `MONGO_URI` não definida**: Script encerra imediatamente com mensagem instruindo o operador a copiar `.env.example` e configurar.
- **Volume muito alto de ocorrências (memória)**: Pipeline em streaming evita carregar todo o arquivo em memória.
- **Re-execução com mesmo IPT**: Idempotência garantida via upsert por chave estável (`taxonID`/`occurrenceID`) seguido de remoção de registros não vistos no DwC-A atual (escopados pela `source`).
- **Encoding de caracteres especiais (UTF-8/Latin-1)**: Tratamento explícito; nomes científicos com diacríticos preservados.
- **Interrupção pelo operador (Ctrl+C)**: Script encerra de forma limpa sem deixar locks ou conexões pendentes.
- **Credencial vazada acidentalmente**: `.gitignore` impede commit; `.env.example` apenas com placeholders genéricos.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema DEVE fornecer três executáveis independentes para **Windows 11 (amd64)** e **Linux x86 (amd64)**: "Update MongoDB - Fauna", "Update MongoDB - Flora", "Update MongoDB - Ocorrências". Os binários são produzidos por cross-compilation nativa do Go — sem alteração no código-fonte.
- **FR-002**: Cada executável DEVE baixar o arquivo DwC-A mais recente da URL de IPT configurada para sua fonte.
- **FR-003**: Cada executável DEVE parsear o DwC-A e gravar **todos** os campos do registro original (passthrough completo), aplicando apenas normalização mínima de tipos (datas ISO 8601, números, coordenadas `double`).
- **FR-004**: Os scripts de Fauna e Flora DEVEM gravar em uma única coleção unificada `taxa` no banco `dwc2json`, identificando a origem (`source`) em cada documento.
- **FR-005**: O script de Ocorrências DEVE gravar na coleção `occurrences` no banco `dwc2json`.
- **FR-006**: Os scripts DEVEM emitir logs verbosos no terminal (etapa atual, contadores, timestamps, totalizadores) durante toda a execução.
- **FR-007**: Os scripts DEVEM ler a URI de conexão MongoDB e URLs de IPT de um arquivo `.env` local (gitignorado).
- **FR-008**: O repositório remoto NÃO DEVE conter credenciais reais — apenas placeholders genéricos no `.env.example`.
- **FR-009**: Os scripts DEVEM ser idempotentes via **upsert por chave estável** (`taxonID` para `taxa`, `occurrenceID` para `occurrences`). Ao final, registros pertencentes à mesma `source` que não apareceram no DwC-A da execução atual DEVEM ser removidos, garantindo que a coleção espelhe o estado do IPT sem janela de inconsistência.
- **FR-010**: O sistema NÃO DEVE conter interface web, servidor HTTP/API, workflow do GitHub Actions, nem artefato Docker.
- **FR-011**: O repositório DEVE conter apenas o contexto de Aquisição — sem enriquecedores, sem loaders de referência, sem camada de apresentação.
- **FR-012**: A documentação (README, CLAUDE.md) DEVE refletir o novo escopo simplificado.
- **FR-013**: Os scripts DEVEM tratar falhas (rede, banco, parsing) com mensagens de erro claras e códigos de saída não-zero.
- **FR-014**: Os executáveis DEVEM rodar em **Windows 11 (amd64)** e **Linux x86 (amd64)** sem dependências externas instaladas (binário autocontido). Gerados via `GOOS=windows GOARCH=amd64` e `GOOS=linux GOARCH=amd64` respectivamente.
- **FR-015**: Todo trabalho DEVE ser comitado diretamente no branch `main` — nenhum branch novo é criado.
- **FR-016**: O sistema DEVE evitar vulnerabilidades comuns desde o início (dependências auditadas, parsing seguro de ZIPs/CSVs, validação de URLs, sem credenciais hardcoded).
- **FR-017**: O `.gitignore` DEVE incluir `.env`, binários compilados (`*.exe`), e qualquer artefato temporário de download.
- **FR-018**: Ao iniciar, cada script DEVE ler o `eml.xml` do DwC-A baixado e logar os metadados de versão (`pubDate`, `version`, `title`). Estes metadados, junto com timestamps de início/fim, contagens de registros lidos/escritos/removidos e código de saída, DEVEM ser persistidos em uma coleção `ingest_runs` no banco `dwc2json` ao final de cada execução (sucesso ou falha).
- **FR-019**: Quando o `pubDate`/`version` do DwC-A atual coincidir com o último registro de sucesso da mesma `source` em `ingest_runs`, o script DEVE exibir um aviso claro (`"AVISO: versão idêntica à última execução bem-sucedida"`) **mas continuar** com o processamento normalmente.
- **FR-020**: Os binários compilados (`*.exe`) NÃO DEVEM ser comitados no repositório. O README DEVE documentar o comando único de build (ex.: `go build ./cmd/...`) que produz os três executáveis a partir do código-fonte.

### Key Entities

- **Taxon**: Registro taxonômico originário dos IPTs de Fauna ou Flora. **Estratégia de schema: passthrough completo** — todos os termos DwC-A do core e extensões taxonômicas são mapeados diretamente para campos do documento MongoDB, preservando os nomes originais (ex.: `scientificName`, `kingdom`, `phylum`, `class`, `order`, `family`, `genus`, `specificEpithet`, `taxonRank`, `taxonomicStatus`, `acceptedNameUsageID`, `parentNameUsageID`, `scientificNameAuthorship`, `nomenclaturalCode`, `vernacularName`, etc.). Campos adicionais obrigatórios injetados pelo pipeline: `_id` (= `taxonID`), `source` (`"fauna"` ou `"flora"`), `ingestedAt` (timestamp UTC da execução).
- **Occurrence**: Registro de ocorrência originário do IPT de ocorrências. **Estratégia de schema: passthrough completo** — todos os termos DwC-A do core de Occurrence (e extensões disponíveis no DwC-A) são preservados (ex.: `occurrenceID`, `basisOfRecord`, `eventDate`, `eventTime`, `recordedBy`, `individualCount`, `decimalLatitude`, `decimalLongitude`, `geodeticDatum`, `coordinateUncertaintyInMeters`, `country`, `stateProvince`, `county`, `municipality`, `locality`, `institutionCode`, `collectionCode`, `catalogNumber`, `identifiedBy`, `dateIdentified`, `scientificName`, `kingdom`, `family`, etc.). Campos adicionais obrigatórios: `_id` (= `occurrenceID`), `source` (identifica o IPT de origem), `ingestedAt` (timestamp UTC).
- **Normalização mínima de tipos**: datas (`eventDate`, `dateIdentified`, etc.) parseadas para ISO 8601; coordenadas (`decimalLatitude`, `decimalLongitude`, `coordinateUncertaintyInMeters`) convertidas para `double`; contagens inteiras (`individualCount`) para `int`; demais campos preservados como `string`. Valores vazios são omitidos do documento (ao invés de gravados como `""`/`null`).
- **DwC-A Source**: Arquivo Darwin Core Archive (ZIP) publicado em um IPT, contendo `meta.xml` (metadados do schema), `eml.xml` (metadados do dataset) e arquivos de dados (core + extensões). Três fontes distintas no escopo: IPT de fauna, IPT de flora, IPT de ocorrências. Cada um com URL configurável via `.env`.
- **Ingest Run**: Registro de auditoria de uma execução de script, gravado na coleção `ingest_runs` do banco `dwc2json`. Atributos: `source` (fauna/flora/occurrences), `startedAt`, `finishedAt`, `status` (`success`/`failed`), `dwcaPubDate`, `dwcaVersion`, `dwcaTitle`, `recordsRead`, `recordsUpserted`, `recordsRemoved`, `errorMessage` (se houver), `exitCode`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: O operador consegue executar qualquer um dos três scripts em **Windows 11** (invocando o `.exe`) ou em **Linux x86** (invocando o binário sem extensão), sem instalar runtime adicional.
- **SC-002**: Durante a execução, o terminal exibe pelo menos uma mensagem de progresso a cada etapa principal (download, descompactação, parsing, escrita) e atualizações periódicas para o script de ocorrências (a cada N registros).
- **SC-003**: Após executar os três scripts com sucesso em ambiente limpo, o banco `dwc2json` contém as coleções `taxa` (fauna + flora) e `occurrences` populadas com volumes compatíveis com os IPTs de origem.
- **SC-004**: Inspeção do repositório após a refatoração mostra ausência total de: pasta `packages/web`, código Astro/React, `.github/workflows`, `Dockerfile`, scripts de enriquecimento, scripts Python.
- **SC-005**: Um operador novo consegue, a partir de um clone limpo do repositório, configurar `.env`, compilar via `go build` e executar o primeiro script em menos de 15 minutos seguindo apenas o README (assumindo Go e MongoDB já instalados) — tanto em Windows 11 quanto em Linux x86.
- **SC-006**: Re-executar qualquer script duas vezes seguidas, sem alterar o IPT de origem, produz o mesmo estado final na coleção (sem duplicatas).
- **SC-007**: Varredura de segredos (ex.: `gitleaks` ou `gh secret-scanning`) no histórico do repositório não encontra credenciais MongoDB reais.
- **SC-008**: Tamanho total do repositório (excluindo `.git`) cai significativamente após a limpeza, refletindo a remoção dos contextos de Enriquecimento e Apresentação.
- **SC-009**: Em hardware típico de desktop (CPU 4+ cores, SSD, MongoDB local ou em rede com latência <50 ms), os scripts concluem dentro destes alvos: **Fauna ≤ 2 min**, **Flora ≤ 2 min**, **Ocorrências ≤ 30 min para um DwC-A de até 5 milhões de registros**.
- **SC-010**: O script de Ocorrências processa o pipeline em **streaming** (uso de memória residente estável, sem crescer linearmente com o volume) e grava em **bulk writes de 5.000 a 10.000 documentos por lote**.

## Assumptions

- O operador (Eduardo) é o usuário único, executa os scripts manualmente em sua máquina Windows 11 conforme necessidade.
- As URLs dos IPTs (fauna, flora, ocorrências) são públicas, estáveis, e configuráveis via `.env` (ex.: `IPT_FAUNA_URL`, `IPT_FLORA_URL`, `IPT_OCCURRENCES_URL`).
- A instância MongoDB de destino é acessível via `MONGO_URI` definido em `.env`, e o operador tem permissões de escrita no banco `dwc2json`.
- O schema das coleções é **passthrough completo** dos termos Darwin Core presentes nos DwC-A das fontes; o pipeline preserva os nomes de campo originais e adiciona apenas `_id`, `source`, e `ingestedAt`. Mapeamento exato de termos por extensão será documentado no plano.
- A linguagem escolhida na fase de clarificação é **Go**, gerando binários autocontidos por script: `.exe` para Windows 11 (amd64) e binário sem extensão para Linux x86 (amd64), via cross-compilation (`GOOS`/`GOARCH`).
- Estratégia de atualização decidida: **upsert por chave estável** + remoção de registros não vistos (escopados por `source`). Detalhes operacionais (tamanho de lote, índice, write concern) serão definidos no plano.
- Não há requisitos de internacionalização, autenticação multiusuário, agendamento automático, ou observabilidade externa (Prometheus/Grafana) — execução é local e manual.
- Histórico de versões anteriores do projeto (V5, V6) permanece acessível via `git log`; não é necessário preservar arquivos legados após a limpeza.
- Compilação dos `.exe` é responsabilidade do operador (`go build`); binários nunca são versionados. O README detalha o passo único de build após `git clone`.
