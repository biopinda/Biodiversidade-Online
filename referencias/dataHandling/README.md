## Data Flow

* criado canonicalName como genus+" "+epitetSpecific+" "+infraspecificEpithet
  * artifício para buscar melhor match com ocorrências uma vez que o $lookup com campos multiplos não funcionou
* Identificado problemas com "cf. e "aff."
* Identificado problema com subGenus
* Retirado herbários duplicados do source.reflora
* 