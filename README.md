# Biodiversidade.Online V7.0 - Aquisição de Dados da Biodiversidade Brasileira

[Eduardo Dalcin](https://github.com/edalcin) e [Henrique Pinheiro](https://github.com/Phenome)

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18668804.svg)](https://doi.org/10.5281/zenodo.18668804)

## Objetivo

Baixar, parsear e persistir dados da biodiversidade brasileira em um banco MongoDB (`dwc2json`). Três executáveis independentes para Windows 11 atualizam as coleções `taxa` (fauna e flora) e `occurrences` a partir de arquivos DwC-A publicados em IPTs.

## O que faz

| Executável               | Fonte         | Coleção       | Tempo esperado    |
| ------------------------ | ------------- | ------------- | ----------------- |
| `update-fauna.exe`       | IPT de Fauna  | `taxa`        | ≤ 2 min           |
| `update-flora.exe`       | IPT de Flora  | `taxa`        | ≤ 2 min           |
| `update-occurrences.exe` | IPT de Ocorr. | `occurrences` | ≤ 30 min (5M reg) |

Cada script:

1. Baixa o DwC-A mais recente da URL configurada em `.env`.
2. Lê `eml.xml` (versão/data do dataset) e loga os metadados.
3. Faz **upsert por chave estável** de todos os campos do DwC-A (passthrough completo).
4. Remove registros da mesma `source` que sumiram do IPT (**delete-not-seen**).
5. Grava auditoria da execução em `ingest_runs`.

## Banco de Dados

Banco MongoDB `dwc2json` com três coleções:

- **`taxa`** — Táxons de fauna e flora. Campo `source` identifica a origem (`"fauna"` ou `"flora"`). Chave estável: `taxonID`.
- **`occurrences`** — Registros de ocorrência. Chave estável: `occurrenceID`.
- **`ingest_runs`** — Auditoria de cada execução (início, fim, contadores, versão do DwC-A, status).

Schema **passthrough completo**: todos os termos Darwin Core do DwC-A são preservados. Normalização mínima: datas → ISO 8601, coordenadas → `double`, strings vazias → omitidas.

## Fontes de Dados

- [Flora e Funga do Brasil](http://floradobrasil.jbrj.gov.br/) — Catálogo oficial de espécies vegetais e fúngicas (IPT de flora)
- [Catálogo Taxonômico da Fauna do Brasil](http://fauna.jbrj.gov.br/) — Base oficial de espécies animais (IPT de fauna)
- ~490 repositórios IPT com registros de ocorrência (IPT de ocorrências)

## Tecnologias

- **Linguagem**: Go 1.22+
- **Banco de Dados**: MongoDB 6.x ou 7.x
- **Dependências**: `go.mongodb.org/mongo-driver/v2`, `github.com/joho/godotenv`
- **Plataformas**: Windows 11 (amd64), Linux x86 (amd64)

## Como Usar

### Pré-requisitos (uma vez por máquina)

| Componente | Versão     | Link                                   |
| ---------- | ---------- | -------------------------------------- |
| Go         | 1.22+      | https://go.dev/dl/ (instalador `.msi`) |
| Git        | 2.40+      | https://git-scm.com/download/win       |
| MongoDB    | 6.x ou 7.x | MongoDB Community ou Atlas             |

### Configuração (uma vez)

```powershell
git clone https://github.com/biopinda/Biodiversidade-Online.git
cd Biodiversidade-Online

# Criar .env com suas credenciais (nunca commitar este arquivo)
Copy-Item .env.example .env
notepad .env
```

Variáveis obrigatórias no `.env`:

```dotenv
MONGO_URI=mongodb://USUARIO:SENHA@HOST:27017/?authSource=admin
MONGO_DATABASE=dwc2json
IPT_FAUNA_URL=https://ipt.example.org/archive.do?r=fauna
IPT_FLORA_URL=https://ipt.example.org/archive.do?r=flora
IPT_OCCURRENCES_URL=https://ipt.example.org/archive.do?r=ocorrencias
```

### Compilar

**Windows 11:**

```powershell
$env:GOOS="windows"; $env:GOARCH="amd64"
go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\...
# Gera: bin\update-fauna.exe, bin\update-flora.exe, bin\update-occurrences.exe
```

**Linux x86:**

```bash
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/ ./cmd/...
# Gera: bin/update-fauna, bin/update-flora, bin/update-occurrences
```

Recompile após `git pull`.

### Executar

**Windows:**

```powershell
.\bin\update-fauna.exe
.\bin\update-flora.exe
.\bin\update-occurrences.exe
```

**Linux:**

```bash
./bin/update-fauna
./bin/update-flora
./bin/update-occurrences
```

Flags opcionais (igual em ambas as plataformas):

```bash
update-fauna --dry-run            # Simula sem escrever no banco
update-fauna --log-level debug    # Logs detalhados
update-fauna --batch-size 10000   # Ajusta tamanho do lote
```

### Validar no MongoDB

```javascript
use dwc2json
db.taxa.countDocuments({source: "fauna"})
db.taxa.countDocuments({source: "flora"})
db.occurrences.countDocuments()
db.ingest_runs.find().sort({startedAt: -1}).limit(3).pretty()
```

### Provisionar Índices (uma vez)

```javascript
use dwc2json
db.taxa.createIndex({source: 1})
db.taxa.createIndex({scientificName: 1}, {collation: {locale: "pt", strength: 2}})
db.taxa.createIndex({family: 1, genus: 1})
db.taxa.createIndex({_runId: 1})

db.occurrences.createIndex({source: 1})
db.occurrences.createIndex({scientificName: 1})
db.occurrences.createIndex({family: 1, genus: 1, scientificName: 1})
db.occurrences.createIndex({country: 1, stateProvince: 1})
db.occurrences.createIndex({eventDate: 1})
db.occurrences.createIndex({_runId: 1})

db.ingest_runs.createIndex({source: 1, startedAt: -1})
db.ingest_runs.createIndex({status: 1})
```

## Estrutura do Projeto

```
├── cmd/
│   ├── update-fauna/         # Entry point: atualiza taxa (fauna)
│   ├── update-flora/         # Entry point: atualiza taxa (flora)
│   └── update-occurrences/   # Entry point: atualiza occurrences
├── internal/
│   ├── config/               # Carrega .env, valida variáveis obrigatórias
│   ├── dwca/                 # Parser nativo de Darwin Core Archive (ZIP)
│   ├── ingest/               # Pipeline: download → parse → transform → upsert → delete-not-seen
│   ├── mongostore/           # Cliente MongoDB: upsert em lote, delete-not-seen, auditoria
│   ├── verbose/              # Logger estruturado (slog)
│   └── version/              # Versão do binário (injetada via ldflags)
├── specs/                    # Especificações de features
│   └── 001-refactor-acquisition/
├── .env.example              # Placeholders (nunca commitar .env real)
├── .gitignore                # .env, bin/, *.exe ignorados
├── go.mod
├── go.sum
└── README.md
```

## Solução de Problemas

| Sintoma                         | Causa provável                 | Ação                                        |
| ------------------------------- | ------------------------------ | ------------------------------------------- |
| `exit 2: MONGO_URI not set`     | `.env` ausente ou var faltando | `Copy-Item .env.example .env` e edite       |
| `exit 3: download failed`       | IPT fora do ar ou URL errada   | Confira no navegador; tente novamente       |
| `exit 4: invalid DwC-A`         | ZIP corrompido                 | Limpe o cache e re-execute                  |
| `exit 5: authentication failed` | Credencial errada              | Verifique `authSource`, usuário, senha      |
| Script mais lento que esperado  | MongoDB em rede lenta          | Ajuste `BULK_BATCH_SIZE=10000` no `.env`    |
| "Versão idêntica à última"      | IPT sem nova publicação        | Normal; script processa mesmo assim e avisa |

## Histórico de Versões

- **V7.0** (2026): Refatoração completa para contexto de Aquisição apenas. Go 1.22+, 3 executáveis para Windows 11 e Linux x86, sem web/Docker/Actions.
- **V6.1** (2026): Pipeline de enriquecimento in-place (CSV → loaders → enrich), arquitetura C4 consolidada
- **V6.0** (2026): Reestruturação com arquitetura C4, foco em API e MCP
- **V5.0** (2025): Integração com ChatBB e protocolo MCP
- **V4.0** (2024): Integração de dados de ocorrência de ~490 IPTs
- **V2.0** (2024): Agregação do Catálogo Taxonômico da Fauna do Brasil
- **V1.0** (2023): Conversão de dados DwC-A para JSON (Flora e Funga do Brasil)

## Projetos Relacionados

O projeto [coletoresDWC2JSON](https://github.com/edalcin/coletoresDWC2JSON) complementa o Biodiversidade.Online fornecendo ferramentas de canonicalização de nomes de coletores.

## Contribuições

Dúvidas, sugestões e contribuições são bem-vindas através das [issues do projeto](https://github.com/biopinda/Biodiversidade-Online/issues).

## Citação

```bibtex
@software{pinheiro_dalcin_2026,
  title = {Biodiversidade.Online: Aquisição de Dados da Biodiversidade Brasileira},
  author = {Pinheiro, Henrique and Dalcin, Eduardo},
  year = {2026},
  version = {7.0},
  doi = {10.5281/zenodo.18668804},
  url = {https://github.com/biopinda/Biodiversidade-Online}
}
```

## Licença

Este projeto é desenvolvido como software livre para a comunidade científica brasileira.
