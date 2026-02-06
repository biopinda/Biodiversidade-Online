# Funcionamento do Sistema Biodiversidade Online (DwC2JSON v5.0)

## Sumario

1. [Visao Geral](#1-visao-geral)
2. [Arquitetura do Monorepo](#2-arquitetura-do-monorepo)
3. [Fontes de Dados e IPTs](#3-fontes-de-dados-e-ipts)
4. [Pipeline de Ingestao (packages/ingest)](#4-pipeline-de-ingestao)
5. [Pipeline de Transformacao (packages/transform)](#5-pipeline-de-transformacao)
6. [Armazenamento MongoDB](#6-armazenamento-mongodb)
7. [Aplicacao Web (packages/web)](#7-aplicacao-web)
8. [Interface de Chat com IA](#8-interface-de-chat-com-ia)
9. [Dashboard e Sistema de Cache](#9-dashboard-e-sistema-de-cache)
10. [Automacao CI/CD](#10-automacao-cicd)
11. [Infraestrutura Docker](#11-infraestrutura-docker)

---

## 1. Visao Geral

O Biodiversidade Online e uma plataforma para consulta de dados da biodiversidade brasileira. O sistema:

- Ingere dados taxonomicos da **Flora e Funga do Brasil** e do **Catalogo Taxonomico da Fauna do Brasil**
- Ingere registros de **ocorrencias** de ~505 colecoes de herbarios e museus brasileiros
- Transforma dados brutos do formato **Darwin Core Archive (DwC-A)** para documentos JSON otimizados
- Enriquece os dados com informacoes de **especies ameacadas**, **especies invasoras** e **unidades de conservacao**
- Oferece uma interface web com busca de especies, mapa de ocorrencias, arvore taxonomica, dashboard analitico e chat com IA

O nome interno do banco de dados e **dwc2json** — uma referencia direta ao processo central: converter Darwin Core Archive em documentos JSON no MongoDB.

---

## 2. Arquitetura do Monorepo

O projeto utiliza **Bun workspaces** para gerenciar tres pacotes:

```
Biodiversidade-Online/
├── packages/
│   ├── ingest/        # Aquisicao de dados dos IPTs e carga no MongoDB
│   ├── transform/     # Normalizacao, validacao e enriquecimento dos dados brutos
│   └── web/           # Aplicacao Astro.js (frontend + API)
├── package.json       # Workspace root com scripts orquestradores
├── tsconfig.base.json # Configuracao TypeScript compartilhada
└── bun.lock           # Lockfile unico para todos os pacotes
```

**Scripts orquestradores** (raiz do projeto):

| Comando                         | Descricao                                 |
| ------------------------------- | ----------------------------------------- |
| `bun run ingest:flora`          | Ingere dados da Flora e Funga do Brasil   |
| `bun run ingest:fauna`          | Ingere dados da Fauna do Brasil           |
| `bun run ingest:occurrences`    | Ingere todas as colecoes de ocorrencias   |
| `bun run transform:taxa`        | Re-transforma taxa brutos em taxa curados |
| `bun run transform:occurrences` | Re-transforma ocorrencias brutas          |
| `bun run web:dev`               | Inicia o servidor de desenvolvimento      |
| `bun run web:build`             | Compila a aplicacao para producao         |

---

## 3. Fontes de Dados e IPTs

### O que sao IPTs

IPT (Integrated Publishing Toolkit) e um software desenvolvido pelo GBIF (Global Biodiversity Information Facility) usado por instituicoes de pesquisa para publicar dados de biodiversidade no formato **Darwin Core Archive**. Cada IPT hospeda um ou mais recursos (datasets) acessiveis via URLs padronizadas.

### Fontes Taxonomicas

O sistema possui **duas fontes taxonomicas primarias**, cada uma publicada como um unico DwC-A:

| Fonte                                  | IPT                                      | URL Base                         | Reino          |
| -------------------------------------- | ---------------------------------------- | -------------------------------- | -------------- |
| Flora e Funga do Brasil                | JBRJ (Jardim Botanico do Rio de Janeiro) | `https://ipt.jbrj.gov.br/jbrj/`  | Plantae, Fungi |
| Catalogo Taxonomico da Fauna do Brasil | JBRJ                                     | `https://ipt.jbrj.gov.br/jabot/` | Animalia       |

### Fontes de Ocorrencias

O sistema mantem um catalogo de **~505 colecoes** de ocorrencias registradas no arquivo `packages/ingest/referencias/occurrences.csv`. Cada linha representa uma colecao hospedada em um IPT, com os campos:

```csv
nome,repositorio,kingdom,tag,url
Herbarium - INPA,inpa,Plantae,inpa_herbario,https://ipt.sibbr.gov.br/inpa/
Herpetology Collection - MPEG,mpeg,Animalia,mpeg_herpetologia,https://ipt.sibbr.gov.br/mpeg/
```

**Principais instituicoes provedoras:**

- **INPA** — Instituto Nacional de Pesquisas da Amazonia
- **MPEG** — Museu Paraense Emilio Goeldi
- **JBRJ** — Jardim Botanico do Rio de Janeiro
- **SiBBr** — Sistema de Informacao sobre a Biodiversidade Brasileira
- **UFMG**, **USP**, **UNICAMP**, e dezenas de outras universidades e museus

### Formato Darwin Core Archive

Um DwC-A e um arquivo ZIP contendo:

```
arquivo.zip/
├── meta.xml           # Schema: define campos do core e extensoes
├── eml.xml            # Metadados ecologicos (titulo, versao, autores)
├── taxon.txt          # Core: dados taxonomicos (tab-delimited)
├── distribution.txt   # Extensao: distribuicao geografica
├── vernacularname.txt # Extensao: nomes populares
├── speciesprofile.txt # Extensao: perfil da especie
└── resourcerelationship.txt # Extensao: sinonimias
```

O arquivo `meta.xml` mapeia cada coluna (por indice) a um termo Darwin Core padronizado:

```xml
<core>
  <field index="0" term="http://rs.tdwg.org/dwc/terms/taxonID"/>
  <field index="1" term="http://rs.tdwg.org/dwc/terms/scientificName"/>
  <field index="2" term="http://rs.tdwg.org/dwc/terms/kingdom"/>
</core>
```

---

## 4. Pipeline de Ingestao

O pacote `packages/ingest` e responsavel por baixar os DwC-A, parsea-los e inseri-los no MongoDB. O pipeline possui etapas distintas para taxa (flora/fauna) e ocorrencias.

### 4.1 Verificacao de Versao

Antes de baixar qualquer arquivo, o sistema verifica se o IPT publicou uma versao nova:

1. Faz fetch do `eml.xml` do IPT: `${url}eml.do?r=${tag}`
2. Extrai a versao do atributo `@packageId`
3. Compara com a versao armazenada na colecao `ipts` do MongoDB
4. **Se a versao e identica, pula o download** (economiza banda e tempo)
5. Versoes verificadas sao cacheadas por 5 minutos para evitar requests repetidos

**Classe:** `VerificadorVersao` (`src/lib/verificador-versao.ts`)

### 4.2 Download do DwC-A

**Funcao:** `processaZip()` (`src/lib/dwca.ts`)

1. Faz HTTP fetch da URL `${url}archive.do?r=${tag}`
2. Streaming do conteudo para arquivo temporario `.temp/temp.zip`
3. Possui timeout por inatividade (resets a cada chunk recebido)
4. Trata erros 404 graciosamente (recurso pode ter sido removido)
5. Extrai o ZIP para diretorio temporario

### 4.3 Parsing do DwC-A — Dois Modos

O sistema utiliza dois modos de parsing, escolhidos conforme o tipo de dado:

#### Modo 1: JSON em Memoria (Taxa)

Usado para Flora e Fauna porque os datasets taxonomicos cabem na memoria (~100K-300K registros).

```
meta.xml → Identifica core + extensoes
    ↓
taxon.txt → Leitura linha a linha → Objeto JSON com taxonID como chave
    ↓
distribution.txt → Adicionado como array aninhado em cada taxon
vernacularname.txt → Idem
speciesprofile.txt → Idem
resourcerelationship.txt → Idem
    ↓
eml.xml → Metadados do IPT extraidos
    ↓
Resultado: { "12345": { taxonID, scientificName, distribution: [...], ... } }
```

**Funcao:** `buildJson()` (`src/lib/dwca.ts`)

#### Modo 2: SQLite Streaming (Ocorrencias)

Usado para ocorrencias porque os datasets podem ter milhoes de registros.

```
meta.xml → Identifica core + extensoes
    ↓
occurrence.txt → Inserido em tabela SQLite in-memory
    ↓
extensoes → Tabelas SQLite separadas com indices
    ↓
Iterator → Retorna batches de N registros (default: 5000)
           com extensoes juntas via SQL JOIN
```

**Funcao:** `buildSqlite()` (`src/lib/dwca.ts`)

### 4.4 Preservacao de Dados Originais

Antes de qualquer transformacao, os dados brutos sao preservados nas colecoes `taxa_ipt` e `occurrences_ipt`:

```javascript
{
  _id: ObjectId,
  iptId: "flora-do-brasil",
  ipt_record_id: "12345",
  ipt_version: "393.366",
  collection_type: "flora",
  original_data: { /* campos DwC-A exatamente como recebidos */ },
  ingestion_metadata: {
    timestamp: Date,
    source_ipt_url: "https://ipt.jbrj.gov.br/jbrj/",
    processing_version: "1.0.0"
  }
}
```

**Beneficios:**

- Auditoria: possibilidade de rastrear dados ate a fonte original
- Reprocessamento: permite aplicar novas transformacoes sem re-download
- Rollback: recuperacao de dados em caso de transformacao incorreta

**Classe:** `PreservadorDadosOriginais` (`src/lib/preservador-dados-originais.ts`)

### 4.5 Transformacao Inline (durante ingestao)

Apos a preservacao, uma **transformacao inline** e aplicada antes da insercao nas colecoes curadas. Os detalhes de cada transformacao estao na Secao 5.

### 4.6 Ingestao de Flora

**Script:** `packages/ingest/src/flora.ts`
**Comando:** `bun run ingest:flora [URL_DWCA]`

Fluxo:

1. Verifica versao do IPT
2. Baixa e extrai DwC-A (modo JSON em memoria)
3. Preserva dados originais em `taxa_ipt`
4. Para cada taxon no JSON:
   - Filtra por rank (mantem apenas `ESPECIE`, `VARIEDADE`, `FORMA`, `SUB_ESPECIE`)
   - Reestrutura distribuicao (array → objeto estruturado)
   - Extrai sinonimias de `resourcerelationship`
   - Normaliza nomes vernaculares
   - Gera `canonicalName` e `flatScientificName`
   - Extrai classificacao superior
5. Remove registros antigos de Plantae/Fungi da colecao `taxa`
6. Insere registros transformados em lotes de 5000
7. Cria indices

### 4.7 Ingestao de Fauna

**Script:** `packages/ingest/src/fauna.ts`
**Comando:** `bun run ingest:fauna [URL_DWCA]`

Processo similar a flora, com diferencas:

- Distribuicao estruturada de forma diferente (usa `locality` e `countryCode`)
- Define `kingdom: "Animalia"` explicitamente
- Remove registros antigos de Animalia antes da insercao

### 4.8 Ingestao de Ocorrencias

**Script:** `packages/ingest/src/ocorrencia.ts`
**Comando:** `bun run ingest:occurrences`

Fluxo:

1. Le catalogo de ~505 IPTs do arquivo `occurrences.csv`
2. Verifica versoes de **todos os IPTs em paralelo** (10 concorrentes)
3. Identifica quais IPTs possuem atualizacoes pendentes
4. Para cada IPT com atualizacao:
   - Baixa DwC-A (modo SQLite streaming)
   - Preserva dados originais em `occurrences_ipt`
   - Processa em batches de 5000:
     - Cria GeoJSON Point com coordenadas validadas
     - Converte campos temporais (year, month, day) para numeros
     - Extrai componentes de data do `eventDate`
     - Normaliza nomes de paises e estados brasileiros
     - Gera `canonicalName` e `flatScientificName`
     - Adiciona metadados do IPT (`iptId`, `ipt`, `iptKingdoms`)
   - Remove registros antigos daquele `iptId`
   - Insere registros transformados
5. Cria 45+ indices incluindo geoespacial (`geoPoint_2dsphere`)

### 4.9 IDs Deterministicos

Para garantir consistencia entre ingestoes, o sistema gera IDs deterministicos:

**Taxa:**

- Flora: `P` + taxonID (ex: `P12345`)
- Fauna: `A` + taxonID (ex: `A67890`)
- Evita colisao entre flora e fauna com mesmo taxonID numerico

**Ocorrencias:**

- Primario: `{occurrenceID}::{iptId}`
- Fallback: hash SHA1 de `iptId|catalogNumber|recordNumber|eventDate|locality|recordedBy`

### 4.10 Tratamento de Erros

- **Timeout de rede:** abort controller com reset por chunk de dados
- **404 (recurso removido):** saida graciosa, o IPT pode ter removido o recurso
- **Limite de 16MB BSON:** `safeInsertMany` reduz tamanho do batch pela metade ate caber
- **Bloqueio concorrente:** sistema de locks em colecao `processingLocks` impede processamento simultaneo do mesmo recurso

---

## 5. Pipeline de Transformacao

O pacote `packages/transform` permite **re-transformar** dados ja ingeridos nas colecoes `_ipt` (brutas) para as colecoes curadas, aplicando normalizacoes e enriquecimentos.

### 5.1 Quando Usar

A transformacao separada e util quando:

- Uma nova regra de normalizacao e adicionada
- Novas fontes de enriquecimento sao importadas (ex: nova lista de especies ameacadas)
- Um bug na transformacao e corrigido e os dados precisam ser reprocessados
- Nao e necessario re-baixar os dados dos IPTs — as colecoes `_ipt` ja contem os dados brutos

### 5.2 Arquitetura de Pipelines

O sistema utiliza **pipelines composiveis** de funcoes puras. Cada etapa recebe um documento e retorna o documento transformado ou `null` (indicando que o registro deve ser descartado):

```
Documento bruto
    ↓
Etapa 1: validate-and-clone
    ↓
Etapa 2: filter-by-taxon-rank
    ↓
...
    ↓
Etapa N: ultima transformacao
    ↓
Documento normalizado (ou null = descartado)
```

### 5.3 Pipeline de Normalizacao de Taxa (11 etapas)

| #   | Etapa                             | Descricao                                                     |
| --- | --------------------------------- | ------------------------------------------------------------- |
| 1   | `validate-and-clone`              | Valida existencia de `_id`, clona o documento                 |
| 2   | `filter-by-taxon-rank`            | Mantem apenas: ESPECIE, VARIEDADE, FORMA, SUB_ESPECIE         |
| 3   | `build-canonical-name`            | Combina genus + specificEpithet + infraspecificEpithet        |
| 4   | `build-flat-scientific-name`      | Remove caracteres especiais, lowercase (para busca)           |
| 5   | `normalize-higher-classification` | Extrai segundo componente apos `;`                            |
| 6   | `normalize-kingdom`               | Mapeia variacoes para valores canonicos                       |
| 7   | `normalize-vernacular-names`      | Lowercase, substitui espacos por hifens, default "Portugues"  |
| 8   | `extract-distribution`            | Reestrutura array de distribuicao em objeto                   |
| 9   | `normalize-species-profile`       | Extrai primeiro perfil, remove `vegetationType` de `lifeForm` |
| 10  | `convert-resource-relationship`   | Mapeia sinonimias para array `othernames`                     |
| 11  | `force-animalia-kingdom`          | Garante `kingdom: "Animalia"` para fauna                      |

**Exemplo de transformacao de distribuicao (Flora):**

Entrada (DwC-A bruto):

```json
"distribution": [
  { "locationID": "AC", "establishmentMeans": "Native",
    "occurrenceRemarks": { "endemism": "Endemic", "phytogeographicDomain": "Amazonia" } },
  { "locationID": "AM", "establishmentMeans": "Native",
    "occurrenceRemarks": { "endemism": "Endemic", "phytogeographicDomain": "Amazonia" } }
]
```

Saida (normalizada):

```json
"distribution": {
  "origin": "Native",
  "Endemism": "Endemic",
  "phytogeographicDomains": "Amazonia",
  "occurrence": ["AC", "AM"],
  "vegetationType": "Forest"
}
```

### 5.4 Pipeline de Normalizacao de Ocorrencias (12 etapas)

| #   | Etapa                                  | Descricao                                                       |
| --- | -------------------------------------- | --------------------------------------------------------------- |
| 1   | `validate-and-clone`                   | Valida existencia de `_id`, clona o documento                   |
| 2   | `normalize-occurrence-id`              | Trima espacos em branco                                         |
| 3   | `build-geo-point`                      | Cria GeoJSON Point; valida lat (-90,90) e lon (-180,180)        |
| 4   | `build-canonical-name`                 | Combina genus + specificEpithet                                 |
| 5   | `build-flat-scientific-name`           | Remove caracteres especiais, lowercase                          |
| 6   | `normalize-ipt-kingdoms`               | Separa reinos por virgula/ponto-e-virgula                       |
| 7   | `normalize-date-fields`                | Converte year/month/day de string para numero                   |
| 8   | `normalize-event-date`                 | Parseia eventDate para Date; extrai year/month/day se ausentes  |
| 9   | `normalize-country`                    | Normaliza "brazil", "BRASIL", etc. → "Brasil"                   |
| 10  | `normalize-state`                      | Normaliza "rj" → "Rio de Janeiro", "sp" → "Sao Paulo", etc.     |
| 11  | `normalize-county`                     | Capitaliza nomes de municipios                                  |
| 12  | `check-brazilian-and-set-reproductive` | **Filtra registros nao-brasileiros**; detecta "flor" em remarks |

**Mapeamento de estados brasileiros:**

O sistema mantem 78+ variacoes mapeadas para nomes canonicos dos 27 estados. Exemplos:

- `"ac"`, `"AC"`, `"acre"`, `"Acre"` → `"Acre"`
- `"sp"`, `"SP"`, `"sao paulo"`, `"São Paulo"` → `"Sao Paulo"`
- `"rj"`, `"RJ"`, `"rio de janeiro"` → `"Rio de Janeiro"`

### 5.5 Enriquecimento de Taxa

Apos a normalizacao, cada taxon e enriquecido com dados de **fontes externas** ja carregadas no MongoDB:

| Fonte              | Colecao MongoDB   | Dado Adicionado                              |
| ------------------ | ----------------- | -------------------------------------------- |
| CNCFlora (Plantae) | `cncfloraPlantae` | Categoria de ameaca (CR, EN, VU, NT, LC, DD) |
| CNCFlora (Fungi)   | `cncfloraFungi`   | Categoria de ameaca                          |
| Fauna Ameacada     | `faunaAmeacada`   | Categoria de ameaca                          |
| Instituto Horus    | `invasoras`       | Status de especie invasora                   |
| ICMBio             | `catalogoucs`     | Unidades de conservacao associadas           |

**Estrategia de matching:**

- Duplo indice: por ID (`_id`, `taxonID`) e por nome (`flatScientificName`, `canonicalName`)
- Prioriza match por ID; fallback para nome achatado
- Retorna primeiro match encontrado

**Campos adicionados ao documento:**

```javascript
{
  threatStatus: [{ source: "cncfloraPlantae", category: "VU" }],
  invasiveStatus: { source: "invasoras", isInvasive: true },
  conservationUnits: [{ ucName: "Parque Nacional da Amazonia" }],
  _transformedAt: Date,
  _transformVersion: "1.0.0"
}
```

### 5.6 Enriquecimento de Ocorrencias

Cada ocorrencia e vinculada ao seu taxon correspondente na colecao `taxa`:

1. Pre-carrega **toda** a colecao `taxa` em 4 mapas em memoria:
   - Por `_id`, por `flatScientificName`, por `canonicalName`, por `scientificName`
2. Tenta match por ID (`taxonID`, `acceptedNameUsageID`)
3. Se falhar, tenta match por nome achatado
4. No match, enriquece com: `taxonID`, `scientificName`, `canonicalName`, `kingdom`
5. Adicionalmente, parseia `recordedBy` em array de coletores

### 5.7 Processamento Incremental

O sistema evita reprocessar documentos ja transformados:

1. Cada documento recebe campo `_transformVersion` com a versao atual
2. No inicio do batch, carrega IDs de documentos ja transformados em um `Set`
3. Pula documentos cujo `_transformVersion` ja corresponde a versao atual
4. **Para forcar re-transformacao:** incremente a versao em `packages/transform/package.json`

### 5.8 Controle de Concorrencia

- Colecao `transform_status` armazena locks
- Impede que duas transformacoes do mesmo tipo rodem simultaneamente
- Lock expira apos timeout configuravel (default: 2 horas)
- Suporta flag `--force` para sobrescrever lock

### 5.9 Metricas

Cada execucao registra metricas na colecao `process_metrics`:

- Registros processados, inseridos, atualizados, com falha
- Duracao em segundos
- Resumo de erros por etapa do pipeline
- ID do runner (GitHub Actions, local, etc.)

---

## 6. Armazenamento MongoDB

### 6.1 Banco de Dados: `dwc2json`

### 6.2 Colecoes Principais

#### `taxa` — Especies curadas e enriquecidas

```javascript
{
  _id: "P12345",                    // ID deterministico (P=Plantae, A=Animalia)
  taxonID: "12345",
  scientificName: "Bertholletia excelsa Bonpl.",
  canonicalName: "Bertholletia excelsa",
  flatScientificName: "bertholletiaexcelsabonpl",
  kingdom: "Plantae",
  phylum: "Tracheophyta",
  class: "Magnoliopsida",
  order: "Ericales",
  family: "Lecythidaceae",
  genus: "Bertholletia",
  specificEpithet: "excelsa",
  taxonRank: "ESPECIE",
  taxonomicStatus: "ACEITO",
  higherClassification: "Angiospermas",

  distribution: {
    origin: "Native",
    Endemism: "Endemic",
    phytogeographicDomains: "Amazonia",
    occurrence: ["AC", "AM", "AP", "MT", "PA", "RO"],
    vegetationType: "Forest"
  },

  vernacularname: [
    { vernacularName: "castanha-do-para", language: "Portugues" }
  ],

  othernames: [
    { taxonID: "67890", scientificName: "Bertholletia nobilis", taxonomicStatus: "synonym" }
  ],

  speciesprofile: { lifeForm: { habit: "Tree", lifeForm: "Phanerophyte" } },

  // Campos de enriquecimento
  threatStatus: [{ source: "cncfloraPlantae", category: "VU" }],
  invasiveStatus: null,
  conservationUnits: [{ ucName: "Floresta Nacional do Tapajos" }],

  _transformedAt: ISODate("2025-01-15"),
  _transformVersion: "1.0.0"
}
```

**Indices:** `scientificName`, `kingdom`, `family`, `genus`, `canonicalName`, `flatScientificName`, composto `taxonID+kingdom`

#### `occurrences` — Registros de ocorrencias curados

```javascript
{
  _id: "urn:catalog:INPA:12345::inpa_herbario",
  occurrenceID: "urn:catalog:INPA:12345",
  iptId: "inpa_herbario",
  ipt: "inpa",
  iptKingdoms: ["Plantae"],

  scientificName: "Bertholletia excelsa Bonpl.",
  canonicalName: "Bertholletia excelsa",
  flatScientificName: "bertholletiaexcelsabonpl",

  kingdom: "Plantae",
  family: "Lecythidaceae",
  genus: "Bertholletia",
  specificEpithet: "excelsa",

  country: "Brasil",
  stateProvince: "Amazonas",
  county: "Manaus",
  locality: "Reserva Ducke, trilha principal",

  decimalLatitude: -2.9333,
  decimalLongitude: -59.9667,
  geoPoint: {
    type: "Point",
    coordinates: [-59.9667, -2.9333]  // GeoJSON: [longitude, latitude]
  },

  eventDate: ISODate("2023-05-15"),
  year: 2023,
  month: 5,
  day: 15,

  recordedBy: "Silva, J.",
  recordNumber: "1234",
  catalogNumber: "INPA12345",
  institutionCode: "INPA",
  basisOfRecord: "PreservedSpecimen"
}
```

**Indices (45+):** campos basicos, compostos (`country+stateProvince`, `genus+specificEpithet`, `kingdom+country`, `kingdom+family`), geoespacial (`geoPoint_2dsphere`), e indice complexo de 8 campos para consultas taxonomicas por estado.

#### `taxa_ipt` / `occurrences_ipt` — Dados brutos preservados

Dados exatamente como recebidos do DwC-A, sem transformacao. Servem como backup e fonte para re-transformacao.

### 6.3 Colecoes de Referencia (pre-carregadas)

| Colecao           | Descricao                                   | Uso                        |
| ----------------- | ------------------------------------------- | -------------------------- |
| `cncfloraPlantae` | Avaliacoes de risco CNCFlora (Plantae)      | Enriquecimento de taxa     |
| `cncfloraFungi`   | Avaliacoes de risco CNCFlora (Fungi)        | Enriquecimento de taxa     |
| `faunaAmeacada`   | Fauna ameacada de extincao                  | Enriquecimento de taxa     |
| `invasoras`       | Especies invasoras (Instituto Horus)        | Enriquecimento de taxa     |
| `ucs`             | Unidades de conservacao e parques nacionais | Consultas e enriquecimento |
| `ipts`            | Metadados e versoes dos IPTs                | Controle de atualizacao    |

### 6.4 Colecoes Operacionais

| Colecao            | Descricao                                     | TTL          |
| ------------------ | --------------------------------------------- | ------------ |
| `occurrenceCache`  | Cache de consultas de ocorrencias (hash MD5)  | 1 hora       |
| `chat_sessions`    | Historico de conversas do chat IA             | 7 dias       |
| `processingLocks`  | Locks de processamento concorrente            | Configuravel |
| `transform_status` | Status de transformacoes em andamento         | —            |
| `process_metrics`  | Metricas de execucao de pipelines             | 30 dias      |
| `calFeno`          | View de calendario fenologico (florescimento) | —            |

---

## 7. Aplicacao Web

### 7.1 Stack Tecnologico

- **Framework:** Astro.js 5 (SSR mode, Node.js adapter)
- **UI:** React 18 + Tailwind CSS 4 + ShadCN UI
- **Runtime:** Node.js 20 (producao), Bun (desenvolvimento)
- **Porta:** 4321

### 7.2 Paginas

| Rota                           | Descricao                                                    |
| ------------------------------ | ------------------------------------------------------------ |
| `/`                            | Homepage com links para as funcionalidades                   |
| `/chat`                        | Interface de chat com IA para consultas em linguagem natural |
| `/taxa`                        | Busca de especies com filtros taxonomicos                    |
| `/taxon/[taxonId]`             | Ficha detalhada de uma especie                               |
| `/taxon/[taxonId]/ocorrencias` | Ocorrencias de uma especie                                   |
| `/tree`                        | Navegador de arvore taxonomica interativa                    |
| `/dashboard`                   | Dashboard analitico com graficos e estatisticas              |
| `/mapa`                        | Mapa de distribuicao de especies                             |
| `/mapaocorrencia`              | Mapa de ocorrencias com pontos georreferenciados             |
| `/calendario-fenologico`       | Calendario fenologico (floracao)                             |
| `/api/docs`                    | Documentacao Swagger da API                                  |
| `/privacy`                     | Politica de privacidade                                      |

### 7.3 API REST

**Endpoints de Taxa:**

- `GET /api/taxa` — Lista taxa com filtros (kingdom, family, genus, etc.)
- `GET /api/taxa/[taxonID]` — Busca taxon por ID
- `GET /api/taxa/count` — Contagem de taxa com filtros
- `GET /api/family/[kingdom]` — Contagem de familias por reino
- `GET /api/taxonomicStatus/[kingdom]` — Status taxonomico por reino
- `GET /api/tree` — Arvore taxonomica hierarquica completa

**Endpoints de Ocorrencias:**

- `GET /api/occurrences` — Lista ocorrencias com filtros
- `GET /api/occurrences/[occurrenceID]` — Busca ocorrencia por ID
- `GET /api/occurrences/count` — Contagem com filtros
- `GET /api/occurrences/geojson` — GeoJSON FeatureCollection (requer `bbox`)

**Endpoints de Dashboard:**

- `GET /api/dashboard/summary` — Estatisticas gerais (cache 1h)
- `GET /api/occurrenceCountByState` — Contagem de ocorrencias por estado
- `GET /api/taxaCountByState` — Contagem de taxa por estado

**Outros:**

- `GET /api/health` — Health check (conectividade MongoDB)
- `POST /api/chat` — Endpoint do chat com IA

### 7.4 Camada de Dados (MongoDB)

A aplicacao web acessa o MongoDB atraves de modulos especializados em `src/lib/mongo/`:

- **`connection.ts`** — Pool de conexoes (maxPoolSize: 10, timeout: 10s)
- **`taxa.ts`** — Consultas taxonomicas, arvore, agregacoes por reino
- **`occurrences.ts`** — Consultas de ocorrencias com cache, sampling para timeouts
- **`threatened.ts`** — Contagens e categorias de especies ameacadas
- **`invasive.ts`** — Contagens e top orders/families de invasoras
- **`phenological.ts`** — Dados do calendario fenologico
- **`cache.ts`** — Gerenciamento de cache de ocorrencias com TTL

**Otimizacoes de consulta:**

- Cache em MongoDB com chave MD5 e TTL de 1 hora
- Fallback por amostragem (50K/10K registros × multiplicador 220) para agregacoes que excedem 120s
- `allowDiskUse: true` para agregacoes grandes

---

## 8. Interface de Chat com IA

### 8.1 Arquitetura

O chat utiliza o **Vercel AI SDK** com integracao **MCP (Model Context Protocol)** para permitir que modelos de IA consultem o MongoDB diretamente.

```
Usuario digita pergunta
    ↓
React (Chat.tsx) → POST /api/chat
    ↓
Vercel AI SDK → Modelo de IA (OpenAI/Google)
    ↓
IA decide usar ferramenta → MCP Server
    ↓
mongodb-mcp-server → find/aggregate no MongoDB
    ↓
Resultado retorna para IA → Resposta em linguagem natural
    ↓
Streaming para o frontend → Markdown renderizado
```

### 8.2 MCP Server

O sistema inicia um processo `npx mongodb-mcp-server --readOnly` via transporte stdio. O servidor MCP expoe duas ferramentas para a IA:

- **`find`** — Busca documentos em qualquer colecao
- **`aggregate`** — Executa pipelines de agregacao

A conexao utiliza `MONGODB_URI_READONLY` (string de conexao somente leitura).

### 8.3 System Prompt

O prompt do sistema (`src/prompts/prompt.md`, ~14KB) instrui a IA sobre:

- Escopo: apenas biodiversidade brasileira (Animalia, Plantae, Fungi)
- Estrutura das colecoes e campos disponiveis
- Regras de consulta (usar `aggregate` para contagens, nunca `count`)
- Valores validos para campos (ex: `kingdom` aceita Animalia, Plantae, Fungi)
- Matching fuzzy para nomes de especies
- Formato de resposta: Markdown com code spans para numeros

### 8.4 Modelos Suportados

| Provedor | Modelos                                            | Recursos Especiais   |
| -------- | -------------------------------------------------- | -------------------- |
| OpenAI   | GPT-4o-mini (default), GPT-4o, o1-preview, o1-mini | Streaming, reasoning |
| Google   | Gemini 2.0 Flash, Gemini 1.5 Pro                   | Thinking config      |

### 8.5 Frontend

O componente `Chat.tsx` (~1000 linhas React) oferece:

- Gerenciamento de multiplas sessoes (criar, trocar, deletar)
- Historico persistido em localStorage
- Seletor de modelo e provedor
- Exibicao de queries MongoDB executadas (badges collapsiveis)
- Exibicao de raciocinio da IA
- Renderizacao Markdown com syntax highlighting
- Armazenamento seguro de API keys (criptografia local)

---

## 9. Dashboard e Sistema de Cache

### 9.1 Dashboard Cache Job

O dashboard utiliza dados pre-computados para evitar agregacoes lentas em cada requisicao.

**Script:** `packages/web/src/scripts/dashboard-cache-job.ts`
**Comando:** `bun run cache-dashboard`

Dados coletados (20+ queries paralelas ao MongoDB):

- Contagem de ocorrencias por reino (Animalia, Plantae, Fungi)
- Contagem de taxa por reino
- Especies ameacadas: contagens e categorias (CR, EN, VU, NT, LC, DD) por reino
- Especies invasoras: contagens, top 10 ordens e familias
- Top 10 ordens e familias por reino
- Top 10 colecoes por reino (por `rightsHolder`)

**Saida:** `packages/web/cache/dashboard-data.json`

### 9.2 Cache Fenologico

- Arquivo: `src/data/phenological-cache.json`
- Renovado semanalmente (apenas segundas-feiras)
- Contem familias, generos e especies com dados fenologicos
- Fallback para consulta direta ao MongoDB em caso de cache miss

### 9.3 Cache de Ocorrencias

- Colecao MongoDB `occurrenceCache` com TTL de 1 hora
- Chave: hash MD5 dos filtros da consulta em JSON
- Usado em `countOccurrenceRegions()` (agregacao cara)
- Evita recomputar contagens identicas dentro da janela de 1 hora

---

## 10. Automacao CI/CD

Todos os workflows sao **manuais** (`workflow_dispatch`), sem triggers automaticos.

### 10.1 Workflows Disponiveis

| Workflow                     | Arquivo                          | Runner        | Timeout | Descricao                               |
| ---------------------------- | -------------------------------- | ------------- | ------- | --------------------------------------- |
| Update MongoDB - Flora       | `update-mongodb-flora.yml`       | self-hosted   | 60 min  | Ingere Flora do Brasil                  |
| Update MongoDB - Fauna       | `update-mongodb-fauna.yml`       | self-hosted   | —       | Ingere Fauna do Brasil                  |
| Update MongoDB - Ocorrencias | `update-mongodb-occurrences.yml` | self-hosted   | 120 min | Ingere todas as colecoes de ocorrencias |
| Re-transform Taxa            | `transform-taxa.yml`             | self-hosted   | 25 min  | Re-transforma taxa sem re-download      |
| Re-transform Occurrences     | `transform-occurrences.yml`      | self-hosted   | —       | Re-transforma ocorrencias               |
| Weekly Data Transformation   | `transform-weekly.yml`           | ubuntu-latest | 180 min | Pipeline completo de transformacao      |
| Docker Build                 | `docker.yml`                     | —             | —       | Constroi imagem Docker                  |

### 10.2 Fluxo Tipico de Atualizacao

```
1. Disparar "Update MongoDB - Flora" no GitHub Actions
   → Baixa DwC-A do JBRJ → Preserva em taxa_ipt → Transforma → Insere em taxa

2. Disparar "Update MongoDB - Fauna"
   → Mesmo fluxo para fauna

3. Disparar "Update MongoDB - Ocorrencias"
   → Verifica 505 IPTs → Baixa os atualizados → Transforma → Insere em occurrences
   → Limpa e regenera cache de ocorrencias

4. (Opcional) Disparar "Re-transform Taxa" se novas regras foram adicionadas
   → Re-processa taxa_ipt → taxa com novas normalizacoes/enriquecimentos

5. Disparar "Docker Build" para nova imagem
   → Build multi-stage → Push para registry

6. Atualizar container no UNRAID manualmente
```

### 10.3 Requisitos dos Runners

- **self-hosted:** usado para ingestao (acesso ao MongoDB e banda de rede)
- **Secrets necessarios:** `MONGO_URI`
- Bun e Node.js 20 instalados automaticamente nos steps

---

## 11. Infraestrutura Docker

### 11.1 Build Multi-Stage

O `Dockerfile` utiliza 3 estagios para otimizar o tamanho da imagem (~220MB):

```
Estagio 1 (builder): oven/bun:1.2.21
  → Instala dependencias completas
  → Compila a aplicacao Astro.js (bun run build)

Estagio 2 (prod-deps): oven/bun:1.2.21-alpine
  → Instala apenas dependencias de producao
  → Remove sharp e cache desnecessarios

Estagio 3 (runner): node:20-alpine
  → Copia node_modules de producao
  → Copia artefatos de build (dist/)
  → Executa: node dist/server/entry.mjs
```

### 11.2 Variaveis de Ambiente (Docker)

| Variavel         | Descricao                         |
| ---------------- | --------------------------------- |
| `MONGO_URI`      | String de conexao MongoDB         |
| `ADMIN_USERNAME` | Usuario admin da interface web    |
| `ADMIN_PASSWORD` | Senha admin                       |
| `PORT`           | Porta do servidor (default: 4321) |

### 11.3 Deploy

- Imagem hospedada em container Docker no **UNRAID**
- Deploy manual via interface do UNRAID
- Servidor expoe porta 4321

---

## Diagrama Geral do Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FONTES EXTERNAS                              │
│                                                                     │
│  Flora/Funga do Brasil (JBRJ)    Fauna do Brasil (JBRJ)            │
│          ↓                              ↓                           │
│     DwC-A ZIP                      DwC-A ZIP                       │
│                                                                     │
│  ~505 Colecoes de Herbarios/Museus (INPA, MPEG, SiBBr, ...)       │
│          ↓                                                          │
│     DwC-A ZIPs (um por colecao)                                    │
│                                                                     │
│  CNCFlora, Instituto Horus, ICMBio                                 │
│          ↓                                                          │
│     Dados de referencia (ameaca, invasao, UCs)                     │
└─────────────┬───────────────────────────────┬───────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐    ┌─────────────────────────────┐
│   packages/ingest       │    │   Colecoes de Referencia    │
│                         │    │                             │
│ 1. Verifica versao IPT  │    │ cncfloraPlantae             │
│ 2. Baixa DwC-A          │    │ cncfloraFungi               │
│ 3. Parseia (JSON/SQLite)│    │ faunaAmeacada               │
│ 4. Preserva dados brutos│    │ invasoras                   │
│ 5. Transformacao inline  │    │ ucs                         │
│ 6. Insere no MongoDB    │    └──────────────┬──────────────┘
└────────────┬────────────┘                   │
             │                                │
             ▼                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MongoDB (dwc2json)                          │
│                                                                     │
│  taxa_ipt ──→ packages/transform ──→ taxa (curado + enriquecido)   │
│  occurrences_ipt ──→ packages/transform ──→ occurrences (curado)   │
│                                                                     │
│  Colecoes operacionais: occurrenceCache, chat_sessions, ipts       │
└─────────────────────────────────────┬───────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      packages/web (Astro.js)                        │
│                                                                     │
│  API REST (/api/taxa, /api/occurrences, /api/dashboard, ...)       │
│  Chat IA (Vercel AI SDK + MCP → MongoDB)                           │
│  Dashboard (cache pre-computado)                                    │
│  Mapa de Ocorrencias (GeoJSON + Leaflet)                           │
│  Arvore Taxonomica, Busca de Especies, Calendario Fenologico       │
│                                                                     │
│                    ↓ Docker (node:20-alpine) ↓                      │
│                    Porta 4321 → UNRAID                              │
└─────────────────────────────────────────────────────────────────────┘
```
