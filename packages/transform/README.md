# @darwincore/transform - Enriquecimento Temático

Pacote responsável pelo enriquecimento temático das coleções principais do MongoDB (`taxa` e `occurrences`).

## Visão Geral

O enriquecimento é organizado por **temas**. Cada tema representa uma fonte externa de dados que agrega informação às coleções principais. A arquitetura é extensível — novos temas seguem o mesmo padrão.

**Padrão de cada tema:**

```
Fonte CSV → Loader (CSV → coleção de referência) → Enricher (referência → $set in-place na coleção alvo)
```

Este pacote implementa dois tipos de operações:

1. **Loaders CSV** — Carregam arquivos CSV para coleções de referência no MongoDB (`faunaAmeacada`, `plantaeAmeacada`, `fungiAmeacada`, `invasoras`, `catalogoucs`)
2. **Enrichers** — Iteram sobre `taxa` e `occurrences` e atualizam os documentos in-place com dados das coleções de referência

Os scripts de ingestão (`packages/ingest`) gravam diretamente em `taxa` e `occurrences`, e os enrichers deste pacote complementam esses dados com informações temáticas.

## Scripts Disponíveis

### Loaders (CSV → MongoDB)

```bash
bun run load:fauna-ameacada -- <caminho.csv>    # → coleção faunaAmeacada
bun run load:plantae-ameacada -- <caminho.csv>  # → coleção plantaeAmeacada
bun run load:fungi-ameacada -- <caminho.csv>    # → coleção fungiAmeacada
bun run load:invasoras -- <caminho.csv>         # → coleção invasoras
bun run load:catalogo-ucs -- <caminho.csv>      # → coleção catalogoucs
```

Cada loader: lê o CSV, detecta o delimitador automaticamente, faz drop + insert na coleção, cria índices.

### Enrichers (atualização in-place)

```bash
bun run enrich:ameacadas    # Atualiza taxa com threatStatus
bun run enrich:invasoras    # Atualiza taxa com invasiveStatus
bun run enrich:ucs          # Atualiza occurrences com conservationUnits
```

Cada enricher: carrega a(s) coleção(ões) de referência em memória, itera sobre a coleção alvo via cursor, aplica `$set` (match) ou `$unset` (sem match) em batches.

### Utilitários

```bash
bun run check-lock    # Verifica locks de transformação ativos
```

## Arquitetura

### Módulo de Lookup Compartilhado

`src/utils/lookup.ts` — Motor de matching reutilizável por todos os enrichers:

```typescript
import {
  createLookup, // Cria índice vazio { byId, byFlatName }
  addToLookup, // Adiciona entrada ao índice
  gatherLookupMatches, // Busca matches por ID e nome
  collectDocumentIds, // Extrai todos os IDs de um documento
  collectDocumentNames // Extrai todos os nomes de um documento
} from '../utils/lookup'
```

**Estratégia de matching duplo:**

- Por ID: campos `_id`, `taxonID`, `taxonId`, `taxon_id`, `identifier`, `id`
- Por nome normalizado: campos `canonicalName`, `scientificName`, `nome`, `nomeCientifico`, etc.

### Fluxo de Enriquecimento

```
Coleções de Referência (ex: faunaAmeacada)
    ↓ materializeCollection()
Documentos carregados em memória
    ↓ collectDocumentIds() + collectDocumentNames()
IndexedLookup { byId: Map, byFlatName: Map }
    ↓
Cursor sobre taxa/occurrences
    ↓ gatherLookupMatches()
Matches encontrados → $set { threatStatus/invasiveStatus/conservationUnits }
Sem match → $unset (se campo existia)
    ↓
bulkWrite em batches de 2000
```

## Estrutura do Código

```
src/
├── index.ts                          # Exports públicos
├── cli/
│   ├── runTransform.ts               # Orquestrador CLI (para pipelines com lock)
│   ├── checkLock.ts                  # Utilitário de locks
│   ├── register.ts                   # Registro de pipelines CLI
│   ├── transformTaxa.ts              # Pipeline de re-normalização de taxa
│   └── transformOccurrences.ts       # Pipeline de re-normalização de ocorrências
├── enrichment/
│   ├── enrichAmeacadas.ts            # Enriquece taxa com threatStatus
│   ├── enrichInvasoras.ts            # Enriquece taxa com invasiveStatus
│   └── enrichUCs.ts                  # Enriquece occurrences com conservationUnits
├── loaders/
│   ├── loadFaunaAmeacada.ts          # CSV → faunaAmeacada
│   ├── loadPlantaeAmeacada.ts        # CSV → plantaeAmeacada
│   ├── loadFungiAmeacada.ts          # CSV → fungiAmeacada
│   ├── loadInvasoras.ts              # CSV → invasoras
│   └── loadCatalogoUCs.ts            # CSV → catalogoucs
├── taxa/
│   ├── transformTaxonRecord.ts       # Normalização inline (usada pela ingestão)
│   ├── normalizeTaxon.ts             # Normalizações (canonicalName, etc.)
│   ├── enrichTaxon.ts                # Enriquecimento (usado pelo pipeline de re-normalização)
│   └── transforms/
│       └── pipeline.ts               # Pipeline de normalização em 11 etapas
├── occurrences/
│   ├── transformOccurrenceRecord.ts  # Normalização inline (usada pela ingestão)
│   ├── normalizeOccurrence.ts        # Normalizações (geoPoint, datas, estados)
│   ├── enrichOccurrence.ts           # Enriquecimento (taxon lookup, Brasil)
│   └── transforms/
│       └── pipeline.ts               # Pipeline de normalização em 12 etapas
├── utils/
│   ├── lookup.ts                     # Motor de matching compartilhado
│   └── name.ts                       # Normalização de nomes científicos
└── lib/
    ├── concurrency.ts                # Sistema de locks MongoDB
    ├── database.ts                   # Conexão MongoDB
    ├── metrics.ts                    # Registro de métricas
    └── orchestrator.ts               # Orquestrador de pipelines
```

## Coleções de Referência

| Coleção           | Loader                  | Enricher           | Campo em taxa/occurrences       |
| ----------------- | ----------------------- | ------------------ | ------------------------------- |
| `faunaAmeacada`   | `load:fauna-ameacada`   | `enrich:ameacadas` | `taxa.threatStatus`             |
| `plantaeAmeacada` | `load:plantae-ameacada` | `enrich:ameacadas` | `taxa.threatStatus`             |
| `fungiAmeacada`   | `load:fungi-ameacada`   | `enrich:ameacadas` | `taxa.threatStatus`             |
| `invasoras`       | `load:invasoras`        | `enrich:invasoras` | `taxa.invasiveStatus`           |
| `catalogoucs`     | `load:catalogo-ucs`     | `enrich:ucs`       | `occurrences.conservationUnits` |

## Formato dos Campos de Enriquecimento

### `threatStatus` (em taxa)

```javascript
threatStatus: [
  { source: 'faunaAmeacada', category: 'Em Perigo (EN)' }
  // pode ter múltiplas fontes
]
```

### `invasiveStatus` (em taxa)

```javascript
invasiveStatus: {
  source: "invasoras",
  isInvasive: true,
  notes: "observação opcional"
}
```

### `conservationUnits` (em occurrences)

```javascript
conservationUnits: [{ ucName: 'Parque Nacional da Amazônia' }]
```

## Dependências

- `@darwincore/shared` — Utilitários compartilhados (database, IDs, métricas)
- `mongodb` — Driver MongoDB
- `cli-progress` — Barras de progresso CLI
- `papaparse` — Parser CSV

## Troubleshooting

### Coleção de referência vazia

```
Coleção 'faunaAmeacada' vazia ou inexistente, pulando.
```

Execute o loader correspondente antes de rodar o enricher:

```bash
bun run load:fauna-ameacada -- packages/ingest/chatbb/fontes/fauna-ameacada-2021.csv
bun run enrich:ameacadas
```

### Lock stuck (pipelines de normalização)

```bash
bun run check-lock
```

### Re-enriquecimento completo

Os enrichers são idempotentes. Execute quantas vezes necessário:

```bash
bun run enrich:ameacadas && bun run enrich:invasoras && bun run enrich:ucs
```

## Como Adicionar um Novo Tema de Enriquecimento

Para adicionar um novo tema (ex: DNA/barcoding, princípios ativos, uso por comunidades tradicionais):

1. **Criar o loader** em `src/loaders/loadNovoTema.ts`:
   - Ler o CSV do caminho fornecido como argumento CLI
   - Fazer `drop + insert` na coleção de referência no MongoDB
   - Criar índices relevantes na coleção

2. **Criar o enricher** em `src/enrichment/enrichNovoTema.ts`:
   - Carregar a coleção de referência em memória via `materializeCollection()`
   - Construir um `IndexedLookup` usando `createLookup()` + `addToLookup()`
   - Iterar sobre a coleção alvo (`taxa` ou `occurrences`) via cursor
   - Para cada documento, usar `gatherLookupMatches()` para encontrar matches
   - Aplicar `$set` (com match) ou `$unset` (sem match) em batches via `bulkWrite`

3. **Registrar os scripts** em `packages/transform/package.json` e no `package.json` raiz:
   - `load:novo-tema` — script do loader
   - `enrich:novo-tema` — script do enricher

4. **Documentar** o novo tema na tabela de Coleções de Referência acima

O motor de matching (`src/utils/lookup.ts`) é reutilizável e suporta matching por ID e por nome normalizado.
