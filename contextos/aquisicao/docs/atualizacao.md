# Atualização da Base de Dados

Procedimento operacional para atualizar `dwc2json` a partir das fontes IPT.

## Visão geral

V7 = pipeline integrado em **um único processo Go** por fonte. Não há etapa separada de "transform" — toda a normalização ocorre inline durante a ingestão.

| Binário | Coleção alvo | Fonte |
|---|---|---|
| `update-flora` | `taxa` (`source:"flora"`) | DwC-A único — Flora e Funga do Brasil |
| `update-fauna` | `taxa` (`source:"fauna"`) | DwC-A único — Catálogo Taxonômico da Fauna |
| `update-occurrences` | `occurrences` (`source:<tag>`) | 505+ DwC-A listados em `data/occurrences.csv` |

## Pré-requisitos

1. `.env` em `contextos/aquisicao/` (copiar de `contextos/comum/.env.example`):
   ```dotenv
   MONGO_URI=mongodb://user:pass@host:27017/?authSource=admin
   MONGO_DB=dwc2json
   IPT_FAUNA_URL=https://ipt.jbrj.gov.br/jbrj/archive.do?r=catalogo_taxonomico_da_fauna_do_brasil
   IPT_FLORA_URL=https://ipt.jbrj.gov.br/jbrj/archive.do?r=lista_especies_flora_brasil
   HTTP_TIMEOUT_MIN=30
   BULK_BATCH_SIZE=5000
   ```

2. Binários compilados em `bin/`:
   ```bash
   # Windows
   go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\update-fauna
   go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\update-flora
   go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\update-occurrences

   # Linux
   GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/ ./cmd/update-fauna ./cmd/update-flora ./cmd/update-occurrences
   ```

3. MongoDB acessível e usuário com permissão de `readWrite` em `dwc2json`.

## Comandos

### Atualização padrão

```bash
./bin/update-flora           # ~10 min, ~50K taxa após filtro de rank
./bin/update-fauna           # ~5 min, ~120K taxa após filtro de rank
./bin/update-occurrences     # 1–3 horas (depende de quantos IPTs têm versão nova)
```

### Dry-run (sem MongoDB)

```bash
./bin/update-flora --dry-run --verbose
```

Útil para validar conectividade, parsing e contadores sem escrever no banco.

### Verbose / JSON logging

```bash
./bin/update-flora --verbose --log-format json
```

### Filtro de fontes (apenas `update-occurrences`)

```bash
./bin/update-occurrences --filter inpa_herbario,mpeg_botanica
```

Processa apenas as tags listadas (separadas por vírgula).

## Quando rodar

| Frequência sugerida | Comando | Motivo |
|---|---|---|
| Mensal | `update-flora` | Flora do Brasil publica versões com baixa frequência |
| Mensal | `update-fauna` | Idem |
| Semanal ou mensal | `update-occurrences` | Coleções publicam atualizações em ritmos variados |
| Ad hoc | qualquer um | Após mudança no pipeline, reprocessamento manual |

## O que cada execução faz

1. **Download** do DwC-A para cache local (`os.UserCacheDir()/biodiversidade`).
2. **Parse** de `meta.xml` (descobre core + extensões) e `eml.xml` (versão, título).
3. **Verifica versão** vs. último `RunRecord` bem-sucedido. Se idêntica, **loga warning mas continua** (operador pode forçar reprocessamento).
4. **Lê core** linha a linha (`taxon.txt` ou `occurrence.txt`).
5. **Para taxa** (fauna/flora): filtra por `taxonRank` (apenas espécie/sub-espécie/variedade/forma) e mescla extensões (distribution, vernacular, speciesprofile, references, types, sinonímias).
6. **BulkUpsert** em lotes (`BULK_BATCH_SIZE`, default 5000) com `_id` determinístico.
7. **Delete-not-seen** — remove docs com `source==<source>` cuja `_runId` não bate com o run atual.
8. **Grava `RunRecord`** em `ingest_runs` com contadores, duração, warnings, status.

## Reprocessamento

V7 não separa "ingest" de "transform". Para reprocessar, apenas re-execute o binário:

```bash
./bin/update-flora    # baixa de novo (ou usa cache), reprocessa, faz upsert
```

O cache de download é reutilizado se o ZIP local for mais novo que `HTTP_TIMEOUT_MIN` minutos. Para forçar download fresh, delete `os.UserCacheDir()/biodiversidade/<source>.zip`.

## Códigos de saída

| Código | Significado |
|---|---|
| 0 | Sucesso |
| 1 | Erro genérico não classificado |
| 2 | Erro de configuração (`.env` inválido, variável obrigatória ausente) |
| 3 | Falha de download (HTTP, timeout, 404) |
| 4 | Erro de parsing do DwC-A (zip corrompido, meta.xml ausente, etc.) |
| 5 | Erro do MongoDB (conexão, BulkWrite, etc.) |

Use `echo $?` (Linux) ou `$LASTEXITCODE` (PowerShell) após cada execução para validar.

## Auditoria

Cada execução grava em `ingest_runs`. Para inspecionar a última execução de uma fonte:

```javascript
db.ingest_runs.find({ source: "flora" }).sort({ startedAt: -1 }).limit(1).pretty()
```

Para listar runs falhados nos últimos 7 dias:

```javascript
db.ingest_runs.find({
  status: "failed",
  startedAt: { $gte: new Date(Date.now() - 7*86400*1000) }
})
```

## Diferenças vs. V6

| Aspecto | V6 (Bun/TS) | V7 (Go) |
|---|---|---|
| Runtime | Bun + Node.js | Binários estáticos |
| CI/CD | GitHub Actions semanal | Execução manual |
| Pipeline | Ingest separado de Transform | Integrado |
| Coleções raw | `taxa_ipt`, `occurrences_ipt` | Removidas — `taxa` já vem normalizada |
| Locks | `transform_status`, `processingLocks` | Sem locks (operador coordena) |
| Métricas | `process_metrics` separada | Consolidadas em `ingest_runs` |
| Enriquecimento (CNCFlora, etc.) | Inline no transform | Movido para Contexto **Enriquecimento** (futuro) |
