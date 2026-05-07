# Biodiversidade.Online — Suite de Aplicativos para a Biodiversidade Brasileira

[Eduardo Dalcin](https://github.com/edalcin) · [Henrique Pinheiro](https://github.com/Phenome)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18668804.svg)](https://doi.org/10.5281/zenodo.18668804)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

---

## Visão Geral

**Biodiversidade.Online** é uma suite de aplicativos independentes que integram, curiam, enriquecem e apresentam dados da biodiversidade brasileira. Cada contexto é um aplicativo autônomo que opera sobre um banco MongoDB compartilhado (`dwc2json`).

A suite segue a arquitetura **C4 Model** com quatro contextos funcionais:

| Contexto | Função | Status |
|---|---|---|
| **Aquisição** | Importa DwC-A de fontes IPT para MongoDB | ✅ V7.0 — Go CLI |
| **Curadoria** | Valida, corrige e gerencia dados taxonômicos | 🔜 Planejado |
| **Enriquecimento** | Adiciona status de ameaça, invasoras, UCs | 🔜 Planejado |
| **Apresentação** | Dashboard, ChatBB e API REST pública | 🔜 Planejado |

---

## Diagrama C4 — Contexto do Sistema (Nível 1)

```mermaid
C4Context
    title Biodiversidade.Online — Contexto do Sistema

    Person(operador, "Operador", "Executa as atualizações periódicas de dados")
    Person(pesquisador, "Pesquisador / Público", "Consulta dados de biodiversidade")

    System_Boundary(suite, "Biodiversidade.Online Suite") {
        System(aquisicao, "Aquisição", "Importa dados DwC-A de fontes IPT e persiste no MongoDB")
        System(curadoria, "Curadoria", "Gerencia e valida dados taxonômicos [planejado]")
        System(enriquecimento, "Enriquecimento", "Adiciona dados temáticos: ameaças, invasoras, UCs [planejado]")
        System(apresentacao, "Apresentação", "Dashboard, ChatBB e REST API [planejado]")
    }

    System_Ext(ipt_flora, "IPT Flora do Brasil", "Repositório DwC-A de flora — JBRJ/Reflora")
    System_Ext(ipt_fauna, "IPT Fauna do Brasil", "Repositório DwC-A de fauna — JBRJ/CNCFlora")
    System_Ext(ipt_occ, "505+ IPTs de Ocorrências", "INPA, MPEG, SIBBR, speciesLink e outros")
    SystemDb(mongodb, "MongoDB dwc2json", "Banco principal compartilhado entre todos os contextos")

    Rel(operador, aquisicao, "executa manualmente")
    Rel(operador, enriquecimento, "executa manualmente")
    Rel(aquisicao, ipt_flora, "baixa DwC-A via HTTP")
    Rel(aquisicao, ipt_fauna, "baixa DwC-A via HTTP")
    Rel(aquisicao, ipt_occ, "baixa DwC-A de 505+ fontes")
    Rel(aquisicao, mongodb, "upsert em taxa e occurrences")
    Rel(curadoria, mongodb, "lê · valida · corrige")
    Rel(enriquecimento, mongodb, "lê · enriquece · grava")
    Rel(apresentacao, mongodb, "lê somente")
    Rel(pesquisador, apresentacao, "consulta via browser / API")
```

---

## Diagrama C4 — Containers do Contexto de Aquisição (Nível 2)

> Único contexto implementado na V7.0.

```mermaid
C4Container
    title Aquisição — Containers (V7.0)

    Person(operador, "Operador", "Executa os binários no servidor")

    System_Ext(ipt_flora, "IPT Flora do Brasil", "DwC-A via HTTP")
    System_Ext(ipt_fauna, "IPT Fauna do Brasil", "DwC-A via HTTP")
    System_Ext(ipt_occ, "505+ IPTs de Ocorrências", "DwC-A via HTTP")
    SystemDb_Ext(mongodb, "MongoDB dwc2json", "taxa · occurrences · ingest_runs")

    System_Boundary(aquisicao, "Contexto de Aquisição") {
        Container(fauna_bin, "update-fauna", "Go CLI binary", "Baixa DwC-A de Fauna, upsert em taxa{source:fauna}")
        Container(flora_bin, "update-flora", "Go CLI binary", "Baixa DwC-A de Flora, upsert em taxa{source:flora}")
        Container(occ_bin, "update-occurrences", "Go CLI binary", "Itera 505+ IPTs, upsert em occurrences por tag")

        Container(dwca_pkg, "internal/dwca", "Go package", "Parser streaming de arquivos DwC-A (meta.xml, eml.xml, CSV)")
        Container(ingest_pkg, "internal/ingest", "Go package", "Pipeline: download → parse → coerce → bulk upsert → delete-not-seen")
        Container(mongostore_pkg, "internal/mongostore", "Go package", "BulkWrite, DeleteNotSeen, auditoria em ingest_runs")
        Container(config_pkg, "internal/config", "Go package", "Carrega .env, valida variáveis obrigatórias por fonte")
    }

    Rel(operador, fauna_bin, "executa com flags")
    Rel(operador, flora_bin, "executa com flags")
    Rel(operador, occ_bin, "executa com flags")

    Rel(fauna_bin, ipt_fauna, "GET archive.do HTTP")
    Rel(flora_bin, ipt_flora, "GET archive.do HTTP")
    Rel(occ_bin, ipt_occ, "GET archive.do?r={tag} para cada fonte")

    Rel(fauna_bin, dwca_pkg, "usa")
    Rel(flora_bin, dwca_pkg, "usa")
    Rel(occ_bin, dwca_pkg, "usa")
    Rel(fauna_bin, ingest_pkg, "usa")
    Rel(flora_bin, ingest_pkg, "usa")
    Rel(occ_bin, ingest_pkg, "usa")
    Rel(ingest_pkg, mongostore_pkg, "usa")
    Rel(fauna_bin, config_pkg, "usa")
    Rel(flora_bin, config_pkg, "usa")
    Rel(occ_bin, config_pkg, "usa")

    Rel(mongostore_pkg, mongodb, "BulkWrite · DeleteMany · InsertOne")
```

---

## Contexto de Aquisição — V7.0

### O que faz

Três binários Go independentes (Windows `.exe` ou Linux sem extensão) que atualizam o MongoDB com dados da biodiversidade brasileira:

| Binário | Fonte IPT | Coleção MongoDB | Tempo esperado |
|---|---|---|---|
| `update-fauna` | IPT Fauna do Brasil | `taxa` (`source:"fauna"`) | ≤ 2 min |
| `update-flora` | IPT Flora do Brasil | `taxa` (`source:"flora"`) | ≤ 2 min |
| `update-occurrences` | 505+ IPTs (via CSV) | `occurrences` | ≤ 30 min (5M reg.) |

Cada execução:
1. Baixa o DwC-A mais recente da URL configurada no `.env`
2. Lê `eml.xml` e registra versão/data do dataset nos logs
3. Faz **upsert por chave estável** de todos os campos DwC-A (passthrough completo)
4. Remove registros da mesma `source` ausentes do IPT (**delete-not-seen**)
5. Grava auditoria em `ingest_runs` (contadores, duração, status)

### Bootstrap rápido

```bash
# 1. Instalar Go 1.22+
# 2. Clonar o repositório
git clone https://github.com/biopinda/Biodiversidade-Online.git
cd Biodiversidade-Online

# 3. Configurar .env
cp .env.example .env
# Editar .env com MONGO_URI, IPT_FAUNA_URL, IPT_FLORA_URL

# 4. Compilar (Windows)
go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\update-fauna
go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\update-flora
go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\update-occurrences

# 4. Compilar (Linux)
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/ ./cmd/update-fauna
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/ ./cmd/update-flora
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/ ./cmd/update-occurrences

# 5. Executar
./bin/update-fauna --log-level debug
./bin/update-flora --log-level debug
./bin/update-occurrences --dry-run
```

### Configuração (`.env`)

```dotenv
# Obrigatório
MONGO_URI=mongodb://user:pass@host:27017/?authSource=admin
IPT_FAUNA_URL=https://ipt.jbrj.gov.br/fauna/
IPT_FLORA_URL=https://ipt.jbrj.gov.br/reflora/

# Opcional — defaults documentados
MONGO_DATABASE=dwc2json
IPT_OCCURRENCES_CSV=data/occurrences.csv   # CSV com 505+ fontes IPT
BULK_BATCH_SIZE=5000
HTTP_TIMEOUT_MIN=30
LOG_LEVEL=info                              # debug | info | warn | error
LOG_FORMAT=text                             # text | json
CACHE_DIR=                                  # deixe vazio para não cachear
```

### Flags CLI comuns

```
--dry-run          Processa e valida sem gravar no MongoDB
--config <path>    Caminho alternativo para o .env (padrão: .env)
--log-level <lvl>  Sobrescreve LOG_LEVEL do .env
--version          Imprime versão e sai
```

> Documentação completa em `bin/HELP.md` após compilar.

### Banco de Dados (`dwc2json`)

| Coleção | Conteúdo | Chave de upsert |
|---|---|---|
| `taxa` | Espécie/sub-espécie/variedade/forma (fauna + flora) com extensões DwC-A mescladas | `taxonID` |
| `occurrences` | Registros de ocorrência de 505+ IPTs | `occurrenceID` |
| `ingest_runs` | Auditoria de cada execução (contadores, status, duração) | — |

Campos injetados em todo documento: `_runId` (UUID v7), `source` (ex: `"fauna"`, `"inpa_acari"`), `ingestedAt` (timestamp UTC).

> **Filtro de rank em `taxa`**: apenas táxons-folha (espécie, sub-espécie, variedade, forma — PT ou EN, case-insensitive) entram. Grupos supra-específicos (família, ordem, etc.) são rejeitados na ingestão.

> **Extensões mescladas no documento `taxa`**: `distribution` (objeto), `vernacularname[]`, `speciesprofile`, `othernames[]` (sinonímias de `resourcerelationship`), `reference[]`, `typesandspecimen[]`. Campos computados: `canonicalName`, `flatScientificName`. Schema-alvo: [`docs/schema-dwc2json-taxa-mongoDBJSON.json`](docs/schema-dwc2json-taxa-mongoDBJSON.json).

### Documentação

| Arquivo | Descrição |
|---|---|
| [`docs/funcionamento.md`](docs/funcionamento.md) | Pipeline de ingestão V7 (visão geral, parsing, filtragem, normalização) |
| [`docs/atualizacao.md`](docs/atualizacao.md) | Procedimento operacional de atualização |
| [`docs/esquema.md`](docs/esquema.md) | Diagrama Mermaid das fontes IPT |
| [`docs/schema-dwc2json-taxa-mongoDBJSON.json`](docs/schema-dwc2json-taxa-mongoDBJSON.json) | Schema-alvo da coleção `taxa` |
| [`docs/schema-dwc2json-ocorrencias-mongoDBJSON.json`](docs/schema-dwc2json-ocorrencias-mongoDBJSON.json) | Schema-alvo da coleção `occurrences` |
| [`docs/legacy/`](docs/legacy/) | Docs V6 de contextos futuros (chat, dashboard, GH Actions) — referência histórica |

### Estrutura do Repositório

```
/
├── cmd/
│   ├── update-fauna/        # Entry point: fauna
│   ├── update-flora/        # Entry point: flora
│   └── update-occurrences/  # Entry point: occurrences (505+ fontes)
├── internal/
│   ├── config/              # Carregamento e validação de .env
│   ├── dwca/                # Parser DwC-A (streaming, sem deps externas)
│   ├── ingest/              # Pipeline compartilhado + coerção de tipos
│   ├── mongostore/          # Cliente MongoDB, upsert, delete-not-seen, auditoria
│   ├── verbose/             # Logger (slog) + tratamento de sinais
│   └── version/             # Versão injetável via ldflags
├── data/
│   └── occurrences.csv      # CSV com 505+ fontes IPT para ocorrências
├── specs/
│   └── 001-refactor-acquisition/   # Spec, plan, tasks e contratos da V7
├── .env.example             # Template de configuração
├── go.mod / go.sum          # Módulo Go
└── LICENSE                  # GPL v3
```

### Dependências Externas

Apenas duas dependências diretas (FR-016):

| Pacote | Versão | Uso |
|---|---|---|
| `go.mongodb.org/mongo-driver/v2` | v2.6.0 | Cliente MongoDB oficial |
| `github.com/joho/godotenv` | v1.5.1 | Carregamento de `.env` |

### Testes

```bash
go test ./internal/...   # 11 testes unitários (dwca + ingest)
go vet ./...             # análise estática
```

---

## Roadmap

```
V7.0  ✅  Aquisição — Go CLI (fauna, flora, 505+ ocorrências)
V7.1  🔜  Curadoria — validação e correção taxonômica
V7.2  🔜  Enriquecimento — status de ameaça, invasoras, UCs
V7.3  🔜  Apresentação — Dashboard, ChatBB, REST API
```

---

## Licença

GPL v3 — ver [LICENSE](LICENSE).
