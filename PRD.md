Quero refatorar este projeto para uma nova estrutura e novos fluxos de processamento. O projeto terá a seguinte estrutura:

- Ingestão de dados brutos disponíveis em repositórios IPT, conforme a lista em `packages\ingest\referencias\occurrences.csv`, para uma base de dados no MongoDB - duas coleções: `taxa_ipt` e `occurrences_ipt`, seguindo os seguintes fluxos: `Taxa Ingestion` e `Occurences Ingestion`
  - as rotinas de ingestão ficarão separadas em `packages\ingest`
  - as coleções no MongoDB conterão os dados brutos existentes nos repositórios IPT, sem qualquer modificação, exceto na modificação da estrutura relacional para a estrutura de documento JSON.
- Transformação dos dados brutos na base de dados, seguindo os fluxos `Taxa Transformation` e `Occurrences Transformation` e criação de duas coleções que vão abrigar os dados transformados: `taxa` e `occurrences`
  - O processo de transformação visa harmonizar dados nos diferentes campos, padronizando e melhorando a qualidade dos dados
  - Alguns dos processos de handling campos já foram definidos em rotinas do código atual. Sempre dar prioridade à os códigos existentes. Apenas arranjá-los nesta nova estrutura de `ingestão`, `transformação` e `exposição`
- Exposição de APIs, usando a plataforma Swagger, para consumo de outros sistemas e das eventuais interfaces que já existem ou serão desenvolvidas.
- Interface
  - Desenvolvimento e manutenção de páginas web para consulta e manutenção dos dados, hoje existentes em `packages\web`
  - O que há de interface hoje deve ser mantido, apenas adaptado para a nova estrutura.

## Coleções MongoDB

### Dados Brutos (Raw)

- `taxa_ipt`: Dados brutos de flora/fauna do IPT
- `occurrences_ipt`: Dados brutos de ocorrências do IPT

### Dados Transformados (Processed)

- `taxa`: Taxonomia harmonizada e validada
- `occurrences`: Ocorrências georreferenciadas e validadas

# IMPORTANTE

- Toda plataforma tecnológica deve ser mantida como está;
- O \_ID do regristros em "taxa_ipt" serão exatamente iguais aos mesmos registros em "taxa"
- O \_ID do regristros em "occurrences_ipt" serão exatamente iguais aos mesmos registros em "occurrences"
- aproveitar ao máximo os códigos, funções e rotinas existentes;
- seguir a estrutura `packages\ingest` para as rotinas de ingestão, `packages\web` para interface e criar `packages\transform` para as rotinas de transformação;
- a estrutura do docker deve ser mantida, com variáveis de ambiente sendo passadas para strings de conexão e KEYs. Nenhuma informação sensível deve ficar exposta no repositório público;
- O Meilisearch pode ser usado, quando necessário. Da mesma forma que o MongoDB, temos um servidor Meilisearch operacional;

## Fluxos de trabalho

### Taxa Ingestion

1. baixar o arquivo de espécies da fauna em `https://ipt.jbrj.gov.br/jbrj/archive.do?r=catalogo_taxonomico_da_fauna_do_brasil`
2. processar o arquivo da fauna
3. baixar o arquivo da flora e funga em `https://ipt.jbrj.gov.br/jbrj/archive.do?r=lista_especies_flora_brasil`
4. processar o arquivo da flora e funga
5. Seguir o seguinte schema para os dados no MongoDB: `docs\schema-dwc2json-taxa-mongoDBJSON.json`

### Occurrences Ingestion

1. acessar a lista de recursos em `packages\ingest\referencias\occurrences.csv`
2. processar todos os arquivos DwC-A contidos nesta lista
3. Seguir o seguinte schema para os dados no MongoDB: `docs\schema-dwc2json-ocorrencias-mongoDBJSON.json`

### Taxa Transformation

#### scientificName

- Deve ser usado para criar o `canonicalName`, com a retirada (parse) do nome do autor

#### Agregação de dados de outras coleções

- Ameaça
  - coleções `cncfloraFungi`, `cncfloraPlantae` e `faunaAmeacada`
- Invasoras
  - coleção `invasoras`
- Presença em Unidades de Conservação
  - Usar o arquivo DwC-A no IPT: `https://ipt.jbrj.gov.br/jbrj/archive.do?r=catalogoucs`

### Occurrences Transformation

#### scientificName

- Checar se é um sinônimo e, caso seja, atualizar para o nome aceito
- Buscar taxonomia na Flora e Fauna
- Buscar e associar TaxonID

#### canonicalName

- Buscar na coleção `taxa`

#### recordedBy

- Trabalhando em um algoritmo aqui: https://github.com/biopinda/coletores-BO

#### eventDate

- Extrair `day`, `month` e `year`
- Transformar para `timestamp`

# continent

- Harmonizar o continente `América do Sul`

# country

- Não ingerir para ocorrências registros que, com grande grau de certeza, não tem o `country` == `Brasil` e todas suas variações.

#### stateProvince

- harmonizar diferentes representações dos estados brasileiros

#### county

- Harmonizar com lista de municipios do IBGE: https://www.ibge.gov.br/explica/codigos-dos-municipios.php

#### Agregação de novos campos como resultado de query nos dados brutos (taxa_ipt)

##### reproductiveCondition

- `reproductiveCondition` = `flor` para:
  - `{ "kingdom": { "$eq": "Plantae" } }`
    `{ "occurrenceRemarks": { "$regex": "(^|[\\s\\p{P}])(flôr|flor)([\\s\\p{P}]|$)" } }`
