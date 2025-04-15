[![Update MongoDB - Flora](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-flora.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-flora.yml)
[![Update MongoDB - Fauna](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-fauna.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-fauna.yml)
[![Update MongoDB - Ocorrências](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-occurrences.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/update-mongodb-occurrences.yml)
[![Docker Image](https://github.com/edalcin/DarwinCoreJSON/actions/workflows/docker.yml/badge.svg)](https://github.com/edalcin/DarwinCoreJSON/pkgs/container/darwincorejson)

# Base de Dados Integrada da Biodiversidade Brasileira
[Eduardo Dalcin](https://github.com/edalcin) e [Henrique Pinheiro](https://github.com/Phenome)


## Histórico do Projeto

Este projeto iniciou com a proposta de converter dados de ocorrência e de lista de espécies no formato [Darwin Core (DwC)](), disponíveis nos [IPTs] de diferentes instituições nacionais, para o formato [JSON]() e carregar os dados em um banco de dados [MongoDB](). A motivação para o projeto era a de facilitar o acesso aos dados, transformando-os de um formato de tabelas relacionadas, no [DwC Archive](), para um formato de documentos JSON, armazenados em um banco de dados orientado a documentos, como o MongoDB.





```mermaid
flowchart LR
    0[IPTs institucionais] --> 1[SiBBr]
    
    0 --> 2[JBRJ]
    2 --> 3[JABOT]
    2 --> 4[REFLORA]
    0 --> 5[FIOCRUZ]
    0 --> 6[CRIA]
    0 --> 7[TAXONLINE]
    1 --> 11[MN]
    1 --> 12[MPEG]
    1 --> 13[INPA]
    1 --> C

    11 --> C
    12 --> C
    12 --> D
    13 --> D
    13 --> C
    2 --> A
    2 --> B
    2 --> D
    3 --> D
    4 --> D
    5 --> C
    6 --> C
    6 --> D
    7 --> C

    A[Espécies da Flora em DwC] --> A1[Taxa no MongoDB]
    B[Espécies da Fauna em DwC] --> A1
    C[Ocorrencias de Fauna] --> C1[Ocorrencias no MongoDB]
    D[Ocorrencia de Flora] --> C1
```