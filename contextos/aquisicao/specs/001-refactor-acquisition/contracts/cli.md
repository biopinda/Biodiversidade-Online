# CLI Contract — Update MongoDB Scripts

**Date**: 2026-05-05
**Audience**: Operador (Eduardo) e qualquer ferramenta de orquestração futura.

Define a interface estável dos três executáveis. Mudanças aqui exigem bump de versão.

---

## Binários e nomes amigáveis

| Binário (arquivo)        | Nome amigável (spec)         | Coleção destino | Source value    |
| ------------------------ | ---------------------------- | --------------- | --------------- |
| `update-fauna.exe`       | Update MongoDB - Fauna       | `taxa`          | `"fauna"`       |
| `update-flora.exe`       | Update MongoDB - Flora       | `taxa`          | `"flora"`       |
| `update-occurrences.exe` | Update MongoDB - Ocorrências | `occurrences`   | `"occurrences"` |

Todos compartilham a mesma interface CLI.

---

## Invocação

```text
update-<source>.exe [--dry-run] [--config <path>] [--log-level <level>]
```

### Flags

| Flag          | Tipo   | Default       | Efeito                                                                                |
| ------------- | ------ | ------------- | ------------------------------------------------------------------------------------- |
| `--dry-run`   | bool   | `false`       | Faz tudo (download, parse, validações) **sem** escrever em MongoDB. Loga o que faria. |
| `--config`    | string | `.env` no CWD | Path alternativo para arquivo de variáveis de ambiente.                               |
| `--log-level` | string | `info`        | Um de: `debug`, `info`, `warn`, `error`. Sobrescreve `LOG_LEVEL` env.                 |
| `--version`   | bool   | —             | Imprime versão (git sha curto + data de build) e sai com 0.                           |
| `--help`      | bool   | —             | Imprime esta ajuda e sai com 0.                                                       |

### Variáveis de ambiente (lidas via `.env` ou ambiente do processo)

| Var                     | Obrigatória?                                     | Descrição                                                                              |
| ----------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `MONGO_URI`             | sim                                              | Connection string completa. Ex.: `mongodb://user:pass@host:27017/?authSource=admin`    |
| `MONGO_DATABASE`        | não (default `dwc2json`)                         | Nome do banco de destino.                                                              |
| `IPT_FAUNA_URL`         | sim para `update-fauna`                          | URL do DwC-A do IPT de fauna.                                                          |
| `IPT_FLORA_URL`         | sim para `update-flora`                          | URL do DwC-A do IPT de flora.                                                          |
| `IPT_OCCURRENCES_URL`   | sim para `update-occurrences`                    | URL do DwC-A do IPT de ocorrências.                                                    |
| `OCCURRENCES_SOURCE_ID` | não (default `occurrences`)                      | Valor literal gravado em `source` para ocorrências (permite múltiplos IPTs no futuro). |
| `BULK_BATCH_SIZE`       | não (default `5000`, max `10000`)                | Documentos por lote em `BulkWrite`.                                                    |
| `LOG_LEVEL`             | não (default `info`)                             | Igual a `--log-level`.                                                                 |
| `LOG_FORMAT`            | não (default `text`)                             | `text` ou `json`.                                                                      |
| `HTTP_TIMEOUT_MIN`      | não (default `30`)                               | Timeout do download em minutos.                                                        |
| `CACHE_DIR`             | não (default `os.UserCacheDir()/biodiversidade`) | Onde salvar o ZIP baixado.                                                             |

### Argumentos posicionais

Nenhum. Toda configuração via flags ou env vars.

---

## Exit codes

| Código | Significado             | Quando                                                             |
| ------ | ----------------------- | ------------------------------------------------------------------ |
| `0`    | Sucesso                 | Run completo, `ingest_runs` gravado com `status: "success"`        |
| `1`    | Erro genérico           | Bug não tratado / panic recuperado                                 |
| `2`    | Erro de configuração    | `.env` ausente, vars obrigatórias faltando, MONGO_URI inválida     |
| `3`    | Erro de rede            | Download falhou após retries; DNS, timeout, 5xx persistente        |
| `4`    | Erro de parsing DwC-A   | ZIP corrompido, `meta.xml` ausente/inválido, encoding incompatível |
| `5`    | Erro de banco           | Auth falhou, write concern não satisfeita, collection bloqueada    |
| `130`  | Interrupção do operador | SIGINT (Ctrl+C) capturado                                          |

`ingest_runs` é gravado para todos os exit codes ≥ 1 (best-effort — se o erro for de banco, gravação pode também falhar, e nesse caso é apenas logada).

---

## Saída padrão (stdout)

Logs estruturados (slog) — texto colorido por default. Cada linha:

```text
TIMESTAMP LEVEL message key1=value1 key2=value2 ...
```

Exemplos:

```text
2026-05-05T10:00:00-03:00 INFO  iniciando script source=fauna binary=update-fauna version=v0.1.0-abc123
2026-05-05T10:00:00-03:00 INFO  carregando configuracao config=.env
2026-05-05T10:00:00-03:00 INFO  conectando ao MongoDB host=mongo.local database=dwc2json
2026-05-05T10:00:01-03:00 INFO  baixando DwC-A url=https://ipt.example/archive.do?r=fauna size_mb=12
2026-05-05T10:00:05-03:00 INFO  DwC-A baixado bytes=12482937 cache=C:\Users\X\AppData\Local\biodiversidade\fauna.zip
2026-05-05T10:00:05-03:00 INFO  lendo eml.xml pubDate=2026-04-30 version=2.3 title="Catálogo da Fauna do Brasil"
2026-05-05T10:00:05-03:00 INFO  lendo meta.xml core_rowtype=Taxon fields=24 extensions=2
2026-05-05T10:00:05-03:00 INFO  iniciando ingestao runId=01910a4b-...
2026-05-05T10:00:05-03:00 INFO  processando lote batch=1 size=5000
2026-05-05T10:00:06-03:00 INFO  lote gravado batch=1 inserted=4998 updated=2 elapsed_ms=420
...
2026-05-05T10:01:30-03:00 INFO  delete-not-seen iniciado source=fauna
2026-05-05T10:01:31-03:00 INFO  delete-not-seen concluido removed=42
2026-05-05T10:01:31-03:00 INFO  gravando ingest_runs status=success
2026-05-05T10:01:31-03:00 INFO  concluido duration_sec=91 records_read=125402 records_upserted=125360 records_rejected=0 records_removed=42 exit_code=0
```

Avisos relevantes:

```text
2026-05-05T10:00:05-03:00 WARN  versao identica a ultima execucao bem-sucedida last_run_at=2026-05-04T22:00:00Z dwca_pubDate=2026-04-30
```

Erros:

```text
2026-05-05T10:00:01-03:00 ERROR download falhou url=... err="Get \"https://...\": dial tcp: i/o timeout" attempts=3
2026-05-05T10:00:01-03:00 ERROR encerrando exit_code=3
```

---

## Stderr

Reservado para erros fatais que ocorrem **antes** do logger inicializar (ex.: panic em `init()`). Em operação normal, vazio.

---

## Idempotência (contrato de runtime)

- **Repetir o mesmo binário** com a mesma URL e mesmo DwC-A produz o mesmo estado final na coleção destino (FR-009).
- Documentos com `_runId` antigo são removidos pelo passo `delete-not-seen` ao final.
- `--dry-run` pode ser executado N vezes sem efeito colateral em MongoDB; ainda grava entrada em `ingest_runs` com `status: "success"` e flag `dryRun: true`.

---

## Garantias de não-efeito

- O binário **não cria** índices automaticamente. Provisionamento de índices é feito em `quickstart.md` por uma função `init-indexes` (script único, opcional, executado manualmente uma vez).
- O binário **não modifica** outras coleções além de `taxa`/`occurrences` (apenas a sua) e `ingest_runs`.
- O binário **não toca** documentos com `source` diferente do seu (ex.: update-fauna jamais altera `source: "flora"` em `taxa`).

---

## Compatibilidade

A interface CLI é considerada **estável** após o primeiro release. Quebras de compatibilidade exigem:

1. Documentação no CHANGELOG.
2. Bump de major version.
