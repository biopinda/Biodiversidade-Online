# update-flora

Importa o catálogo de flora brasileira de um endpoint IPT para a coleção `taxa` do MongoDB (`dwc2json`). Processa o arquivo DwC-A completo incluindo extensões (distribuição, nomes vernaculares, perfil de espécie, relações, referências, tipos).

## Uso

```
update-flora.exe [opções]
```

## Parâmetros

| Parâmetro             | Padrão  | Descrição                                          |
|-----------------------|---------|----------------------------------------------------|
| `--dry-run`           | `false` | Baixa e valida sem gravar no MongoDB               |
| `--config PATH`       | `.env`  | Caminho para o arquivo `.env`                      |
| `--log-level NÍVEL`   | `info`  | Nível de log: `debug`, `info`, `warn`, `error`     |
| `--version`           | —       | Imprime versão (git SHA + data) e sai              |

## Variáveis de ambiente (`.env`)

| Variável           | Obrigatória        | Padrão     | Descrição                                                                          |
|--------------------|--------------------|------------|------------------------------------------------------------------------------------|
| `MONGO_URI`        | **sim**            | —          | Connection string MongoDB (ex: `mongodb://user:pass@host:27017/?authSource=admin`) |
| `IPT_FLORA_URL`    | **sim**            | —          | URL do DwC-A de flora (ex: `https://ipt.jbrj.gov.br/reflora/archive.do?r=flora`)  |
| `MONGO_DATABASE`   | não                | `dwc2json` | Nome do banco de destino                                                           |
| `BULK_BATCH_SIZE`  | não                | `5000`     | Documentos por lote no BulkWrite (máx. 10000)                                      |
| `HTTP_TIMEOUT_MIN` | não                | `30`       | Timeout do download em minutos                                                     |
| `CACHE_DIR`        | não                | `%LocalAppData%\biodiversidade` | Diretório para cache do ZIP baixado               |
| `LOG_LEVEL`        | não                | `info`     | Igual a `--log-level`                                                              |
| `LOG_FORMAT`       | não                | `text`     | `text` (legível) ou `json` (estruturado)                                           |

Em `--dry-run`, `MONGO_URI` não é exigida.

## Exemplos

```powershell
# Rodar da raiz do repositório (onde está o .env)
.\bin\update-flora.exe

# Dry-run para testar sem banco
.\bin\update-flora.exe --dry-run

# Log detalhado
.\bin\update-flora.exe --log-level debug

# .env em local alternativo
.\bin\update-flora.exe --config C:\segredo\.env

# Verificar versão
.\bin\update-flora.exe --version
```

## Filtro de rank taxonômico

Somente táxons no nível de espécie ou abaixo são importados. Grupos supra-específicos (família, gênero, etc.) são descartados.

Ranks aceitos (PT ou EN, case-insensitive):

| Português    | Inglês       |
|--------------|--------------|
| `ESPECIE`    | `SPECIES`    |
| `SUB_ESPECIE`| `SUBSPECIES` |
| `VARIEDADE`  | `VARIETY`    |
| `FORMA`      | `FORM`       |

## Extensões DwC-A processadas

| Arquivo                    | Campo no documento          |
|----------------------------|-----------------------------|
| `distribution.txt`         | `distribution[]`            |
| `vernacularname.txt`       | `vernacularNames[]`         |
| `speciesprofile.txt`       | `speciesProfile`            |
| `resourcerelationship.txt` | `otherNames[]`              |
| `reference.txt`            | `references[]`              |
| `typesandspecimen.txt`     | `typesAndSpecimens[]`       |

## Campos computados

- **`canonicalName`** — `genus + specificEpithet [+ infraspecificEpithet]`
- **`flatScientificName`** — `scientificName` em minúsculas, somente alfanuméricos (usado para busca)

## Skip por versão

Se o `packageId` do EML (atributo raiz do `eml.xml`) for idêntico ao da última execução bem-sucedida, a importação é ignorada sem processar registros. O `packageId` é gravado em `ingest_runs.dwca.packageId` a cada execução.

## Coleção MongoDB de destino

`dwc2json.taxa` — `_id` baseado em `taxonID` (ou fallback para `scientificNameID` / hash de nome).

## Exit codes

| Código | Significado                                                          |
|--------|----------------------------------------------------------------------|
| `0`    | Sucesso                                                              |
| `2`    | Erro de configuração (`.env` ausente, variável obrigatória faltando) |
| `3`    | Erro de rede (download falhou após retries)                          |
| `4`    | Erro de parsing DwC-A (ZIP corrompido, `meta.xml` inválido)          |
| `5`    | Erro de banco (autenticação, write concern)                          |
| `130`  | Interrupção pelo operador (Ctrl+C / SIGINT)                          |
