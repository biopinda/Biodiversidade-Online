[![Update MongoDB - Flora](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-flora.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-flora.yml)
[![Update MongoDB - Fauna](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-fauna.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-fauna.yml)
[![Update MongoDB - Ocorrências](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-occurrences.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-occurrences.yml)
[![Docker Image](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/docker.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/pkgs/container/darwincorejson)

# **_Darwin Core Archive to JSON_**

[Eduardo Dalcin](https://github.com/edalcin) e [Henrique Pinheiro](https://github.com/Phenome)

## Motivação e Justificativa - V.2

O início deste projeto tinha uma motivação e justificativa mais modesta, como pode ser visto na [versão 1 do README](https://github.com/biopinda/Biodiversidade-Online/blob/main/README.v1.md). Entretanto, com o avançar do desenvolvimento da ferramenta, o escopo do projeto se ampliou.

No início, o foco do projeto era apenas ler o arquivo "[Darwin Core](https://dwc.tdwg.org/)" da [Flora e Funga do Brasil](https://floradobrasil.jbrj.gov.br/consulta/), publicado no [IPT do JBRJ](https://ipt.jbrj.gov.br/jbrj/resource?r=lista_especies_flora_brasil), e convertê-lo para o formato [JSON](https://www.json.org/json-pt.html), incluindo os documentos das "espécies" no [MongoDB](https://www.mongodb.com/), um banco de dados orientado à documentos, gratuito e de código aberto. Como "bônus", uma [interface de consulta simples](https://dwca2json.deno.dev/taxa) também foi criada, que também funciona como API, para consumir as fichas de espécie no formato JSON.

Com a publicação dos dados do [Catálogo Taxonômico da Fauna do Brasil](http://fauna.jbrj.gov.br/) no [IPT do JBRJ](https://ipt.jbrj.gov.br/jbrj/resource?r=catalogo_taxonomico_da_fauna_do_brasil), surgiu a ideia de também incorporar os dados da fauna no banco de dados, tendo as fichas das espécies da fauna e da flora unificadas no banco de dados.

Uma vez que o código implementado era genérico o suficiente para reconhecer e automatizar a conversão de diferentes "cores", como o de "ocorrências", surgiu a ideia então de criar uma coleção no mesmo banco de dados dedicado para ficha de ocorrências da flora e da fauna, nos diferentes IPTs públicos.

Desta forma, o banco criado por esta ferramenta hoje conta com cerca de 278 mil nomes de espécie e cerca de 12 milhões de fichas de ocorrências, provenientes de [458](https://github.com/biopinda/Biodiversidade-Online/blob/main/packages/ingest/referencias/occurrences.csv) recursos publicados em 10 diferentes IPTs.

Um dos aspectos mais significativos desta proposta é que todo o banco de dados é atualizado em poucos minutos, apenas clicando nas "[actions](https://github.com/biopinda/Biodiversidade-Online/actions)" de atualização da fauna, flora e ocorrências.

Um conjunto de APIs e páginas está disponível aqui para demonstração do projeto:

- https://dwca2json.deno.dev/taxa
- https://dwca2json.deno.dev/api
- https://dwca2json.deno.dev/mapa
- https://dwca2json.deno.dev/dashboard

Criticas, sugestões e "[issues](https://github.com/biopinda/Biodiversidade-Online/issues)" são sempre bem-vindas!
