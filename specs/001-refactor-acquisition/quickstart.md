# Quickstart — Biodiversidade.Online (Aquisição apenas)

**Date**: 2026-05-05
**Audience**: Operador (você) em Windows 11.

Este guia leva do `git clone` à primeira execução de um script em **menos de 15 minutos** (assumindo Go e MongoDB já instalados, conforme SC-005).

---

## 1. Pré-requisitos (uma vez por máquina)

| Componente | Versão     | Como instalar                                                                            |
| ---------- | ---------- | ---------------------------------------------------------------------------------------- |
| Go         | 1.22+      | https://go.dev/dl/ — instalador `.msi` para Windows                                      |
| Git        | 2.40+      | https://git-scm.com/download/win                                                         |
| MongoDB    | 6.x ou 7.x | Local (`MongoDB Community`) ou Atlas. Banco `dwc2json` será criado na primeira gravação. |

Verificar versões:

```powershell
go version    # esperar: go version go1.22.x windows/amd64 ou superior
git --version
```

---

## 2. Clonar e configurar (uma vez)

```powershell
cd D:\git
git clone https://github.com/<sua-org>/Biodiversidade-Online.git
cd Biodiversidade-Online
```

Criar `.env` a partir do exemplo:

```powershell
Copy-Item .env.example .env
notepad .env
```

Editar `.env` com seus valores reais:

```dotenv
# Conexão MongoDB
MONGO_URI=mongodb://USUARIO:SENHA@HOST:27017/?authSource=admin
MONGO_DATABASE=dwc2json

# URLs dos IPTs (DwC-A archives)
IPT_FAUNA_URL=https://ipt.example.org/archive.do?r=fauna
IPT_FLORA_URL=https://ipt.example.org/archive.do?r=flora
IPT_OCCURRENCES_URL=https://ipt.example.org/archive.do?r=ocorrencias

# Opcionais
LOG_LEVEL=info
LOG_FORMAT=text
BULK_BATCH_SIZE=5000
```

> **Segurança**: `.env` está em `.gitignore`. Nunca o commite. As credenciais ficam apenas na sua máquina.

---

## 3. Compilar os binários

```powershell
go build -trimpath -ldflags="-s -w" -o bin\update-fauna.exe       .\cmd\update-fauna
go build -trimpath -ldflags="-s -w" -o bin\update-flora.exe       .\cmd\update-flora
go build -trimpath -ldflags="-s -w" -o bin\update-occurrences.exe .\cmd\update-occurrences
```

Ou em um único comando (gera 3 binários em `bin\`):

```powershell
go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\...
```

Verificar:

```powershell
Get-ChildItem bin\
# update-fauna.exe        ~10 MB
# update-flora.exe        ~10 MB
# update-occurrences.exe  ~10 MB
```

> A pasta `bin\` é gitignorada. Recompile após `git pull`.

---

## 4. (Opcional) Provisionar índices uma vez

Os scripts **não criam índices automaticamente** (FR-020 esclareceu o build; aqui mantemos a separação de responsabilidades). Provisione manualmente uma vez:

```javascript
// Em mongosh, conectado ao banco dwc2json
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

---

## 5. Executar pela primeira vez

### Fauna (rápido — ≤ 2 min)

```powershell
.\bin\update-fauna.exe
```

Saída esperada (resumida):

```text
INFO  iniciando script source=fauna binary=update-fauna
INFO  carregando configuracao config=.env
INFO  conectando ao MongoDB host=... database=dwc2json
INFO  baixando DwC-A url=https://...
INFO  DwC-A baixado bytes=12482937
INFO  lendo eml.xml pubDate=2026-04-30 version=2.3
INFO  iniciando ingestao runId=01910a4b-...
INFO  processando lote batch=1 size=5000
...
INFO  delete-not-seen concluido removed=42
INFO  concluido duration_sec=91 records_read=125402 records_upserted=125360 exit_code=0
```

Validar no MongoDB:

```javascript
use dwc2json
db.taxa.countDocuments({source: "fauna"})
db.ingest_runs.find({source: "fauna"}).sort({startedAt: -1}).limit(1).pretty()
```

### Flora (rápido — ≤ 2 min)

```powershell
.\bin\update-flora.exe
```

### Ocorrências (longo — até 30 min para 5M registros)

```powershell
.\bin\update-occurrences.exe
```

> **Dica**: deixe o terminal visível para acompanhar progresso. Logs verbosos por design (FR-006).

---

## 6. Re-execução (atualização semanal/mensal)

Apenas re-execute o `.exe` desejado. O script:

1. Baixa o DwC-A mais recente.
2. Lê `eml.xml` e avisa se a versão é igual à última run de sucesso.
3. Faz **upsert por chave estável** dos registros atuais.
4. **Remove** documentos da mesma `source` que sumiram do IPT (delete-not-seen).
5. Grava entrada em `ingest_runs`.

Resultado: a coleção sempre reflete o estado mais recente do IPT, sem duplicatas e sem janela vazia.

---

## 7. Modo dry-run (validar sem escrever)

Útil para verificar se uma URL nova está funcionando antes de executar de verdade:

```powershell
.\bin\update-fauna.exe --dry-run --log-level debug
```

Faz download, parsing, e simula upserts. Não toca em `taxa` nem em `ingest_runs` (entrada é gravada com `dryRun: true`).

---

## 8. Solução de problemas

| Sintoma                         | Causa provável                               | Ação                                                             |
| ------------------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| `exit 2: MONGO_URI not set`     | `.env` ausente ou var faltando               | `Copy-Item .env.example .env` e edite                            |
| `exit 3: download failed`       | IPT fora do ar ou URL errada                 | Confira no navegador; tente novamente em alguns minutos          |
| `exit 4: invalid DwC-A`         | ZIP corrompido (download interrompido)       | Apague `%LocalAppData%\biodiversidade\<source>.zip` e re-execute |
| `exit 5: authentication failed` | Credencial errada em `MONGO_URI`             | Verifique `authSource`, usuário, senha                           |
| Demora muito mais que SC-009    | MongoDB lento/em rede ruim, ou batch pequeno | Ajuste `BULK_BATCH_SIZE=10000` no `.env`                         |
| Versão idêntica à última        | IPT não publicou nova versão                 | Normal; script processa mesmo assim e avisa                      |

---

## 9. Atualização do código

```powershell
git pull
go build -trimpath -ldflags="-s -w" -o bin\ .\cmd\...
```

---

## 10. Limpeza completa de cache

```powershell
Remove-Item -Recurse -Force "$env:LocalAppData\biodiversidade"
```

A pasta será recriada na próxima execução.

---

## Referências

- [spec.md](./spec.md) — requisitos funcionais e critérios de sucesso
- [plan.md](./plan.md) — decisões técnicas e arquitetura
- [data-model.md](./data-model.md) — schemas das coleções
- [contracts/cli.md](./contracts/cli.md) — contrato CLI completo
- [contracts/collections.md](./contracts/collections.md) — contrato de leitura das coleções
