# Phase 0 Research — Refatoração para Aquisição Apenas

**Date**: 2026-05-05
**Spec**: [spec.md](./spec.md)

Este documento consolida as decisões técnicas resolvidas durante a fase de pesquisa. Todas as `NEEDS CLARIFICATION` apontadas no `Technical Context` do `plan.md` são resolvidas aqui.

---

## 1. Linguagem e versão

**Decision**: **Go 1.22+** (mínimo 1.22, recomendado 1.23+).

**Rationale**:

- Já decidido na clarificação do spec; aqui fixamos versão mínima.
- Go 1.21 introduziu `log/slog` (logging estruturado nativo); 1.22 introduziu range-over-func (não usaremos, mas confirma estabilidade); 1.23 melhorou `archive/zip` para arquivos grandes.
- Go gera `.exe` autocontido para Windows via `GOOS=windows GOARCH=amd64 go build`, atendendo FR-014.
- Compilação em segundos, deps mínimas, ecossistema padrão para data tooling.

**Alternatives considered**: Rust (curva alta), .NET AOT (lock-in), Bun (já é o atual; refator quer mudança).

---

## 2. Driver MongoDB

**Decision**: **`go.mongodb.org/mongo-driver/v2`** (v2.x, lançado 2024, GA estável).

**Rationale**:

- Driver oficial mantido pela MongoDB. v2 é a linha atual; v1 entra em modo manutenção.
- API limpa: `mongo.Connect(options.Client().ApplyURI(uri))` retorna `*mongo.Client` sem `context` no construtor (mais ergonômico).
- `BulkWrite` com `mongo.NewReplaceOneModel().SetUpsert(true)` cobre o "upsert por chave estável" (FR-009) em uma única chamada por lote.
- Suporta `DeleteMany` para remover registros não vistos no DwC-A atual (filtrando por `source` + `ingestedAt < runStartedAt`).
- Inclui `bson.D` / `bson.M` nativos sem dependências terceirizadas.

**Alternatives considered**:

- `mgo`/`globalsign/mgo`: deprecated, sem suporte ao MongoDB moderno.
- `qmgo`: wrapper sobre o driver oficial; adiciona deps sem ganho relevante neste projeto.

**Reference patterns** (validados via Context7):

```go
import (
    "go.mongodb.org/mongo-driver/v2/bson"
    "go.mongodb.org/mongo-driver/v2/mongo"
    "go.mongodb.org/mongo-driver/v2/mongo/options"
)

client, _ := mongo.Connect(options.Client().ApplyURI(uri))
defer client.Disconnect(ctx)

models := []mongo.WriteModel{
    mongo.NewReplaceOneModel().
        SetFilter(bson.D{{Key: "_id", Value: taxonID}}).
        SetReplacement(doc).
        SetUpsert(true),
    // ...
}
opts := options.BulkWrite().SetOrdered(false)
res, err := coll.BulkWrite(ctx, models, opts)
```

---

## 3. Parser de Darwin Core Archive

**Decision**: **Implementação nativa** usando stdlib (`archive/zip`, `encoding/xml`, `encoding/csv`).

**Rationale**:

- Não há lib Go consolidada para DwC-A. Implementações que existem são abandonadas ou pré-Go 1.20.
- DwC-A é um formato simples: ZIP com `meta.xml` (descreve schema dos arquivos), `eml.xml` (metadados do dataset), e arquivos `*.txt`/`*.csv` (dados core + extensões).
- `meta.xml` segue o XML schema GBIF (`http://rs.tdwg.org/dwc/text/`) — mapeável diretamente para tipos Go com `encoding/xml`.
- Implementação nativa = zero deps externas para o componente mais crítico, máxima auditabilidade, e sem risco de supply-chain (FR-016).
- Streaming CSV via `csv.Reader.Read()` linha-a-linha satisfaz SC-010 (memória estável).

**Alternatives considered**:

- Bibliotecas GBIF Java: fora do stack.
- Pré-extrair via `unzip` externo: introduz dependência de PATH no Windows.

**Implementation notes**:

- `archive/zip.OpenReader(zipPath)` para acesso aleatório, `Reader.Open(name)` para abrir entradas.
- `meta.xml`: parsear `<core>`, `<extension>`, atributos `rowType`, `fieldsTerminatedBy`, `linesTerminatedBy`, `encoding`, `ignoreHeaderLines`, e `<field index="N" term="...">` para mapear coluna→termo DwC.
- Encoding padrão UTF-8; respeitar `encoding="..."` se diferente (alguns IPTs publicam Latin-1).

---

## 4. Carregamento de `.env`

**Decision**: **`github.com/joho/godotenv`** (v1.5.x).

**Rationale**:

- De facto standard em Go para `.env`.
- Lib pequena (~300 LOC), sem deps transitivas, manutenção ativa, score alto em auditoria.
- API mínima: `godotenv.Load()` carrega para `os.Environ`; programa lê com `os.Getenv("MONGO_URI")`.
- Falha silenciosamente se `.env` ausente; pipeline valida explicitamente após o `Load()` para emitir mensagem clara (FR-013, edge case "`.env` ausente").

**Alternatives considered**:

- Implementação manual (parser .env): ~50 LOC, viável, mas reinventar lib auditada não traz benefício.
- `viper`: pesado para o escopo, traz YAML/JSON/TOML que não usaremos.

---

## 5. Logging

**Decision**: **stdlib `log/slog`** com handler de texto colorido em ambiente de terminal.

**Rationale**:

- Disponível desde Go 1.21, sem deps externas.
- Suporta níveis (`Debug`/`Info`/`Warn`/`Error`), atributos estruturados, e múltiplos handlers.
- Formato texto satisfaz "verbose, legível pelo operador" (FR-006). JSON pode ser ativado com env var (`LOG_FORMAT=json`) para uso futuro em pipelines, sem custo adicional.
- Respeita `LOG_LEVEL` env var.

**Alternatives considered**:

- `zap`/`zerolog`: mais rápidos, mas para CLI manual com 1 linha/segundo o overhead do stdlib é irrelevante.

---

## 6. Parsing de argumentos CLI

**Decision**: **stdlib `flag`** (sem libs externas como `cobra`/`urfave-cli`).

**Rationale**:

- Cada um dos 3 binários tem ≤2 flags (`--dry-run`, `--config`). `flag` cobre 100% sem boilerplate.
- Reduz superfície de ataque (FR-016).

**Alternatives considered**: `cobra` — útil para CLIs grandes com subcomandos; aqui são 3 binários independentes, não uma CLI única.

---

## 7. Estrutura de módulo Go

**Decision**: Layout **standard `cmd/` + `internal/`**.

```
cmd/
├── update-fauna/main.go
├── update-flora/main.go
└── update-occurrences/main.go
internal/
├── config/      # Carrega .env, valida MONGO_URI / IPT_*_URL
├── dwca/        # Parser DwC-A (zip, meta.xml, eml.xml, csv reader)
├── ingest/      # Pipeline: download → parse → transform → bulk upsert
├── mongostore/  # Cliente Mongo, upsert+delete-not-seen, ingest_runs writer
└── verbose/     # Helpers de log estruturado (slog wrappers)
```

**Rationale**:

- `internal/` impede uso externo dos pacotes — garantia de coesão.
- Cada `cmd/` é praticamente um `main.go` chamando `ingest.Run(source)`. Os 3 binários compartilham 100% do código.
- `go build ./cmd/...` produz os 3 `.exe` em uma chamada (FR-020 / SC-005).

**Alternatives considered**:

- Um único binário com subcomandos (`bio update fauna`): mais elegante, mas o spec lista 3 nomes explícitos ("Update MongoDB - Fauna/Flora/Ocorrências"). Manter 3 executáveis dá fidelidade aos nomes que o operador conhece.

---

## 8. Estratégia de download do DwC-A

**Decision**: HTTP GET direto da URL do IPT, salvando em diretório temporário (`os.UserCacheDir()/biodiversidade/<source>.zip`), com retry exponencial (3 tentativas, backoff 1s/4s/16s) em caso de erro 5xx ou timeout.

**Rationale**:

- IPTs publicam URL estável de download via REST (`/archive.do?r=<resource>` ou `/eml.do?r=<resource>`).
- `net/http` com `http.Client{Timeout: 30 * time.Minute}` cobre downloads grandes.
- Cache em `UserCacheDir` (Windows: `%LocalAppData%\biodiversidade`) não polui o repo nem o `%TEMP%`.

**Alternatives considered**:

- Streaming direto do HTTP body para o parser (sem salvar em disco): impede retry e valida ZIP só no fim. Custo de espaço em disco é baixo.
- Resume parcial via `Range` header: complexidade desnecessária para o volume esperado.

---

## 9. Tamanho de bulk write

**Decision**: **5.000 documentos por lote** (configurável via env `BULK_BATCH_SIZE`, default 5000, máximo 10000).

**Rationale**:

- Limite de tamanho de payload BSON do MongoDB é 48 MB por mensagem em writes em batch (suficiente para 5–10k documentos típicos).
- 5k é o sweet spot empírico para DwC-A: maior reduz overhead RTT mas aumenta picos de RAM no driver.
- Alinhado com SC-010 ("5.000 a 10.000 documentos por lote").

---

## 10. Estratégia de "delete-not-seen"

**Decision**: Marcar todos os documentos da `source` no início da run com um campo `_runId` (UUID v7 gerado pelo script), upsertar definindo `_runId` para o novo valor; ao final, `DeleteMany({source: <s>, _runId: {$ne: <newRunId>}})`.

**Rationale**:

- Atômico em nível lógico: a coleção sempre reflete o último estado completo, sem janela vazia.
- Não exige duas passagens nem stage collection.
- `_runId` fica visível em queries para auditoria.
- UUID v7 (timestamp-prefixed) ordena temporalmente — útil em logs.

**Alternatives considered**:

- Track de IDs vistos em memória (set de `taxonID`s) e deletar os não-vistos: pico de RAM proibitivo para 5M ocorrências (~100 MB+ de strings).
- Soft delete com TTL: introduz delay e exige cleanup separado.

---

## 11. Auditoria (`ingest_runs`)

**Decision**: Coleção `ingest_runs` no banco `dwc2json`. Documento gravado **uma vez ao final** de cada execução (sucesso ou falha) usando `defer` no `main` do binário.

**Rationale**:

- Cobre FR-018: persiste `pubDate`, `version`, `title`, contadores, exit code, erro.
- Não interfere se o operador interromper com Ctrl+C antes do `defer` rodar — caso em que a coleção `taxa`/`occurrences` já reflete os upserts parciais (estratégia delete-not-seen ainda não rodou, então documentos do run anterior permanecem; o operador re-roda e recompõe).
- Index recomendado: `{source: 1, startedAt: -1}` para a query "última run de fauna/flora/occurrences" usada por FR-019.

---

## 12. Tratamento de erros e exit codes

**Decision**: Exit codes definidos:

- `0`: sucesso completo
- `1`: erro genérico/bug
- `2`: erro de configuração (`.env` ausente, `MONGO_URI` inválido, URL IPT inválido)
- `3`: erro de rede (download falhou após retries)
- `4`: erro de parsing DwC-A (ZIP corrompido, meta.xml inválido)
- `5`: erro de banco (autenticação, write concern, etc.)
- `130`: interrupção pelo operador (SIGINT)

**Rationale**: Permite scripts de orquestração futuros (caso ele queira agendar via Task Scheduler) distinguirem causas.

---

## 13. Segurança e dependências

**Decision**:

- Dependências mínimas: `mongo-driver/v2`, `joho/godotenv`. Tudo o resto vem da stdlib.
- Versões fixadas em `go.mod`; `go mod verify` na CI local antes de cada release.
- `gosec` (linter de segurança) executado opcionalmente pelo operador (`go run github.com/securego/gosec/v2/cmd/gosec ./...`).
- Atributo `httpClient.Timeout` definido (proteção contra DoS por servidor lento).
- Validação de URL via `url.Parse` antes do `http.Get` (proteção contra SSRF — embora aqui só sejam URLs vindas do `.env` do próprio operador).

**Rationale**: Endereça FR-016 ("evitar vulnerabilidades comuns").

---

## 14. Testes

**Decision**: **Testes mínimos com stdlib `testing`**. Foco em:

- Unit tests do parser DwC-A (com fixtures pequenas em `internal/dwca/testdata/`).
- Unit tests do conversor de tipos (datas, coordenadas, integers).
- Sem testes de integração com MongoDB real (dependência externa; operador valida manualmente via `db.taxa.countDocuments(...)`).

**Rationale**: FR/spec não exigem suíte completa; o operador é único usuário e valida via execução real. Testes ficam em ~5 arquivos `*_test.go` cobrindo as transformações puras.

**Alternatives considered**:

- `testcontainers-go` para MongoDB de teste: complexidade alta para projeto sem CI automatizado.

---

## 15. Build e cross-compilation

**Decision**: Build padrão executado pelo operador no Windows com:

```powershell
go build -trimpath -ldflags="-s -w" -o bin/update-fauna.exe ./cmd/update-fauna
go build -trimpath -ldflags="-s -w" -o bin/update-flora.exe ./cmd/update-flora
go build -trimpath -ldflags="-s -w" -o bin/update-occurrences.exe ./cmd/update-occurrences
```

Ou em uma linha: `go build -trimpath -ldflags="-s -w" -o bin/ ./cmd/...`.

**Rationale**:

- `-trimpath` remove paths de build absolutos do binário (privacidade + reproducibilidade).
- `-ldflags="-s -w"` strip de debug info — corta ~30% do tamanho final.
- Pasta `bin/` gitignorada (FR-017, FR-020).

---

## Resolução de NEEDS CLARIFICATION

Todas as questões de Technical Context foram resolvidas:

| Item                 | Status                                       |
| -------------------- | -------------------------------------------- |
| Language/Version     | ✅ Go 1.22+                                  |
| Primary Dependencies | ✅ mongo-driver/v2, godotenv                 |
| Storage              | ✅ MongoDB (banco `dwc2json`)                |
| Testing              | ✅ stdlib `testing`, sem suite de integração |
| Target Platform      | ✅ Windows 11 (amd64)                        |
| Project Type         | ✅ CLI (3 executáveis)                       |
| Performance Goals    | ✅ Definidos no spec (SC-009/SC-010)         |
| Constraints          | ✅ Memória estável (streaming), bulk 5–10k   |
| Scale/Scope          | ✅ Até 5M ocorrências, ~milhares de táxons   |

**Pronto para Phase 1 (Design & Contracts).**
