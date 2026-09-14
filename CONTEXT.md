# Biodiversidade.Online — Base DuckDB de Espécies e Ocorrências

Ferramenta de linha de comando que baixa dados de fauna, flora e ocorrências publicados por fontes IPT em Darwin Core Archive, harmoniza esses dados e os grava em um único arquivo DuckDB, com nomes de atributo no padrão Darwin Core.

## Language

**Fonte IPT**:
Um repositório publicado via IPT (Integrated Publishing Toolkit) que expõe um Darwin Core Archive baixável por HTTP. Cada fonte tem uma `tag` (identificador estável) e um `tipo` (`taxa` ou `ocorrencias`).
_Avoid_: "dataset" ou "repositório" isolado sem deixar claro que é uma fonte IPT.

**Harmonização**:
O processo de normalizar um registro bruto de uma Fonte IPT para o vocabulário, os tipos e a estrutura do Darwin Core antes da gravação no banco — inclui coerção de tipos, tradução PT→EN de valores canônicos, filtragem de táxons não-folha, e descarte de campos fora do padrão DwC.
_Avoid_: "limpeza" sozinho (é mais amplo que limpeza: também envolve tradução e enriquecimento).

**Execução (Ingest Run)**:
Uma passada completa do script sobre uma Fonte IPT, registrada na tabela `ingest_runs` com contadores, status e metadados do pacote DwC-A (para permitir pular execuções cuja versão não mudou).
_Avoid_: "job", "task" isolados sem indicar que é uma execução de ingestão auditada.

**Taxon / Occurrence (núcleo)**:
As duas classes centrais do Darwin Core que este projeto persiste como tabelas próprias (`taxon`, `occurrence`), com colunas fixas correspondendo aos termos DwC — não um passthrough livre de qualquer campo que a fonte trouxer.

**Tabela de extensão**:
Tabela DuckDB que espelha uma extensão DwC-A do núcleo `taxon` (ex.: `taxon_vernacular_name`, `taxon_distribution`), ligada por `taxonID`, contendo valores já harmonizados — não uma cópia crua do arquivo de extensão.
