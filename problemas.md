# Problemas com o DwC da Flora

Ficha do pau-brasil: http://reflora.jbrj.gov.br/reflora/listaBrasil/FichaPublicaTaxonUC/FichaPublicaTaxonUC.do?id=FB602728


## distribution.txt

* As colunas "countryCode", "establishmentMeans" e "occurrenceRemarks" são redundantes
* "occorenceRemarks" com vários termos

| id	| locationID	| countryCode	| establishmentMeans	| occurrenceRemarks |
| --- | --- | --- | --- | --- |
|602728 | BR-ES | BR | NATIVA | {"endemism":"Endemica","phytogeographicDomain":["Mata Atlântica"]} |
|602728 | BR-RJ | BR | NATIVA | {"endemism":"Endemica","phytogeographicDomain":["Mata Atlântica"]} |
|602728 | BR-SE | BR | NATIVA | {"endemism":"Endemica","phytogeographicDomain":["Mata Atlântica"]} |
|602728 | BR-RN | BR | NATIVA | {"endemism":"Endemica","phytogeographicDomain":["Mata Atlântica"]} |
|602728 | BR-PE | BR | NATIVA | {"endemism":"Endemica","phytogeographicDomain":["Mata Atlântica"]} |
|602728 | BR-PB | BR | NATIVA | {"endemism":"Endemica","phytogeographicDomain":["Mata Atlântica"]} |
|602728 | BR-BA | BR | NATIVA | {"endemism":"Endemica","phytogeographicDomain":["Mata Atlântica"]} |
|602728 | BR-AL | BR | NATIVA | {"endemism":"Endemica","phytogeographicDomain":["Mata Atlântica"]} |
|604183 | BR-ES | BR | NATIVA | {"endemism":"Endemica","phytogeographicDomain":["Mata Atlântica"]} |


## speciesprofile.txt

* "lifeForm" contendo vários termos
* "habitat" nulo

| id | lifeForm | habitat |
| --- | --- | --- |
| 602728 | {"lifeForm":["Árvore"],"habitat":["Terrícola"],"vegetationType":["Floresta Estacional Semidecidual","Floresta Ombrófila (= Floresta Pluvial)","Restinga"]}	|  |
