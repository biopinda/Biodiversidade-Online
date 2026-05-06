# Collection Contract — `dwc2json`

**Date**: 2026-05-05
**Audience**: Consumidores externos do banco MongoDB (queries diretas, futuros exports/APIs).

Define o contrato de leitura das três coleções do banco `dwc2json`. Mudanças aqui requerem coordenação com consumidores.

Para detalhamento completo de campos, ver [data-model.md](../data-model.md).

---

## Convenções globais

- **Banco**: `dwc2json` (configurável via `MONGO_DATABASE`, mas o nome de referência é `dwc2json`).
- **`_id`**: sempre `string`, nunca `ObjectId` autogerado.
- **Datas**: `ISODate` quando o pipeline conseguiu parsear; `string` quando o formato original era ambíguo.
- **Strings vazias**: omitidas (campo não presente em vez de `""` ou `null`).
- **Encoding**: UTF-8 garantido em todos os campos textuais.

---

## Coleção `taxa`

### Garantias

| Garantia                      | Descrição                                                 |
| ----------------------------- | --------------------------------------------------------- |
| `_id` único e estável         | Cópia do `taxonID` original do IPT                        |
| `source ∈ {"fauna", "flora"}` | Sempre presente, sempre um destes dois valores            |
| `scientificName` presente     | Documentos sem nome científico são rejeitados na ingestão |
| `ingestedAt` presente         | Timestamp UTC do upsert mais recente                      |
| `_runId` presente             | UUID v7 da última run que tocou o documento               |

### Termos Darwin Core

Todos os termos presentes no `meta.xml` do DwC-A da fonte são gravados com **o nome original**. Lista típica em [data-model.md §1](../data-model.md#1-coleção-taxa).

### Query patterns esperados

```javascript
// Todos os táxons de fauna
db.taxa.find({ source: 'fauna' })

// Família específica
db.taxa.find({ source: 'flora', family: 'Asteraceae' })

// Por nome científico (case-insensitive)
db.taxa.find({ scientificName: { $regex: /^Anolis/i } })

// Última atualização
db.taxa.find().sort({ ingestedAt: -1 }).limit(1)
```

---

## Coleção `occurrences`

### Garantias

| Garantia                             | Descrição                                                          |
| ------------------------------------ | ------------------------------------------------------------------ |
| `_id` único e estável                | Cópia do `occurrenceID` original                                   |
| `source` presente                    | Identificador da fonte IPT (configurável; default `"occurrences"`) |
| `decimalLatitude`/`decimalLongitude` | `double` quando presentes; podem estar ausentes                    |
| `eventDate`                          | `ISODate` ou `string`; checar tipo antes de query temporal         |
| `ingestedAt`, `_runId`               | Sempre presentes                                                   |

### Query patterns esperados

```javascript
// Ocorrências de uma espécie
db.occurrences.find({ scientificName: 'Panthera onca' })

// Por estado
db.occurrences.find({ stateProvince: 'Mato Grosso' })

// Por ano
db.occurrences.find({
  eventDate: { $gte: ISODate('2020-01-01'), $lt: ISODate('2021-01-01') }
})

// Bounding box (sem 2dsphere)
db.occurrences.find({
  decimalLatitude: { $gte: -16, $lte: -14 },
  decimalLongitude: { $gte: -49, $lte: -47 }
})

// Spécimes preservados (PreservedSpecimen)
db.occurrences.find({ basisOfRecord: 'PreservedSpecimen' })
```

### Notas

- **Sem índice 2dsphere por padrão**. Se quiser queries `$near`/`$geoWithin`, criar manualmente: `db.occurrences.createIndex({location: "2dsphere"})` após adicionar campo `location` derivado.
- **`eventDate` heterogêneo**: para queries robustas use também `year`/`month`/`day` quando presentes.

---

## Coleção `ingest_runs`

### Garantias

| Garantia                                        | Descrição                                               |
| ----------------------------------------------- | ------------------------------------------------------- |
| `_id` único                                     | UUID v7 = `_runId` referenciado em `taxa`/`occurrences` |
| `source ∈ {"fauna", "flora", "occurrences"}`    | Igual ao binário executado                              |
| `status ∈ {"success", "failed", "interrupted"}` | Sempre presente                                         |
| `startedAt` presente                            | Timestamp UTC do início                                 |
| `finishedAt`                                    | Pode estar ausente se script crashou antes do `defer`   |

### Schema completo

Ver [data-model.md §3](../data-model.md#3-coleção-ingest_runs).

### Query patterns esperados

```javascript
// Última execução de fauna com sucesso
db.ingest_runs
  .find({ source: 'fauna', status: 'success' })
  .sort({ startedAt: -1 })
  .limit(1)

// Tudo o que falhou nos últimos 30 dias
db.ingest_runs.find({
  status: 'failed',
  startedAt: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) }
})

// Histórico de versões dos DwC-As
db.ingest_runs
  .find(
    { source: 'occurrences' },
    { 'dwca.pubDate': 1, 'dwca.version': 1, startedAt: 1 }
  )
  .sort({ startedAt: -1 })

// Documentos de uma run específica
db.taxa.find({ _runId: '<run-id-aqui>' })
```

---

## Garantias de coerência cruzada

- **`taxa.source` ↔ binário**: `source: "fauna"` só é gravado por `update-fauna.exe`; `source: "flora"` só por `update-flora.exe`. Outros binários jamais tocam documentos com a `source` alheia.
- **`_runId` ↔ `ingest_runs._id`**: Para todo `_runId` em `taxa`/`occurrences`, há (eventualmente) um documento correspondente em `ingest_runs`. Pode haver janela curta entre o último upsert e a gravação de `ingest_runs`.

---

## Versionamento

Adicionar novos campos passthrough a `taxa`/`occurrences` (porque o IPT de origem adicionou novos termos DwC) **não é breaking change** — consumidores são livres para ignorar campos desconhecidos.

Renomear, remover, ou mudar o tipo de campos injetados (`source`, `_runId`, `ingestedAt`, `_id`) **é breaking change** e exige coordenação.
