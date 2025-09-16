# Base de Dados Integrada da Biodiversidade Brasileira
# (DarwinCoreJSON)

[Eduardo Dalcin](https://github.com/edalcin) e [Henrique Pinheiro](https://github.com/Phenome)<br>
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.15261018.svg)](https://doi.org/10.5281/zenodo.15261018)

[![Update MongoDB - Flora](https://github.com/biopinda/DarwinCoreJSON/actions/workflows/update-mongodb-flora.yml/badge.svg)](https://github.com/biopinda/DarwinCoreJSON/actions/workflows/update-mongodb-flora.yml)
[![Update MongoDB - Fauna](https://github.com/biopinda/DarwinCoreJSON/actions/workflows/update-mongodb-fauna.yml/badge.svg)](https://github.com/biopinda/DarwinCoreJSON/actions/workflows/update-mongodb-fauna.yml)
[![Update MongoDB - Ocorrências](https://github.com/biopinda/DarwinCoreJSON/actions/workflows/update-mongodb-occurrences.yml/badge.svg)](https://github.com/biopinda/DarwinCoreJSON/actions/workflows/update-mongodb-occurrences.yml)
[![Docker Image](https://github.com/biopinda/DarwinCoreJSON/actions/workflows/docker.yml/badge.svg)](https://github.com/biopinda/DarwinCoreJSON/pkgs/container/darwincorejson)

## Histórico do Projeto

Este projeto iniciou em novembro de 2023 com a **V1.0**, motivado pela necessidade de converter dados da [Flora e Funga do Brasil](http://floradobrasil.jbrj.gov.br/reflora/listaBrasil/ConsultaPublicaUC/ConsultaPublicaUC.do) do formato [Darwin Core Archive (DwC-A)](https://www.gbif.org/pt/darwin-core) para o [formato JSON](https://pt.wikipedia.org/wiki/JSON), facilitando o acesso e manipulação dos dados para pesquisadores e analistas.

A estrutura relacional do formato DwC-A, embora adequada como formato de transferência entre aplicações do domínio da biodiversidade (especialmente para o GBIF), exige conhecimento técnico para relacionar e integrar as diferentes tabelas. O formato JSON oferece uma abordagem mais acessível e intuitiva para consultas e análises.

Na **V2.0**, foi agregado o [Catálogo Taxonômico da Fauna do Brasil](http://fauna.jbrj.gov.br/), criando uma base unificada com mais de 290 mil nomes científicos de flora, fungi e fauna brasileira.

A **V4.0** expandiu significativamente o projeto com a integração de dados de ocorrência de aproximadamente 15 diferentes IPTs, disponibilizando 493 conjuntos de dados de ocorrências. Um sistema de curadoria evita duplicação entre diferentes fontes, e atualizações automáticas semanais mantêm a base sempre atualizada.

A versão atual integra uma vasta gama de fontes de dados da biodiversidade brasileira em uma base de dados MongoDB unificada, facilitando consultas e análises para a comunidade científica.

## Versão Atual - V5.0

O **DarwinCoreJSON** é um sistema automatizado de integração e processamento de dados de biodiversidade brasileira, desenvolvido em TypeScript com Deno. O projeto consolida informações taxonômicas e de ocorrências de múltiplas fontes científicas em uma base de dados MongoDB unificada, facilitando consultas e análises da biodiversidade nacional.

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
├── src/
│   ├── fauna.ts          # Processamento de dados da fauna
│   ├── flora.ts          # Processamento de dados da flora  
│   ├── ocorrencia.ts     # Processamento de registros de ocorrência
│   └── lib/
│       └── dwca.ts       # Biblioteca para processamento DwC-A
├── scripts/
│   └── check_ipt_resources.py  # Verificação de recursos IPT
├── .github/workflows/    # Automação CI/CD
└── referencias/          # Documentação e listas de referência
```

### Tecnologias Utilizadas
- **Runtime**: Deno
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
*(Requer chave da OpenAI ou Gemini)*

## Histórico de Versões
- **V5.0** (atual): Integração com ChatBB e protocolo MCP
- **V4.0**: [Melhorias na integração de dados](README.v4.md)
- **V2.x**: [Expansão de fontes de dados](README.v2.md)
- **V1.0**: [Versão inicial](README.v1.md)

## Como Usar

### Pré-requisitos
- Deno instalado
- Acesso ao MongoDB
- Docker (opcional)

### Execução Local
```bash
# Processar dados de flora
deno run --allow-all src/flora.ts

# Processar dados de fauna  
deno run --allow-all src/fauna.ts

# Processar ocorrências
deno run --allow-all src/ocorrencia.ts
```

### Via Docker
```bash
docker pull ghcr.io/biopinda/darwincorejson:latest
docker run ghcr.io/biopinda/darwincorejson:latest
```

## Contribuições

Dúvidas, sugestões e contribuições são bem-vindas através das [issues do projeto](https://github.com/biopinda/DarwinCoreJSON/issues).

## Citação

```bibtex
@software{pinheiro_dalcin_2025,
  title = {DarwinCoreJSON: Sistema de Integração de Dados de Biodiversidade},
  author = {Pinheiro, Henrique and Dalcin, Eduardo},
  year = {2025},
  version = {5.0},
  doi = {10.5281/zenodo.15511063},
  url = {https://github.com/biopinda/DarwinCoreJSON}
}
```

## Licença

Este projeto é desenvolvido como software livre para a comunidade científica brasileira.
