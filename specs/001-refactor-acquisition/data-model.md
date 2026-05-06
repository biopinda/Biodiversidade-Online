# Data Model — Refatoração para Aquisição Apenas

**Date**: 2026-05-05
**Database**: `dwc2json`
**Spec**: [spec.md](./spec.md)

Banco MongoDB único (`dwc2json`) com **três coleções**: `taxa`, `occurrences`, `ingest_runs`.

---

## 1. Coleção `taxa`

### Estratégia de schema

**Passthrough completo** dos termos Darwin Core do core/extensões taxonômicas dos IPTs de fauna e flora. O documento preserva os nomes originais dos termos DwC; apenas três campos são adicionados pelo pipeline (`_id`, `source`, `ingestedAt`, `_runId`).

### Identidade

- `_id`: string. Cópia do termo `taxonID` do DwC. Quando `taxonID` ausente, fallback para `<source>:<scientificNameID>` ou hash determinístico de `(scientificName, scientificNameAuthorship, source)`.
- Único por `_id` (índice padrão).
- Não há documentos sem `_id`.

### Campos passthrough (exemplos típicos — não exaustivo)

Todos os termos do DwC presentes no `meta.xml` do DwC-A são gravados. Lista representativa:

| Campo                      | Tipo              | Origem       | Notas                        |
| -------------------------- | ----------------- | ------------ | ---------------------------- |
| `taxonID`                  | string            | DwC core     | duplicado em `_id`           |
| `scientificName`           | string            | DwC core     | nome científico completo     |
| `scientificNameAuthorship` | string            | DwC core     | autor(es)                    |
| `acceptedNameUsage`        | string            | DwC core     | nome aceito                  |
| `acceptedNameUsageID`      | string            | DwC core     | id do nome aceito            |
| `parentNameUsageID`        | string            | DwC core     | hierarquia                   |
| `originalNameUsageID`      | string            | DwC core     | basiônimo                    |
| `taxonRank`                | string            | DwC core     | species, genus, family, etc. |
| `taxonomicStatus`          | string            | DwC core     | accepted, synonym, etc.      |
| `nomenclaturalCode`        | string            | DwC core     | ICN, ICZN, etc.              |
| `nomenclaturalStatus`      | string            | DwC core     |                              |
| `kingdom`                  | string            | DwC core     |                              |
| `phylum`                   | string            | DwC core     |                              |
| `class`                    | string            | DwC core     |                              |
| `order`                    | string            | DwC core     |                              |
| `family`                   | string            | DwC core     |                              |
| `genus`                    | string            | DwC core     |                              |
| `subgenus`                 | string            | DwC core     |                              |
| `specificEpithet`          | string            | DwC core     |                              |
| `infraspecificEpithet`     | string            | DwC core     |                              |
| `vernacularName`           | string\|array     | DwC extensão | array se múltiplas extensões |
| `references`               | string            | DwC core     | URL da publicação            |
| `bibliographicCitation`    | string            | DwC core     |                              |
| `modified`                 | string (ISO 8601) | DwC core     | data de modificação no IPT   |
| `language`                 | string            | DwC core     |                              |
| `rightsHolder`             | string            | DwC core     |                              |
| `datasetID`                | string            | DwC core     |                              |
| `datasetName`              | string            | DwC core     |                              |

### Campos injetados pelo pipeline

| Campo        | Tipo             | Descrição                                               |
| ------------ | ---------------- | ------------------------------------------------------- |
| `source`     | string enum      | `"fauna"` ou `"flora"`                                  |
| `ingestedAt` | ISODate          | Timestamp UTC do upsert                                 |
| `_runId`     | string (UUID v7) | Identificador da execução que gravou/atualizou este doc |

### Normalização de tipos

- Datas (ex.: `modified`): se parseável, gravado como ISODate; se não, mantido como string.
- Numéricos não esperados em `taxa` (mantido tudo como string exceto datas).
- Strings vazias são **omitidas** do documento.

### Índices

| Índice           | Tipo                                                     | Propósito                                  |
| ---------------- | -------------------------------------------------------- | ------------------------------------------ |
| `_id`            | padrão                                                   | unicidade                                  |
| `source`         | simples                                                  | filtros por fonte (FR-009 delete-not-seen) |
| `scientificName` | simples (caso-insensitivo via collation `pt`/strength 2) | buscas                                     |
| `family, genus`  | composto                                                 | navegação taxonômica                       |
| `_runId`         | simples                                                  | suporta delete-not-seen e auditoria        |

### Validações de pipeline (não validator MongoDB)

- `taxonID` ou fallback DEVE existir; documento sem identificador estável é rejeitado e contabilizado em `recordsRejected` no `ingest_runs`.
- `scientificName` DEVE existir; sem ele, registro é rejeitado.
- Campos com valor `\\N`, `null`, `NULL` (convenções DwC) são tratados como ausentes.

---

## 2. Coleção `occurrences`

### Estratégia de schema

**Passthrough completo** dos termos do core de Occurrence + extensões disponíveis (Identification, MeasurementOrFact, etc.). Mesma filosofia de `taxa`.

### Identidade

- `_id`: string. Cópia de `occurrenceID`. Sem fallback automático — se `occurrenceID` ausente, registro é rejeitado.

### Campos passthrough (exemplos)

| Campo                                                    | Tipo              | Notas                                                                           |
| -------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------- |
| `occurrenceID`                                           | string            | duplicado em `_id`                                                              |
| `basisOfRecord`                                          | string            | PreservedSpecimen, HumanObservation, etc.                                       |
| `eventDate`                                              | ISODate ou string | parseado se possível (ISO 8601, formatos `YYYY-MM-DD`, `YYYY-MM-DD/YYYY-MM-DD`) |
| `eventTime`                                              | string            | mantido como string                                                             |
| `year`, `month`, `day`                                   | int               | quando presentes                                                                |
| `recordedBy`                                             | string            |                                                                                 |
| `individualCount`                                        | int               |                                                                                 |
| `sex`                                                    | string            |                                                                                 |
| `lifeStage`                                              | string            |                                                                                 |
| `decimalLatitude`                                        | double            | normalizado                                                                     |
| `decimalLongitude`                                       | double            | normalizado                                                                     |
| `geodeticDatum`                                          | string            |                                                                                 |
| `coordinateUncertaintyInMeters`                          | double            |                                                                                 |
| `country`                                                | string            |                                                                                 |
| `countryCode`                                            | string            |                                                                                 |
| `stateProvince`                                          | string            |                                                                                 |
| `county`, `municipality`, `locality`                     | string            |                                                                                 |
| `institutionCode`                                        | string            |                                                                                 |
| `collectionCode`                                         | string            |                                                                                 |
| `catalogNumber`                                          | string            |                                                                                 |
| `identifiedBy`                                           | string            |                                                                                 |
| `dateIdentified`                                         | ISODate ou string |                                                                                 |
| `scientificName`                                         | string            | denormalizado da identificação                                                  |
| `kingdom`, `phylum`, `class`, `order`, `family`, `genus` | string            | denormalizados                                                                  |
| `taxonRank`                                              | string            |                                                                                 |
| `references`                                             | string            | URL no IPT                                                                      |

### Campos injetados pelo pipeline

| Campo        | Tipo             | Descrição                                                                         |
| ------------ | ---------------- | --------------------------------------------------------------------------------- |
| `source`     | string           | identificador da fonte IPT (ex.: `"sibbr-occurrences"` — configurável via `.env`) |
| `ingestedAt` | ISODate          | timestamp UTC                                                                     |
| `_runId`     | string (UUID v7) | id da execução                                                                    |

### Normalização especial

- `decimalLatitude`/`decimalLongitude`: parsear como `float64`. Valores fora de `[-90,90]`/`[-180,180]` são **mantidos** mas o pipeline emite warning no log e contabiliza em `recordsWithSuspectCoordinates` no `ingest_runs`.
- `eventDate`: parser tolerante. Aceita `YYYY-MM-DD`, `YYYY-MM`, `YYYY`, `YYYY-MM-DD/YYYY-MM-DD` (range — gravado como objeto `{start, end}` em vez de ISODate).
- `individualCount`: parsear como `int`; se não-numérico, gravado como string original e log warn.

### Índices

| Índice                              | Tipo                                                                       | Propósito                                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `_id`                               | padrão                                                                     | unicidade                                                                                                              |
| `source`                            | simples                                                                    | filtros e delete-not-seen                                                                                              |
| `scientificName`                    | simples                                                                    | buscas por nome                                                                                                        |
| `family, genus, scientificName`     | composto                                                                   | navegação taxonômica                                                                                                   |
| `country, stateProvince`            | composto                                                                   | filtros geográficos                                                                                                    |
| `decimalLatitude, decimalLongitude` | 2dsphere (sobre objeto GeoJSON `{type: "Point", coordinates: [lon,lat]}`)? | **Decisão postergada** — adicionar no futuro se quiser queries geo. **Por agora, sem 2dsphere** (mantém simplicidade). |
| `eventDate`                         | simples                                                                    | filtros temporais                                                                                                      |
| `_runId`                            | simples                                                                    | delete-not-seen                                                                                                        |

### Validações

- `occurrenceID` obrigatório; sem ele → reject.
- `basisOfRecord` recomendado mas não obrigatório (warn).
- Coordenadas opcionais; se uma das duas presente sem a outra, gravar a presente e warn.

---

## 3. Coleção `ingest_runs`

### Propósito

Registro de auditoria por execução (FR-018, FR-019).

### Schema

```jsonc
{
  "_id": "<UUID v7>",                  // = _runId daquela execução
  "source": "fauna" | "flora" | "occurrences",
  "binary": "update-fauna" | "update-flora" | "update-occurrences",
  "version": "<git sha curto ou versão do binário>",
  "startedAt": ISODate,
  "finishedAt": ISODate,                // pode ser ausente se script abortou antes de gravar
  "durationSec": double,
  "status": "success" | "failed" | "interrupted",
  "exitCode": int,                      // 0..130
  "errorMessage": string,               // presente se failed/interrupted
  "dwca": {
    "url": string,                      // URL do IPT usada
    "downloadedBytes": long,
    "pubDate": ISODate,                 // do eml.xml
    "version": string,                  // do eml.xml
    "title": string                     // do eml.xml
  },
  "counters": {
    "recordsRead": long,
    "recordsRejected": long,
    "recordsUpserted": long,            // result.MatchedCount + result.UpsertedCount
    "recordsRemoved": long,             // delete-not-seen ao final
    "recordsWithSuspectCoordinates": long  // só occurrences
  },
  "warnings": [string]                  // até 100 amostras (truncar para evitar doc gigante)
}
```

### Índices

| Índice                  | Tipo     | Propósito                  |
| ----------------------- | -------- | -------------------------- |
| `_id`                   | padrão   | unicidade                  |
| `source, startedAt: -1` | composto | "última run de X" (FR-019) |
| `status`                | simples  | troubleshooting            |

### Política de retenção

Não há TTL. Coleção cresce ~3 docs/dia no pior caso (1 por script/dia) → trivial. Operador pode limpar manualmente se quiser.

---

## 4. Lifecycle / state transitions

### Run lifecycle

```text
[startedAt] → loading config → connecting Mongo → downloading DwC-A
            → parsing meta.xml/eml.xml → reading core+extensions
            → bulk upsert (loop em lotes) → delete-not-seen
            → write ingest_runs(success) → [finishedAt]

Falhas em qualquer ponto → write ingest_runs(failed, exitCode, errorMessage)
SIGINT (Ctrl+C) → write ingest_runs(interrupted, exitCode=130)
```

### Document lifecycle (taxa/occurrences)

```text
Não existe → upsert (insert) com _runId=R1 → presente
Existe (de R1) → mesma run → não tocado (single doc per run)
Existe (de R0) → upsert (replace) com _runId=R1 → atualizado
Existe (de R0) → não veio em R1 → delete-not-seen (remove ao final)
```

---

## 5. Relações entre coleções

- `taxa.scientificName` ↔ `occurrences.scientificName`: **denormalização**, não é foreign key. Match textual (collation case-insensitive) suficiente para queries futuras.
- `taxa._id` (= taxonID) ↔ `occurrences.taxonID` se presente no DwC-A: **referência opcional**. Pipeline não enforça integridade — DwC é frequentemente desconectado.
- `ingest_runs._id` (= `_runId`) ↔ `taxa._runId`/`occurrences._runId`: **rastreabilidade**. Permite query "quais documentos vieram da run X?".

---

## 6. Validações finais

| Coleção       | Regra                                | Falha leva a                         |
| ------------- | ------------------------------------ | ------------------------------------ |
| `taxa`        | `_id` único                          | reject + log warn                    |
| `taxa`        | `scientificName` presente            | reject + counter                     |
| `occurrences` | `_id` único                          | reject + log warn                    |
| `occurrences` | coordenadas em range válido          | warn + counter                       |
| `occurrences` | `eventDate` parseável                | warn (mantém string)                 |
| `ingest_runs` | gravação atômica via `defer` no main | falha de gravação não invalida o run |

Não usaremos JSON Schema validator do MongoDB — validações são responsabilidade do pipeline (mais flexível, melhores mensagens, evita reject silencioso pelo banco).
