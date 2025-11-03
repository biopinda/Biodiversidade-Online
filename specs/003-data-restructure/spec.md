# Feature Specification: Reestruturação de Dados - Separação de Ingestão e Transformação

**Feature Branch**: `003-data-restructure`  
**Created**: 2025-10-29  
**Status**: Draft  
**Input**: User description: "reestruturação de dados. Leia o https://github.com/biopinda/Biodiversidade-Online/blob/main/PRD.md para as especificações"

## Clarifications

### Session 2025-10-29

- Q: What is the data retention policy for raw IPT collections (`taxa_ipt` and `occurrences_ipt`)? → A: Retain indefinitely until manual deletion is triggered for audit/reproducibility purposes
- Q: Which concurrency control mechanism should be implemented to prevent race conditions during transformation processes? → A: Process-level flag in MongoDB collection (e.g., `transform_status` collection with timestamps)
- Q: What happens when the external collector parsing algorithm dependency (`https://github.com/biopinda/coletores-BO`) is unavailable? → A: Parse fails gracefully, preserve original `recordedBy` unchanged, log warning
- Q: What metrics/monitoring targets should be implemented for operational health and observability? → A: Basic operational metrics (ingestion/transformation duration, record counts, error rates)
- Q: Should transformation processes be triggered manually or automatically after ingestion completes? → A: Automatic transformation triggered immediately after each successful ingestion via GitHub workflows, with workflow_dispatch option for manual triggering

### Session 2025-10-31

- Q: Should transformation be a separate step after ingestion or integrated into ingestion? → A: Integrated into ingestion - transform immediately after inserting raw data using upsert to both raw and transformed collections
- Q: How should we handle shared code between ingest and transform packages to avoid cyclic dependencies? → A: Create `packages/shared` for utilities like deterministic-id, database connections, collection names, and metrics
- Q: When should bulk re-transformation be triggered? → A: Only when packages/transform version is bumped (indicating transformation logic changed) or via manual workflow_dispatch
- Q: Should ingestion workflows chain to transformation workflows? → A: No - ingestion scripts import and call transformation functions directly; separate transform workflows only for bulk re-processing

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ingestão e Transformação Automática de Dados de Taxa (Priority: P1) 🎯 MVP

O sistema deve baixar e processar automaticamente os dados taxonômicos da Flora e Fauna do Brasil diretamente dos repositórios IPT oficiais, armazenando os dados brutos em `taxa_ipt` e imediatamente transformando-os para `taxa` no MongoDB. Esta é a base fundamental do sistema - em uma única operação, temos dados brutos para auditoria e dados transformados para uso.

**Why this priority**: Esta história representa a fundação do sistema de dados. Todos os demais processos (API, interface) dependem da disponibilidade dos dados transformados. Ao integrar ingestão e transformação em um único passo, garantimos consistência e simplificamos o pipeline.

**Independent Test**: Pode ser totalmente testado executando o comando de ingestão de taxa e verificando se: (1) os arquivos DwC-A são baixados dos URLs corretos, (2) os registros são inseridos na coleção `taxa_ipt` com estrutura JSON conforme schema, (3) registros transformados são inseridos em `taxa` com mesmo `_id`, (4) transformações aplicadas corretamente (canonicalName, filtros, enriquecimentos).

**Acceptance Scenarios**:

1. **Given** que o repositório IPT da Fauna está disponível, **When** o sistema executa `bun run ingest:fauna`, **Then** todos os registros de espécies da fauna são: (a) inseridos em `taxa_ipt` com campos DwC originais preservados, (b) transformados e inseridos em `taxa` com canonicalName, filtros e enriquecimentos aplicados, (c) ambos registros possuem `_id` idêntico baseado em `taxonID`
2. **Given** que o repositório IPT da Flora está disponível, **When** o sistema executa `bun run ingest:flora`, **Then** todos os registros são processados em duas etapas: raw insert em `taxa_ipt` seguido de transform e upsert em `taxa`
3. **Given** que já existem registros em `taxa_ipt` e `taxa`, **When** uma nova ingestão é executada, **Then** registros duplicados são identificados pelo `_id` (taxonID) e atualizados (upsert) em ambas coleções sem criar duplicatas
4. **Given** que o download do arquivo DwC-A falha, **When** o sistema tenta acessar o IPT, **Then** uma mensagem de erro clara é exibida e o processo pode ser retomado posteriormente (nenhum registro é inserido em nenhuma coleção)
5. **Given** que um registro é inserido em `taxa_ipt`, **When** a transformação automática falha, **Then** o erro é registrado mas o registro bruto permanece em `taxa_ipt` para auditoria
6. **Given** que a transformação processa um registro, **When** cria o documento em `taxa`, **Then** o campo `canonicalName` é gerado corretamente a partir de `scientificName`, dados de ameaça/invasoras/UCs são agregados quando aplicável
7. **Given** que um registro possui `taxonRank` = "GENERO", **When** a transformação automática é executada, **Then** o registro aparece em `taxa_ipt` mas NÃO em `taxa` (filtrado durante transformação)

---

### User Story 2 - Ingestão e Transformação Automática de Dados de Ocorrências (Priority: P1)

O sistema deve processar todos os recursos DwC-A listados no arquivo `occurrences.csv`, armazenando os dados brutos em `occurrences_ipt` e imediatamente transformando-os para `occurrences` no MongoDB. Juntamente com a User Story 1, esta história completa o pipeline integrado de dados.

**Why this priority**: Dados de ocorrências são essenciais para mapas, visualizações geográficas e análises de distribuição de espécies. Esta história e a User Story 1 formam o MVP completo - ambas devem funcionar para termos dados brutos auditáveis e dados transformados prontos para uso.

**Independent Test**: Pode ser totalmente testado executando o comando de ingestão de ocorrências e verificando se: (1) todos os 507 recursos listados em `occurrences.csv` são processados, (2) os registros são inseridos em `occurrences_ipt` e `occurrences` conforme schemas, (3) transformações são aplicadas (geoPoint, normalização de datas/estados, vinculação taxonômica), (4) `_id` é preservado entre coleções.

**Acceptance Scenarios**:

1. **Given** que o arquivo `occurrences.csv` contém 507 recursos IPT, **When** o sistema executa `bun run ingest:occurrences`, **Then** todos os recursos são processados: (a) dados brutos inseridos em `occurrences_ipt`, (b) dados transformados inseridos em `occurrences` com validações geográficas e enriquecimentos aplicados
2. **Given** que um recurso IPT está temporariamente indisponível, **When** o sistema tenta baixá-lo, **Then** o erro é registrado e o processo continua com os próximos recursos sem interromper toda a ingestão
3. **Given** que registros de ocorrências já existem, **When** uma nova ingestão é executada, **Then** registros são atualizados (upsert) em `occurrences_ipt` e `occurrences` usando `_id` como chave única
4. **Given** que um arquivo DwC-A é processado, **When** a transformação automática cria registros em `occurrences`, **Then** campo `geoPoint` é criado quando coordenadas são válidas, datas são parseadas para day/month/year, estados são normalizados
5. **Given** que duas ocorrências do mesmo IPT possuem `occurrenceID` idêntico, **When** são processadas, **Then** o segundo registro sobrescreve o primeiro (upsert) em ambas coleções garantindo unicidade de \_id
6. **Given** que uma ocorrência possui `scientificName` que é sinônimo, **When** a transformação automática é executada, **Then** o nome é validado contra `taxa` e substituído pelo nome aceito com `taxonID` correto
7. **Given** que uma ocorrência possui `country` diferente de "Brasil", **When** a transformação automática é executada, **Then** o registro aparece em `occurrences_ipt` mas NÃO em `occurrences` (filtrado durante transformação)

---

### User Story 3 - Re-transformação em Massa de Dados (Priority: P2)

O sistema deve permitir re-executar o processo de transformação sobre todos os dados brutos existentes em `taxa_ipt` e `occurrences_ipt`, regenerando as coleções `taxa` e `occurrences`. Esta funcionalidade é essencial quando a lógica de transformação é atualizada.

**Why this priority**: Re-transformação é necessária apenas quando a lógica de transformação muda (novo campo, filtro atualizado, correção de bug). Como ingestão já transforma automaticamente, esta história é secundária mas importante para manutenção.

**Independent Test**: Pode ser totalmente testado: (1) modificando um arquivo em `packages/transform/src`, (2) incrementando a versão em `packages/transform/package.json`, (3) executando `bun run transform:taxa` ou `bun run transform:occurrences`, (4) verificando que todos os registros em `taxa_ipt`/`occurrences_ipt` foram reprocessados e atualizados em `taxa`/`occurrences`.

**Acceptance Scenarios**:

1. **Given** que a versão de `@darwincore/transform` foi incrementada de 1.0.0 para 1.1.0, **When** o workflow GitHub Actions detecta mudança no package.json, **Then** o workflow de re-transformação é disparado automaticamente
2. **Given** que existem 100.000 registros em `taxa_ipt`, **When** o comando `bun run transform:taxa` é executado, **Then** todos os registros são reprocessados em lotes, transformados e atualizados em `taxa` preservando `_id`
3. **Given** que a transformação de ocorrências está em execução, **When** outro processo tenta iniciar transformação, **Then** o sistema detecta lock em `transform_status` e aborta com mensagem clara
4. **Given** que um usuário executa manualmente `workflow_dispatch` para transform-taxa, **When** o workflow é disparado, **Then** a re-transformação completa é executada independente da versão do pacote
5. **Given** que a lógica de transformação falha em 10% dos registros, **When** a re-transformação é executada, **Then** os 90% restantes são processados com sucesso, erros são registrados em métricas, e registros com erro preservam versão anterior ou são marcados para revisão

---

### User Story 4 - Exposição de APIs RESTful (Priority: P3)

O sistema deve expor endpoints de API documentados via Swagger para permitir consultas programáticas aos dados transformados de taxa e ocorrências. Esta história permite que sistemas externos e a interface web consumam os dados de forma estruturada.

**Why this priority**: APIs são o mecanismo de acesso aos dados transformados. Sem elas, os dados existem mas não são acessíveis. Depende das stories anteriores (precisa de dados transformados para expor).

**Independent Test**: Pode ser totalmente testado acessando a documentação Swagger e executando requests para: (1) consultar taxa por nome científico, (2) buscar ocorrências por coordenadas geográficas, (3) filtrar dados por múltiplos critérios, (4) obter estatísticas agregadas.

**Acceptance Scenarios**:

1. **Given** que a API está disponível, **When** um usuário acessa `/api/docs`, **Then** a documentação Swagger completa é exibida com todos os endpoints disponíveis
2. **Given** que existem registros em `taxa`, **When** uma requisição GET é feita para `/api/taxa?scientificName=Panthera onca`, **Then** a API retorna os dados do taxon em formato JSON
3. **Given** que existem registros em `occurrences`, **When** uma requisição GET é feita para `/api/occurrences?stateProvince=São Paulo&limit=100`, **Then** a API retorna até 100 ocorrências do estado especificado
4. **Given** que um filtro geográfico é aplicado, **When** uma requisição GET é feita para `/api/occurrences?bbox=-46.5,-23.7,-46.3,-23.5`, **Then** apenas ocorrências dentro do bounding box são retornadas
5. **Given** que múltiplos filtros são combinados, **When** uma requisição complexa é feita, **Then** a API aplica todos os filtros corretamente e retorna resultados paginados

---

### User Story 5 - Adaptação da Interface Web (Priority: P3)

As páginas web existentes (chat, taxa search, dashboard, map, tree view) devem ser adaptadas para consumir dados das novas coleções `taxa` e `occurrences` através das APIs, mantendo todas as funcionalidades atuais. Esta história garante que usuários finais continuem acessando os dados através das interfaces existentes.

**Why this priority**: A interface web é a camada de apresentação para usuários finais. Sua adaptação é importante mas pode ser feita depois que APIs estejam disponíveis. Depende da User Story 4 (precisa de APIs funcionando).

**Independent Test**: Pode ser totalmente testado navegando em cada página web e verificando se: (1) http://localhost:4321/taxa retorna resultados de busca, (2) http://localhost:4321/mapa exibe ocorrências georreferenciadas, (3) http://localhost:4321/dashboard mostra estatísticas atualizadas, (4) http://localhost:4321/tree exibe a árvore taxonômica.

**Acceptance Scenarios**:

1. **Given** que a página de busca de taxa está carregada, **When** um usuário pesquisa por "Panthera onca", **Then** os resultados são carregados da coleção `taxa` via API
2. **Given** que o mapa de ocorrências está carregado, **When** um usuário aplica filtros, **Then** os dados são buscados da coleção `occurrences` e os pontos são renderizados corretamente
3. **Given** que o dashboard está carregado, **When** as estatísticas são calculadas, **Then** os dados vêm das coleções `taxa` e `occurrences` via cache ou API
4. **Given** que a árvore taxonômica está carregada, **When** um usuário expande um nó, **Then** os dados hierárquicos são carregados da coleção `taxa`
5. **Given** que a interface de chat está carregada, **When** um usuário faz uma pergunta sobre biodiversidade, **Then** o ChatBB consulta as novas coleções para fornecer respostas

---

### Edge Cases

- **Falha de conexão IPT durante ingestão**: Quando um recurso IPT está indisponível temporariamente, o sistema registra o erro, pula para o próximo recurso e permite reprocessamento posterior apenas dos recursos falhados
- **Registros com campos obrigatórios ausentes**: Quando um registro DwC-A não possui campos obrigatórios do schema (e.g., `occurrenceID` ausente), o sistema registra warning detalhado mas continua processamento dos demais registros
- **TaxonID ausente ou inválido**: Quando um registro de taxa não possui `taxonID` válido, o sistema gera `_id` alternativo usando hash de `scientificName` + `kingdom` para garantir unicidade e consistência
- **OccurrenceID duplicado entre IPTs**: Quando dois IPTs diferentes possuem registros com mesmo `occurrenceID`, o sistema gera `_id` único combinando `occurrenceID` + `iptId` (hash ou concatenação) para evitar colisão
- **OccurrenceID ausente**: Quando um registro de ocorrência não possui `occurrenceID`, o sistema gera `_id` usando hash de campos-chave (catalogNumber, recordNumber, eventDate, locality, recordedBy) garantindo rastreabilidade
- **Sincronização de \_id entre coleções**: Quando a transformação é executada, o sistema SEMPRE copia `_id` de raw para transformed sem modificação, garantindo rastreabilidade perfeita
- **Verificação de integridade de \_id**: Quando transformação completa, o sistema valida que para cada `_id` em `taxa` existe exatamente um documento com mesmo `_id` em `taxa_ipt` (e vice-versa para occurrences)
- **Sinônimos não encontrados em taxa**: Quando uma ocorrência referencia um `scientificName` que é sinônimo mas não está na coleção `taxa`, o sistema mantém o nome original e adiciona flag de validação pendente
- **Coordenadas geográficas inválidas**: Quando `decimalLatitude` ou `decimalLongitude` estão fora dos ranges válidos (-90 a 90, -180 a 180), o sistema registra o erro mas preserva os valores originais em campo separado para auditoria
- **Múltiplas execuções de transformação**: Quando a transformação é executada múltiplas vezes sobre os mesmos dados brutos, o sistema usa upsert por `_id` para evitar duplicatas, garantindo idempotência
- **Mudanças no schema IPT**: Quando o formato do arquivo DwC-A do IPT muda (novos campos ou estrutura alterada), o sistema registra campos desconhecidos sem falhar, permitindo ajustes posteriores no código
- **Volume massivo de dados**: Quando milhões de registros são processados, o sistema usa processamento em lotes (batch) com commit periódico para evitar timeouts de conexão e permitir recuperação de falhas parciais
- **Arquivos DwC-A corrompidos**: Quando um arquivo ZIP baixado está corrompido ou incompleto, o sistema detecta a corrupção antes de processar, registra erro e mantém versão anterior dos dados se disponível
- **Concorrência em transformações**: Quando múltiplos processos de transformação tentam executar simultaneamente, o sistema usa coleção MongoDB `transform_status` com flags de processo e timestamps atômicos para evitar condições de corrida (permite detecção de locks obsoletos via timeout)
- **Perda de referências entre coleções**: Quando registros em `taxa_ipt` são deletados após a criação de `occurrences`, o sistema mantém integridade referencial através de validações que identificam ocorrências órfãs
- **Dependência externa indisponível**: Quando o repositório de parsing de coletores (`https://github.com/biopinda/coletores-BO`) está inacessível ou retorna erro, o sistema preserva o campo `recordedBy` original sem parsing, registra warning, e continua processamento normalmente

## Requirements _(mandatory)_

### Functional Requirements

**Ingestão e Transformação Integrada de Dados:**

- **FR-001**: Sistema DEVE baixar automaticamente arquivos DwC-A dos URLs dos repositórios IPT especificados
- **FR-002**: Sistema DEVE processar arquivos DwC-A da Fauna do Brasil do IPT JBRJ (`https://ipt.jbrj.gov.br/jbrj/archive.do?r=catalogo_taxonomico_da_fauna_do_brasil`)
- **FR-003**: Sistema DEVE processar arquivos DwC-A da Flora e Funga do Brasil do IPT JBRJ (`https://ipt.jbrj.gov.br/jbrj/archive.do?r=lista_especies_flora_brasil`)
- **FR-004**: Sistema DEVE processar todos os 507 recursos DwC-A listados no arquivo `packages/ingest/referencias/occurrences.csv`
- **FR-005**: Sistema DEVE armazenar dados taxonômicos brutos na coleção MongoDB `taxa_ipt` seguindo o schema `docs/schema-dwc2json-taxa-mongoDBJSON.json`
- **FR-006**: Sistema DEVE armazenar dados de ocorrências brutas na coleção MongoDB `occurrences_ipt` seguindo o schema `docs/schema-dwc2json-ocorrencias-mongoDBJSON.json`
- **FR-007**: Sistema DEVE preservar TODOS os campos DwC originais sem modificações durante a ingestão em coleções `*_ipt`
- **FR-008**: Sistema DEVE converter estrutura relacional DwC-A para estrutura de documento JSON MongoDB
- **FR-009**: Sistema DEVE gerar `_id` determinístico baseado em chave natural (taxonID para taxa, occurrenceID para ocorrências) durante ingestão para garantir rastreabilidade entre coleções raw e transformadas
- **FR-009a**: Para taxa, Sistema DEVE usar `taxonID` do DwC-A como `_id` em `taxa_ipt` (garantindo unicidade e rastreabilidade)
- **FR-009b**: Para ocorrências, Sistema DEVE gerar `_id` combinando `occurrenceID` + `iptId` (hash ou concatenação) para garantir unicidade entre diferentes IPTs
- **FR-009c**: Sistema DEVE reter dados brutos em `taxa_ipt` e `occurrences_ipt` indefinidamente até que deleção manual seja explicitamente acionada, para fins de auditoria, reprodutibilidade e rastreabilidade de dados
- **FR-010**: Sistema DEVE executar transformação imediatamente após inserir cada registro bruto, no mesmo processo de ingestão
- **FR-010a**: Scripts de ingestão (flora.ts, fauna.ts, ocorrencia.ts) DEVEM importar funções de transformação de `@darwincore/transform`
- **FR-010b**: Sistema DEVE realizar upsert em ambas coleções raw e transformed usando mesmo `_id` para manter rastreabilidade
- **FR-010c**: Se transformação falhar para um registro específico, Sistema DEVE registrar erro mas continuar processamento, mantendo registro bruto em coleção `*_ipt`

**Transformação de Dados Taxonômicos:**

- **FR-011**: Sistema DEVE criar registro na coleção `taxa` para cada registro em `taxa_ipt` preservando EXATAMENTE o mesmo `_id` (rastreabilidade 1:1)
- **FR-012**: Sistema DEVE filtrar apenas registros com `taxonRank` em ['ESPECIE', 'VARIEDADE', 'FORMA', 'SUB_ESPECIE']
- **FR-013**: Sistema DEVE criar campo `canonicalName` concatenando campos: `genus`, `genericName`, `subgenus`, `infragenericEpithet`, `specificEpithet`, `infraspecificEpithet`, `cultivarEpiteth` (filtrados por Boolean e unidos com espaço)
- **FR-014**: Sistema DEVE criar campo `flatScientificName` removendo caracteres não alfanuméricos de `scientificName` e convertendo para lowercase
- **FR-015**: Sistema DEVE processar campo `higherClassification` usando apenas o segundo componente da string separada por ponto-e-vírgula (issue #13)
- **FR-016**: Sistema DEVE normalizar `vernacularname` array: converter `vernacularName` para lowercase com hífens no lugar de espaços, e capitalizar primeira letra de `language`
- **FR-017**: Para Flora/Fungi, Sistema DEVE transformar array `distribution` em objeto estruturado com: `origin` (estabelecimentoMeans do primeiro elemento), `Endemism` (occurrenceRemarks.endemism), `phytogeographicDomains`, `occurrence` (array de locationID ordenado), `vegetationType` (do speciesprofile[0].lifeForm.vegetationType)
- **FR-018**: Para Fauna, Sistema DEVE transformar array `distribution` em objeto estruturado com: `origin`, `occurrence` (locality split por ';'), `countryCode` (split por ';')
- **FR-019**: Sistema DEVE processar `resourcerelationship` array criando campo `othernames` com mapeamento de: `taxonID` (relatedResourceID), `scientificName` (buscado no dwcJson), `taxonomicStatus` (relationshipOfResource), e deletar campo original `resourcerelationship`
- **FR-020**: Para Flora/Fungi, Sistema DEVE transformar `speciesprofile` array pegando primeiro elemento e removendo `vegetationType` de `lifeForm`
- **FR-021**: Sistema DEVE definir `kingdom` = 'Animalia' para registros de Fauna durante transformação
- **FR-022**: Sistema DEVE agregar dados de ameaça das coleções `cncfloraFungi`, `cncfloraPlantae` e `faunaAmeacada`
- **FR-023**: Sistema DEVE agregar dados de espécies invasoras da coleção `invasoras`
- **FR-024**: Sistema DEVE agregar dados de presença em Unidades de Conservação do arquivo DwC-A `https://ipt.jbrj.gov.br/jbrj/archive.do?r=catalogoucs`

**Transformação de Dados de Ocorrências:**

- **FR-025**: Sistema DEVE criar registro na coleção `occurrences` para cada registro em `occurrences_ipt` preservando EXATAMENTE o mesmo `_id` (rastreabilidade 1:1)
- **FR-026**: Sistema DEVE criar campo `geoPoint` (tipo Point com coordinates [longitude, latitude]) quando `decimalLatitude` e `decimalLongitude` são válidos (numéricos e dentro dos ranges -90 a 90 e -180 a 180)
- **FR-027**: Sistema DEVE criar campo `canonicalName` concatenando campos: `genus`, `genericName`, `subgenus`, `infragenericEpithet`, `specificEpithet`, `infraspecificEpithet`, `cultivarEpiteth` (filtrados por Boolean e unidos com espaço)
- **FR-028**: Sistema DEVE criar campo `iptKingdoms` como array resultado do split de `kingdom` do CSV por vírgula ou vírgula-espaço
- **FR-029**: Sistema DEVE criar campo `flatScientificName` removendo caracteres não alfanuméricos de `scientificName` (ou canonicalName se scientificName ausente) e convertendo para lowercase
- **FR-030**: Sistema DEVE converter campos `year`, `month`, `day` de string para number quando válidos: year > 0, month entre 1-12, day entre 1-31 (mantém como string se inválido para compatibilidade)
- **FR-031**: Sistema DEVE normalizar campo `country` usando mapeamento de normalizeCountryName (Brasil, Brazil → Brasil) preservando variações
- **FR-032**: Sistema DEVE normalizar campo `stateProvince` usando mapeamento de normalizeStateName (abreviações e variações → nome completo oficial)
- **FR-033**: Sistema DEVE parsear `eventDate` quando é string: criar objeto Date válido, extrair year/month/day se ausentes ou inválidos, e converter para timestamp (mantém string original se parsing falhar)
- **FR-034**: Sistema DEVE adicionar campos `iptId` (ipt.id), `ipt` (repositório), `canonicalName`, `iptKingdoms`, `flatScientificName` a todos os registros
- **FR-035**: Sistema DEVE validar `scientificName` contra coleção `taxa` e substituir sinônimos por nomes aceitos
- **FR-036**: Sistema DEVE associar `taxonID` correto de `taxa` para cada ocorrência
- **FR-037**: Sistema DEVE buscar e validar `canonicalName` na coleção `taxa`
- **FR-038**: Sistema DEVE harmonizar campo `continent` para valor padronizado "América do Sul"
- **FR-039**: Sistema DEVE filtrar e NÃO ingerir registros com `country` diferente de "Brasil" (e variações) com alta certeza
- **FR-040**: Sistema DEVE harmonizar campo `county` usando lista oficial de municípios do IBGE
- **FR-041**: Sistema DEVE criar campo `reproductiveCondition` = "flor" para registros Plantae quando `occurrenceRemarks` contém regex `(^|[\s\p{P}])(flôr|flor)([\s\p{P}]|$)`
- **FR-042**: Sistema DEVE aplicar algoritmo de parsing de coletores do repositório `https://github.com/biopinda/coletores-BO` ao campo `recordedBy`
- **FR-042a**: Sistema DEVE preservar campo `recordedBy` original sem modificação quando algoritmo de parsing de coletores falha (repositório indisponível, erro de parsing), registrando warning em log para rastreabilidade

**Re-transformação em Massa:**

- **FR-043**: Sistema DEVE permitir re-executar transformação sobre todos dados brutos via comando CLI `bun run transform:taxa` e `bun run transform:occurrences`
- **FR-044**: Sistema DEVE detectar mudanças de versão em `packages/transform/package.json` e disparar re-transformação via GitHub Actions
- **FR-045**: Sistema DEVE suportar execução manual de re-transformação via `workflow_dispatch` no GitHub Actions
- **FR-046**: Sistema DEVE processar re-transformação em lotes (batch) para evitar timeouts em grandes volumes
- **FR-047**: Sistema DEVE usar coleção MongoDB `transform_status` com operações atômicas para controlar concorrência, incluindo campos: process_type (taxa/occurrences), status (running/completed/failed), started_at, updated_at, process_id
- **FR-048**: Sistema DEVE registrar métricas de re-transformação na coleção `process_metrics` (duração, contagem de registros, taxa de erro)
- **FR-049**: Sistema DEVE garantir que transformação é idempotente (múltiplas execuções produzem mesmo resultado)

**Exposição de APIs:**

- **FR-050**: Sistema DEVE expor APIs RESTful usando plataforma Swagger para documentação interativa
- **FR-051**: APIs DEVEM permitir consultas à coleção `taxa` com filtros por campos taxonômicos
- **FR-052**: APIs DEVEM permitir consultas à coleção `occurrences` com filtros geográficos e temporais
- **FR-053**: APIs DEVEM suportar paginação de resultados
- **FR-054**: APIs DEVEM retornar dados em formato JSON
- **FR-055**: APIs DEVEM suportar filtros combinados (múltiplos parâmetros simultaneamente)
- **FR-056**: APIs DEVEM incluir metadados de paginação (total de registros, página atual, total de páginas)

**Adaptação de Interface Web:**

- **FR-057**: Interface web DEVE consumir dados das coleções `taxa` e `occurrences` através das APIs expostas
- **FR-058**: Página de busca de taxa (`/taxa`) DEVE buscar dados da coleção `taxa` via API
- **FR-059**: Página de mapa (`/mapa`) DEVE carregar ocorrências georreferenciadas da coleção `occurrences` via API
- **FR-060**: Página de dashboard (`/dashboard`) DEVE calcular estatísticas usando dados das coleções `taxa` e `occurrences`
- **FR-061**: Página de árvore taxonômica (`/tree`) DEVE construir hierarquia a partir da coleção `taxa`
- **FR-062**: Interface de chat (`/chat`) DEVE consultar coleções `taxa` e `occurrences` para responder perguntas sobre biodiversidade

**Requisitos Técnicos e de Arquitetura:**

- **FR-063**: Código compartilhado entre pacotes DEVE estar organizado em `packages/shared` (deterministic-id, database connection, collection names, metrics)
- **FR-064**: Rotinas de ingestão DEVEM estar organizadas no pacote `packages/ingest` e DEVEM importar transformações de `packages/transform`
- **FR-065**: Rotinas de transformação (re-processamento em massa) DEVEM estar organizadas no pacote `packages/transform`
- **FR-066**: Interface web DEVE permanecer no pacote `packages/web`
- **FR-067**: Sistema DEVE reutilizar código existente de funções e rotinas sempre que possível (especialmente processaZip, processaEml, normalização)
- **FR-068**: Sistema DEVE manter plataforma tecnológica atual (Bun, Astro.js, TypeScript, MongoDB)
- **FR-069**: Sistema DEVE usar Docker com variáveis de ambiente para strings de conexão e chaves sensíveis
- **FR-070**: Sistema DEVE suportar integração opcional com Meilisearch quando necessário
- **FR-071**: Nenhuma informação sensível DEVE estar exposta no repositório público
- **FR-072**: Workflows GitHub Actions de ingestão NÃO DEVEM chamar workflows de transformação (transformação integrada no processo de ingestão)
- **FR-073**: Workflows GitHub Actions de transformação DEVEM ser disparados apenas por: (a) mudança de versão em `packages/transform/package.json`, (b) workflow_dispatch manual

**Requisitos de Processamento em Lote e Resiliência (já implementados):**

- **FR-064**: Sistema DEVE processar inserções em lotes usando safeInsertMany com chunking automático quando BSON excede 16MB
- **FR-065**: Sistema DEVE detectar erros de rede (timeout, Connection, ECONNRESET, ENOTFOUND, ECONNREFUSED, AbortError) e marcar IPT servers como offline
- **FR-066**: Sistema DEVE executar version check de IPTs com concorrência limitada (max 10 simultâneos) e timeout de 10 segundos
- **FR-067**: Sistema DEVE usar ordered:false em insertMany para permitir inserção parcial em caso de duplicatas
- **FR-068**: Sistema DEVE tratar recursos 404 (não encontrados) sem interromper processamento de outros recursos
- **FR-069**: Sistema DEVE criar índices MongoDB de forma segura, tratando erro 85 (índice existe com opções diferentes)

**Requisitos de Índices MongoDB (já implementados):**

- **FR-070**: Sistema DEVE criar índices em `occurrences` para: scientificName, iptId, ipt, canonicalName, flatScientificName, iptKingdoms, year, month, eventDate, country, stateProvince, genus, specificEpithet, kingdom, family, recordedBy, recordNumber, locality, tag, phylum, class, order
- **FR-071**: Sistema DEVE criar índices compostos em `occurrences` para: (country, stateProvince), (genus, specificEpithet), (kingdom, country), (kingdom, stateProvince), (kingdom, family)
- **FR-072**: Sistema DEVE criar índice geoespacial 2dsphere em `geoPoint` para queries geográficas
- **FR-073**: Sistema DEVE criar índice de taxonomia complexo em `occurrences`: (stateProvince, kingdom, phylum, class, order, family, genus, specificEpithet)
- **FR-074**: Sistema DEVE criar índices em `taxa` para: scientificName, kingdom, family, genus, (taxonID, kingdom), canonicalName, flatScientificName
- **FR-075**: Sistema DEVE criar índices em `ipts` para: tag, ipt

### Non-Functional Requirements

**Observability & Monitoring:**

- **NFR-001**: Sistema DEVE registrar métricas operacionais básicas incluindo: duração de cada processo de ingestão (por recurso IPT), duração de cada processo de transformação (taxa e occurrences separadamente), contagem de registros processados (inseridos, atualizados, com erro), taxa de erro por tipo (rede, validação, parsing)
- **NFR-002**: Métricas DEVEM ser armazenadas em coleção MongoDB `process_metrics` com campos: process_type, resource_identifier, started_at, completed_at, duration_seconds, records_processed, records_inserted, records_updated, records_failed, error_summary
- **NFR-003**: Sistema DEVE expor endpoint `/api/health` retornando status das últimas execuções de ingestão e transformação para monitoramento externo

### Key Entities

**Taxa (Taxonomia):**

- Representa espécies, gêneros, famílias e outras categorias taxonômicas
- Atributos principais: `_id`, `scientificName`, `canonicalName`, `taxonID`, `kingdom`, `phylum`, `class`, `order`, `family`, `genus`, `taxonomicStatus`
- Relacionamentos: Hierarquia taxonômica (`parentNameUsageID`), sinônimos (`othernames`), ocorrências associadas
- Dados agregados: Status de ameaça, invasoras, presença em UCs

**Occurrence (Ocorrência):**

- Representa registro de avistamento/coleta de espécie em local e momento específicos
- Atributos principais: `_id`, `occurrenceID`, `scientificName`, `canonicalName`, `taxonID`, `eventDate`, `decimalLatitude`, `decimalLongitude`, `geoPoint`, `stateProvince`, `county`, `basisOfRecord`
- Relacionamentos: Vinculada a taxon via `taxonID`, origem em repositório IPT (`ipt`, `iptId`)
- Dados temporais: `day`, `month`, `year`, `eventDate` (timestamp)
- Dados geográficos: `continent`, `country`, `stateProvince`, `county`, `locality`, coordenadas

**IPT Resource (Recurso IPT):**

- Representa fonte de dados DwC-A em repositório IPT
- Atributos: `nome`, `repositorio`, `kingdom`, `tag`, `url`
- 507 recursos catalogados em `occurrences.csv`

**Conservation Unit (Unidade de Conservação):**

- Representa área protegida do catálogo de UCs
- Fonte: `https://ipt.jbrj.gov.br/jbrj/archive.do?r=catalogoucs`
- Agregada aos dados de taxa durante transformação

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Sistema completa ingestão de dados de Fauna e Flora em menos de 2 horas para conjunto completo de registros
- **SC-002**: Sistema processa todos os 507 recursos de ocorrências listados em `occurrences.csv` com taxa de sucesso superior a 95% (máximo 25 recursos com falha temporária)
- **SC-003**: 100% dos registros em `taxa` possuem `_id` EXATAMENTE idêntico ao registro correspondente em `taxa_ipt` (validação por join em \_id)
- **SC-004**: 100% dos registros em `occurrences` possuem `_id` EXATAMENTE idêntico ao registro correspondente em `occurrences_ipt` (validação por join em \_id)
- **SC-004a**: Qualquer registro transformado pode ser auditado encontrando seu documento raw pelo `_id`: query `db.taxa_ipt.findOne({_id: taxa_id})` sempre retorna o documento original
- **SC-004b**: Sistema permite queries bi-direcionais: dado um `_id`, encontra-se tanto o documento raw quanto o transformado instantaneamente
- **SC-005**: 95% dos campos `canonicalName` são parseados corretamente a partir de `scientificName` (validação manual por amostragem)
- **SC-006**: 90% das ocorrências com `scientificName` válido são vinculadas a `taxonID` correto da coleção `taxa`
- **SC-007**: 100% dos registros com `eventDate` válido possuem campos `day`, `month`, `year` extraídos corretamente
- **SC-008**: 100% dos estados brasileiros em `stateProvince` são harmonizados para formato padronizado
- **SC-009**: 95% dos municípios em `county` são validados e harmonizados usando lista IBGE
- **SC-010**: APIs respondem a consultas simples em menos de 500ms para até 1000 resultados
- **SC-011**: Documentação Swagger expõe 100% dos endpoints de API disponíveis com exemplos funcionais
- **SC-012**: Todas as páginas web existentes (taxa, mapa, dashboard, tree, chat) continuam funcionando após adaptação
- **SC-013**: Transformações são idempotentes: executar 2x produz exatamente o mesmo resultado que executar 1x
- **SC-014**: Processo de ingestão pode ser retomado após falha sem reprocessar recursos já concluídos
- **SC-015**: Zero informações sensíveis (passwords, API keys, connection strings) são expostas no código-fonte público
- **SC-016**: Métricas operacionais são registradas para 100% dos processos de ingestão e transformação executados, incluindo duração, contagem de registros e taxa de erro

## Assumptions

1. **Conectividade IPT**: Assumimos que os repositórios IPT do JBRJ e SiBBr mantêm disponibilidade superior a 95% e que indisponibilidades temporárias são aceitáveis com retry posterior
2. **Formato DwC-A estável**: Assumimos que o formato Darwin Core Archive permanece compatível com a versão atual, com possíveis novos campos sendo opcionais
3. **Schema MongoDB existente**: Assumimos que os schemas em `docs/schema-dwc2json-taxa-mongoDBJSON.json` e `docs/schema-dwc2json-ocorrencias-mongoDBJSON.json` são completos e validados
4. **Infraestrutura MongoDB**: Assumimos que a instância MongoDB possui capacidade de armazenamento suficiente para milhões de registros (estimado mínimo 50GB para dados brutos + transformados)
5. **Algoritmo de coletores**: Assumimos que o repositório `https://github.com/biopinda/coletores-BO` fornece algoritmo funcional para parsing do campo `recordedBy`
6. **Lista IBGE atualizada**: Assumimos que a lista de municípios do IBGE está acessível em `https://www.ibge.gov.br/explica/codigos-dos-municipios.php` e permanece relativamente estável
7. **Código existente reutilizável**: Assumimos que funções existentes em `packages/ingest/src/lib/` (processaZip, processaEml, getEml, normalization) podem ser reutilizadas na nova estrutura sem modificações significativas
8. **Performance aceitável**: Assumimos que processamento em lote de até 100.000 registros por vez é suficiente para evitar timeouts e problemas de memória (baseado em implementação atual de safeInsertMany)
9. **Compatibilidade Docker**: Assumimos que a estrutura Docker atual pode ser adaptada para incluir o novo pacote `packages/transform` sem mudanças arquiteturais significativas
10. **Meilisearch opcional**: Assumimos que funcionalidades dependentes de Meilisearch podem ser implementadas incrementalmente e não bloqueiam o MVP

## Code Preservation Requirements

Esta seção documenta código e lógica existentes que DEVEM ser preservados durante a refatoração:

### Funções de Biblioteca a Preservar (`packages/ingest/src/lib/`)

1. **dwca.ts**:
   - `getEml(url, timeout)`: Download de metadados EML com timeout configurável
   - `processaEml(eml)`: Parse de XML EML para objeto Ipt estruturado
   - `processaZip(url, isOccurrence?, batchSize?)`: Download e processamento de DwC-A com suporte a batching
   - Tipos: `DbIpt`, `Ipt`
2. **normalization.ts**:
   - `normalizeCountryName(value)`: Mapeamento de variações de "Brasil/Brazil" para forma canônica
   - `normalizeStateName(value)`: Mapeamento completo de estados brasileiros (abreviações + variações → nome oficial)
   - `stateMapping`: Objeto congelado com todos os mapeamentos de estados
   - `countryMapping`: Objeto congelado com mapeamentos de países

### Lógica de Processamento a Preservar

1. **Controle de Concorrência** (`ocorrencia.ts`):
   - `runWithConcurrency()`: Pool de promises com limite de execução simultânea
   - Limit de 10 IPTs simultâneos durante version check
   - Timeout de 10 segundos para version checks

2. **Resiliência e Error Handling**:
   - `isNetworkError()`: Detecção de erros de rede vs erros de dados
   - `failedIpts Set`: Tracking de IPT servers offline para skip de recursos do mesmo servidor
   - Tratamento especial de HTTP 404 (recursos deletados) sem interromper processamento
   - `ordered: false` em insertMany para inserção parcial

3. **BSON Size Management** (`ocorrencia.ts`):
   - `safeInsertMany()`: Chunking automático quando batch excede 16MB BSON limit
   - Loop de redução de chunk size por metade até sucesso
   - Redução de returns para único objeto de resultado

4. **Progress Tracking**:
   - Uso de `cli-progress` SingleBar para feedback visual durante inserção
   - Incremento em duas fases (batch.length - floor/4, depois floor/4)

5. **Transformações de Taxonomia** (preservar de `flora.ts` e `fauna.ts`):
   - Filtro de taxonRank: apenas ['ESPECIE', 'VARIEDADE', 'FORMA', 'SUB_ESPECIE']
   - Parse de `higherClassification`: split por ';' e pegar índice [1]
   - Normalização de vernacularname: lowercase com hífens, capitalização de language
   - Transformação de distribution array → objeto estruturado (diferente para Flora vs Fauna)
   - Processamento de resourcerelationship → othernames
   - Remoção de vegetationType de speciesprofile.lifeForm (apenas Flora)

6. **Transformações de Ocorrências** (preservar de `ocorrencia.ts`):
   - Validação e criação de geoPoint apenas se coordenadas válidas (lat -90 a 90, lon -180 a 180)
   - Conversão segura de year/month/day para números com validação de ranges
   - Parse de eventDate para Date object com fallback para year/month/day
   - Criação de canonicalName de múltiplos campos possíveis
   - Criação de flatScientificName (remove não-alfanuméricos + lowercase)

7. **Index Creation**:
   - `createIndexSafely()`: Tratamento de erro 85 (índice existe com opções diferentes)
   - Lista completa de 30+ índices para occurrences
   - Índices compostos para otimização de queries comuns
   - Índice geoespacial 2dsphere

### Estrutura de Dados a Preservar

1. **IPT Source CSV Format** (`occurrences.csv`):
   - Colunas: nome, repositorio, kingdom, tag, url
   - Parse com PapaParse usando header:true

2. **Version Control**:
   - Comparação de `dbVersion` vs `ipt.version` antes de reprocessar
   - Skip de processamento se versões são iguais
   - Upsert de IPT metadata com fields: \_id, version, tag, ipt, kingdom, set

3. **Batch Processing Pattern**:
   - Iteração sobre batches retornados por processaZip
   - Map de cada batch antes de insertMany
   - Progress bar atualizada por batch

4. **ID Preservation Strategy (CRÍTICO)**:
   - **Taxa**: `_id` em `taxa_ipt` e `taxa` DEVE ser idêntico (baseado em `taxonID` do DwC-A)
   - **Occurrences**: `_id` em `occurrences_ipt` e `occurrences` DEVE ser idêntico (gerado de forma determinística de `occurrenceID` + `iptId`)
   - **Rastreabilidade**: Dado qualquer `_id`, deve ser possível encontrar tanto o documento raw quanto o transformado
   - **Auditoria**: Queries como `db.taxa.findOne({_id: X})` e `db.taxa_ipt.findOne({_id: X})` retornam documentos relacionados
   - **Upsert**: Usar `_id` como chave de upsert garante idempotência e atualização correta
   - **NO ObjectId gerado**: Não usar MongoDB ObjectId auto-gerado; sempre usar chave natural determinística

### Migration Notes

- **NÃO ALTERAR**: Toda a lógica em `packages/ingest/src/lib/` deve ser mantida intacta
- **REUTILIZAR**: Funções de `flora.ts` e `fauna.ts` devem ser movidas para `packages/transform` como estão
- **SEPARAR**: Lógica de transformação (canonicalName, normalização) deve ser extraída para transform package
- **MANTER**: Estrutura de error handling, concurrency control e BSON management em ingest package

## Out of Scope

- Migração automática de dados das coleções antigas (`taxa` e `occurrences` atuais) para nova estrutura
- Interface de administração para monitoramento de ingestão/transformação em tempo real
- Sistema de notificações sobre falhas em recursos IPT
- Versionamento de dados transformados (histórico de mudanças)
- Validação taxonômica profunda contra bases externas (GBIF, Catalogue of Life)
- Implementação de cache distribuído para APIs
- Suporte a múltiplos idiomas na interface web
- Sistema de autenticação e autorização para APIs
- Implementação de rate limiting nas APIs
- Testes automatizados end-to-end do fluxo completo
- Otimização de índices MongoDB (será abordado em feature futura)
- Interface web para visualização de logs de transformação
- Sistema de rollback automático em caso de falha na transformação
