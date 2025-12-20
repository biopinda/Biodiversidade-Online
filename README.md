# Biodiversidade.Online - Uma Base de Dados Integrada da Biodiversidade Brasileira

[Eduardo Dalcin](https://github.com/edalcin) e [Henrique Pinheiro](https://github.com/Phenome)<br>
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.15261018.svg)](https://doi.org/10.5281/zenodo.15261018)

[![Update MongoDB - Flora](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-flora.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-flora.yml)
[![Update MongoDB - Fauna](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-fauna.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-fauna.yml)
[![Update MongoDB - Ocorrências](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-occurrences.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/update-mongodb-occurrences.yml)
[![Docker Image](https://github.com/biopinda/Biodiversidade-Online/actions/workflows/docker.yml/badge.svg)](https://github.com/biopinda/Biodiversidade-Online/pkgs/container/biodiversidade-online)

## Histórico do Projeto

Este projeto iniciou em novembro de 2023 com a **V1.0**, motivado pela necessidade de converter dados da [Flora e Funga do Brasil](http://floradobrasil.jbrj.gov.br/reflora/listaBrasil/ConsultaPublicaUC/ConsultaPublicaUC.do) do formato [Darwin Core Archive (DwC-A)](https://www.gbif.org/pt/darwin-core) para o [formato JSON](https://pt.wikipedia.org/wiki/JSON), facilitando o acesso e manipulação dos dados para pesquisadores e analistas.

A estrutura relacional do formato DwC-A, embora adequada como formato de transferência entre aplicações do domínio da biodiversidade (especialmente para o GBIF), exige conhecimento técnico para relacionar e integrar as diferentes tabelas. O formato JSON oferece uma abordagem mais acessível e intuitiva para consultas e análises.

Na **V2.0**, foi agregado o [Catálogo Taxonômico da Fauna do Brasil](http://fauna.jbrj.gov.br/), criando uma base unificada com mais de 290 mil nomes científicos de flora, fungi e fauna brasileira.

A **V4.0** expandiu significativamente o projeto com a integração de dados de ocorrência de aproximadamente 15 diferentes IPTs, disponibilizando 493 conjuntos de dados de ocorrências. Um sistema de curadoria evita duplicação entre diferentes fontes, e atualizações automáticas semanais mantêm a base sempre atualizada.

A **V5.0** introduziu o ChatBB, um assistente virtual que utiliza o protocolo MCP (Model Context Protocol) para conectar a base de dados integrada com modelos de linguagem (LLMs), e consolidou a arquitetura de processamento integrado (ingestão + transformação inline).

A versão atual refatora a plataforma com foco em simplicidade e três pontos de acesso complementares, mantendo a robustez do pipeline de dados.

## Versão Atual - V5.1 (ChatBB - Redefinição de Escopo e Arquitetura)

O **Biodiversidade.Online v5.1** refatora a plataforma para uma arquitetura simplificada e focada com **três interfaces complementares** de acesso aos dados de biodiversidade brasileira:

### 🎯 Três Pontos de Acesso à Biodiversidade

#### 1. **Dashboard Analítico** (Homepage Principal)
Interface visual interativa para exploração de dados de biodiversidade com:
- Visualizações em tempo real (gráficos, estatísticas, filtros)
- Filtros dinâmicos: tipo de espécie (nativa, ameaçada, invasora), localização geográfica, status de conservação
- Atualização de visualizações em <1 segundo
- Acesso direto ao ChatBB via menu
- **URL**: https://biodiversidade.online/

#### 2. **ChatBB - Interface Conversacional** (via MCP)
Assistente de IA para perguntas complexas sobre biodiversidade em linguagem natural (português/inglês):
- Consultas sobre espécies, distribuição geográfica, status de conservação
- Integração via Model Context Protocol (MCP) com base de dados transformada
- Contexto de conversação mantido para perguntas de acompanhamento
- Precisão de 95%+ em perguntas bem-formadas sobre biodiversidade
- **URL**: https://biodiversidade.online/chat

#### 3. **REST API com Swagger** (Integração Programática)
API completa para integração externa com documentação interativa:
- Endpoints para taxa, ocorrências, estatísticas, unidades de conservação
- Filtros avançados: tipo, região, status de conservação, nível de ameaça
- Respostas JSON com suporte a GeoJSON para dados geográficos
- Documentação Swagger/OpenAPI completa com exemplos
- Tempo de resposta <500ms para consultas de até 10.000 registros
- **URL**: https://biodiversidade.online/api/docs

### 🔄 Pipeline de Dados Robusto

A v5.1 mantém e aprimora o pipeline integrado de processamento de dados:

1. **Ingestão Automática Semanal** (Domingos):
   - 02:00 UTC - Flora do Brasil
   - 02:30 UTC - Fauna do Brasil
   - 03:00 UTC - ~490 repositórios IPT de ocorrências

2. **Transformação com Enriquecimento**:
   - Dados brutos (`taxa_ipt`, `occurrences_ipt`) → Dados transformados (`taxa`, `occurrences`)
   - **Novo**: Enriquecimento com espécies ameaçadas (Flora/Funga do Brasil)
   - **Novo**: Enriquecimento com espécies invasoras (IBAMA)
   - **Novo**: Associação com unidades de conservação (ICMBio)
   - Normalização geográfica (coordenadas, estados, municípios)
   - Validação taxonômica e resolução de sinônimos
   - Rastreabilidade completa com preservação de `_id`

3. **Consistência de Dados**:
   - Todas as três interfaces (Dashboard, ChatBB, API) compartilham dados transformados
   - Atualização sincronizada em até 1 hora após transformação
   - Cache com TTL de 1 hora para otimização de performance

### 📊 Fontes de Dados Integradas

**Dados Taxonômicos:**
- **Flora e Funga do Brasil** - Catálogo oficial de espécies vegetais
- **Catálogo Taxonômico da Fauna do Brasil** - Base oficial de espécies animais

**Dados de Ocorrências:**
- **~12 milhões de registros** de ~490 repositórios IPT
- Validação geográfica (coordenadas, estados via códigos IBGE)
- Associação com unidades de conservação

**Dados de Enriquecimento (Novo em v5.1):**
- **Espécies Ameaçadas** - Status de ameaça, nível de proteção, programas de recuperação
- **Espécies Invasoras** - Origem geográfica, impacto em ecossistemas (Instituto Hórus, IBAMA)
- **Unidades de Conservação** - Limites geográficos, tipo de designação, status de gestão (CNUC/ICMBio)

### 🎨 Arquitetura Simplificada

A v5.1 **remove componentes legados** para reduzir complexidade:
- ❌ Calendário fenológico
- ❌ Interface de busca taxonômica dedicada
- ❌ Mapa de distribuição standalone

**Foco**: Dashboard como ponto de entrada único, com ChatBB para consultas conversacionais e API REST para integrações programáticas.

## Arquitetura Técnica

```
├── packages/
│   ├── shared/                 # Utilitários compartilhados (database, IDs, métricas)
│   ├── ingest/                 # Pipeline de ingestão integrada (raw + transform)
│   │   ├── src/
│   │   │   ├── flora.ts        # Ingestão + transformação inline → taxa_ipt + taxa
│   │   │   ├── fauna.ts        # Ingestão + transformação inline → taxa_ipt + taxa
│   │   │   ├── ocorrencia.ts   # Ingestão + transformação inline → occurrences_ipt + occurrences
│   │   │   └── lib/            # Utilitários DwC-A e normalização
│   │   ├── referencias/        # Documentação e listas de referência
│   │   └── chatbb/             # Conjuntos de dados e prompts do assistente
│   ├── transform/              # Pipeline de enriquecimento e re-transformação
│   │   ├── src/
│   │   │   ├── loaders/        # Carregadores de dados de enriquecimento (ameaçadas, invasoras, UCs)
│   │   │   ├── enrichment/     # Módulos de enriquecimento (sinônimos, TaxonID)
│   │   │   ├── validation/     # Validação DwC-A e consistência de dados
│   │   │   ├── taxa/           # Re-processamento taxa_ipt → taxa
│   │   │   ├── occurrences/    # Re-processamento occurrences_ipt → occurrences
│   │   │   ├── lib/            # Infraestrutura (database, locks, métricas)
│   │   │   └── cli/            # Comandos CLI para orquestração
│   │   └── test/               # Testes de validação
│   └── web/                    # Aplicação web Astro.js (v5.1: Dashboard, ChatBB, API)
│       ├── src/
│       │   ├── pages/          # Dashboard (homepage), ChatBB, APIs REST
│       │   │   ├── index.astro              # Dashboard Analítico (homepage)
│       │   │   ├── chat.astro               # Interface ChatBB
│       │   │   └── api/                     # Endpoints REST
│       │   │       ├── taxa/                # API de taxa
│       │   │       ├── occurrences/         # API de ocorrências
│       │   │       ├── dashboard/           # API do Dashboard
│       │   │       ├── chat/                # API ChatBB (MCP adapter)
│       │   │       └── docs.ts              # Swagger UI
│       │   ├── components/     # Componentes Astro/React (Dashboard, ChatBB, Charts)
│       │   ├── lib/            # Utilitários (MongoDB, MCP adapter, Claude client, cache)
│       │   └── types/          # Definições TypeScript (Taxa, Occurrence, MCP types)
│       └── public/
├── specs/                      # Especificações e planejamento (v5.1)
│   ├── spec.md                 # Especificação de features
│   ├── plan.md                 # Plano de implementação
│   └── tasks.md                # Lista de tarefas (85 tarefas)
├── docs/                       # Histórico do projeto e documentação
└── .github/workflows/          # Automação CI/CD integrada
```

### Tecnologias Utilizadas

- **Runtime**: Bun
- **Linguagem**: TypeScript
- **Framework Web**: Astro.js com Astro Islands (interatividade)
- **Estilização**: Tailwind CSS
- **Banco de Dados**: MongoDB 4.4+
- **IA/LLM**: Claude API (Anthropic) via Model Context Protocol (MCP)
- **Documentação API**: Swagger/OpenAPI 3.0
- **Automação**: GitHub Actions
- **Containerização**: Docker

## Funcionalidades Principais

### 🔄 Processamento Automático de Dados

- **Integração contínua** via GitHub Actions com processamento automático de dados de flora, fauna e ocorrências
- **Processamento integrado** de arquivos DwC-A (Darwin Core Archive) com transformação inline
- **Enriquecimento automático** com dados de espécies ameaçadas, invasoras e unidades de conservação
- **Re-transformação automática** quando lógica de processamento é modificada
- **Normalização e estruturação** de dados taxonômicos seguindo padrões Darwin Core
- **Atualização semanal** automática do banco MongoDB com novos dados

#### Workflows Automáticos

**Ingestão Semanal (Domingos):**

- 02:00 UTC - Flora do Brasil (ingestão + transformação + enriquecimento)
- 02:30 UTC - Fauna do Brasil (ingestão + transformação + enriquecimento)
- 03:00 UTC - ~490 IPTs de ocorrências (ingestão + transformação + enriquecimento)

**Re-transformação Automática por Mudanças de Código:**

- Modificações em `packages/transform/src/**` → Workflow de re-transformação com enriquecimento
- Bump de versão em `packages/transform/package.json` → Re-transformação completa
- Distributed locks para evitar execuções concorrentes

**Execução Manual:**

- Todos workflows disponíveis via GitHub Actions interface
- Suporte a URLs customizadas para fontes DwC-A
- Monitoramento de transformação via endpoints `/api/transform-status`

### 🤖 ChatBB - Assistente Conversacional de Biodiversidade

O **ChatBB** permite consultas em linguagem natural sobre a biodiversidade brasileira:

**Exemplos de Consultas:**
- "Quais espécies ameaçadas estão em unidades de conservação?"
- "Quantas espécies invasoras foram registradas no Cerrado?"
- "Liste as Bromeliaceae endêmicas da Mata Atlântica"
- "Mostre ocorrências de Vriesea em parques nacionais"

**Características:**
- Suporte a português e inglês
- Contexto de conversação mantido para perguntas de acompanhamento
- Integração via MCP (Model Context Protocol) com dados transformados
- Respostas com referências às fontes de dados
- Tratamento gracioso de erros e indisponibilidade

**Exemplos Documentados:**
- [Informações sobre o gênero Vriesea](https://trilium.dalc.in/share/lFMRnEIBR5Yu)
- [Espécies invasoras em parques nacionais](https://trilium.dalc.in/share/I7vFC96GRy73)
- [Bromeliaceae ameaçadas em UCs](https://trilium.dalc.in/share/nfGgiYw3jhX8)
- [Análise de espécies endêmicas](https://trilium.dalc.in/share/wHVjLmy2GYZH)

## Histórico de Versões

- **V5.1** (atual - 2025-12-20): Redefinição de arquitetura com 3 interfaces (Dashboard, ChatBB, API), enriquecimento com espécies ameaçadas/invasoras/UCs, remoção de componentes legados
- **V5.0** (2025-12-01): Integração com ChatBB e protocolo MCP, pipeline integrado ingestão+transformação
- **V4.0**: [Melhorias na integração de dados](docs/README.v4.md)
- **V2.x**: [Expansão de fontes de dados](docs/README.v2..md)
- **V1.0**: [Versão inicial](docs/README.v1.md)

## Como Usar

### Pré-requisitos

- Bun instalado
- MongoDB 4.4+ acessível via `MONGO_URI`
- Node.js v20.19.4+
- Docker (opcional)
- Chave da Claude API para ChatBB (variável `CLAUDE_API_KEY`)

### Execução Local

```bash
# Instalar dependências dos workspaces
bun install

# === Pipeline Integrado (Ingestão + Transformação + Enriquecimento) ===
# Processar dados de flora
bun run ingest:flora <dwc-a-url>

# Processar dados de fauna
bun run ingest:fauna <dwc-a-url>

# Processar ocorrências de todos os IPTs
bun run ingest:occurrences

# === Re-transformação em Massa (quando lógica muda) ===
# Re-processar todos dados taxonômicos com enriquecimento
bun run transform:taxa

# Re-processar todos dados de ocorrências com enriquecimento e validação geográfica
bun run transform:occurrences

# Executar transformação completa coordenada (loaders + enrichment)
bun run transform:execute

# Verificar status de locks de transformação
bun run transform:check-lock

# === Aplicação Web (Dashboard + ChatBB + API) ===
# Iniciar a interface web em modo dev (http://localhost:4321)
cd packages/web
bun run dev

# Build para produção
bun run build

# Executar servidor de produção
node dist/server/entry.mjs

# === Validação ===
# Validar formato DwC-A
bun run validate:dwca <path-to-archive>

# Verificar consistência de dados transformados
bun run transform:validate
```

### Via Docker

```bash
docker pull ghcr.io/biopinda/darwincorejson:latest
docker run -p 4321:4321 \
  -e MONGO_URI="mongodb://..." \
  -e CLAUDE_API_KEY="sk-..." \
  ghcr.io/biopinda/darwincorejson:latest
```

### Acessando as Interfaces

**Após executar localmente ou via Docker:**

- **Dashboard Analítico**: http://localhost:4321/
- **ChatBB**: http://localhost:4321/chat
- **Swagger API Documentation**: http://localhost:4321/api/docs
- **API Taxa**: http://localhost:4321/api/taxa
- **API Ocorrências**: http://localhost:4321/api/occurrences

## Projetos Relacionados

### 🔧 **Canonicalização de Coletores**

O projeto [coletoresDWC2JSON](https://github.com/edalcin/coletoresDWC2JSON) complementa o Biodiversidade.Online fornecendo ferramentas especializadas para melhoria da qualidade dos dados de coletores. Este sistema implementa algoritmos de canonicalização que normalizam e agrupam variações de nomes de coletores (ex: "FORZZA", "Forzza, R." e "R.C. Forzza"), aumentando a consistência dos dados e facilitando análises posteriores da base de dados integrada.

## Contribuições

Dúvidas, sugestões e contribuições são bem-vindas através das [issues do projeto](https://github.com/biopinda/Biodiversidade-Online/issues).

## Documentação Técnica

- **Especificação v5.1**: [specs/spec.md](specs/spec.md)
- **Plano de Implementação**: [specs/plan.md](specs/plan.md)
- **Lista de Tarefas**: [specs/tasks.md](specs/tasks.md) (85 tarefas)
- **Constituição do Projeto**: [.specify/memory/constitution.md](.specify/memory/constitution.md)

## Citação

```bibtex
@software{pinheiro_dalcin_2025,
  title = {Biodiversidade.Online: Uma Base de Dados Integrada da Biodiversidade Brasileira},
  author = {Pinheiro, Henrique and Dalcin, Eduardo},
  year = {2025},
  version = {5.1},
  doi = {10.5281/zenodo.15511063},
  url = {https://github.com/biopinda/Biodiversidade-Online}
}
```

## Licença

Este projeto é desenvolvido como software livre para a comunidade científica brasileira.
