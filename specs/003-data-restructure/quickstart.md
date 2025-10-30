# Quickstart: Reestruturação de Dados

**Feature**: 003-data-restructure  
**Date**: 2025-10-29  
**Audience**: Desenvolvedores implementando ou validando a feature

## Pré-requisitos

- Node.js v20.19.4+
- Bun instalado (`curl -fsSL https://bun.sh/install | bash`)
- MongoDB rodando e acessível
- Variável de ambiente `MONGO_URI` configurada

## Setup Inicial

### 1. Instalar Dependências

```powershell
# No diretório raiz do projeto
cd e:\Biodiversidade-Online
bun install
```

**Tempo esperado**: ~56 segundos

### 2. Configurar MongoDB

```powershell
# Copiar arquivo de exemplo de ambiente
cp packages/web/.env.example packages/web/.env

# Editar .env e configurar MONGO_URI
# Exemplo: MONGO_URI=mongodb://localhost:27017/biodiversidade
```

### 3. Verificar Compilação TypeScript

```powershell
# No diretório raiz
bunx tsc --noEmit
```

**Resultado esperado**: Sem erros (warnings são aceitáveis)

---

## Fase 1: Ingestão de Dados Brutos

### 1.1 Ingerir Dados de Taxa (Flora)

```powershell
# Executar ingestão de Flora (cria/atualiza taxa_ipt)
bun run ingest:flora
```

**Tempo esperado**: 10-30 minutos (dependendo do tamanho do arquivo DwC-A)

**Validação**:

```javascript
// Conectar ao MongoDB e verificar
use biodiversidade
db.taxa_ipt.countDocuments()
// Deve retornar número de registros > 0

// Verificar estrutura de um documento
db.taxa_ipt.findOne()
// Deve conter: _id, taxonID, scientificName, kingdom, etc
```

### 1.2 Ingerir Dados de Taxa (Fauna)

```powershell
# Executar ingestão de Fauna (adiciona a taxa_ipt)
bun run ingest:fauna
```

**Validação**:

```javascript
// Verificar que registros de Animalia foram adicionados
db.taxa_ipt.countDocuments({ kingdom: 'Animalia' })
// Deve retornar número > 0
```

### 1.3 Ingerir Dados de Ocorrências

```powershell
# Executar ingestão de ocorrências (cria/atualiza occurrences_ipt)
bun run ingest:occurrences
```

**Tempo esperado**: 1-2 horas (507 recursos IPT)

**Validação**:

```javascript
// Verificar contagem de ocorrências raw
db.occurrences_ipt.countDocuments()
// Deve retornar número > 1 milhão

// Verificar estrutura
db.occurrences_ipt.findOne()
// Deve conter: _id (formato occurrenceID:iptId), occurrenceID, scientificName, etc
```

---

## Fase 2: Transformação de Dados

### 2.1 Transformar Dados de Taxa

```powershell
# Executar transformação de taxa (taxa_ipt → taxa)
bun run transform:taxa
```

**Tempo esperado**: <30 minutos

**Validação**:

```javascript
// Verificar contagem (deve ser <= taxa_ipt por causa de filtros)
db.taxa.countDocuments()
db.taxa_ipt.countDocuments()
// taxa count deve ser menor (apenas ESPECIE, VARIEDADE, etc)

// Verificar campos transformados
db.taxa.findOne({ scientificName: /Panthera onca/ })
// Deve conter: canonicalName, flatScientificName, distribution processado

// CRÍTICO: Verificar rastreabilidade de _id
const taxaId = db.taxa.findOne()._id
db.taxa_ipt.findOne({ _id: taxaId })
// Deve retornar o documento raw correspondente
```

### 2.2 Transformar Dados de Ocorrências

```powershell
# Executar transformação de ocorrências (occurrences_ipt → occurrences)
bun run transform:occurrences
```

**Tempo esperado**: <1 hora

**Validação**:

```javascript
// Verificar contagem (pode ser < occurrences_ipt se filtragem de país aplicada)
db.occurrences.countDocuments()

// Verificar campos transformados
db.occurrences.findOne({ geoPoint: { $exists: true } })
// Deve conter: geoPoint (GeoJSON), year/month/day como números, stateProvince normalizado

// Verificar vinculação taxonômica
db.occurrences.findOne({ taxonID: { $exists: true } })
// taxonID deve existir em db.taxa

// CRÍTICO: Verificar rastreabilidade de _id
const occId = db.occurrences.findOne()._id
db.occurrences_ipt.findOne({ _id: occId })
// Deve retornar o documento raw correspondente
```

### 2.3 Verificar Integridade de \_id

```javascript
// Validar que TODO _id em taxa existe em taxa_ipt
const taxaIds = db.taxa.distinct('_id')
const taxaIptIds = db.taxa_ipt.distinct('_id')
const orphanedTaxa = taxaIds.filter((id) => !taxaIptIds.includes(id))
orphanedTaxa.length
// Deve ser 0 (nenhum registro transformado sem raw source)

// Mesmo para occurrences
const occIds = db.occurrences.distinct('_id')
const occIptIds = db.occurrences_ipt.distinct('_id')
const orphanedOcc = occIds.filter((id) => !occIptIds.includes(id))
orphanedOcc.length
// Deve ser 0
```

---

## Fase 3: Testar APIs

### 3.1 Iniciar Servidor de Desenvolvimento

```powershell
# No diretório packages/web
cd packages/web
bun run dev
```

**URL**: http://localhost:4321/

### 3.2 Testar API de Taxa

```powershell
# Listar táxons (todos)
curl http://localhost:4321/api/taxa?limit=10

# Buscar por nome científico
curl "http://localhost:4321/api/taxa?scientificName=Panthera%20onca"

# Filtrar por reino
curl http://localhost:4321/api/taxa?kingdom=Animalia&limit=5

# Obter táxon por ID
curl http://localhost:4321/api/taxa/taxon-12345

# Contar táxons
curl "http://localhost:4321/api/taxa/count?family=Felidae"
```

**Resultado esperado**: JSON com `data` array e `pagination` object

### 3.3 Testar API de Ocorrências

```powershell
# Listar ocorrências
curl http://localhost:4321/api/occurrences?limit=10

# Filtrar por estado
curl "http://localhost:4321/api/occurrences?stateProvince=São%20Paulo&limit=5"

# Buscar por bounding box
curl "http://localhost:4321/api/occurrences?bbox=-46.5,-23.7,-46.3,-23.5"

# Apenas com coordenadas
curl "http://localhost:4321/api/occurrences?hasCoordinates=true&limit=10"

# Contar ocorrências
curl "http://localhost:4321/api/occurrences/count?year=2023"

# GeoJSON para mapa
curl "http://localhost:4321/api/occurrences/geojson?bbox=-50,-25,-45,-20&limit=1000"
```

**Resultado esperado**: JSON com dados de ocorrências e paginação

---

## Fase 4: Validar Interface Web

### 4.1 Taxa Search Page

1. Acessar: http://localhost:4321/taxa
2. Digitar "Panthera onca" na busca
3. Verificar resultados carregados
4. Clicar em um resultado e verificar detalhes

**Resultado esperado**: Busca funciona, resultados são exibidos, página de detalhes carrega

### 4.2 Map Page

1. Acessar: http://localhost:4321/mapa
2. Aplicar filtro (ex: "São Paulo")
3. Verificar pontos renderizados no mapa
4. Clicar em um ponto e verificar popup com dados

**Resultado esperado**: Mapa carrega, filtros funcionam, pontos são plotados corretamente

### 4.3 Dashboard Page

1. Acessar: http://localhost:4321/dashboard
2. Verificar que estatísticas são exibidas
3. Verificar gráficos carregam

**Resultado esperado**: Dashboard exibe dados atualizados das novas collections

### 4.4 Tree View Page

1. Acessar: http://localhost:4321/tree
2. Expandir nós da árvore taxonômica
3. Navegar pela hierarquia (Reino → Filo → Classe → Ordem → Família)

**Resultado esperado**: Árvore carrega hierarquia corretamente

### 4.5 Chat Interface

1. Acessar: http://localhost:4321/chat
2. Fazer pergunta: "Quantas espécies de felídeos existem no Brasil?"
3. Verificar resposta do ChatBB

**Resultado esperado**: ChatBB consulta collections transformadas e responde corretamente

---

## Fase 5: Verificar Métricas e Concurrency

### 5.1 Verificar Métricas de Processos

```javascript
// Verificar métricas registradas
db.process_metrics.find().sort({ started_at: -1 }).limit(5)
// Deve retornar últimas 5 execuções com duração, contagens, etc

// Verificar métricas de transformação específica
db.process_metrics.find({ process_type: 'transform_taxa' })
```

### 5.2 Verificar Controle de Concorrência

```javascript
// Verificar estado de lock
db.transform_status.find()
// Deve mostrar status de processos (completed, running, ou failed)

// Durante execução de transform, verificar que lock está ativo
// db.transform_status.findOne({process_type: 'taxa', status: 'running'})
```

---

## Validação de Sucesso da Feature

✅ **User Story 1**: Ingestão de taxa completa, `taxa_ipt` contém registros DwC brutos  
✅ **User Story 2**: Ingestão de ocorrências completa, `occurrences_ipt` contém 507 IPTs  
✅ **User Story 3**: Transformação de taxa completa, `taxa` contém registros enriquecidos  
✅ **User Story 4**: Transformação de ocorrências completa, `occurrences` com geoPoint válidos  
✅ **User Story 5**: APIs expostas e documentadas, Swagger funciona  
✅ **User Story 6**: Interface web adaptada, todas as páginas funcionam

### Success Criteria Checks

```javascript
// SC-003: 100% dos registros em taxa possuem _id idêntico a taxa_ipt
db.taxa.countDocuments() ===
  db.taxa
    .aggregate([
      {
        $lookup: {
          from: 'taxa_ipt',
          localField: '_id',
          foreignField: '_id',
          as: 'raw'
        }
      },
      { $match: { 'raw.0': { $exists: true } } },
      { $count: 'matched' }
    ])
    .next().matched
// Deve retornar true

// SC-004: 100% dos registros em occurrences possuem _id idêntico a occurrences_ipt
db.occurrences.countDocuments() ===
  db.occurrences
    .aggregate([
      {
        $lookup: {
          from: 'occurrences_ipt',
          localField: '_id',
          foreignField: '_id',
          as: 'raw'
        }
      },
      { $match: { 'raw.0': { $exists: true } } },
      { $count: 'matched' }
    ])
    .next().matched
// Deve retornar true

// SC-007: 100% dos registros com eventDate válido possuem year/month/day
db.occurrences.countDocuments({
  eventDate: { $exists: true, $type: 'date' },
  year: { $exists: true, $type: 'number' },
  month: { $exists: true, $type: 'number' },
  day: { $exists: true, $type: 'number' }
})
// Deve ser > 0 e próximo de total com eventDate

// SC-008: 100% dos estados em stateProvince são harmonizados
db.occurrences.distinct('stateProvince')
// Deve retornar apenas nomes completos oficiais (ex: "São Paulo", "Rio de Janeiro")
```

---

## Troubleshooting

### Problema: Ingestão de IPT falha com timeout

**Solução**: Verificar `failedIpts Set` - alguns IPT servers podem estar offline temporariamente. Re-executar ingestão irá pular servers falhados.

### Problema: Transformação falha com "Lock already acquired"

**Solução**: Verificar `transform_status` collection:

```javascript
db.transform_status.find({ status: 'running' })
// Se lock está obsoleto (updated_at > 2 horas atrás):
db.transform_status.updateOne(
  { process_type: 'taxa' },
  { $set: { status: 'failed', error_message: 'Manual unlock - obsolete lock' } }
)
```

### Problema: APIs retornam dados vazios

**Solução**: Verificar que transformações foram executadas:

```javascript
db.taxa.countDocuments()
db.occurrences.countDocuments()
// Se 0, executar bun run transform:taxa e transform:occurrences
```

### Problema: TypeScript compilation errors

**Solução**: Verificar que novo pacote `packages/transform` tem `tsconfig.json` correto e está referenciado no root `tsconfig.json`.

---

## Próximos Passos

Após validação do quickstart:

1. ✅ Executar `/tasks` command para gerar `tasks.md`
2. 📝 Implementar tasks em ordem (TDD: tests → implementation)
3. 🔄 Executar este quickstart novamente como teste de regressão
4. 🚀 Deploy para produção via GitHub Actions

---

## Checklist de Validação Final

Use este checklist para validar a implementação completa da feature 003-data-restructure:

### ✅ Infraestrutura e Setup

- [ ] Monorepo configurado com 3 packages: ingest, transform, web
- [ ] Root `package.json` possui scripts: `ingest:flora`, `ingest:fauna`, `ingest:occurrences`, `transform:taxa`, `transform:occurrences`, `transform:check-lock`
- [ ] TypeScript compila sem erros: `bunx tsc --noEmit`
- [ ] Dependências instaladas com sucesso: `bun install`
- [ ] MongoDB acessível e `MONGO_URI` configurado

### ✅ US1: Ingestão de Taxa (Flora e Fauna)

- [ ] Script `bun run ingest:flora` executa sem erros
- [ ] Script `bun run ingest:fauna` executa sem erros
- [ ] Coleção `taxa_ipt` existe e contém > 250.000 registros
- [ ] Registros possuem `_id` baseado em `taxonID`
- [ ] Ambos Plantae e Animalia presentes: `db.taxa_ipt.distinct('kingdom')`
- [ ] Métricas registradas em `process_metrics` collection

### ✅ US2: Ingestão de Ocorrências

- [ ] Script `bun run ingest:occurrences` processa ~490+ IPTs
- [ ] Coleção `occurrences_ipt` existe e contém > 1 milhão de registros
- [ ] Registros possuem `_id` determinístico (occurrenceID + iptId)
- [ ] Campo `iptId` presente em todos os registros
- [ ] Métricas registradas em `process_metrics` collection

### ✅ US3: Transformação de Taxa

- [ ] Script `bun run transform:taxa` executa sem erros
- [ ] Coleção `taxa` existe com registros filtrados (apenas ESPECIE, VARIEDADE, etc)
- [ ] Campo `canonicalName` presente e normalizado
- [ ] Campo `flatScientificName` criado corretamente
- [ ] Array `vernacularname` processado
- [ ] Campo `distribution` com `origin` e `occurrence` arrays
- [ ] Enriquecimentos aplicados: `threatStatus`, `invasiveStatus`
- [ ] **CRÍTICO**: Todo `taxa._id` existe em `taxa_ipt._id`
- [ ] Lock registrado em `transform_status` durante execução
- [ ] Métricas registradas em `process_metrics`

### ✅ US4: Transformação de Ocorrências

- [ ] Script `bun run transform:occurrences` executa sem erros
- [ ] Coleção `occurrences` existe
- [ ] Campo `geoPoint` criado com formato GeoJSON para registros com coordenadas válidas
- [ ] Campos `year`, `month`, `day` convertidos para números
- [ ] Campo `country` normalizado para "Brasil"
- [ ] Campo `stateProvince` normalizado (nomes completos, não siglas)
- [ ] Array `iptKingdoms` criado a partir de campo CSV
- [ ] Vinculação com `taxa` via `taxonID` funcionando
- [ ] **CRÍTICO**: Todo `occurrences._id` existe em `occurrences_ipt._id`
- [ ] Filtro de país aplicado (apenas registros do Brasil)
- [ ] Lock registrado em `transform_status` durante execução
- [ ] Métricas registradas em `process_metrics`

### ✅ US5: APIs RESTful

- [ ] Endpoint GET `/api/taxa` retorna lista paginada
- [ ] Endpoint GET `/api/taxa/{taxonID}` retorna táxon específico
- [ ] Endpoint GET `/api/taxa/count` retorna contagem
- [ ] Endpoint GET `/api/occurrences` retorna lista paginada
- [ ] Endpoint GET `/api/occurrences/{occurrenceID}` retorna ocorrência específica
- [ ] Endpoint GET `/api/occurrences/count` retorna contagem
- [ ] Endpoint GET `/api/occurrences/geojson` retorna GeoJSON válido
- [ ] Filtros funcionam corretamente em todas as APIs
- [ ] Paginação funciona (limit, offset)
- [ ] `/api/docs` ou `/public/api-spec.json` atualizado com novos endpoints

### ✅ US6: Interface Web

- [ ] `/taxa` - Busca de espécies funciona, usa API `/api/taxa`
- [ ] `/mapa` - Mapa carrega e exibe distribuição por estado
- [ ] `/dashboard` - Dashboard exibe estatísticas das collections transformadas
- [ ] `/tree` - Árvore taxonômica carrega hierarquia de `taxa` collection
- [ ] `/chat` - ChatBB consulta collections transformadas via MCP
- [ ] `prompt.md` atualizado com referências a `taxa`/`occurrences` (não `ocorrencias`)
- [ ] Cache do dashboard regenerado: `bun run cache-dashboard`

### ✅ Automação e CI/CD

- [ ] Workflow `.github/workflows/transform-taxa.yml` existe
- [ ] Workflow `.github/workflows/transform-occurrences.yml` existe
- [ ] Workflow `update-mongodb-flora.yml` chama `transform-taxa.yml` após ingestão
- [ ] Workflow `update-mongodb-fauna.yml` chama `transform-taxa.yml` após ingestão
- [ ] Workflow `update-mongodb-occurrences.yml` chama `transform-occurrences.yml` após ingestão
- [ ] Workflows podem ser executados manualmente (workflow_dispatch)

### ✅ Documentação

- [ ] `README.md` atualizado com arquitetura raw → transform
- [ ] `README.md` documenta novos comandos CLI
- [ ] `docs/atualizacao.md` atualizado com fluxo de duas fases
- [ ] `docs/atualizacao.md` documenta métricas e controle de concorrência
- [ ] `packages/web/README.md` documenta APIs e fluxo de dados
- [ ] `specs/003-data-restructure/quickstart.md` validado (este arquivo)

### ✅ Rastreabilidade e Auditoria (CRÍTICO)

- [ ] Validação 100%: `db.taxa.countDocuments() === db.taxa.aggregate([{$lookup:{from:'taxa_ipt', localField:'_id', foreignField:'_id', as:'raw'}}, {$match:{'raw.0':{$exists:true}}}, {$count:'c'}]).next().c`
- [ ] Validação 100%: `db.occurrences.countDocuments() === db.occurrences.aggregate([{$lookup:{from:'occurrences_ipt', localField:'_id', foreignField:'_id', as:'raw'}}, {$match:{'raw.0':{$exists:true}}}, {$count:'c'}]).next().c`
- [ ] Nenhum registro órfão em collections transformadas
- [ ] Processo de transformação é idempotente (pode ser re-executado sem duplicatas)

### ✅ Testes Manuais End-to-End

- [ ] Executar ingestão completa: flora → fauna → occurrences
- [ ] Executar transformação completa: taxa → occurrences
- [ ] Testar todas as páginas web em desenvolvimento: `bun run web:dev`
- [ ] Testar build de produção: `bun run web:build`
- [ ] Iniciar servidor de produção e validar funcionalidade
- [ ] Executar queries de auditoria no MongoDB (rastreabilidade de \_id)
- [ ] Verificar que `process_metrics` contém registros de todas as execuções

### ✅ Performance e Otimização

- [ ] Índices MongoDB criados corretamente
- [ ] Queries de API respondem em < 500ms (com dados locais)
- [ ] Dashboard carrega em < 2 segundos (usando cache)
- [ ] Transformações completam em tempo razoável (< 30 min para taxa, < 1h para occurrences)

---

**Total de Validações**: 90+  
**Tempo Estimado de Validação Completa**: 3-4 horas

---

**Version**: 1.0  
**Last Updated**: 2025-10-30  
**Estimated Total Time**: 3-4 horas (incluindo tempos de ingestão/transformação)
