# Biodiversidade.Online — Scripts de Aquisição

Três executáveis para popular o banco MongoDB `dwc2json` com dados DwC-A dos IPTs.

---

## Uso

```
update-fauna.exe       [opções]
update-flora.exe       [opções]
update-occurrences.exe [opções]
```

---

## Parâmetros

| Flag                  | Tipo   | Padrão  | Descrição                                      |
| --------------------- | ------ | ------- | ---------------------------------------------- |
| `--dry-run`           | bool   | `false` | Baixa e valida sem gravar no MongoDB           |
| `--config <path>`     | string | `.env`  | Caminho alternativo para o arquivo `.env`      |
| `--log-level <nível>` | string | `info`  | Nível de log: `debug`, `info`, `warn`, `error` |
| `--version`           | bool   | —       | Imprime versão (git sha + data) e sai          |
| `--help`              | bool   | —       | Imprime ajuda e sai                            |

---

## Variáveis de ambiente (arquivo `.env`)

| Variável              | Obrigatória            | Padrão                          | Descrição                                                                          |
| --------------------- | ---------------------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| `MONGO_URI`           | **sim**                | —                               | Connection string MongoDB (ex: `mongodb://user:pass@host:27017/?authSource=admin`) |
| `MONGO_DATABASE`      | não                    | `dwc2json`                      | Nome do banco de destino                                                           |
| `IPT_FAUNA_URL`       | **sim** (update-fauna) | —                               | URL do DwC-A do IPT de fauna                                                       |
| `IPT_FLORA_URL`       | **sim** (update-flora) | —                               | URL do DwC-A do IPT de flora                                                       |
| `IPT_OCCURRENCES_CSV` | não                    | `data/occurrences.csv`          | Caminho do CSV com lista de fontes IPT para ocorrências                            |
| `BULK_BATCH_SIZE`     | não                    | `5000`                          | Documentos por lote no BulkWrite (máx. 10000)                                      |
| `LOG_LEVEL`           | não                    | `info`                          | Igual a `--log-level`                                                              |
| `LOG_FORMAT`          | não                    | `text`                          | `text` (legível) ou `json` (estruturado)                                           |
| `HTTP_TIMEOUT_MIN`    | não                    | `30`                            | Timeout do download em minutos                                                     |
| `CACHE_DIR`           | não                    | `%LocalAppData%\biodiversidade` | Diretório para cache dos ZIPs baixados                                             |

---

## Formato do CSV de ocorrências (`data/occurrences.csv`)

Colunas obrigatórias:

| Coluna        | Descrição                                                    | Exemplo                          |
| ------------- | ------------------------------------------------------------ | -------------------------------- |
| `nome`        | Nome da coleção                                              | `Coleção de Acari - INPA`        |
| `repositorio` | Identificador da instituição                                 | `inpa`                           |
| `kingdom`     | Reino biológico                                              | `Animalia`                       |
| `tag`         | Shortname do recurso no IPT (usado como `source` no MongoDB) | `inpa_acari`                     |
| `url`         | URL base do IPT                                              | `https://ipt.sibbr.gov.br/inpa/` |

A URL de download é construída automaticamente: `{url}archive.do?r={tag}`

---

## Exit codes

| Código | Significado                                                          |
| ------ | -------------------------------------------------------------------- |
| `0`    | Sucesso                                                              |
| `2`    | Erro de configuração (`.env` ausente, variável obrigatória faltando) |
| `3`    | Erro de rede (download falhou após retries)                          |
| `4`    | Erro de parsing DwC-A (ZIP corrompido, `meta.xml` inválido)          |
| `5`    | Erro de banco (autenticação, write concern)                          |
| `130`  | Interrupção pelo operador (Ctrl+C)                                   |

---

## Exemplos

```powershell
# Rodar da raiz do repositório (onde está o .env)
cd D:\git\Biodiversidade-Online

# Fauna com log detalhado
.\bin\update-fauna.exe --log-level debug

# Flora em modo dry-run (sem gravar)
.\bin\update-flora.exe --dry-run

# Ocorrências com .env em outro local
.\bin\update-occurrences.exe --config C:\segredo\.env

# Verificar versão
.\bin\update-fauna.exe --version
```

---

## Configuração inicial

1. Copiar `.env.example` para `.env` na raiz do repositório
2. Preencher `MONGO_URI`, `IPT_FAUNA_URL`, `IPT_FLORA_URL`
3. Editar `data\occurrences.csv` se necessário
4. Rodar `.\bin\update-fauna.exe` para validar

Ver também: `specs/001-refactor-acquisition/quickstart.md`
