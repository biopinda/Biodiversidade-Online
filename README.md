[![Update MongoDB - Flora](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-flora.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-flora.yml)
[![Update MongoDB - Fauna](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-fauna.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-fauna.yml)
[![Update MongoDB - Ocorrências](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-occurrences.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-occurrences.yml)
[![Docker Image](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/docker.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/pkgs/container/darwincorejson)
[![DOI](https://zenodo.org/badge/576212307.svg)](https://doi.org/10.5281/zenodo.10458671)

# ChatBB - O "chat" da Biodiversidade Brasileira
# (DwC2JSON V5.0)

Esta nova versão do projeto DWC2JSON (ver histórico em [versão1](https://github.com/edalcin/DarwinCoreJSON/blob/main/README.v1.md), [versão2](https://github.com/edalcin/DarwinCoreJSON/blob/main/README.v2..md), [versão4](https://github.com/edalcin/DarwinCoreJSON/blob/main/README.v4.md)), se aproveita do [protocolo MCP](https://www.anthropic.com/news/model-context-protocol), desenvolvido pela empresa Athropic, [implementado recentemente pelos desenvolvedores do MongoDB](https://www.mongodb.com/blog/post/announcing-mongodb-mcp-server), para conectar a [base de dados integrada da biodiversidade brasileira]() com a [plataforma da OpenIA](https://platform.openai.com/docs/overview) e criar o "ChatBB - O Assistente Virtual Inteligente da Biodiversidade Brasileira".

O "ChatBB" é um assistente de inteligência artificial que usa um "Large Language Models" (LLM) da empresa OpenIA, criadora do ChatGPT, para interpretar e responder perguntas sobre espécies da biodiversidade brasileira e suas ocorrências, seu grau de ameaça, espécies invasoras e unidades de conservação em território nacional.

As coleções de dados ofertadas ao LLM pela base de dados integrada são as seguintes:

* [Flora e Funga do Brasil](https://floradobrasil.jbrj.gov.br/consulta/).
* [Catálogo Taxonômico da Fauna do Brasil](http://fauna.jbrj.gov.br/)
* Banco de dados de espécies invasoras do [Instituto Hórus](https://institutohorus.org.br/).
* Espécies da flora avaliadas quanto ao risco de extinção pelo [CNCFlora](https://cncflora.jbrj.gov.br/), até 2022.
* [FAUNA - Lista de Espécies Ameaçadas - 2021](https://dados.mma.gov.br/dataset/especies-ameacadas/resource/544f9312-d4c6-4d12-b6ac-51bf3039bbb7)
* [Lista das UCs ativas no CNUC com respectivas categorias de manejo, área, esfera de governo, ano de criação e outras informações. Dados atualizados até março/2025](https://dados.mma.gov.br/dataset/unidadesdeconservacao/resource/f6bf9940-cf30-4ef2-927d-2bd278e4c8af).
* Cerca de 12 milhões de registros de ocorrência da fauna e flora, provenientes de cerca de 490 repositórios (IPTs) - [lista](https://github.com/edalcin/DarwinCoreJSON/blob/main/referencias/occurrences.csv).

A utilização do "ChatBB" usa o LLM da OpenAI (4.1-mini) que requer uma chave de API que consome créditos em UD$. O valor mínimo para colocar de crédito é USD$5, mas com este valor é possível realizar milhares de consultas. O uso de outros LLMs será habilitado conforme a evolução da proposta.

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
* [Me fale sobre os parques nacionais. Quantos são em cada estado?](https://trilium.dalc.in/share/ULXsWsPpnSy1)

O ChatBB ainda está em fase de testes e ajustes em seu "prompt" e a ideia é que seja colocado em produção para os interessados.

Dúvidas e sugestões podem ser registradas [nos "issues"](https://github.com/edalcin/DarwinCoreJSON/issues).

Citação da ferramenta:[Henrique Pinheiro, & Eduardo Dalcin. (2025). edalcin/DarwinCoreJSON: ChatBB - O "chat" da Biodiversidade Brasileira (DWC2JSON V5.0) (v5.0). Zenodo. https://doi.org/10.5281/zenodo.15511063](https://doi.org/10.5281/zenodo.15511063)
