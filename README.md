[![Update MongoDB - Flora](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-flora.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-flora.yml)
[![Update MongoDB - Fauna](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-fauna.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-fauna.yml)
[![Update MongoDB - Ocorrências](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-occurrences.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-occurrences.yml)
[![Docker Image](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/docker.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/pkgs/container/darwincorejson)

# Base de Dados Integrada da Biodiversidade Brasileira
# (DwC2JSON V4.0)
[Eduardo Dalcin](https://github.com/edalcin) e [Henrique Pinheiro](https://github.com/Phenome)<br>
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.10782707.svg)](https://doi.org/10.5281/zenodo.10782707)

## Histórico do Projeto

Este projeto iniciou em novembro de 2023 com a proposta de converter dados da [Flora e Funga do Brasil](http://floradobrasil.jbrj.gov.br/reflora/listaBrasil/ConsultaPublicaUC/ConsultaPublicaUC.do), do formato [___Darwin Core Archive___ (DwC-A)](https://www.gbif.org/pt/darwin-core), [disponível](https://ipt.jbrj.gov.br/jbrj/resource?r=lista_especies_flora_brasil) no IPT do JBRJ, para o [formato JSON](https://pt.wikipedia.org/wiki/JSON) e criar uma base de dados neste formato no [MongoDB](https://www.mongodb.com/).

Após esta etapa, decidimos agregar à base de dados no MongoDB o [Catálogo Taxonômico da Fauna do Brasil](http://fauna.jbrj.gov.br/), também [disponível](https://ipt.jbrj.gov.br/jbrj/resource?r=catalogo_taxonomico_da_fauna_do_brasil) no IPT do JBRJ.

Com a agregação das duas fontes de dados - flora (+fungi) e fauna, um conjunto de dados taxonômicos com mais de 290 mil nomes passou a ficar disponível e, como prova de conceito, algumas interfaces para estes conjuntos de dados foram criadas:

* [Busca por gênero ou espécie](https://dwc2json.dalc.in/taxa)
* [Conjunto de APIs](https://dwc2json.dalc.in/api)
* [Mapa de Distribuição](https://dwc2json.dalc.in/mapa)
* [Dashboard](https://dwc2json.dalc.in/dashboard)

Na terceira etapa, resolvemos agregar dados de ocorrência, provenientes se 15 diferentes [IPTs](https://www.gbif.org/pt/ipt), disponibilizando 493 conjuntos de dados de ocorrências ([lista](https://github.com/edalcin/DarwinCoreJSON/blob/main/referencias/occurrences.csv)). Vale notar que os conjuntos de dados passam por uma curadoria, evitando a duplicação de dados na base do MongoDB, por conjuntos de dados que estão publicados em diferentes IPTs (ver ["matriz de seleção"](https://github.com/edalcin/DarwinCoreJSON/blob/main/referencias/matrizSelecaoFontes.md)).

Um diferencial desta base de dados é que todo o domingo 3 "actions" de atualização da base de dados no MongoDB são acionadas, percorrendo [uma rotina]() que atualiza a base de dados taxonômica e de ocorrências, com base nas últimas versões dos conjuntos de dados disponíveis nos IPTs.


