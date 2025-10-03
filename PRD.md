Quero refatorar este projeto para uma nova estrutura e novos fluxos de processamento. O projeto terá a seguinte estrutura:

- Ingestão de dados brutos disponíveis em repositórios IPT, conforme a lista em `packages\ingest\referencias\occurrences.csv`, para uma base de dados no MongoDB - duas coleções: `taxaipt` e `ococorrenciasipt`, seguindo os seguintes fluxos: `Taxa Ingestion` e `Occurences Ingestion`
  - as rotinas de ingestão ficarão separadas em `packages\ingest`
  - as coleções no MongoDB conterão os dados brutos existentes nos repositórios IPT, sem qualquer modificação, exceto na modificação da estrutura relacional para a estrutura de documento JSON.
- Transformação dos dados brutos na base de dados, seguindo os fluxos `Taxa Transformation` e `Occurrences Transformation` e criação de duas coleções que vão abrigar os dados transformados: `taxa` e `ocorrencias`
  - O processo de transformação visa harmonizar dados nos diferentes campos, padronizando e melhorando a qualidade dos dados
  - Alguns dos processos de handling campos já foram definidos em rotinas do código atual. Sempre dar prioridade à os códigos existentes. Apenas arranjá-los nesta nova estrutura de `ingestão` e `transformação`
- Exposição de APIs, usando a plataforma Swagger, para consumo de outros sistemas e das eventuais interfaces que já existem ou serão desenvolvidas.
- Interface
  - Desenvolvimento e manutenção de páginas web para consulta e manutenção dos dados, hoje existentes em `packages\web`
  - O que há de interface hoje deve ser mantido, apenas adaptado para a nova estrutura.

# IMPORTANTE

- aproveitar os códigos, funções e rotinas existentes
- seguir a estrutura `packages\ingest` para as rotinas de ingestão, `packages\web` para interface e criar `packages\transform` para as rotinas de transformação.

## Fluxos de trabalho

### Taxa Ingestion

[A SER DEFINIDO]

### Occurrences Ingestion

[A SER DEFINIDO]

### Taxa Transformation

[A SER DEFINIDO]

### Occurrences Transformation

[A SER DEFINIDO]
