# GitHub Actions Workflows - Biodiversidade.Online

## 📋 Visão Geral

Este documento explica os **6 workflows** principais do GitHub Actions que automatizam a ingestão, transformação e sincronização de dados de biodiversidade.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Data Pipeline Overview                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  External Sources (IPT, JBRJ, SiBBr)                           │
│         ↓ ↓ ↓                                                    │
│  ┌──────────────────────────────────────────────┐              │
│  │ Ingest Workflows (UPDATE-MONGODB-*)          │              │
│  │ Download DwC-A archives and parse            │              │
│  │ Store in taxa_ipt, occurrences_ipt           │              │
│  └──────────────────────────────────────────────┘              │
│         ↓ ↓ ↓                                                    │
│  ┌──────────────────────────────────────────────┐              │
│  │ Transform Workflows (RE-TRANSFORM-*)         │              │
│  │ Process ingested data                        │              │
│  │ Store in taxa, occurrences (enriched)        │              │
│  └──────────────────────────────────────────────┘              │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────┐              │
│  │ Weekly Transformation (TRANSFORM-WEEKLY)     │              │
│  │ Orchestrates full pipeline with enrichment   │              │
│  │ Comprehensive data quality checks            │              │
│  └──────────────────────────────────────────────┘              │
│         ↓                                                        │
│  MongoDB (Production Collections)                              │
│         ↓                                                        │
│  Dashboard | ChatBB | REST API                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Workflows Explicados

### 1. **Update MongoDB - Flora** 📗

**Arquivo**: `.github/workflows/update-mongodb-flora.yml`

#### O que faz?

Baixa e importa dados de **flora (plantas)** do JBRJ (Jardim Botânico do Rio de Janeiro) em formato DwC-A (Darwin Core Archive).

#### Trigger (quando executa?)

| Tipo         | Horário/Condição                                                                |
| ------------ | ------------------------------------------------------------------------------- |
| **Agendado** | ✅ Domingos às 02:00 UTC (22:00 hora de Brasília)                               |
| **Manual**   | ✅ workflow_dispatch (botão na aba Actions)                                     |
| **Push**     | ✅ Quando modifica `packages/ingest/src/flora.ts` ou `packages/ingest/src/lib/` |

#### Passos

1. Checkout do código
2. Setup Node.js 20.x + Bun 1.2.21
3. Instalar dependências com `bun install --frozen-lockfile`
4. Executar `bun run ingest:flora`
   - Baixa DwC-A do JBRJ
   - Valida e processa arquivo
   - Armazena em MongoDB na coleção `taxa_ipt`

#### Parâmetros

```yaml
DWCA_URL: https://ipt.jbrj.gov.br/jbrj/archive.do?r=lista_especies_flora_brasil
```

#### Infraestrutura

- **Runner**: self-hosted (sua máquina)
- **Timeout**: Padrão (não especificado)
- **Permissões**: read (lê repositório apenas)

---

### 2. **Update MongoDB - Fauna** 🦁

**Arquivo**: `.github/workflows/update-mongodb-fauna.yml`

#### O que faz?

Baixa e importa dados de **fauna (animais)** do JBRJ em formato DwC-A.

#### Trigger (quando executa?)

| Tipo         | Horário/Condição                                                                |
| ------------ | ------------------------------------------------------------------------------- |
| **Agendado** | ✅ Domingos às 02:30 UTC (22:30 hora de Brasília)                               |
| **Manual**   | ✅ workflow_dispatch (com parâmetro DWCA_URL opcional)                          |
| **Push**     | ✅ Quando modifica `packages/ingest/src/fauna.ts` ou `packages/ingest/src/lib/` |

#### Passos

1. Checkout do código
2. Setup Node.js 20.x + Bun 1.2.21
3. Instalar `zip` (para descompactar DwC-A)
4. Instalar dependências com `bun install --frozen-lockfile`
5. Executar `bun run ingest:fauna`
   - Baixa DwC-A do JBRJ
   - Processa dados de fauna
   - Armazena em MongoDB na coleção `taxa_ipt`

#### Parâmetros

```yaml
DWCA_URL: https://ipt.jbrj.gov.br/jbrj/archive.do?r=catalogo_taxonomico_da_fauna_do_brasil
```

#### Parâmetro de Entrada (workflow_dispatch)

Pode passar uma URL customizada para DWCA_URL se desejar processar dados de outra fonte.

#### Infraestrutura

- **Runner**: self-hosted
- **Timeout**: Padrão
- **Permissões**: read

#### Diferença da Flora

- Roda **30 minutos depois** da Flora (02:30 vs 02:00)
- Processa dados de animais/fauna em vez de plantas
- Suporta URL customizada como parâmetro

---

### 3. **Update MongoDB - Ocorrências** 📍

**Arquivo**: `.github/workflows/update-mongodb-occurrences.yml`

#### O que faz?

Importa dados de **ocorrências (observações de espécies)** e **limpa o cache** de ocorrências na aplicação web.

#### Trigger (quando executa?)

| Tipo         | Horário/Condição                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| **Agendado** | ✅ Domingos às 03:00 UTC (23:00 hora de Brasília)                                                       |
| **Manual**   | ✅ workflow_dispatch (sem parâmetros)                                                                   |
| **Push**     | ✅ Quando modifica `packages/ingest/src/ocorrencia.ts` ou `packages/ingest/referencias/occurrences.csv` |

#### Passos

1. Checkout do código
2. Setup Node.js 20.x + Bun 1.2.21
3. Instalar `zip`
4. Instalar dependências
5. **Executar**: `bun run ingest:occurrences`
   - Processa arquivo CSV de referências
   - Armazena em MongoDB na coleção `occurrences_ipt`
6. **Limpar cache**: `bun run clear-occurrence-cache`
   - Regenera cache de ocorrências na aplicação web
   - Invalida dados cacheados anteriores

#### Particularidades

- É o **único workflow** que também executa script de limpeza de cache
- Roda **última** entre os três ingest workflows (03:00)
- Mais complexo pois trabalha com 2 passos: ingestão + limpeza

#### Infraestrutura

- **Runner**: self-hosted
- **Timeout**: Padrão
- **Permissões**: read

---

### 4. **Re-transform Taxa** 🔄

**Arquivo**: `.github/workflows/transform-taxa.yml`

#### O que faz?

**Re-transforma** dados de taxa (espécies) já ingeridos. Aplica lógica de enriquecimento e normalização aos dados brutos.

#### Trigger (quando executa?)

| Tipo         | Condição                                             |
| ------------ | ---------------------------------------------------- |
| **Push**     | ✅ Quando modifica `packages/transform/src/taxa/**`  |
| **Push**     | ✅ Quando modifica `packages/transform/package.json` |
| **Manual**   | ✅ workflow_dispatch                                 |
| **Agendado** | ❌ NÃO tem schedule                                  |

#### Passos

1. Checkout do código
2. Setup Node.js 20.x + Bun 1.2.21
3. Instalar dependências
4. **Executar**: `bun run transform:taxa`
   - Lê dados de `taxa_ipt` (brutos)
   - Aplica transformações (limpeza, normalização, enriquecimento)
   - Escreve em `taxa` (processados)

#### Quando usar?

- Quando você **modifica a lógica de transformação** de taxa
- Quando quer **reprocessar dados** com novas regras
- Quando corrige **bugs na transformação**

#### Diferença dos Ingest Workflows

- **Ingest**: Baixa dados externos → armazena coleção `_ipt`
- **Transform**: Processa dados `_ipt` → armazena coleção final

#### Infraestrutura

- **Runner**: self-hosted
- **Timeout**: Padrão
- **Permissões**: read
- **Sem agenda**: Roda apenas por push ou manual

---

### 5. **Re-transform Occurrences** 🔄

**Arquivo**: `.github/workflows/transform-occurrences.yml`

#### O que faz?

**Re-transforma** dados de ocorrências (observações). Aplica validação espacial, normalização geográfica e enriquecimento.

#### Trigger (quando executa?)

| Tipo         | Condição                                                   |
| ------------ | ---------------------------------------------------------- |
| **Push**     | ✅ Quando modifica `packages/transform/src/occurrences/**` |
| **Push**     | ✅ Quando modifica `packages/transform/package.json`       |
| **Manual**   | ✅ workflow_dispatch                                       |
| **Agendado** | ❌ NÃO tem schedule                                        |

#### Passos

1. Checkout do código
2. Setup Node.js 20.x + Bun 1.2.21
3. Instalar dependências
4. **Executar**: `bun run transform:occurrences`
   - Lê dados de `occurrences_ipt` (brutos)
   - Valida coordenadas (dentro do Brasil)
   - Normaliza nomes de estados (código IBGE)
   - Associa com unidades de conservação
   - Escreve em `occurrences` (processados)
5. **Executar**: `clear-occurrence-cache`
   - Limpa cache da aplicação web

#### Quando usar?

- Quando modifica lógica de transformação de ocorrências
- Quando corrige validação espacial
- Quando atualiza regras de normalização geográfica

#### Particularidade

- Limpa cache **automaticamente** após transformação
- Processa dados geoespaciais complexos

#### Infraestrutura

- **Runner**: self-hosted
- **Timeout**: Padrão
- **Permissões**: read
- **Sem agenda**: Roda apenas por push ou manual

---

### 6. **Weekly Data Transformation** 🗓️

**Arquivo**: `.github/workflows/transform-weekly.yml`

#### O que faz?

**Pipeline semanal completo** que orquestra ingestão + transformação + enriquecimento + validação. É o **workflow mais completo e importante**.

#### Trigger (quando executa?)

| Tipo           | Horário/Condição                                             |
| -------------- | ------------------------------------------------------------ |
| **Agendado**   | ✅ **Segundas-feiras às 04:00 UTC** (00:00 hora de Brasília) |
| **Manual**     | ✅ workflow_dispatch                                         |
| **Programado** | ❌ NÃO triggered por push                                    |

#### Passos Principais

1. Checkout com histórico completo (`fetch-depth: 0`)
2. Setup Node.js 20.19.4 + Bun 1.2.21
3. Instalar dependências
4. **Acquire Distributed Lock**
   - Verifica se outra transformação está rodando
   - Timeout de 1 hora (prevent duplicate runs)
5. **Run Transformation Pipeline**
   - Executa `bun run transform:execute`
   - Timeout: 120 minutos (máximo 180 total)
   - Ambiente: `NODE_ENV=production`
6. **Verify Results**
   - Valida dados transformados
7. **Notify Results**
   - Sucesso: ✅ Log e continuação
   - Falha: ❌ Log de erro detalhado
8. **Upload Artifacts**
   - Salva logs em artefatos (30 dias)
9. **Release Lock**
   - Libera distribuído lock

#### Variáveis de Ambiente

```env
MONGO_URI: ${{ secrets.MONGO_URI }}
MONGO_DB_NAME: dwc2json
NODE_ENV: production
```

#### Timeouts

| Etapa              | Limite                 |
| ------------------ | ---------------------- |
| Job total          | 180 minutos (3 horas)  |
| Transform pipeline | 120 minutos            |
| Distributed lock   | 3600 segundos (1 hora) |

#### Runner

- **Runner**: `ubuntu-latest` (GitHub-hosted, não self-hosted)
- **Razão**: Execução mais confiável e logs melhorados

#### Particularidades

- **Distributed Lock**: Evita transformações simultâneas
- **Artifacts**: Salva logs para debugging
- **Notifications**: Notifica sucesso/falha
- **Production Environment**: NODE_ENV=production
- **Post-ingest**: Roda após os 3 workflows de ingest (04:00 = depois de 03:00)

#### Diferença dos Re-transform Workflows

| Aspecto            | Re-transform               | Weekly                           |
| ------------------ | -------------------------- | -------------------------------- |
| **Escopo**         | Apenas taxa OU occurrences | Pipeline completo                |
| **Triggers**       | Push ou manual             | Agenda ou manual                 |
| **Schedule**       | Nenhum                     | Seg 04:00 UTC                    |
| **Enriquecimento** | Básico                     | Completo (threat, invasive, UCs) |
| **Lock**           | Não                        | Sim (distribuído)                |
| **Artifacts**      | Não                        | Sim (logs 30 dias)               |
| **Runner**         | self-hosted                | ubuntu-latest                    |
| **Timeout**        | Padrão                     | 3 horas                          |

---

## 📅 Timeline Semanal Completo

```
DOMINGO (Padrão UTC → Horário de Brasília PT-BR)
├─ 02:00 UTC (22:00 PT-BR) → Update MongoDB - Flora ✅
├─ 02:30 UTC (22:30 PT-BR) → Update MongoDB - Fauna ✅
└─ 03:00 UTC (23:00 PT-BR) → Update MongoDB - Ocorrências ✅
                                    ↓
SEGUNDA-FEIRA
└─ 04:00 UTC (00:00 PT-BR) → Weekly Data Transformation ✅
                            (Process + Enrich + Validate)
```

### Fluxo Completo

1. **Domingo 22:00**: Ingest Flora
2. **Domingo 22:30**: Ingest Fauna
3. **Domingo 23:00**: Ingest Occurrences + Clear Cache
4. **Segunda 00:00**: Full Transformation Pipeline
   - Re-transform taxa (com enriquecimento completo)
   - Re-transform occurrences (com validação espacial)
   - Associar com unidades de conservação
   - Validação de consistência

---

## 🎯 Quando Usar Cada Workflow

### **Update MongoDB - Flora**

Use quando:

- Precisa atualizar dados de flora do JBRJ
- Quer testar ingestão de flora isoladamente
- Encontrou erro na ingestão de flora

### **Update MongoDB - Fauna**

Use quando:

- Precisa atualizar dados de fauna do JBRJ
- Quer testar ingestão de fauna isoladamente
- Encontrou erro na ingestão de fauna

### **Update MongoDB - Ocorrências**

Use quando:

- Precisa atualizar dados de ocorrências
- Quer forçar regeneração do cache de ocorrências
- Encontrou erro na ingestão de ocorrências

### **Re-transform Taxa**

Use quando:

- Modifica lógica de transformação em `packages/transform/src/taxa/`
- Quer reprocessar taxa com novas regras
- Encontrou bug na transformação de taxa
- **Não** quer esperar pelo Weekly Pipeline

### **Re-transform Occurrences**

Use quando:

- Modifica lógica de transformação em `packages/transform/src/occurrences/`
- Quer reprocessar occurrences com novas regras
- Encontrou bug na transformação de occurrences
- **Não** quer esperar pelo Weekly Pipeline

### **Weekly Data Transformation**

Use quando:

- Quer pipeline completo com enriquecimento
- Precisa de garantias de consistência (distributed lock)
- Quer logs salvos para auditoria
- Está em produção (todos os dados atualizados simultaneamente)
- **Dica**: Esta é a execução principal, as outras são auxiliares

---

## 🔧 Troubleshooting

### Workflow não executa quando esperado

**Verificar**:

1. Cron syntax correto? Use https://crontab.guru
2. Timezone é UTC? Sim, sempre UTC
3. Branch é `main`? Apenas workflows neste branch

### Workflow executou mas falhou

**Passos**:

1. Clique no workflow na aba Actions
2. Veja logs detalhados de cada step
3. Verifique:
   - `MONGO_URI` secret está definido?
   - MongoDB está acessível?
   - Bun/Node.js compatível?

### Distributed Lock ficou travado (Weekly)

**Solução**:

1. SSH na máquina
2. `rm /tmp/transform.lock`
3. Re-execute workflow manualmente

### Workflow demorou mais que 3 horas

**Análise**:

- Verifique query performance de MongoDB
- Dados muito grandes?
- Network lenta?
- Considere paralelizar parte da transformação

---

## 📊 Monitoramento

### Ver histórico de execuções

```
GitHub → Seu Repositório → Actions → Selecione workflow
```

### Verificar status atual

- ✅ Verde: Sucesso
- ❌ Vermelho: Falha
- ⏳ Laranja: Em execução
- ⚪ Branco: Aguardando

### Artefatos

- Weekly pipeline salva logs por 30 dias
- Download em Actions → Workflow → Artifacts

---

## 📝 Resumo Comparativo

| Aspecto            | Flora       | Fauna       | Ocorrências | Re-taxa     | Re-occur    | Weekly    |
| ------------------ | ----------- | ----------- | ----------- | ----------- | ----------- | --------- |
| **Tipo**           | Ingest      | Ingest      | Ingest      | Transform   | Transform   | Full      |
| **Horário**        | Dom 02:00   | Dom 02:30   | Dom 03:00   | Manual      | Manual      | Seg 04:00 |
| **Runner**         | self-hosted | self-hosted | self-hosted | self-hosted | self-hosted | ubuntu    |
| **Lock**           | Não         | Não         | Não         | Não         | Não         | Sim       |
| **Cache**          | Não         | Não         | Sim         | Não         | Sim         | Sim       |
| **Artifacts**      | Não         | Não         | Não         | Não         | Não         | Sim       |
| **Auto-trigger**   | push        | push        | push        | push        | push        | Não       |
| **Enriquecimento** | Não         | Não         | Não         | Sim         | Sim         | Sim       |

---

## 🎓 Conceitos

### DwC-A (Darwin Core Archive)

Formato padrão para compartilhamento de dados de biodiversidade. Arquivo ZIP contendo:

- `meta.xml` - Descrição da estrutura
- `eml.xml` - Metadados
- Arquivos CSV - Dados reais

### Coleções `_ipt`

Dados brutos diretos do IPT (Integrated Publishing Toolkit). Não normalizados.

- `taxa_ipt` - Espécies brutas
- `occurrences_ipt` - Observações brutas

### Coleções finais

Dados processados e enriquecidos.

- `taxa` - Espécies transformadas
- `occurrences` - Observações transformadas

### Distributed Lock

Mecanismo para evitar 2+ transformações simultâneas:

1. Cria arquivo `/tmp/transform.lock`
2. Se arquivo >1h, considera expirado
3. Evita race conditions no MongoDB

---

**Última atualização**: 2025-12-21
**Versão**: 5.1.0
