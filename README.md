# Biodiversidade.Online V6.0 - Uma Base de Dados Integrada da Biodiversidade Brasileira

[Eduardo Dalcin](https://github.com/edalcin) e [Henrique Pinheiro](https://github.com/Phenome)<br>
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.15261018.svg)](https://doi.org/10.5281/zenodo.15261018)

[![Update MongoDB - Flora](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-flora.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-flora.yml)
[![Update MongoDB - Fauna](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-fauna.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-fauna.yml)
[![Update MongoDB - Ocorrências](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-occurrences.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-occurrences.yml)
[![Docker Image](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/docker.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/pkgs/container/biodiversidade-online)

## Objetivo

Construir uma **base de dados unificada da biodiversidade brasileira**, integrando dados taxonômicos (flora, fauna), registros de ocorrência e dados de enriquecimento (espécies ameaçadas, invasoras, unidades de conservação), com acesso via **Dashboard analítico**, **assistente conversacional (ChatBB)** e **REST API**.

## Arquitetura C4

O projeto é organizado em três contextos principais:

```mermaid
graph TB
    subgraph Aquisição["Contexto: Aquisição"]
        Flora["Ingestão Flora"]
        Fauna["Ingestão Fauna"]
        Ocorrencias["Ingestão Ocorrências"]
        FuturoAmeacadas["🔜 Ameaçadas"]
        FuturoInvasoras["🔜 Invasoras"]
        FuturoUCs["🔜 UCs"]
    end

    subgraph Transformação["Contexto: Transformação"]
        TransformTaxa["Transformação Taxa"]
        TransformOcc["Transformação Ocorrências"]
        FuturoEnrich["🔜 Enriquecimento"]
    end

    subgraph Apresentação["Contexto: Apresentação"]
        Dashboard["Dashboard Analítico"]
        ChatBB["ChatBB (IA)"]
        API["REST API"]
    end

    IPTFlora["IPT Flora do Brasil"] --> Flora
    IPTFauna["IPT Fauna do Brasil"] --> Fauna
    IPTs["~490 IPTs"] --> Ocorrencias

    Flora --> MongoDB[(MongoDB)]
    Fauna --> MongoDB
    Ocorrencias --> MongoDB

    MongoDB --> TransformTaxa
    MongoDB --> TransformOcc
    TransformTaxa --> MongoDB
    TransformOcc --> MongoDB

    MongoDB --> Dashboard
    MongoDB --> ChatBB
    MongoDB --> API
    ClaudeAPI["Claude API"] --> ChatBB
```

## Fontes de Dados

**Dados Taxonômicos:**

- [Flora e Funga do Brasil](http://floradobrasil.jbrj.gov.br/) - Catálogo oficial de espécies vegetais e fúngicas
- [Catálogo Taxonômico da Fauna do Brasil](http://fauna.jbrj.gov.br/) - Base oficial de espécies animais

**Dados de Ocorrências:**

- ~490 repositórios IPT com milhões de registros de ocorrência
- Validação geográfica (coordenadas, estados via códigos IBGE)

**Dados de Enriquecimento (em desenvolvimento):**

- Espécies ameaçadas - Status de ameaça e programas de recuperação
- Espécies invasoras - Origem geográfica e impacto em ecossistemas
- Unidades de conservação - Limites geográficos e status de gestão

## Pipeline de Dados

Todos os workflows são **manuais** (acionados via GitHub Actions):

- **Ingestão Flora** - Processa dados DwC-A da Flora e Funga do Brasil
- **Ingestão Fauna** - Processa dados DwC-A do Catálogo da Fauna
- **Ingestão Ocorrências** - Processa dados de ~490 IPTs
- **Transformação Taxa** - Re-processa taxa_ipt → taxa com enriquecimento
- **Transformação Ocorrências** - Re-processa occurrences_ipt → occurrences

## Tecnologias

- **Runtime**: Bun
- **Linguagem**: TypeScript
- **Framework Web**: Astro.js com Astro Islands
- **Estilização**: Tailwind CSS
- **Banco de Dados**: MongoDB
- **IA/LLM**: Claude API (Anthropic) via Model Context Protocol (MCP)
- **Documentação API**: Swagger/OpenAPI
- **Automação**: GitHub Actions (workflows manuais)
- **Containerização**: Docker

## Como Usar

### Pré-requisitos

- Bun instalado
- MongoDB acessível via `MONGO_URI`
- Node.js v20.19.4+
- Docker (opcional)
- Chave da Claude API para ChatBB (variável `CLAUDE_API_KEY`)

### Execução Local

```bash
# Instalar dependências dos workspaces
bun install

# === Ingestão (Aquisição) ===
bun run ingest:flora <dwc-a-url>
bun run ingest:fauna <dwc-a-url>
bun run ingest:occurrences

# === Transformação ===
bun run transform:taxa
bun run transform:occurrences
bun run transform:execute
bun run transform:check-lock

# === Aplicação Web (Apresentação) ===
cd packages/web
bun run dev              # Desenvolvimento (http://localhost:4321)
bun run build            # Build para produção
node dist/server/entry.mjs  # Servidor de produção
```

### Via Docker

```bash
docker pull ghcr.io/biopinda/darwincorejson:latest
docker run -p 4321:4321 \
  -e MONGO_URI="mongodb://..." \
  -e CLAUDE_API_KEY="sk-..." \
  ghcr.io/biopinda/darwincorejson:latest
```

### Interfaces

- **Dashboard Analítico**: http://localhost:4321/
- **ChatBB**: http://localhost:4321/chat
- **Swagger API**: http://localhost:4321/api/docs
- **API Taxa**: http://localhost:4321/api/taxa
- **API Ocorrências**: http://localhost:4321/api/occurrences

## Estrutura do Projeto

```
├── packages/
│   ├── ingest/          # Aquisição: scripts de ingestão DwC-A
│   ├── transform/       # Transformação: enriquecimento e re-processamento
│   ├── shared/          # Utilitários compartilhados (database, IDs, métricas)
│   └── web/             # Apresentação: Dashboard, ChatBB, REST API
├── .github/workflows/   # Workflows manuais (GitHub Actions)
├── docs/                # Documentação histórica
├── patches/             # Patches de dependências
└── scripts/             # Scripts utilitários
```

## Histórico de Versões

- **V6.0** (atual - 2026): Reestruturação com arquitetura C4 (Aquisição, Transformação, Apresentação), remoção de componentes legados, foco em API e MCP
- **V5.0** (2025): Integração com ChatBB e protocolo MCP, pipeline integrado ingestão+transformação
- **V4.0** (2024): Integração de dados de ocorrência de ~490 IPTs
- **V2.0** (2024): Agregação do Catálogo Taxonômico da Fauna do Brasil
- **V1.0** (2023): Conversão de dados DwC-A para JSON (Flora e Funga do Brasil)

## Projetos Relacionados

O projeto [coletoresDWC2JSON](https://github.com/edalcin/coletoresDWC2JSON) complementa o Biodiversidade.Online fornecendo ferramentas de canonicalização de nomes de coletores, normalizando variações e aumentando a consistência dos dados.

## Contribuições

Dúvidas, sugestões e contribuições são bem-vindas através das [issues do projeto](https://github.com/biopinda/Biodiversidade-Online/issues).

## Citação

```bibtex
@software{pinheiro_dalcin_2026,
  title = {Biodiversidade.Online: Uma Base de Dados Integrada da Biodiversidade Brasileira},
  author = {Pinheiro, Henrique and Dalcin, Eduardo},
  year = {2026},
  version = {6.0},
  doi = {10.5281/zenodo.15261018},
  url = {https://github.com/biopinda/Biodiversidade-Online}
}
```

## Licença

Este projeto é desenvolvido como software livre para a comunidade científica brasileira.
