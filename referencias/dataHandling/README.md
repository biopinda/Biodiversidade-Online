## Data Flow

* criado canonicalName como genus+" "+epitetSpecific+" "+infraspecificEpithet
  * artifício para buscar melhor match com ocorrências uma vez que o $lookup com campos multiplos não funcionou
* Retirado herbários duplicados do source.reflora
* 