# Especificações - Biodiversidade.Online V5.0

Este diretório contém a documentação centralizada de especificação, planejamento e tarefas do projeto Biodiversidade.Online.

## 📋 Arquivos Principais (Documentação Ativa)

Estes são os únicos arquivos que devem ser mantidos e atualizados:

- **`spec.md`** - Especificação consolidada do projeto (requisitos, user stories, success criteria)
- **`plan.md`** - Plano técnico e arquitectura (context, constitution, phases, design)
- **`tasks.md`** - Tarefas detalhadas para implementação (phases, task list, dependencies)

## 📁 Estrutura Auxiliar

### `_contracts/`

Contém contratos de API e interfaces técnicas por feature (opcional, referência):

- `XXX-feature/map-component-interface.ts`
- `XXX-feature/api-contracts.yaml`
- etc.

### `_data-models/`

Modelos de dados e esquemas para cada feature (referência histórica):

- `XXX-feature.md`

### `_research/`

Documentação de pesquisa e análise (referência histórica):

- `XXX-feature.md`

### `_archive/`

Versões antigas de especificações, planos e tarefas (histórico):

- `001-mapa-de-ocorr.spec.md` (histórico)
- `002-split-up-mongo.spec.md` (histórico)
- `003-data-restructure.spec.md` (histórico)
- `003-manter-dados-originais.spec.md` (histórico)
- Todos os .plan.md, .tasks.md, .quickstart.md antigos

## 🔄 Como Usar

### Atualizando Especificações

Quando precisa fazer mudanças na especificação, planejamento ou tarefas:

1. **Abra apenas um arquivo:**
   - `specs/spec.md` para modificar requisitos
   - `specs/plan.md` para modificar arquitetura/design
   - `specs/tasks.md` para modificar tarefas

2. **Edite e commit:**

   ```bash
   git add specs/spec.md  # ou plan.md ou tasks.md
   git commit -m "update: descrição do que mudou"
   ```

3. **Tudo em um lugar** - Nenhuma busca por múltiplos arquivos necessária

### Consultando Histórico

Se precisar consultar versões antigas:

- Verifique `specs/_archive/` para versões antigos de features específicas
- Use `git log specs/` para histórico de commits

## 📝 Status da Consolidação

✅ **Consolidado em 2025-12-01**

- `spec.md` - Consolidação de: 001-pipeline-integrado + 003-data-restructure + 003-manter-dados-originais
- `plan.md` - Consolidação de: 003-data-restructure.plan.md
- `tasks.md` - Consolidação de: 003-data-restructure.tasks.md

Versões antigas (001-_, 002-_, 003-\*) movidas para `_archive/` como referência histórica.

## 🎯 Objetivo

Ter um único ponto de verdade para:

- **O QUÊ** fazer (spec.md)
- **COMO** fazer (plan.md)
- **QUANDO/QUEM** faz (tasks.md)

Sem necessidade de buscar informações em múltiplos arquivos.
