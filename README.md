# Visualização de Dados sobre Biodiversidade Brasileira

## Histórico do Projeto

Este projeto iniciou com a proposta de converter dados de ocorrência e de lista de espécies no formato [Darwin Core (DwC)](), disponíveis nos [IPTs] de diferentes instituições nacionais, para o formato [JSON]() e carregar os dados em um banco de dados [MongoDB](). A motivação para o projeto era a de facilitar o acesso aos dados, transformando-os de um formato de tabelas relacionadas, no [DwC Archive](), para um formato de documentos JSON, armazenados em um banco de dados orientado a documentos, como o MongoDB.





```mermaid
flowchart TD
    0[IPTs institucionais] --> 1
    0 --> 2
    0 --> 3
    0 --> 4
    1[Espécies da Flora em DwC] --> A[Espécies no MongoDB]
    2[Espécies da Fauna em DwC] --> A
    3[Ocorrencias de Fauna] --> B[Ocorrencias no Mongo]
    4[Ocorrencia de Flora] --> B
    B --> 5[Portal de Visualização]
    A --> 5
    5 --> 6[Visualização Espacial]
    5 --> 7[Geração de Listas]
    5 --> 8[Dashboard de estatísticas]
    6 --> 9[Mapa de distribuição das espécies]
    6 --> 10[Mapa de Distribuição das ocorrências]


```