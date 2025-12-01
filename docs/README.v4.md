[![Update MongoDB - Flora](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-flora.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-flora.yml)
[![Update MongoDB - Fauna](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-fauna.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-fauna.yml)
[![Update MongoDB - Ocorrências](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-occurrences.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-occurrences.yml)
[![Docker Image](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/docker.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/pkgs/container/darwincorejson)

# Base de Dados Integrada da Biodiversidade Brasileira

# (DwC2JSON V4.0)

[Eduardo Dalcin](https://github.com/edalcin) e [Henrique Pinheiro](https://github.com/Phenome)<br>
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.15261018.svg)](https://doi.org/10.5281/zenodo.15261018)

> :warning: **Atenção:** Acompanhe o desenvolvimento do ["ChatBB"](https://github.com/biopinda/Biodiversidade-Online/blob/main/chatbb.md).

## Histórico do Projeto

Este projeto iniciou em novembro de 2023 com a proposta de converter dados da [Flora e Funga do Brasil](http://floradobrasil.jbrj.gov.br/reflora/listaBrasil/ConsultaPublicaUC/ConsultaPublicaUC.do), do formato [**_Darwin Core Archive_** (DwC-A)](https://www.gbif.org/pt/darwin-core), [disponível](https://ipt.jbrj.gov.br/jbrj/resource?r=lista_especies_flora_brasil) no IPT do JBRJ, para o [formato JSON](https://pt.wikipedia.org/wiki/JSON) e criar uma base de dados neste formato no [MongoDB](https://www.mongodb.com/).

Após esta etapa, decidimos agregar à base de dados no MongoDB o [Catálogo Taxonômico da Fauna do Brasil](http://fauna.jbrj.gov.br/), também [disponível](https://ipt.jbrj.gov.br/jbrj/resource?r=catalogo_taxonomico_da_fauna_do_brasil) no IPT do JBRJ.

Com a agregação das duas fontes de dados - flora (+fungi) e fauna, um conjunto de dados taxonômicos com mais de 290 mil nomes passou a ficar disponível e, como prova de conceito, algumas interfaces para estes conjuntos de dados foram criadas:

- [Busca por gênero ou espécie](https://dwc2json.dalc.in/taxa)
- [Conjunto de APIs](https://dwc2json.dalc.in/api)
- [Mapa de Distribuição](https://dwc2json.dalc.in/mapa)
- [Dashboard](https://dwc2json.dalc.in/dashboard)

Na terceira etapa, resolvemos agregar dados de ocorrência, provenientes se 15 diferentes [IPTs](https://www.gbif.org/pt/ipt), disponibilizando 493 conjuntos de dados de ocorrências ([lista](https://github.com/biopinda/Biodiversidade-Online/blob/main/packages/ingest/referencias/occurrences.csv)). Vale notar que os conjuntos de dados passam por uma curadoria, evitando a duplicação de dados na base do MongoDB, por conjuntos de dados que estão publicados em diferentes IPTs (ver ["matriz de seleção"](https://github.com/biopinda/Biodiversidade-Online/blob/main/packages/ingest/referencias/matrizSelecaoFontes.md)).

Um diferencial desta base de dados é que todo o domingo 3 "actions" de atualização da base de dados no MongoDB são acionadas, percorrendo [uma rotina](https://github.com/biopinda/Biodiversidade-Online/blob/main/atualizacao.md) que atualiza a base de dados taxonômica e de ocorrências, com base nas últimas versões dos conjuntos de dados disponíveis nos IPTs.

## Versão atual da proposta do projeto - versão 4.0

Acreditamos que uma versão integrada destes conjuntos de dados - fauna, flora, fungos, e suas ocorrências, em uma base atualizada, de dados de acesso aberto e gratuito, é um recurso valioso, que pode:

- servir para gerar informação relevante para a conservação e uso sustentável e socialmente justo da biodiversidade;
- possibilitar a agregação de outros conjuntos de dados relevantes como dados de espécies invasoras, dados de avaliação de risco de extinção, dados de interação entre animais e plantas, dados de diversidade química e genética, dado de usos por comunidades tradicionais etc., aumentando significativamente o potencial de gerar informação relevante com estes conjuntos de dados;
- ser utilizado para treinar modelos de inteligência artificial, aumentando a precisão e confiabilidade, possibilitando uma generalização mais eficaz, reduzindo o viés e melhorando o desempenho e eficiência destes modelos.

## Evolução da proposta e do projeto

Uma vez que o produto deste projeto são os dois conjuntos de dados em formato JSON, gerenciados pelo MongoDB - "taxa" e "ocorrencias", pensamos que o futuro da proposta pode ser direcionado para agregar qualidade nestes conjuntos de dados, em espacial nos dados de ocorrência, [notoriamente de baixa qualidade](https://www.ibge.gov.br/geociencias/investigacoes-experimentais-geo/informacoes-geocientificas-experimentais/38371-avaliacao-dos-dados-sobre-a-biodiversidade-brasileira.html).

Comentários e sugestões são muito bem-vindos, na [área de "issues"](https://github.com/biopinda/Biodiversidade-Online/issues).
