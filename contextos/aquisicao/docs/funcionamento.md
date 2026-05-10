# Funcionamento — Contexto de Aquisição (V7)

> Este documento descreve **somente o Contexto de Aquisição** da suite Biodiversidade.Online. Os contextos Curadoria, Enriquecimento e Apresentação serão documentados em seus próprios repositórios quando implementados.

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura V7](#2-arquitetura-v7)
3. [Fontes de Dados e IPTs](#3-fontes-de-dados-e-ipts)
4. [Pipeline de Ingestão](#4-pipeline-de-ingestão)
5. [Filtragem e Normalização de Taxa](#5-filtragem-e-normalização-de-taxa)
6. [Armazenamento MongoDB](#6-armazenamento-mongodb)

---

## 1. Visão Geral

A Aquisição V7 é um conjunto de **três binários Go** (CLI puros) que importam dados taxonômicos e de ocorrências de fontes IPT (Integrated Publishing Toolkit) para o banco MongoDB compartilhado `dwc2json`:

- **`update-flora`** — Flora e Funga do Brasil (JBRJ/Reflora)
- **`update-fauna`** — Catálogo Taxonômico da Fauna do Brasil (JBRJ)
- **`update-occurrences`** — 505+ coleções de herbários e museus brasileiros

Cada binário baixa um Darwin Core Archive (DwC-A), faz parsing streaming, transforma os registros e faz upsert no MongoDB.

Não há frontend, chat, dashboard ou workflows automáticos neste repositório — esses componentes pertencem aos contextos futuros.

---

## 2. Arquitetura V7

### 2.1 Layout do repositório

```
Biodiversidade-Online/
└── contextos/
    └── aquisicao/                  # raiz do módulo Go
        ├── cmd/
        │   ├── update-fauna/       # main.go — entry point fauna
        │   ├── update-flora/       # main.go — entry point flora
        │   └── update-occurrences/ # main.go — entry point ocorrências (505+ fontes)
        ├── internal/
        │   ├── config/             # carrega .env + valida variáveis
        │   ├── dwca/               # parser DwC-A (meta.xml, eml.xml, core, extensões)
        │   ├── ingest/             # pipeline: download → parse → transform → upsert
        │   ├── mongostore/         # BulkWrite, DeleteNotSeen, RunRecord
        │   ├── verbose/            # slog wrapper + signal handling
        │   └── version/            # versão via -ldflags
        ├── data/
        │   └── occurrences.csv     # 505+ fontes IPT para ocorrências
        ├── docs/                   # esta documentação
        └── specs/                  # spec, plan, tasks, contratos
```

### 2.2 Stack

| Item | Tecnologia |
|---|---|
| Linguagem | Go 1.22+ |
| Banco | MongoDB (driver oficial v2) |
| Dependências diretas | apenas `mongo-driver/v2` e `godotenv` |
| Distribuição | binários estáticos em `bin/` |
| Sem | Bun, Node.js, TypeScript, Docker, GitHub Actions |

---

## 3. Fontes de Dados e IPTs

### O que são IPTs

IPT (Integrated Publishing Toolkit) é o software do GBIF usado por instituições para publicar dados de biodiversidade no formato **Darwin Core Archive**. Cada IPT hospeda um ou mais recursos (datasets) acessíveis via URLs padronizadas.

### Fontes Taxonômicas

| Fonte | IPT | URL Base | Reino |
|---|---|---|---|
| Flora e Funga do Brasil | JBRJ | `https://ipt.jbrj.gov.br/jbrj/` | Plantae, Fungi |
| Catálogo Taxonômico da Fauna do Brasil | JBRJ | `https://ipt.jbrj.gov.br/jbrj/` | Animalia |

URLs configuráveis em `.env` (`IPT_FAUNA_URL`, `IPT_FLORA_URL`).

### Fontes de Ocorrências

`data/occurrences.csv` cataloga 505+ coleções:

```csv
nome,repositorio,kingdom,tag,url
Herbarium - INPA,inpa,Plantae,inpa_herbario,https://ipt.sibbr.gov.br/inpa/
Herpetology Collection - MPEG,mpeg,Animalia,mpeg_herpetologia,https://ipt.sibbr.gov.br/mpeg/
```

### Formato Darwin Core Archive

Um DwC-A é um ZIP contendo:

```
arquivo.zip/
├── meta.xml           # Schema: define core + extensões e seus campos
├── eml.xml            # Metadados (título, versão, autores)
├── taxon.txt          # Core (taxa)
├── distribution.txt   # Extensão: distribuição geográfica
├── vernacularname.txt # Extensão: nomes vernaculares
├── speciesprofile.txt # Extensão: perfil da espécie
├── reference.txt      # Extensão: referências bibliográficas
├── typesandspecimen.txt # Extensão: espécimes-tipo
└── resourcerelationship.txt # Extensão: sinonímias
```

O `meta.xml` mapeia cada coluna (por índice) a um termo Darwin Core padronizado. Exemplo:

```xml
<core rowType="http://rs.tdwg.org/dwc/terms/Taxon">
  <files><location>taxon.txt</location></files>
  <id index="0"/>
  <field index="0" term="http://rs.tdwg.org/dwc/terms/taxonID"/>
  <field index="1" term="http://rs.tdwg.org/dwc/terms/scientificName"/>
  <field index="2" term="http://rs.tdwg.org/dwc/terms/kingdom"/>
</core>
```

Extensões compartilham com o core via `coreid` (chave estrangeira para o `taxonID`).

---

## 4. Pipeline de Ingestão

Implementado em `internal/ingest/pipeline.go`. Cada binário em `cmd/<binary>/main.go` apenas faz: parse flags → `config.Load` → `mongostore.Connect` → `ingest.Run` → exit code.

```
┌────────────────┐   ┌────────────────┐   ┌────────────────┐   ┌───────────────┐
│  Download HTTP │ → │  Open archive  │ → │  Parse meta+eml│ → │  Read core    │
│  archive.do    │   │  (zip stream)  │   │  + extensões   │   │  taxon.txt    │
└────────────────┘   └────────────────┘   └────────────────┘   └───────────────┘
                                                                       ↓
                                                              ┌────────────────┐
                                                              │ Filter rank    │
                                                              │ (apenas espéc.,│
                                                              │  sub-esp., etc)│
                                                              └────────────────┘
                                                                       ↓
                                                              ┌────────────────┐
                                                              │ Enrich:        │
                                                              │  +distribution │
                                                              │  +vernacular   │
                                                              │  +speciesprof. │
                                                              │  +othernames   │
                                                              │  +reference    │
                                                              │  +types/spec.  │
                                                              │  +canonicalNm  │
                                                              │  +flatScNm     │
                                                              └────────────────┘
                                                                       ↓
                                                              ┌────────────────┐
                                                              │ BulkUpsert     │
                                                              │ ReplaceOne by  │
                                                              │ _id, upsert=t  │
                                                              └────────────────┘
                                                                       ↓
                                                              ┌────────────────┐
                                                              │ DeleteNotSeen  │
                                                              │ (source filter)│
                                                              └────────────────┘
```

### 4.1 Download

`internal/dwca/download.go`. Stream para arquivo de cache em `os.UserCacheDir()/biodiversidade`. Timeout configurável via `HTTP_TIMEOUT_MIN` (default 30 min).

### 4.2 Parsing

- `dwca.Open(zipPath)` lê `meta.xml` + `eml.xml` em RAM, retorna `*Archive` com `Core` + `[]Extension`.
- `dwca.CoreReader(zipPath)` retorna iterador streaming sobre o core file.
- `dwca.ExtensionReader(zipPath, rowType)` retorna iterador para extensão específica.

Cada `Read()` retorna `Record = map[string]string` com chaves = nomes curtos do termo Darwin Core (último componente do URI, ex: `taxonID`, `scientificName`).

### 4.3 Versão e cache

Antes de processar, o pipeline compara `eml.xml.pubDate` + `dateStamp` com a última `RunRecord` bem-sucedida em `ingest_runs`. Se idênticos, loga warning (mas continua execução — operador decide).

### 4.4 IDs determinísticos

Implementado em `internal/ingest/pipeline.go:resolveID`:

- **Taxa**: `taxonID` direto, ou fallback `<source>:<scientificNameID>`, ou último recurso `<source>:<scientificName>:<authorship>`.
- **Ocorrências**: `occurrenceID` direto.

### 4.5 Delete-not-seen

Após upsert de todos os registros do run, `mongostore.DeleteNotSeen(ctx, coll, source, runID)` remove docs com `source==source` e `_runId!=runID`. Garante que registros removidos da fonte sumam do banco.

---

## 5. Filtragem e Normalização de Taxa

Aplicado **apenas** quando `source ∈ {fauna, flora}` (ocorrências passam por pipeline diferente).

### 5.1 Filtro de Rank Taxonômico

`internal/ingest/taxa_transform.go:shouldKeepTaxon`. Aceita apenas (case-insensitive):

| Português (Flora/Fauna BR) | Inglês (compatibilidade) |
|---|---|
| ESPECIE | SPECIES |
| SUB_ESPECIE | SUBSPECIES |
| VARIEDADE | VARIETY |
| FORMA | FORM |

Qualquer outro valor (FAMILIA, GENERO, ORDEM, CLASSE, etc.) é **rejeitado**. Registros sem `taxonRank` também são rejeitados.

> **Por quê:** o sistema cataloga apenas táxons-folha (espécie e infraespécie). Grupos supra-específicos são derivados dos campos `kingdom`/`phylum`/`class`/`order`/`family`/`genus` dos próprios documentos folha.

### 5.2 Extensões integradas no documento

Para cada taxon-folha, o pipeline carrega todas as extensões em RAM (taxa cabem confortavelmente: ~300K registros) e mescla por `taxonID`:

- **distribution.txt** → objeto `distribution` normalizado:
  ```json
  "distribution": {
    "origin": "NATIVA",
    "Endemism": "Endemica",
    "phytogeographicDomains": ["Mata Atlântica"],
    "occurrence": ["BR-AL","BR-BA","BR-ES",...],
    "vegetationType": ["Floresta Estacional Semidecidual",...]
  }
  ```
  Lógica: agrupa todos os `locationID` do taxon em `occurrence[]`, deduplica `phytogeographicDomain` e `vegetationType` (vêm de `occurrenceRemarks`), pega primeiro `establishmentMeans` como `origin` e primeiro `endemism` como `Endemism`.

- **vernacularname.txt** → array `vernacularname[]`:
  ```json
  "vernacularname": [
    {"vernacularName":"pau-brasil","language":"Portugues","locality":"Brasil"},
    ...
  ]
  ```
  Default `language="Portugues"` se vazio.

- **speciesprofile.txt** → objeto `speciesprofile.lifeForm`:
  ```json
  "speciesprofile": { "lifeForm": { "lifeForm":["Árvore"], "habitat":["Terrícola"] } }
  ```

- **resourcerelationship.txt** → array `othernames[]` (sinonímias):
  ```json
  "othernames": [
    {"taxonID":"82704","scientificName":"Caesalpinia echinata Lam.","taxonomicStatus":"Tem como sinônimo BASIONIMO"},
    ...
  ]
  ```

- **reference.txt** → array `reference[]`.

- **typesandspecimen.txt** → array `typesandspecimen[]`.

### 5.3 Campos computados

- **`canonicalName`** = `genus + " " + specificEpithet [+ " " + infraspecificEpithet]`. Exemplo: `"Paubrasilia echinata"`.
- **`flatScientificName`** = `scientificName` em lowercase com tudo que não for `[a-z0-9]` removido. Exemplo: `"paubrasiliaechinatalamgagnonhclimagplewis"`.

Usados pela Curadoria/Enriquecimento (futuros) para matching fuzzy contra listas externas.

---

## 6. Armazenamento MongoDB

### 6.1 Banco: `dwc2json`

### 6.2 Coleções

#### `taxa` — Espécies (filtradas + extensões mescladas)

Schema-alvo formal: [`schema-dwc2json-taxa-mongoDBJSON.json`](schema-dwc2json-taxa-mongoDBJSON.json)

Exemplo (Paubrasilia echinata, Flora):

```json
{
  "_id": "P602728",
  "taxonID": "602728",
  "parentNameUsageID": "602727",
  "originalNameUsageID": "82704",
  "scientificName": "Paubrasilia echinata (Lam.) Gagnon, H.C.Lima & G.P.Lewis",
  "parentNameUsage": "Paubrasilia (Lam.) Gagnon, H.C.Lima & G.P.Lewis",
  "namePublishedIn": "PhytoKeys 71: 1–160. 2016",
  "namePublishedInYear": "2016",
  "higherClassification": "Angiospermas",
  "kingdom": "Plantae",
  "phylum": "Tracheophyta",
  "class": "Magnoliopsida",
  "order": "Fabales",
  "family": "Fabaceae",
  "genus": "Paubrasilia",
  "specificEpithet": "echinata",
  "taxonRank": "ESPECIE",
  "scientificNameAuthorship": "(Lam.) Gagnon, H.C.Lima & G.P.Lewis",
  "taxonomicStatus": "NOME_ACEITO",
  "nomenclaturalStatus": "NOME_CORRETO",
  "modified": "2024-07-10T14:21:03.648Z",
  "bibliographicCitation": "Flora do Brasil 2020 em construção...",
  "references": "http://reflora.jbrj.gov.br/...",
  "vernacularname": [...],
  "reference": [...],
  "distribution": { "origin":"NATIVA", "occurrence":["BR-AL",...], ... },
  "speciesprofile": { "lifeForm":{...} },
  "typesandspecimen": [...],
  "othernames": [...],
  "canonicalName": "Paubrasilia echinata",
  "flatScientificName": "paubrasiliaechinatalamgagnonhclimagplewis",
  "source": "flora",
  "_runId": "...",
  "ingestedAt": ISODate("...")
}
```

#### `occurrences` — Registros de ocorrências

Schema-alvo: [`schema-dwc2json-ocorrencias-mongoDBJSON.json`](schema-dwc2json-ocorrencias-mongoDBJSON.json)

Documento cru do DwC-A (passthrough) + `_id` derivado de `occurrenceID`. Coordenadas validadas (lat ∈ [-90,90], lon ∈ [-180,180]) — registros suspeitos são logados como warning mas mantidos.

#### `ingest_runs` — Auditoria de execuções

Cada execução (sucesso ou falha) grava um `RunRecord`:

```javascript
{
  _id: "<runID>",
  source: "fauna|flora|<tag>",
  binary: "update-fauna",
  version: "v7.0.0+abc123",
  startedAt: Date,
  finishedAt: Date,
  durationSec: 123.4,
  status: "success|failed",
  exitCode: 0,
  dwca: { url, pubDate, version, title, downloadedBytes },
  counters: { recordsRead, recordsUpserted, recordsRejected, recordsRemoved, ... },
  warnings: [...],
  errorMessage: "",
  dryRun: false
}
```

### 6.3 Campos injetados pelo store

Em todos os documentos de `taxa` e `occurrences`, o `mongostore.BulkUpsert` injeta:

- `_runId` — referência ao `ingest_runs._id` da execução que escreveu o doc
- `source` — string identificadora (ex: `"fauna"`, `"flora"`, `"inpa_herbario"`)
- `ingestedAt` — `time.Time` da execução

### 6.4 Validador `$jsonSchema` (opcional)

Os schemas em `docs/schema-dwc2json-*.json` podem ser aplicados como `$jsonSchema` validators na coleção via:

```javascript
db.runCommand({
  collMod: "taxa",
  validator: { $jsonSchema: <conteúdo do JSON> },
  validationLevel: "moderate"
})
```

> **Nota:** o validador V6 espera `_id` do tipo `objectId`. Na V7 usamos `_id` string determinístico (ex: `"P602728"`). Ajustar `_id.bsonType` para `string` antes de aplicar, ou rebaixar `validationLevel` para `"off"` durante migração.

---

## Ver também

- [`atualizacao.md`](atualizacao.md) — Como executar atualizações (operador)
- [`esquema.md`](esquema.md) — Diagrama Mermaid das fontes IPT
- [`../../README.md`](../../README.md) — Diagramas C4 da suite
- [`../specs/001-refactor-acquisition/`](../specs/001-refactor-acquisition/) — Spec, plan e tasks da V7
