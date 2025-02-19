# Visualização de Dados sobre Biodiversidade Brasileira




```mermaid
flowchart TD
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