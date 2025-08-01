# ChatBB - O "chat" da Biodiversidade Brasileira

O "ChatBB" é um assistente de inteligência artificial que usa um "Large Language Models" (LLM) das empresas OpenIA e Google para interpretar e responder perguntas sobre espécies da biodiversidade brasileira, suas ocorrências, seu risco de extinção, unidades de conservação e espécies invasoras.

O banco de dados em MongoDB, criado pelo projeto "Darwin Core 2 JSON" é conectado ao LLM com base no [protocolo MCP](https://www.anthropic.com/news/model-context-protocol), desenvolvido pela empresa Athropic, e [implementado recentemente pelos desenvolvedores do MongoDB](https://www.mongodb.com/blog/post/announcing-mongodb-mcp-server).

As coleções de dados ofertadas pelo banco de dados ao LLM são as seguintes:

* [Flora e Funga do Brasil](https://floradobrasil.jbrj.gov.br/consulta/).
* [Catálogo Taxonômico da Fauna do Brasil](http://fauna.jbrj.gov.br/)
* Banco de dados de espécies invasoras do [Instituto Hórus](https://institutohorus.org.br/).
* Espécies da flora avaliadas quanto ao risco de extinção pelo [CNCFlora](https://cncflora.jbrj.gov.br/), até 2022.
* [FAUNA - Lista de Espécies Ameaçadas - 2021](https://dados.mma.gov.br/dataset/especies-ameacadas/resource/544f9312-d4c6-4d12-b6ac-51bf3039bbb7)
* [Lista das UCs ativas no CNUC com respectivas categorias de manejo, área, esfera de governo, ano de criação e outras informações. Dados atualizados até março/2025](https://dados.mma.gov.br/dataset/unidadesdeconservacao/resource/f6bf9940-cf30-4ef2-927d-2bd278e4c8af).
* Cerca de 12 milhões de registros de ocorrência da fauna e flora, provenientes de cerca de 490 repositórios (IPTs) - [lista](https://github.com/edalcin/DarwinCoreJSON/blob/main/referencias/occurrences.csv).

Veja aqui alguns exemplos de perguntas e respostas utilizando o ChatBB:

* [Me fale sobre o gênero vriesea](https://trilium.dalc.in/share/lFMRnEIBR5Yu)
* [Quais as espécies invasoras de árvores ocorrem nos parques nacionais?](https://trilium.dalc.in/share/I7vFC96GRy73)
* [Quais as espécies de bromeliaceae ameaçadas de extinção que ocorrem em parques nacionais?](https://trilium.dalc.in/share/nfGgiYw3jhX8)
* [Existe alguma espécie de mammalia invasora ocorrendo em parque nacional?](https://trilium.dalc.in/share/gq7VrTs1VQw9)
* [Mammalia no Parque Nacional de Itatiata](https://trilium.dalc.in/share/UP1QHZIKKImI)
* [Liste as espécies da fauna ameaçada que não estão na coleção taxa. Inclua as informações de filo e classe.](https://trilium.dalc.in/share/dX6Fpw2sC6J2)
* [Quais as espécies de cactus são endêmicas do rio de janeiro?](https://trilium.dalc.in/share/wHVjLmy2GYZH)
* [Qual as 10 famílias de plantas mais coletadas por Filardi?](https://trilium.dalc.in/share/So7cSpBzKg6X)
* [Me fale sobre o parque de itatiaia](https://trilium.dalc.in/share/8DooZZ2m6ZRD)
* [Gostaria de saber mais sobre as espécies ameaçadas](https://trilium.dalc.in/share/hYv76no1dEgS)
* [Existem registros de coletas de plantas em terras indígenas com indicação de uso?](https://trilium.dalc.in/share/yMmZpPBgogyZ)
* [Me fale sobre a Caesalpinia echinata](https://trilium.dalc.in/share/hQnwrXvZKdak)
* [Me fale sobre a restinga de massambaba](https://trilium.dalc.in/share/UILAdy3L13yx)


Caso tenha interesse em participar da fase de testes, entre em contato com Eduardo Dalcin, pelo seu email institucional.
