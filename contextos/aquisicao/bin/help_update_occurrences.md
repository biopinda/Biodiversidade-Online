# update-occurrences

Importa registros de ocorrência de 500+ fontes IPT para a coleção `occurrences` do MongoDB (`dwc2json`). Cada fonte é processada sequencialmente a partir do arquivo `data/occurrences.csv`. Ao final, gera um relatório completo por fonte.

## Uso

```
update-occurrences.exe [opções]
```

## Parâmetros

| Parâmetro             | Padrão  | Descrição                                          |
|-----------------------|---------|----------------------------------------------------|
| `--dry-run`           | `false` | Baixa e valida sem gravar no MongoDB               |
| `--config PATH`       | `.env`  | Caminho para o arquivo `.env`                      |
| `--log-level NÍVEL`   | `info`  | Nível de log: `debug`, `info`, `warn`, `error`     |
| `--version`           | —       | Imprime versão (git SHA + data) e sai              |

## Variáveis de ambiente (`.env`)

| Variável              | Obrigatória | Padrão                        | Descrição                                                                          |
|-----------------------|-------------|-------------------------------|------------------------------------------------------------------------------------|
| `MONGO_URI`           | **sim**     | —                             | Connection string MongoDB (ex: `mongodb://user:pass@host:27017/?authSource=admin`) |
| `MONGO_DATABASE`      | não         | `dwc2json`                    | Nome do banco de destino                                                           |
| `IPT_OCCURRENCES_CSV` | não         | `data/occurrences.csv`        | Caminho do CSV com a lista de fontes IPT                                           |
| `BULK_BATCH_SIZE`     | não         | `5000`                        | Documentos por lote no BulkWrite (máx. 10000)                                      |
| `HTTP_TIMEOUT_MIN`    | não         | `30`                          | Timeout do download por fonte em minutos                                           |
| `CACHE_DIR`           | não         | `%LocalAppData%\biodiversidade` | Diretório para cache dos ZIPs baixados                                           |
| `LOG_LEVEL`           | não         | `info`                        | Igual a `--log-level`                                                              |
| `LOG_FORMAT`          | não         | `text`                        | `text` (legível) ou `json` (estruturado)                                           |

## Exemplos

```powershell
# Rodar da raiz do repositório (onde está o .env)
.\bin\update-occurrences.exe

# Dry-run (sem banco, lê todas as fontes e valida)
.\bin\update-occurrences.exe --dry-run

# Log detalhado
.\bin\update-occurrences.exe --log-level debug

# CSV de fontes alternativo
.\bin\update-occurrences.exe --config C:\segredo\.env

# Verificar versão
.\bin\update-occurrences.exe --version
```

## Arquivo de fontes (`data/occurrences.csv`)

Cada linha representa uma fonte IPT. A URL de download é construída automaticamente como `{url}archive.do?r={tag}`.

| Coluna        | Descrição                                                    | Exemplo                          |
|---------------|--------------------------------------------------------------|----------------------------------|
| `nome`        | Nome da coleção                                              | `Acari Collection - INPA`        |
| `repositorio` | Identificador da instituição                                 | `inpa`                           |
| `kingdom`     | Reino biológico                                              | `Animalia`                       |
| `tag`         | Shortname do recurso no IPT (usado como `source` no MongoDB) | `inpa_acari`                     |
| `url`         | URL base do IPT                                              | `https://ipt.sibbr.gov.br/inpa/` |

Para adicionar novas fontes ao CSV, use o `ipt-compare.exe` (ver `help_ipt_compare.md`).

## Skip por versão

Antes de processar cada fonte, o script compara o `packageId` do `eml.xml` com o valor gravado na última execução bem-sucedida (`ingest_runs.dwca.packageId`). Se forem idênticos, a fonte é ignorada sem baixar registros.

```
level=INFO msg="versao identica, fonte ignorada" packageId=https://ipt.sibbr.gov.br/inpa/resource?id=inpa_acari/v1.4 last_run_at=2026-05-10T08:00:00Z
```

O `packageId` muda a cada nova publicação do recurso no IPT (ex: `/v1.4` → `/v1.5`). Fontes sem `packageId` no EML são sempre processadas.

## Validação de coordenadas

Registros com `decimalLatitude` fora de `[-90, 90]` ou `decimalLongitude` fora de `[-180, 180]` são marcados como suspeitos. O registro é importado mesmo assim, mas um aviso é gravado em `ingest_runs.warnings` e o contador `recordsWithSuspectCoordinates` é incrementado.

## Relatório final

Ao fim da execução, o script imprime para `stdout` uma tabela markdown com o resultado por fonte:

```
## Relatório — update-occurrences
Data: 2026-05-11 10:30:00 | Fontes: 524 | Sucesso: 480 | Ignoradas: 38 | Erros: 6 | Duração: 4h12m3s

| # | Fonte | Status | Lidos | Inseridos | Atualizados | Removidos | Erro |
|---|-------|--------|-------|-----------|-------------|-----------|------|
| 1 | [Acari Collection - INPA](https://ipt.sibbr.gov.br/inpa/resource?r=inpa_acari) | sucesso | 12345 | 200 | 12145 | 0 | |
| 2 | [Algae Flora](https://...) | ignorada | — | — | — | — | |
| 3 | [Fonte X](https://...) | erro | — | — | — | — | download: dial tcp… |
```

- **Fonte** — link clicável para a página do recurso no IPT (`resource?r=tag`)
- **Inseridos** — registros novos nesta execução
- **Atualizados** — registros já existentes que foram substituídos
- **Removidos** — registros do run anterior não mais presentes na fonte (delete-not-seen)

Para salvar o relatório em arquivo, redirecione `stdout`:

```powershell
.\bin\update-occurrences.exe 2>ops.log > relatorio.md
```

## Coleção MongoDB de destino

`dwc2json.occurrences` — `_id` baseado em `occurrenceID`.

## Exit codes

| Código | Significado                                                              |
|--------|--------------------------------------------------------------------------|
| `0`    | Todas as fontes processadas (com ou sem erros parciais em fontes individuais) |
| `2`    | Erro de configuração (`.env` ausente, variável obrigatória faltando)     |
| `3`    | Última fonte falhou por erro de rede                                     |
| `4`    | Última fonte falhou por erro de parsing DwC-A                            |
| `5`    | Erro de banco (autenticação, write concern)                              |
| `130`  | Interrupção pelo operador (Ctrl+C / SIGINT)                              |

Erros em fontes individuais não interrompem o processamento das demais — o script continua para a próxima fonte e registra o erro no relatório final.
