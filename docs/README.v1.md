# **_Darwin Core Archive to JSON_** - Flora e Funga do Brasil

[Eduardo Dalcin](https://github.com/edalcin) e [Henrique Pinheiro](https://github.com/Phenome)

---

## Motivação e Justificativa

A [Flora e Funga do Brasil](http://floradobrasil.jbrj.gov.br/reflora/listaBrasil/ConsultaPublicaUC/ConsultaPublicaUC.do) é uma base de dados de referência nacional para a biodiversidade de plantas e fungos. Além da interface de acesso aos dados, o acesso pode ser feito via [**_web services_**](https://servicos.jbrj.gov.br/v2/flora/) e parte dos dados podem ser "baixados" no formato [**_Darwin Core Archive_** (DwC-A)](https://www.gbif.org/pt/darwin-core), através do recurso disponível no [IPT institucional](https://ipt.jbrj.gov.br/jbrj/resource?r=lista_especies_flora_brasil).

Entretanto, [a estrutrura relacional do formato DwC-A](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0029715) exige do {usuário, analista, cientista de dados, pesquisador etc} um esforço adicional para relacionar e integrar as diferentes tabelas para gerar a informação necessária.

Em essência, o formato DwC-A é um formato de transferência de dados entre aplicações. Porém, altamente específico para o domínio da biodiversidade, em especial, para atender a demanda por agregação de dados de provedores na base de dados do [GBIF](https://www.gbif.org/).

Por outro lado, [formato JSON](https://pt.wikipedia.org/wiki/JSON) é uma forma de armazenar e transferir dados, sob a forma de **_documentos_**, que se tornou muito popular com as aplicações baseadas na **_web_**. Em resumo, o formato JSON:

- É uma formatação leve e compacto de troca de dados;
- Para seres humanos, é fácil de ler e escrever;
- Para máquinas, é fácil de interpretar e gerar;
- É um padrão aberto independente de linguagem;
- Utiliza texto legível a humanos, no formato atributo-valor, de natureza auto-descritiva.

Além disto a base de dados da Flora e Funga do Brasil possui hoje mais de 135.000 nomes científicos e o produto cartesiano das relações entre todas as tabelas gera um conjunto de registros significativo para a manipulação visando análise para geração de informação relevante.

Com esta aplicação, é possível importar o conjunto de dados da Flora e Funga do Brasil, disponível no formato DwC-A, para um sistema gerenciador de bancos de dados orientado à documentos, como o [MongoDB](https://www.mongodb.com/), por exemplo, e realizar consultas e definir filtros de forma mais simples, para o {usuário, analista, cientista de dados, pesquisador etc} sem maiores conhecimentos técnicos e de **_SQL_**, e sem o custo computacional gerado pelas "JOINs".

Por fim, a importância do conjunto de dados da Flora e Funga do Brasil para a conservação e uso sustentável e socielmente justo da biodiversidade brasileira requer que sua disponibilidade e facilidade de uso seja sempre ampliada e potencializada pela oferta do seu conjunto de dados em diferentes formatos, para que possa causar o maior impacto possível na tomada de decisão e na formulação de políticas públicas relacionadas com a biodiversidade vegetal brasileira.

## Objetivo

- Criar uma ferramenta livre, gratuita e de código que ofereça os dados publicados pela Flora e Funga do Brasil em formato Darwin Core Archive no IPT, em formato JSON
- Oferecer a ferramenta em um [**_Docker_**](<https://pt.wikipedia.org/wiki/Docker_(software)>), onde o usuário pode instalar em sua máquina local ou em um servidor

---

## [Clique aqui para acessar o DEMO](https://dwca2json.deno.dev/taxa/)
