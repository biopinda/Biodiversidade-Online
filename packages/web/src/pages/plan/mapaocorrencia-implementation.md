# Plano de Implementação: Mapa de Ocorrências por Estado

## Objetivo

Criar uma nova página `mapaocorrencia.astro` que exiba um mapa do Brasil com contabilização de ocorrências por estado brasileiro, baseada na estrutura existente de `mapa.astro`.

## Análise da Estrutura Atual

### Componentes Existentes

1. **mapa.astro**: Página principal que usa o componente `MapPage`
2. **MapPage.tsx**: Componente principal que gerencia estado e API calls
3. **MapFilter.tsx**: Componente de filtros taxonômicos
4. **Map.tsx**: Componente de visualização do mapa (Google Charts)
5. **API taxaCountByState.ts**: Endpoint que conta taxa por região

### Dados Utilizados Atualmente

- **Fonte**: Coleção `taxa`
- **Campo de região**: `distribution.occurrence` (estados onde o taxon ocorre)
- **Filtros**: Parâmetros taxonômicos (reino, família, gênero, etc.)

## Análise da Nova Funcionalidade

### Dados para Ocorrências

- **Fonte**: Coleção `ocorrencia`
- **Campo de estado**: `stateProvince`
- **Problema**: Inconsistência nos dados de estado (ex: "Amazonas" vs "AM")
- **Solução**: Criar mapeamento de harmonização de nomes de estados

## Mapeamento de Estados Brasileiros

### Estados que precisam de harmonização:

```javascript
const stateMapping = {
  // Norte
  AC: 'Acre',
  Acre: 'Acre',
  AP: 'Amapá',
  Amapá: 'Amapá',
  Amapa: 'Amapá',
  AM: 'Amazonas',
  Amazonas: 'Amazonas',
  PA: 'Pará',
  Pará: 'Pará',
  Para: 'Pará',
  RO: 'Rondônia',
  Rondônia: 'Rondônia',
  Rondonia: 'Rondônia',
  RR: 'Roraima',
  Roraima: 'Roraima',
  TO: 'Tocantins',
  Tocantins: 'Tocantins',

  // Nordeste
  AL: 'Alagoas',
  Alagoas: 'Alagoas',
  BA: 'Bahia',
  Bahia: 'Bahia',
  CE: 'Ceará',
  Ceará: 'Ceará',
  Ceara: 'Ceará',
  MA: 'Maranhão',
  Maranhão: 'Maranhão',
  Maranhao: 'Maranhão',
  PB: 'Paraíba',
  Paraíba: 'Paraíba',
  Paraiba: 'Paraíba',
  PE: 'Pernambuco',
  Pernambuco: 'Pernambuco',
  PI: 'Piauí',
  Piauí: 'Piauí',
  Piaui: 'Piauí',
  RN: 'Rio Grande do Norte',
  'Rio Grande do Norte': 'Rio Grande do Norte',
  SE: 'Sergipe',
  Sergipe: 'Sergipe',

  // Centro-Oeste
  GO: 'Goiás',
  Goiás: 'Goiás',
  Goias: 'Goiás',
  MT: 'Mato Grosso',
  'Mato Grosso': 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  'Mato Grosso do Sul': 'Mato Grosso do Sul',
  DF: 'Distrito Federal',
  'Distrito Federal': 'Distrito Federal',

  // Sudeste
  ES: 'Espírito Santo',
  'Espírito Santo': 'Espírito Santo',
  'Espirito Santo': 'Espírito Santo',
  MG: 'Minas Gerais',
  'Minas Gerais': 'Minas Gerais',
  RJ: 'Rio de Janeiro',
  'Rio de Janeiro': 'Rio de Janeiro',
  SP: 'São Paulo',
  'São Paulo': 'São Paulo',
  'Sao Paulo': 'São Paulo',

  // Sul
  PR: 'Paraná',
  Paraná: 'Paraná',
  Parana: 'Paraná',
  RS: 'Rio Grande do Sul',
  'Rio Grande do Sul': 'Rio Grande do Sul',
  SC: 'Santa Catarina',
  'Santa Catarina': 'Santa Catarina'
}
```

## Arquitetura da Solução

### 1. Novo Endpoint API: `occurrenceCountByState.ts`

```typescript
// Funcionalidades:
- Consultar coleção 'ocorrencia'
- Aplicar filtros taxonômicos
- Harmonizar nomes de estados
- Agregar contagem por estado
- Retornar formato compatível com MapPage
```

### 2. Novo Componente: `MapOccurrencePage.tsx`

```typescript
// Baseado em MapPage.tsx, mas:
- Usar endpoint /api/occurrenceCountByState
- Manter mesma interface de filtros
- Título/labels específicos para ocorrências
```

### 3. Nova Página: `mapaocorrencia.astro`

```astro
// Estrutura idêntica a mapa.astro
- Usar MapOccurrencePage ao invés de MapPage
- Manter mesmo CSS e layout
```

## Problemas Identificados e Correções

### Problema no Filtro Atual

- **Issue**: MapFilter pode não estar funcionando corretamente
- **Investigação**: Verificar se os parâmetros estão sendo passados corretamente
- **Correção**: Verificar e corrigir a integração entre FilterPopover e MapFilter

## Plano de Implementação

### Fase 1: Investigação e Correção

1. ✅ Analisar estrutura atual do mapa.astro
2. 🔄 Examinar dados da coleção 'ocorrencia'
3. 📋 Identificar e corrigir problemas no filtro atual

### Fase 2: Desenvolvimento da Nova Funcionalidade

1. 📋 Criar função de harmonização de estados
2. 📋 Implementar API occurrenceCountByState.ts
3. 📋 Criar componente MapOccurrencePage.tsx
4. 📋 Criar página mapaocorrencia.astro

### Fase 3: Testes e Refinamentos

1. 📋 Testar funcionalidade de filtros
2. 📋 Validar contagens de ocorrência
3. 📋 Verificar harmonização de estados
4. 📋 Testes de integração

### Fase 4: Finalização

1. 📋 Commit das alterações
2. 📋 Sincronização com repositório remoto

## Filtros Suportados

- Reino (kingdom)
- Filo (phylum)
- Classe (class)
- Ordem (order)
- Superfamília (superfamily)
- Família (family)
- Gênero (genus)
- Epíteto específico (specificEpithet)

## Considerações Técnicas

- Reutilizar componentes existentes sempre que possível
- Manter consistência na interface de usuário
- Garantir performance adequada para consultas na coleção de ocorrências
- Implementar tratamento de erros robusto
- Manter compatibilidade com filtros existentes

## Resultados Esperados

- Nova página `/mapaocorrencia` funcional
- Visualização de ocorrências por estado brasileiro
- Filtros funcionando corretamente em ambas as páginas
- Harmonização adequada de nomes de estados
- Interface consistente com o mapa de taxa existente
