# ___Darwin Core Archive to JSON___ - Flora e Funga do Brasil

## Motivação e Justificativa

A [Flora e Funga do Brasil](http://floradobrasil.jbrj.gov.br/reflora/listaBrasil/ConsultaPublicaUC/ConsultaPublicaUC.do) é uma base de dados de referência nacional para a biodiversidade de plantas e fungos. Além da interface de acesso aos dados, o acesso pode ser feito via [___web services___](https://servicos.jbrj.gov.br/v2/flora/) e parte dos dados podem ser "baixados" no formato [___Darwin Core Archive___ (DwC-A)](https://www.gbif.org/pt/darwin-core), através do recurso disponível no [IPT institucional](https://ipt.jbrj.gov.br/jbrj/resource?r=lista_especies_flora_brasil).

Entretanto, [a estrutrura relacional do formato DwC-A](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0029715) exige do {usuário, analista, cientista de dados, pesquisador etc} um esforço adicional para relacionar e integrar as diferentes tabelas para gerar a informação necessária.

Em essência, o formato DwC-A é um formato de transferência de dados entre aplicações. Porém, altamente específico para o domínio da biodiversidade, em especial, para atender a demanda por agregação de dados de provedores na base de dados do [GBIF](https://www.gbif.org/).
