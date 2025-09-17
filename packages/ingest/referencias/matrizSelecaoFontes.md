## Matriz de seleção de recurso duplicados em repositórios

Alguns recursos, especialmente herbários, estão publicados em diferentes repositórios (IPTs). Para evitar duplicação de registros de ocorrência na base, quando o recurso é presente em mais de um repositório, foi usada a matriz abaixo para buscar os registros:

| Repositório 1 | Repositório 2 | Repositório 3 | Selecionado |
| --- | --- | --- | --- |
| JABOT | REFLORA | SpeciesLink | JABOT |
| JABOT |  | SpeciesLink | JABOT |
|  | REFLORA | SpeciesLink | REFLORA |
| JABOT | REFLORA |  | JABOT |
|  | REFLORA |  | REFLORA |
| JABOT |  |  | JABOT |
|  |  | SpeciesLink | SpeciesLink |

A lista completa dos recursos está em https://github.com/biopinda/DarwinCoreJSON/blob/main/packages/ingest/referencias/occurrences.csv

