# Funcionamento do Sistema Biodiversidade Online (V6.1)

## Sumario

1. [Visao Geral](#1-visao-geral)
2. [Arquitetura do Monorepo](#2-arquitetura-do-monorepo)
3. [Fontes de Dados e IPTs](#3-fontes-de-dados-e-ipts)
4. [Pipeline de Aquisicao + Transformacao (packages/ingest)](#4-pipeline-de-aquisicao--transformacao)
5. [Pipeline de Enriquecimento (packages/transform)](#5-pipeline-de-enriquecimento)
6. [Armazenamento MongoDB](#6-armazenamento-mongodb)
7. [Aplicacao Web (packages/web)](#7-aplicacao-web)
8. [Interface de Chat com IA](#8-interface-de-chat-com-ia)
9. [Dashboard e Sistema de Cache](#9-dashboard-e-sistema-de-cache)
10. [Automacao CI/CD](#10-automacao-cicd)
11. [Infraestrutura Docker](#11-infraestrutura-docker)

---

## 1. Visao Geral

O Biodiversidade Online e uma plataforma para consulta de dados da biodiversidade brasileira. O sistema:

- **Adquire e transforma** dados taxonomicos da **Flora e Funga do Brasil** e do **Catalogo Taxonomico da Fauna do Brasil** (DwC-A → normalização → JSON)
- **Adquire e transforma** registros de **ocorrencias** de ~505 colecoes de herbarios e museus brasileiros (DwC-A → normalização → JSON)
- **Enriquece** taxa com dados de **especies ameacadas** e **especies invasoras**
- **Enriquece** ocorrencias com dados de **unidades de conservacao**
- Oferece uma interface web com dashboard analitico, chat com IA e API REST documentada

Todas as colecoes residem em um **unico banco de dados MongoDB** (`dwc2json`). O nome interno e uma referencia direta ao processo central: converter Darwin Core Archive em documentos JSON.

---

## 2. Arquitetura do Monorepo

O projeto utiliza **Bun workspaces** para gerenciar quatro pacotes:

```
Biodiversidade-Online/
├── packages/
│   ├── ingest/        # Aquisicao + transformacao (DwC-A → normalizacao → MongoDB)
│   ├── transform/     # Enriquecimento (loaders CSV + enrichers in-place)
│   ├── shared/        # Utilitarios compartilhados (database, IDs, metricas)
│   └── web/           # Aplicacao Astro.js (frontend + API)
├── package.json       # Workspace root com scripts orquestradores
├── tsconfig.base.json # Configuracao TypeScript compartilhada
└── bun.lock           # Lockfile unico para todos os pacotes
```

**Scripts orquestradores** (raiz do projeto):

| Comando                                  | Descricao                                   |
| ---------------------------------------- | ------------------------------------------- |
| `bun run ingest:flora`                   | Ingere dados da Flora e Funga do Brasil     |
| `bun run ingest:fauna`                   | Ingere dados da Fauna do Brasil             |
| `bun run ingest:occurrences`             | Ingere todas as colecoes de ocorrencias     |
| `bun run load:fauna-ameacada -- <csv>`   | Carrega CSV de fauna ameacada               |
| `bun run load:plantae-ameacada -- <csv>` | Carrega CSV de plantae ameacada             |
| `bun run load:fungi-ameacada -- <csv>`   | Carrega CSV de fungi ameacada               |
| `bun run load:invasoras -- <csv>`        | Carrega CSV de especies invasoras           |
| `bun run load:catalogo-ucs -- <csv>`     | Carrega CSV do catalogo de UCs              |
| `bun run enrich:ameacadas`               | Enriquece taxa com threatStatus             |
| `bun run enrich:invasoras`               | Enriquece taxa com invasiveStatus           |
| `bun run enrich:ucs`                     | Enriquece ocorrencias com conservationUnits |
| `bun run web:dev`                        | Inicia o servidor de desenvolvimento        |
| `bun run web:build`                      | Compila a aplicacao para producao           |

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

### Fontes de Dados de Referencia (Enriquecimento)

| Dado                             | Colecao MongoDB   | Formato   | Campos-chave                            |
| -------------------------------- | ----------------- | --------- | --------------------------------------- |
| Fauna ameacada (MMA/ICMBio)      | `faunaAmeacada`   | CSV (`;`) | `canonicalName`, `threatStatus`         |
| Plantae ameacada (CNCFlora)      | `plantaeAmeacada` | CSV (`;`) | `Nome Cientifico`, `Categoria de Risco` |
| Fungi ameacada (CNCFlora)        | `fungiAmeacada`   | CSV (`;`) | `Nome Cientifico`, `Categoria de Risco` |
| Especies invasoras (Horus/IBAMA) | `invasoras`       | CSV       | `scientific_name`                       |
| Catalogo de UCs (CNUC/ICMBio)    | `catalogoucs`     | CSV (`;`) | `Nome da UC`, `UF`                      |

---

## 4. Pipeline de Aquisicao + Transformacao

O pacote `packages/ingest` e responsavel por baixar os DwC-A, transforma-los (normalização de nomes, classificação, coordenadas, datas) e inseri-los diretamente no MongoDB nas colecoes `taxa` e `occurrences`. A transformação ocorre durante a ingestão — não há etapa intermediaria.

### 4.1 Verificacao de Versao

Antes de baixar qualquer arquivo, o sistema verifica se o IPT publicou uma versao nova:

1. Faz fetch do `eml.xml` do IPT: `${url}eml.do?r=${tag}`
2. Extrai a versao do atributo `@packageId`
3. Compara com a versao armazenada na colecao `ipts` do MongoDB
4. **Se a versao e identica, pula o download** (economiza banda e tempo)

**Classe:** `VerificadorVersao` (`src/lib/verificador-versao.ts`)

### 4.2 Download do DwC-A

**Funcao:** `processaZip()` (`src/lib/dwca.ts`)

1. Faz HTTP fetch da URL `${url}archive.do?r=${tag}`
2. Streaming do conteudo para arquivo temporario `.temp/temp.zip`
3. Possui timeout por inatividade (resets a cada chunk recebido)
4. Trata erros 404 graciosamente

### 4.3 Parsing do DwC-A — Dois Modos

#### Modo 1: JSON em Memoria (Taxa)

Usado para Flora e Fauna porque os datasets taxonomicos cabem na memoria (~100K-300K registros).

```
meta.xml → Identifica core + extensoes
    ↓
taxon.txt → Leitura linha a linha → Objeto JSON com taxonID como chave
    ↓
distribution.txt + vernacularname.txt + speciesprofile.txt → adicionados como arrays aninhados
    ↓
Resultado: { "12345": { taxonID, scientificName, distribution: [...], ... } }
```

#### Modo 2: SQLite Streaming (Ocorrencias)

Usado para ocorrencias porque os datasets podem ter milhoes de registros.

```
meta.xml → Identifica core + extensoes
    ↓
occurrence.txt → Inserido em tabela SQLite in-memory
    ↓
extensoes → Tabelas SQLite separadas com indices
    ↓
Iterator → Retorna batches de N registros com extensoes juntas via SQL JOIN
```

### 4.4 Ingestao de Flora

**Script:** `packages/ingest/src/flora.ts`
**Comando:** `bun run ingest:flora [URL_DWCA]`

Fluxo:

1. Verifica versao do IPT
2. Baixa e extrai DwC-A (modo JSON em memoria)
3. Para cada taxon no JSON:
   - Filtra por rank (mantem apenas `ESPECIE`, `VARIEDADE`, `FORMA`, `SUB_ESPECIE`)
   - Reestrutura distribuicao (array → objeto estruturado)
   - Extrai sinonimias de `resourcerelationship`
   - Normaliza nomes vernaculares
   - Gera `canonicalName` e `flatScientificName`
   - Extrai classificacao superior
4. Remove registros antigos de Plantae/Fungi da colecao `taxa`
5. Insere registros transformados em lotes de 5000
6. Cria indices

### 4.5 Ingestao de Fauna

**Script:** `packages/ingest/src/fauna.ts`
**Comando:** `bun run ingest:fauna [URL_DWCA]`

Processo similar a flora, com diferencas:

- Define `kingdom: "Animalia"` explicitamente
- Remove registros antigos de Animalia antes da insercao

### 4.6 Ingestao de Ocorrencias

**Script:** `packages/ingest/src/ocorrencia.ts`
**Comando:** `bun run ingest:occurrences`

Fluxo:

1. Le catalogo de ~505 IPTs do arquivo `occurrences.csv`
2. Verifica versoes de **todos os IPTs em paralelo** (10 concorrentes)
3. Para cada IPT com atualizacao:
   - Baixa DwC-A (modo SQLite streaming)
   - Processa em batches de 5000
   - Cria GeoJSON Point com coordenadas validadas
   - Normaliza campos temporais e geograficos
   - Remove registros antigos daquele `iptId`
   - Insere registros transformados
4. Cria 45+ indices incluindo geoespacial (`geoPoint_2dsphere`)

### 4.7 IDs Deterministicos

**Taxa:**

- Flora: `P` + taxonID (ex: `P12345`)
- Fauna: `A` + taxonID (ex: `A67890`)
- Evita colisao entre flora e fauna com mesmo taxonID numerico

**Ocorrencias:**

- Primario: `{occurrenceID}::{iptId}`
- Fallback: hash SHA1 de `iptId|catalogNumber|recordNumber|eventDate|locality|recordedBy`

---

## 5. Pipeline de Enriquecimento Tematico

O pacote `packages/transform` implementa um modelo de **enriquecimento tematico extensivel**. Cada tema representa uma fonte externa de dados que agrega informacao as colecoes principais (`taxa` ou `occurrences`).

**Padrao de cada tema:**

| Componente      | Descricao                                         | Exemplo (Ameacadas)       |
| --------------- | ------------------------------------------------- | ------------------------- |
| Fonte CSV       | Arquivo de dados de referencia                    | `fauna-ameacada-2021.csv` |
| Loader          | Script que carrega CSV → colecao de referencia    | `load:fauna-ameacada`     |
| Colecao de ref. | Colecao MongoDB com dados de referencia           | `faunaAmeacada`           |
| Enricher        | Script que associa dados ao campo alvo (in-place) | `enrich:ameacadas`        |
| Campo alvo      | Campo adicionado em `taxa` ou `occurrences`       | `taxa.threatStatus`       |

**Extensibilidade:** Para adicionar um novo tema (ex: DNA/barcoding, principios ativos, uso por comunidades tradicionais), basta criar um loader e um enricher seguindo o mesmo padrao. O motor de matching (`lookup.ts`) e reutilizavel por todos os temas.

O pacote e responsavel por duas operacoes: carregar dados de referencia (loaders) e enriquecer as colecoes principais in-place (enrichers).

### 5.1 Loaders CSV

Os loaders carregam arquivos CSV para as colecoes de referencia no MongoDB. Cada loader:

1. Le o CSV do caminho fornecido como argumento CLI
2. Detecta o delimitador automaticamente (papaparse)
3. Faz **drop + insert** na colecao de destino
4. Cria indices especificos para a colecao

```bash
bun run load:fauna-ameacada -- packages/ingest/chatbb/fontes/fauna-ameacada-2021.csv
bun run load:plantae-ameacada -- <caminho.csv>
bun run load:fungi-ameacada -- <caminho.csv>
bun run load:invasoras -- <caminho.csv>
bun run load:catalogo-ucs -- packages/ingest/chatbb/fontes/cnuc_2025_03.csv
```

### 5.2 Motor de Matching (lookup.ts)

O modulo `src/utils/lookup.ts` implementa o motor de matching utilizado por todos os enrichers:

```
Documentos da colecao de referencia
    ↓ collectDocumentIds() + collectDocumentNames()
IndexedLookup {
  byId: Map<id → [entry, ...]>
  byFlatName: Map<nomePlano → [entry, ...]>
}
    ↓ gatherLookupMatches(lookup, ids, names)
Matches encontrados (por ID prioritario, depois por nome)
```

**Campos de ID verificados:** `_id`, `taxonID`, `taxonId`, `taxon_id`, `identifier`, `id`

**Campos de nome verificados:** `canonicalName`, `scientificName`, `scientificname`, `nome`, `nomeCientifico`, `nome_cientifico`, `species`, etc.

**Normalizacao de nomes:** Remove caracteres nao-alfanumericos e converte para minusculas (ex: `"Bertholletia excelsa"` → `"bertholletiaexcelsa"`)

### 5.3 Enricher de Especies Ameacadas (enrich:ameacadas)

**Script:** `src/enrichment/enrichAmeacadas.ts`

```
1. Carrega faunaAmeacada + plantaeAmeacada + fungiAmeacada em IndexedLookup
2. Cursor sobre colecao taxa
3. Para cada taxon:
   - Extrai IDs candidatos (_id, taxonID)
   - Extrai nomes candidatos (canonicalName, scientificName, flatScientificName)
   - gatherLookupMatches() → lista de ThreatStatusEntry
   - Se matches: $set { threatStatus: [...] }
   - Se sem match mas tinha campo: $unset { threatStatus: "" }
4. bulkWrite em batches de 2000
```

**Formato do campo gerado:**

```javascript
threatStatus: [{ source: 'faunaAmeacada', category: 'Em Perigo (EN)' }]
```

### 5.4 Enricher de Invasoras (enrich:invasoras)

**Script:** `src/enrichment/enrichInvasoras.ts`

```
1. Carrega invasoras em IndexedLookup
2. Cursor sobre colecao taxa
3. Para cada taxon: matching + $set { invasiveStatus } ou $unset
4. bulkWrite em batches de 2000
```

**Formato do campo gerado:**

```javascript
invasiveStatus: {
  source: "invasoras",
  isInvasive: true,
  notes: "observacao opcional"
}
```

### 5.5 Enricher de UCs (enrich:ucs)

**Script:** `src/enrichment/enrichUCs.ts`

```
1. Carrega catalogoucs em IndexedLookup (por nome da UC)
2. Cursor sobre colecao occurrences
3. Para cada ocorrencia: matching + $set { conservationUnits } ou $unset
4. bulkWrite em batches de 2000
```

**Formato do campo gerado:**

```javascript
conservationUnits: [{ ucName: 'Parque Nacional da Amazonia' }]
```

**Nota:** O matching atual e por nome/ID. Matching geoespacial (ponto dentro do poligono da UC) e um TODO para versoes futuras.

### 5.6 Pipeline de Normalizacao de Taxa (11 etapas)

Usado durante re-normalizacao (`transform:taxa`), que processa taxa dentro da propria colecao `taxa`:

| #   | Etapa                             | Descricao                                                     |
| --- | --------------------------------- | ------------------------------------------------------------- |
| 1   | `validate-and-clone`              | Valida existencia de `_id`, clona o documento                 |
| 2   | `filter-by-taxon-rank`            | Mantem apenas: ESPECIE, VARIEDADE, FORMA, SUB_ESPECIE         |
| 3   | `build-canonical-name`            | Combina genus + specificEpithet + infraspecificEpithet        |
| 4   | `build-flat-scientific-name`      | Remove caracteres especiais, lowercase (para busca)           |
| 5   | `normalize-higher-classification` | Extrai segundo componente apos `;`                            |
| 6   | `normalize-kingdom`               | Mapeia variacoes para valores canonicos                       |
| 7   | `normalize-vernacular-names`      | Lowercase, substitui espacos por hifens                       |
| 8   | `extract-distribution`            | Reestrutura array de distribuicao em objeto                   |
| 9   | `normalize-species-profile`       | Extrai primeiro perfil, remove `vegetationType` de `lifeForm` |
| 10  | `convert-resource-relationship`   | Mapeia sinonimias para array `othernames`                     |
| 11  | `force-animalia-kingdom`          | Garante `kingdom: "Animalia"` para fauna                      |

### 5.7 Pipeline de Normalizacao de Ocorrencias (12 etapas)

| #   | Etapa                                  | Descricao                                                |
| --- | -------------------------------------- | -------------------------------------------------------- |
| 1   | `validate-and-clone`                   | Valida existencia de `_id`, clona o documento            |
| 2   | `normalize-occurrence-id`              | Trima espacos em branco                                  |
| 3   | `build-geo-point`                      | Cria GeoJSON Point; valida lat (-90,90) e lon (-180,180) |
| 4   | `build-canonical-name`                 | Combina genus + specificEpithet                          |
| 5   | `build-flat-scientific-name`           | Remove caracteres especiais, lowercase                   |
| 6   | `normalize-ipt-kingdoms`               | Separa reinos por virgula/ponto-e-virgula                |
| 7   | `normalize-date-fields`                | Converte year/month/day de string para numero            |
| 8   | `normalize-event-date`                 | Parseia eventDate para Date                              |
| 9   | `normalize-country`                    | Normaliza variacoes de "Brasil"                          |
| 10  | `normalize-state`                      | Normaliza siglas e variacoes de estados brasileiros      |
| 11  | `normalize-county`                     | Capitaliza nomes de municipios                           |
| 12  | `check-brazilian-and-set-reproductive` | **Filtra registros nao-brasileiros**; detecta fenologia  |

---

## 6. Armazenamento MongoDB

### 6.1 Banco de Dados: `dwc2json`

### 6.2 Colecoes Principais

#### `taxa` — Especies curadas e enriquecidas

```javascript
{
  _id: "P12345",
  taxonID: "12345",
  scientificName: "Bertholletia excelsa Bonpl.",
  canonicalName: "Bertholletia excelsa",
  flatScientificName: "bertholletiaexcelsa",
  kingdom: "Plantae",
  phylum: "Tracheophyta",
  family: "Lecythidaceae",
  genus: "Bertholletia",
  taxonRank: "ESPECIE",
  taxonomicStatus: "ACEITO",

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

  // Campos de enriquecimento (adicionados por enrich:ameacadas, enrich:invasoras)
  threatStatus: [{ source: "plantaeAmeacada", category: "VU" }],
  invasiveStatus: null,

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
  iptKingdoms: ["Plantae"],

  scientificName: "Bertholletia excelsa Bonpl.",
  canonicalName: "Bertholletia excelsa",

  kingdom: "Plantae",
  family: "Lecythidaceae",

  country: "Brasil",
  stateProvince: "Amazonas",
  county: "Manaus",
  locality: "Reserva Ducke",

  geoPoint: {
    type: "Point",
    coordinates: [-59.9667, -2.9333]
  },

  eventDate: ISODate("2023-05-15"),
  year: 2023, month: 5, day: 15,

  recordedBy: "Silva, J.",
  institutionCode: "INPA",
  basisOfRecord: "PreservedSpecimen",

  // Campo de enriquecimento (adicionado por enrich:ucs)
  conservationUnits: [{ ucName: "Floresta Nacional do Tapajos" }]
}
```

**Indices (45+):** campos basicos, compostos, geoespacial (`geoPoint_2dsphere`)

### 6.3 Colecoes de Referencia (carregadas via loaders)

| Colecao           | Loader                  | Descricao                               | Uso                     |
| ----------------- | ----------------------- | --------------------------------------- | ----------------------- |
| `faunaAmeacada`   | `load:fauna-ameacada`   | Fauna ameacada de extincao (MMA/ICMBio) | `enrich:ameacadas`      |
| `plantaeAmeacada` | `load:plantae-ameacada` | Flora ameacada (CNCFlora/Plantae)       | `enrich:ameacadas`      |
| `fungiAmeacada`   | `load:fungi-ameacada`   | Fungos ameacados (CNCFlora/Fungi)       | `enrich:ameacadas`      |
| `invasoras`       | `load:invasoras`        | Especies invasoras (Instituto Horus)    | `enrich:invasoras`      |
| `catalogoucs`     | `load:catalogo-ucs`     | Catalogo de UCs (CNUC/ICMBio)           | `enrich:ucs`            |
| `ipts`            | —                       | Metadados e versoes dos IPTs            | Controle de atualizacao |

### 6.4 Colecoes Operacionais

| Colecao            | Descricao                             | TTL          |
| ------------------ | ------------------------------------- | ------------ |
| `occurrenceCache`  | Cache de consultas de ocorrencias     | 1 hora       |
| `chat_sessions`    | Historico de conversas do chat IA     | 7 dias       |
| `processingLocks`  | Locks de processamento concorrente    | Configuravel |
| `transform_status` | Status de transformacoes em andamento | —            |
| `process_metrics`  | Metricas de execucao de pipelines     | 30 dias      |

---

## 7. Aplicacao Web

### 7.1 Stack Tecnologico

- **Framework:** Astro.js 5 (SSR mode, Node.js adapter)
- **UI:** React 18 + Tailwind CSS 4 + ShadCN UI
- **Runtime:** Node.js 20 (producao), Bun (desenvolvimento)
- **Porta:** 4321

### 7.2 Paginas

| Rota           | Descricao                                                    |
| -------------- | ------------------------------------------------------------ |
| `/`            | Homepage com links para as funcionalidades                   |
| `/chat`        | Interface de chat com IA para consultas em linguagem natural |
| `/dashboard`   | Dashboard analitico com graficos e estatisticas              |
| `/api`         | Documentacao Swagger interativa da API (componente React)    |
| `/api/docs`    | Documentacao Swagger da API (HTML estatico via CDN)          |
| `/privacy`     | Politica de privacidade                                      |
| `/admin/login` | Login do painel administrativo                               |
| `/admin`       | Painel administrativo (acesso protegido por PIN)             |

### 7.3 API REST

**Endpoints de Taxa:**

- `GET /api/taxa` — Lista taxa com filtros (kingdom, family, genus, etc.)
- `GET /api/taxa/[taxonID]` — Busca taxon por ID
- `GET /api/taxa/count` — Contagem de taxa com filtros

**Endpoints de Ocorrencias:**

- `GET /api/occurrences` — Lista ocorrencias com filtros
- `GET /api/occurrences/[occurrenceID]` — Busca ocorrencia por ID
- `GET /api/occurrences/count` — Contagem com filtros
- `GET /api/occurrences/geojson` — GeoJSON FeatureCollection (requer `bbox`)

**Endpoints de Dashboard:**

- `GET /api/dashboard/summary` — Estatisticas gerais (cache 1h)

**Outros:**

- `GET /api/health` — Health check (conectividade MongoDB)
- `POST /api/chat` — Endpoint do chat com IA

### 7.4 Camada de Dados (MongoDB)

A aplicacao web acessa o MongoDB atraves de modulos especializados em `src/lib/mongo/`:

- **`connection.ts`** — Pool de conexoes (maxPoolSize: 10, timeout: 10s)
- **`taxa.ts`** — Consultas taxonomicas, arvore, agregacoes por reino
- **`occurrences.ts`** — Consultas de ocorrencias com cache, sampling para timeouts
- **`threatened.ts`** — Contagens e categorias de especies ameacadas (`faunaAmeacada`, `plantaeAmeacada`, `fungiAmeacada`)
- **`invasive.ts`** — Contagens e top orders/families de invasoras
- **`phenological.ts`** — Dados do calendario fenologico
- **`cache.ts`** — Gerenciamento de cache de ocorrencias com TTL

---

## 8. Interface de Chat com IA

### 8.1 Arquitetura

O chat utiliza o **Claude API** com integracao **MCP (Model Context Protocol)** para permitir que a IA consulte o MongoDB diretamente.

```
Usuario digita pergunta
    ↓
React (Chat.tsx) → POST /api/chat
    ↓
Claude API (Anthropic)
    ↓
IA decide usar ferramenta → MCP Server (mongodb-mcp-server)
    ↓
find/aggregate no MongoDB (readOnly)
    ↓
Resultado retorna para IA → Resposta em linguagem natural
    ↓
Streaming para o frontend → Markdown renderizado
```

### 8.2 System Prompt

O prompt do sistema (`src/prompts/prompt.md`) instrui a IA sobre:

- Escopo: apenas biodiversidade brasileira (Animalia, Plantae, Fungi)
- Estrutura das colecoes: `taxa`, `occurrences`, `faunaAmeacada`, `plantaeAmeacada`, `fungiAmeacada`, `invasoras`, `ucs`
- Regras de consulta (usar `aggregate` para contagens, nunca `count`)
- Relacoes entre colecoes: `taxa.taxonID` ↔ `plantaeAmeacada.Flora e Funga do Brasil ID`
- Matching fuzzy para nomes de especies

### 8.3 Coleções Consultadas pelo ChatBB

| Colecao           | Uso                                |
| ----------------- | ---------------------------------- |
| `taxa`            | Dados taxonomicos normalizados     |
| `occurrences`     | Registros de coletas e ocorrencias |
| `faunaAmeacada`   | Status de ameaca da fauna          |
| `plantaeAmeacada` | Status de ameaca da flora          |
| `fungiAmeacada`   | Status de ameaca dos fungos        |
| `invasoras`       | Especies invasoras                 |
| `catalogoucs`     | Unidades de conservacao            |

---

## 9. Dashboard e Sistema de Cache

### 9.1 Dashboard Cache Job

O dashboard utiliza dados pre-computados para evitar agregacoes lentas.

**Comando:** `bun run cache-dashboard`

Dados coletados:

- Contagem de ocorrencias e taxa por reino
- Especies ameacadas: contagens e categorias por reino (usando `faunaAmeacada`, `plantaeAmeacada`, `fungiAmeacada`)
- Especies invasoras: contagens, top ordens e familias
- Top colecoes por reino

**Saida:** `packages/web/cache/dashboard-data.json`

---

## 10. Automacao CI/CD

Todos os workflows sao **manuais** (`workflow_dispatch`), sem triggers automaticos.

### 10.1 Workflows Disponiveis

| Workflow                     | Arquivo                          | Runner      | Timeout | Descricao                               |
| ---------------------------- | -------------------------------- | ----------- | ------- | --------------------------------------- |
| Update MongoDB - Flora       | `update-mongodb-flora.yml`       | self-hosted | 60 min  | Ingere Flora do Brasil → taxa           |
| Update MongoDB - Fauna       | `update-mongodb-fauna.yml`       | self-hosted | —       | Ingere Fauna do Brasil → taxa           |
| Update MongoDB - Ocorrencias | `update-mongodb-occurrences.yml` | self-hosted | 120 min | Ingere ~505 IPTs → occurrences          |
| Enrich Taxa - Ameacadas      | `enrich-ameacadas.yml`           | self-hosted | 30 min  | Load CSVs (opcional) + enrich:ameacadas |
| Enrich Taxa - Invasoras      | `enrich-invasoras.yml`           | self-hosted | 30 min  | Load CSV (opcional) + enrich:invasoras  |
| Enrich Ocorrencias - UCs     | `enrich-ucs.yml`                 | self-hosted | 60 min  | Load CSV (opcional) + enrich:ucs        |
| Docker Build                 | `docker.yml`                     | —           | —       | Constroi imagem Docker                  |

### 10.2 Fluxo Tipico de Atualizacao

```
1. Disparar "Update MongoDB - Flora" no GitHub Actions
   → Baixa DwC-A do JBRJ → Transforma → Insere em taxa

2. Disparar "Update MongoDB - Fauna"
   → Mesmo fluxo para fauna

3. Disparar "Update MongoDB - Ocorrencias"
   → Verifica 505 IPTs → Baixa os atualizados → Transforma → Insere em occurrences

4. Disparar "Enrich Taxa - Ameacadas"
   → (Opcional: fornecer CSV atualizado como input)
   → Enriquece taxa com threatStatus de faunaAmeacada + plantaeAmeacada + fungiAmeacada

5. Disparar "Enrich Taxa - Invasoras"
   → Enriquece taxa com invasiveStatus de invasoras

6. Disparar "Enrich Ocorrencias - UCs"
   → Enriquece occurrences com conservationUnits de catalogoucs

7. Disparar "Docker Build" para nova imagem
   → Build multi-stage → Push para registry

8. Atualizar container no UNRAID manualmente
```

### 10.3 Requisitos dos Runners

- **self-hosted:** usado para ingestao e enriquecimento (acesso ao MongoDB e banda de rede)
- **Secrets necessarios:** `MONGO_URI`
- Bun e Node.js 20 instalados automaticamente nos steps

---

## 11. Infraestrutura Docker

### 11.1 Build Multi-Stage

O `Dockerfile` utiliza 3 estagios:

```
Estagio 1 (builder): oven/bun:1.2.21
  → Instala dependencias completas
  → Compila a aplicacao Astro.js (bun run build)

Estagio 2 (prod-deps): oven/bun:1.2.21-alpine
  → Instala apenas dependencias de producao

Estagio 3 (runner): node:20-alpine
  → Copia node_modules de producao
  → Copia artefatos de build (dist/)
  → Executa: node dist/server/entry.mjs
```

### 11.2 Variaveis de Ambiente (Docker)

| Variavel    | Descricao                         |
| ----------- | --------------------------------- |
| `MONGO_URI` | String de conexao MongoDB         |
| `ADMIN_PIN` | PIN de acesso ao painel admin     |
| `PORT`      | Porta do servidor (default: 4321) |

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
│  CSVs de Referencia (Fauna/Plantae/Fungi Ameacadas, Invasoras, UCs)│
│          ↓                                                          │
│     Arquivos CSV (carregados manualmente ou via GitHub Actions)    │
└──────────┬────────────────────────────────────┬─────────────────────┘
           │                                    │
           ▼                                    ▼
┌──────────────────────────────┐  ┌──────────────────────────────────┐
│  AQUISICAO + TRANSFORMACAO   │  │  CARGA DE REFERENCIA             │
│  (packages/ingest)           │  │  (packages/transform - loaders)  │
│                              │  │                                  │
│  1. Verifica versao IPT      │  │  CSV → drop + insert na colecao │
│  2. Baixa DwC-A              │  │                                  │
│  3. Parseia (JSON/SQLite)    │  │  load:fauna-ameacada             │
│  4. Transforma (normaliza)   │  │  load:plantae-ameacada           │
│  5. Insere no MongoDB        │  │  load:fungi-ameacada             │
│                              │  │  load:invasoras                  │
│  → taxa, occurrences         │  │  load:catalogo-ucs               │
└──────────────┬───────────────┘  └───────────────┬──────────────────┘
               │                                  │
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MongoDB (dwc2json) — banco unico                 │
│                                                                     │
│  Colecoes principais:                                               │
│    taxa              occurrences                                    │
│                                                                     │
│  Colecoes de referencia:                                            │
│    faunaAmeacada  plantaeAmeacada  fungiAmeacada                   │
│    invasoras      catalogoucs                                       │
│                                                                     │
│  Colecoes operacionais:                                             │
│    ipts  occurrenceCache  chat_sessions  processingLocks           │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ENRIQUECIMENTO (packages/transform - enrichers)                    │
│                                                                     │
│  enrich:ameacadas  faunaAmeacada + plantaeAmeacada + fungiAmeacada │
│                    → associa threatStatus a taxa                    │
│                                                                     │
│  enrich:invasoras  invasoras → associa invasiveStatus a taxa        │
│                                                                     │
│  enrich:ucs        catalogoucs → associa conservationUnits          │
│                    a occurrences                                    │
│                                                                     │
│  (leitura das colecoes de referencia + $set/$unset in-place)        │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      packages/web (Astro.js)                        │
│                                                                     │
│  API REST (/api/taxa, /api/occurrences, /api/dashboard, ...)       │
│  Chat IA (Claude API + MCP → MongoDB)                              │
│  Dashboard (cache pre-computado)                                    │
│  Admin Panel (/admin)                                               │
│                                                                     │
│                    ↓ Docker (node:20-alpine) ↓                      │
│                    Porta 4321 → UNRAID                              │
└─────────────────────────────────────────────────────────────────────┘
```
