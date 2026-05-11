# ipt-compare

Compara os recursos de um endpoint IPT com o arquivo `occurrences.csv` e lista os que estão ausentes, com opção de adicioná-los.

## Uso

```
ipt-compare --endpoint URL [opções]
```

## Parâmetros

| Parâmetro | Obrigatório | Padrão | Descrição |
|---|---|---|---|
| `--endpoint URL` | Sim | — | URL do endpoint de inventário do IPT (formato `/inventory/v2/dataset`) |
| `--csv PATH` | Não | `data/occurrences.csv` (auto-detectado) | Caminho para o arquivo CSV de fontes |
| `--add` | Não | `false` | Adicionar recursos ausentes ao CSV |
| `--yes` | Não | `false` | Pular confirmação interativa (usar com `--add`) |
| `--kingdom NOME` | Não | `""` | Kingdom a atribuir aos novos recursos (ex: `Plantae`, `Animalia`) |

## Exemplos

```bash
# Listar recursos ausentes (não modifica nada)
./ipt-compare --endpoint "https://ipt.jbrj.gov.br/jabot/inventory/v2/dataset"

# Listar com kingdom definido para novos recursos
./ipt-compare --endpoint "https://ipt.jbrj.gov.br/jabot/inventory/v2/dataset" --kingdom Plantae

# Adicionar com confirmação interativa
./ipt-compare --endpoint "https://ipt.jbrj.gov.br/jabot/inventory/v2/dataset" --add

# Adicionar sem confirmação
./ipt-compare --endpoint "https://ipt.jbrj.gov.br/jabot/inventory/v2/dataset" --add --yes

# Adicionar com kingdom e CSV customizado
./ipt-compare \
  --endpoint "https://ipt.jbrj.gov.br/jabot/inventory/v2/dataset" \
  --add --yes \
  --kingdom Plantae \
  --csv /caminho/para/occurrences.csv
```

## Comportamento padrão (sem `--add`)

O script apenas lista os recursos ausentes. Nenhum arquivo é modificado.

```
Endpoint : https://ipt.jbrj.gov.br/jabot/inventory/v2/dataset
CSV      : /caminho/para/data/occurrences.csv

IPT base : https://ipt.jbrj.gov.br/jabot/  (repo=jabot)
Recursos no IPT: 116
Entradas no CSV: 505

Recursos ausentes no CSV: 19
----------------------------------------------------------------------
  [  1] PALM - Herbário do Campus Palmeira das Missões da UFSM
        tag: palm
        url: https://ipt.jbrj.gov.br/jabot/archive.do?r=palm
  ...
----------------------------------------------------------------------

Use --add para adicionar ao CSV (--yes para pular confirmação).
```

## Backup automático

Ao usar `--add`, o script **sempre** cria um backup antes de modificar o CSV:

```
occurrences_backup_20260511.csv
```

O nome usa a data atual no formato `YYYYMMDD`. Se o backup do dia já existir, ele é sobrescrito.

## Filtros aplicados

Somente recursos com `format=DWCA` e `core=OCCURRENCE` são considerados. Recursos em outros formatos (ex: checklists) são contabilizados como "ignorados" na saída.

## Resolução do CSV

Se `--csv` não for informado, o script procura `data/occurrences.csv` nas seguintes localizações, em ordem:

1. Diretório de trabalho atual (`./data/occurrences.csv`)
2. Diretório do executável (`bin/data/occurrences.csv`)
3. Diretório pai do executável (`../data/occurrences.csv`)

## Formato de saída dos novos recursos no CSV

Cada recurso novo é adicionado ao final do CSV com as colunas:

```
nome,repositorio,kingdom,tag,url
```

- `nome` — título do recurso no IPT
- `repositorio` — derivado do path da URL base (ex: `jabot` de `ipt.jbrj.gov.br/jabot/`)
- `kingdom` — valor do parâmetro `--kingdom` (vazio se não informado)
- `tag` — shortname do recurso no IPT (ex: `palm`, `ufg`)
- `url` — URL base do IPT (ex: `https://ipt.jbrj.gov.br/jabot/`)
