# @darwincore/transform - Pipeline de Transformação

Pacote responsável pela transformação de dados brutos DwC-A em dados processados otimizados para consultas e APIs.

## Visão Geral

Este pacote implementa o **pipeline de transformação** que processa dados brutos das coleções `taxa_ipt` e `occurrences_ipt` aplicando:

- **Validações**: Geográficas, temporais, taxonômicas
- **Normalizações**: Padronização de campos e formatos
- **Enriquecimentos**: Status de ameaça, invasoras, UCs, vinculações taxonômicas
- **Otimização**: Índices e agregações para performance

## Arquitetura

### Funções Exportadas (Uso Inline)

O pacote exporta funções puras para uso durante ingestão:

```typescript
import {
  transformTaxonRecord,
  transformOccurrenceRecord
} from '@darwincore/transform'

// Durante ingestão - transformação inline
const rawTaxon = {
  /* dados de taxa_ipt */
}
const transformedTaxon = await transformTaxonRecord(rawTaxon, db)
await taxaCollection.insertOne(transformedTaxon)
```

### CLI para Re-transformação

Scripts CLI para re-processamento em massa quando lógica muda:

```bash
# Re-transformar todos dados taxonômicos
bun run transform:taxa

# Re-transformar todos dados de ocorrências
bun run transform:occurrences

# Verificar status de locks
bun run transform:check-lock
```

## Quando Incrementar Versão

**Incremente a versão** (`packages/transform/package.json`) quando modificar:

- Lógica de validação (geográfica, taxonômica, temporal)
- Regras de normalização (nomes, datas, localidades)
- Enriquecimentos (ameaça, invasoras, UCs)
- Vinculações taxonômicas ou filtros
- Estrutura de dados de saída

**Isso dispara automaticamente**:

- GitHub Actions workflow `transform-taxa.yml` (se houver mudanças em taxa)
- GitHub Actions workflow `transform-occurrences.yml` (se houver mudanças em occurrences)
- Re-transformação completa dos dados afetados
- Testes de regressão
- Deploy com dados atualizados

**Triggers Automáticos por Workflow**:

```yaml
# transform-taxa.yml dispara em:
- packages/transform/src/taxa/**
- packages/transform/package.json
- packages/shared/src/**

# transform-occurrences.yml dispara em:
- packages/transform/src/occurrences/**
- packages/transform/package.json
- packages/shared/src/**
```

**Exemplo de workflow de desenvolvimento**:

```bash
# 1. Modificar lógica de transformação
vim packages/transform/src/taxa/normalizeTaxon.ts

# 2. Incrementar versão (patch/minor/major)
cd packages/transform
npm version patch

# 3. Commit e push
git commit -am "feat: improve taxon normalization"
git push origin main

# 4. GitHub Actions automaticamente executa transform-taxa.yml
# Re-transforma todos os dados taxonômicos com a nova lógica
```

## Estrutura do Código

```
src/
├── index.ts                    # Exports públicos
├── cli/
│   ├── runTransform.ts         # CLI orquestrador
│   └── checkLock.ts            # Utilitário de locks
├── taxa/
│   ├── transformTaxa.ts        # Pipeline re-transform taxa_ipt → taxa
│   ├── transformTaxonRecord.ts # Função inline transformTaxonRecord()
│   ├── normalizeTaxon.ts       # Normalizações (canonicalName, etc.)
│   └── enrichTaxon.ts          # Enriquecimentos (ameaça, invasoras)
├── occurrences/
│   ├── transformOccurrences.ts # Pipeline re-transform occurrences_ipt → occurrences
│   ├── transformOccurrenceRecord.ts # Função inline transformOccurrenceRecord()
│   ├── normalizeOccurrence.ts  # Normalizações (geoPoint, datas)
│   └── enrichOccurrence.ts     # Enriquecimentos (taxon lookup, Brasil)
└── lib/
    ├── concurrency.ts          # Sistema de locks
    ├── database.ts             # Conexão MongoDB
    └── metrics.ts              # Registro de métricas
```

## Transformações Implementadas

### Taxa (transformTaxonRecord)

**Validações:**

- `taxonRank` válido (ESPECIE, GENERO, FAMILIA, etc.)
- `taxonomicStatus` = 'NOME_ACEITO'

**Normalizações:**

- `canonicalName`: Nome científico padronizado
- `vernacularName`: Nome vulgar em português
- `distribution`: Distribuição geográfica normalizada

**Enriquecimentos:**

- `threatStatus`: Status de ameaça (CNCFlora/MMA)
- `invasive`: Espécie invasora (Instituto Hórus)
- `protectedArea`: Ocorre em Unidades de Conservação

### Ocorrências (transformOccurrenceRecord)

**Validações:**

- Coordenadas geográficas válidas
- País = 'Brazil' (filtragem automática)
- Datas em formato ISO válido

**Normalizações:**

- `geoPoint`: GeoJSON Point com índice 2dsphere
- `eventDate`: Data padronizada ISO
- `stateProvince`: Estado brasileiro normalizado
- `municipality`: Município normalizado

**Enriquecimentos:**

- `taxonID`: Vinculação com táxon via scientificName
- `collectorName`: Nome do coletor padronizado
- `reproductiveCondition`: Condição reprodutiva

## Controle de Concorrência

Sistema de locks previne execuções simultâneas:

```typescript
// Lock automático durante re-transformação
await acquireLock('taxa-transform')

try {
  // Processamento...
} finally {
  await releaseLock('taxa-transform')
}
```

**Comandos de manutenção:**

```bash
# Verificar locks ativos
bun run transform:check-lock

# Forçar liberação (emergência)
bun run transform:check-lock --force
```

## Métricas e Monitoramento

Cada execução registra métricas em `process_metrics`:

```javascript
{
  operation: 'transform-taxa',
  startTime: ISODate(),
  duration: 125000, // ms
  recordsProcessed: 150000,
  recordsInserted: 148000,
  recordsUpdated: 2000,
  errors: 0
}
```

## Desenvolvimento

### Adicionando Nova Transformação

1. **Modificar função inline** (`transformTaxonRecord.ts` ou `transformOccurrenceRecord.ts`)
2. **Testar localmente** com dados de exemplo
3. **Incrementar versão** em `package.json`
4. **Commit e push** - GitHub Actions executará re-transformação automaticamente

### Testes

```bash
# Executar testes (se implementados)
bun test

# Testar pipeline completo
bun run transform:taxa --dry-run
```

## Dependências

- `@darwincore/shared`: Utilitários compartilhados (database, IDs, métricas)
- `mongodb`: Driver MongoDB
- `cli-progress`: Barras de progresso CLI

## Integração com Ingestão

O pacote é usado durante ingestão para transformação inline:

```typescript
// packages/ingest/src/flora.ts
import { transformTaxonRecord } from '@darwincore/transform'

for (const rawRecord of dwcRecords) {
  // Inserir raw
  await taxaIptCollection.insertOne(rawRecord)

  // Transformar inline
  const transformed = await transformTaxonRecord(rawRecord, db)
  await taxaCollection.insertOne(transformed)
}
```

## Troubleshooting

### Lock Stuck

```bash
bun run transform:check-lock --force
```

### Performance Issues

- Verificar índices em coleções transformadas
- Monitorar métricas em `process_metrics`
- Considerar processamento em batches menores

### Dados Inconsistentes

- Comparar `_id` entre coleções raw/transform
- Verificar logs de erro na transformação
- Re-executar transformação: `bun run transform:taxa`</content>
  <parameter name="filePath">e:\Biodiversidade-Online\packages\transform\README.md
