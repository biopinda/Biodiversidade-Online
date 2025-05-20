# ChatBB - O "chat" da Biodiversidade Brasileira

O "ChatBB" é um assistente de inteligência artificial que usa um "Large Language Models" (LLM) da empresa OpenIA, criadora do ChatGPT, para interpretar e responder perguntas sobre espécies da biodiversidade brasileira e suas ocorrências.

O banco de dados em MongoDB, criado pelo projeto "Darwin Core 2 JSON" é conectado ao LLM com base no [protocolo MCP](https://www.anthropic.com/news/model-context-protocol), desenvolvido pela empresa Athropic, e [implementado recentemente pelos desenvolvedores do MongoDB](https://www.mongodb.com/blog/post/announcing-mongodb-mcp-server).

As coleções de dados ofertadas pelo banco de dados ao LLM são as seguintes:

* [Flora e Funga do Brasil](https://floradobrasil.jbrj.gov.br/consulta/).
* [Catálogo Taxonômico da Fauna do Brasil](http://fauna.jbrj.gov.br/)
* Banco de dados de espécies invasoras do [Instituto Hórus](https://institutohorus.org.br/).
* Espécies da flora avaliadas quanto ao risco de extinção pelo [CNCFlora](https://cncflora.jbrj.gov.br/), até 2022.
* Cerca de 12 milhões de registros de ocorrência da fauna e flora, provenientes de cerca de 490 repositórios (IPTs) - [lista](https://github.com/edalcin/DarwinCoreJSON/blob/main/referencias/occurrences.csv).

A utilização do "ChatBB" usa o LLM da OpenAI (4.1-mini) que requer uma chave de API que consome créditos em UD$. O valor mínimo para colocar de crédito é USD$5, mas com este valor é possível realizar milhares de consultas.

Caso tenha interesse em participar da fase de testes, entre em contato com Eduardo Dalcin, pelo seu email institucional.