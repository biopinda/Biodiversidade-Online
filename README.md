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

A versão atual integra uma vasta gama de fontes de dados da biodiversidade brasileira em uma base de dados MongoDB unificada, facilitando consultas e análises para a comunidade científica.

## Versão Atual - V5.0

O **Biodiversidade.Online** é um sistema automatizado de integração e processamento de dados de biodiversidade brasileira, desenvolvido em TypeScript executado com Bun. O projeto consolida informações taxonômicas e de ocorrências de múltiplas fontes científicas em uma base de dados MongoDB unificada, facilitando consultas e análises da biodiversidade nacional.

### Arquitetura de Dados: Pipeline Raw → Transform

A versão 5.0 introduz uma arquitetura de processamento de dados em duas etapas:

1. **Ingestão (Raw)**: Dados brutos são baixados de fontes DwC-A e armazenados sem transformações nas coleções `taxa_ipt` e `occurrences_ipt`, preservando campos originais e rastreabilidade.

2. **Transformação (Transform)**: Scripts dedicados processam os dados brutos aplicando:
   - **Validações**: Geográficas (coordenadas), temporais (datas), taxonômicas (ranks)
   - **Normalizações**: Padronização de países, estados, nomes científicos
   - **Enriquecimentos**: Status de ameaça, invasoras, unidades de conservação
   - **Agregações**: Criação de campos derivados e índices otimizados

Os dados transformados são armazenados nas coleções `taxa` e `occurrences`, que são consultadas pelas APIs e interfaces web.

#### Benefícios da Arquitetura

- ✅ **Rastreabilidade completa**: `_id` preservado entre coleções raw e transformadas
- ✅ **Auditoria facilitada**: Comparação direta entre dados originais e processados
- ✅ **Idempotência garantida**: Re-execuções seguras sem duplicação de dados
- ✅ **Flexibilidade**: Modificar transformações sem re-baixar dados de origem
- ✅ **Desempenho otimizado**: Índices e agregações pré-computadas nas coleções transformadas

## Funcionalidades Principais

### 🔄 Processamento Automático de Dados

- **Integração contínua** via GitHub Actions com processamento automático de dados de flora, fauna e ocorrências
- **Processamento de arquivos DwC-A** (Darwin Core Archive) de repositórios IPT
- **Normalização e estruturação** de dados taxonômicos seguindo padrões Darwin Core
- **Atualização automática** do banco MongoDB com novos dados

### 📊 Fontes de Dados Integradas

- **Flora e Funga do Brasil** - Catálogo oficial de espécies vegetais
- **Catálogo Taxonômico da Fauna do Brasil** - Base oficial de espécies animais
- **Instituto Hórus** - Banco de dados de espécies invasoras
- **CNCFlora** - Avaliações de risco de extinção da flora (até 2022)
- **MMA** - Lista oficial de espécies ameaçadas de fauna (2021)
- **CNUC** - Unidades de conservação brasileiras
- **~12 milhões de registros de ocorrência** de ~490 repositórios IPT

### 🛠️ Ferramentas de Gerenciamento

- **Script de verificação IPT** - Monitora recursos disponíveis vs. integrados
- **Processadores específicos** para flora e fauna com lógicas de transformação otimizadas
- **Suporte a diferentes formatos** de dados científicos

## Arquitetura Técnica

```
├── packages/
│   ├── ingest/                 # Pipeline de ingestão de dados brutos
│   │   ├── src/
│   │   │   ├── flora.ts        # Ingestão de dados da Flora do Brasil → taxa_ipt
│   │   │   ├── fauna.ts        # Ingestão de dados da Fauna do Brasil → taxa_ipt
│   │   │   ├── ocorrencia.ts   # Ingestão de ~490 IPTs → occurrences_ipt
│   │   │   └── lib/            # Utilitários DwC-A e normalização
│   │   ├── referencias/        # Documentação e listas de referência
│   │   └── chatbb/             # Conjuntos de dados e prompts do assistente
│   ├── transform/              # Pipeline de transformação de dados
│   │   ├── src/
│   │   │   ├── taxa/           # Transformação taxa_ipt → taxa
│   │   │   ├── occurrences/    # Transformação occurrences_ipt → occurrences
│   │   │   ├── lib/            # Infraestrutura (database, locks, métricas)
│   │   │   └── cli/            # Comandos CLI para orquestração
│   │   └── test/               # Testes de validação
│   └── web/                    # Aplicação web Astro.js
│       ├── src/
│       │   ├── pages/          # Interfaces web e APIs REST
│       │   ├── components/     # Componentes React
│       │   └── prompts/        # Prompts do ChatBB
│       └── public/
├── docs/                       # Histórico do projeto e documentação
└── .github/workflows/          # Automação CI/CD
```

### Tecnologias Utilizadas

- **Runtime**: Bun
- **Linguagem**: TypeScript
- **Banco de dados**: MongoDB
- **Automação**: GitHub Actions
- **Containerização**: Docker

## ChatBB - Assistente de IA para Biodiversidade

A versão 5.0 introduz o **ChatBB**, um assistente virtual que utiliza o protocolo MCP (Model Context Protocol) para conectar a base de dados integrada com modelos de linguagem (LLMs) como OpenAI GPT e Google Gemini.

### Exemplos de Consultas

- [Informações sobre o gênero Vriesea](https://trilium.dalc.in/share/lFMRnEIBR5Yu)
- [Espécies invasoras em parques nacionais](https://trilium.dalc.in/share/I7vFC96GRy73)
- [Bromeliaceae ameaçadas em UCs](https://trilium.dalc.in/share/nfGgiYw3jhX8)
- [Análise de espécies endêmicas](https://trilium.dalc.in/share/wHVjLmy2GYZH)

## Interfaces e Funcionalidades Disponíveis

O projeto disponibiliza diversas interfaces web para acesso aos dados integrados:

### 🌿 **Calendário Fenológico**

https://biodiversidade.online/calendario-fenologico

### 🔍 **Interfaces de Busca Taxonômica**

- **Interface principal de busca**: https://biodiversidade.online/taxa
- **Interface com search engine intermediário**: https://web.dalc.in/sandbox/meilisearch/

### 🔗 **APIs de Dados**

https://biodiversidade.online/api

### 🗺️ **Mapa de Distribuição**

Visualização de contagem de nomes aceitos por estado: https://biodiversidade.online/mapa

### 📊 **Dashboard Analítico**

https://biodiversidade.online/dashboard

### 🤖 **Interface de IA (ChatBB)**

Acesso via LLM (OpenAI ou Gemini): https://biodiversidade.online/chat
_(Requer chave da OpenAI ou Gemini)_

## Histórico de Versões

- **V5.0** (atual): Integração com ChatBB e protocolo MCP
- **V4.0**: [Melhorias na integração de dados](docs/README.v4.md)
- **V2.x**: [Expansão de fontes de dados](docs/README.v2..md)
- **V1.0**: [Versão inicial](docs/README.v1.md)

## Como Usar

### Pré-requisitos

- Bun instalado
- Acesso ao MongoDB
- Docker (opcional)

### Execução Local

```bash
# Instalar dependências dos workspaces
bun install

# === Pipeline de Ingestão (Raw Data) ===
# Processar dados de flora (DwC-A → taxa_ipt)
bun run ingest:flora <dwc-a-url>

# Processar dados de fauna (DwC-A → taxa_ipt)
bun run ingest:fauna <dwc-a-url>

# Processar ocorrências de todos os IPTs (DwC-A → occurrences_ipt)
bun run ingest:occurrences

# === Pipeline de Transformação (Processed Data) ===
# Transformar dados taxonômicos (taxa_ipt → taxa)
bun run transform:taxa

# Transformar dados de ocorrências (occurrences_ipt → occurrences)
bun run transform:occurrences

# Verificar status de locks de transformação
bun run transform:check-lock

# === Aplicação Web ===
# Iniciar a interface web em modo dev
bun run web:dev

# Build para produção
bun run web:build

# Executar servidor de produção
cd packages/web && node dist/server/entry.mjs
```

### Via Docker

```bash
docker pull ghcr.io/biopinda/darwincorejson:latest
docker run ghcr.io/biopinda/darwincorejson:latest
```

## Projetos Relacionados

### 🔧 **Canonicalização de Coletores**

O projeto [coletoresDWC2JSON](https://github.com/edalcin/coletoresDWC2JSON) complementa o Biodiversidade.Online fornecendo ferramentas especializadas para melhoria da qualidade dos dados de coletores. Este sistema implementa algoritmos de canonicalização que normalizam e agrupam variações de nomes de coletores (ex: "FORZZA", "Forzza, R." e "R.C. Forzza"), aumentando a consistência dos dados e facilitando análises posteriores da base de dados integrada.

## Contribuições

Dúvidas, sugestões e contribuições são bem-vindas através das [issues do projeto](https://github.com/biopinda/Biodiversidade-Online/issues).

## Citação

```bibtex
@software{pinheiro_dalcin_2025,
  title = {Biodiversidade.Online: Uma Base de Dados Integrada da Biodiversidade Brasileira},
  author = {Pinheiro, Henrique and Dalcin, Eduardo},
  year = {2025},
  version = {5.0},
  doi = {10.5281/zenodo.15511063},
  url = {https://github.com/biopinda/Biodiversidade-Online}
}
```

## Licença

Este projeto é desenvolvido como software livre para a comunidade científica brasileira.
