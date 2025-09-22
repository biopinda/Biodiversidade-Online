# Research Findings: Mapa de Ocorrências por Estado

**Date**: 2025-09-22
**Phase**: 0 - Research & Analysis

## Arquitetura Existente Analisada

### Estrutura do Mapa de Taxa (Referência)

**Arquivos Principais:**

- `packages/web/src/pages/mapa.astro` - Página principal
- `packages/web/src/components/MapPage.tsx` - Componente gerenciador
- `packages/web/src/components/MapFilter.tsx` - Filtros taxonômicos
- `packages/web/src/components/Map.tsx` - Visualização Google Charts
- `packages/web/src/pages/api/taxaCountByState.ts` - API endpoint

**Decisão**: Reutilizar completamente esta arquitetura para ocorrências
**Rationale**: Componentes já testados, interface familiar ao usuário
**Alternativas consideradas**: Criar do zero (rejeitada por violar princípio de simplicidade)

### Implementação Existente de Ocorrências

**Estado Atual:**

- `packages/web/src/pages/mapaocorrencia.astro` - Página já existe
- `packages/web/src/components/MapOccurrencePage.tsx` - Componente já implementado
- `packages/web/src/pages/api/occurrenceCountByState.ts` - API já funcional
- `packages/web/src/lib/mongo.ts` - Função `countOccurrenceRegions()` já existe

**Decisão**: Melhorar implementação existente ao invés de recriar
**Rationale**: Código funcional já presente, seguir princípio de edição sobre criação
**Alternativas consideradas**: Implementação do zero (rejeitada - desnecessária)

### Tecnologias e Padrões

**Google Charts para Visualização:**

- **Decisão**: Manter Google Charts web components
- **Rationale**: Já configurado, mapas do Brasil funcionais, zero configuração adicional
- **Alternativas consideradas**: D3.js (rejeitada - complexidade adicional), Leaflet (rejeitada - overhead)

**MongoDB Aggregation Pipeline:**

- **Decisão**: Usar agregação MongoDB para performance
- **Rationale**: Dados grandes (~1M registros), aggregation mais eficiente que find()
- **Alternativas consideradas**: Client-side filtering (rejeitada - performance), múltiplas queries (rejeitada - latência)

**TypeScript + React Components:**

- **Decisão**: Manter stack TypeScript/React/Astro
- **Rationale**: Já configurado no projeto, componentes reutilizáveis
- **Alternativas consideradas**: Vanilla JS (rejeitada - tipagem), Vue (rejeitada - inconsistência)

## Harmonização de Estados

### Problema Identificado

Dados de `stateProvince` na coleção `ocorrencias` têm inconsistências:

- Abreviações: "AM", "SP", "RJ"
- Nomes completos: "Amazonas", "São Paulo", "Rio de Janeiro"
- Variações de acentos: "Pará" vs "Para", "Ceará" vs "Ceara"

### Solução Implementada

**Decisão**: Usar mapeamento de normalização no mongo.ts
**Rationale**: Já implementado em `stateMapping` object, cobertura completa de 27 estados
**Alternativas consideradas**: Normalização no banco (rejeitada - modificação dados fonte), client-side (rejeitada - performance)

## Filtros Taxonômicos

### Compatibilidade com Sistema Existente

**Decisão**: Reutilizar FilterPopover e MapFilter componentes
**Rationale**: Interface familiar, filtros já mapeados para parâmetros MongoDB
**Alternativas consideradas**: Filtros específicos para ocorrências (rejeitada - complexidade UX)

**Mapeamento de Campos:**

```typescript
fieldToParam: {
  reino: 'kingdom',
  filo: 'phylum',
  classe: 'class',
  ordem: 'order',
  superfamília: 'superfamily',
  família: 'family',
  gênero: 'genus',
  'epíteto específico': 'specificEpithet'
}
```

## Performance e Otimização

### Aggregation Pipeline Otimizada

**Decisão**: Pipeline com `$facet` para total e contagem por região
**Rationale**: Single query para múltiplos resultados, otimização MongoDB
**Alternativas consideradas**: Múltiplas queries (rejeitada - latência), client-side counting (rejeitada - volume dados)

### Indexação MongoDB

**Decisão**: Assumir índices existentes em campos taxonômicos
**Rationale**: Campos já usados em outras funcionalidades do sistema
**Alternativas consideradas**: Índices específicos (sem evidência de necessidade)

## Melhorias Identificadas

### Interface e UX

**Problemas no Código Atual:**

1. MapOccurrencePage.tsx já existe mas pode estar desatualizado
2. Tratamento de erro poderia ser mais específico
3. Loading states não implementados

**Decisão**: Melhorar implementação atual mantendo arquitetura
**Rationale**: Base sólida existente, ajustes incrementais mais seguros
**Alternativas consideradas**: Reescrita completa (rejeitada - desnecessária)

### Robustez de Dados

**Melhorias Planejadas:**

1. Validação de nomes de estados desconhecidos
2. Tratamento de registros sem stateProvince
3. Logging de inconsistências para monitoramento

## Conclusões e Recomendações

### Abordagem Final

1. **Melhorar** código existente em `mapaocorrencia.astro` e componentes relacionados
2. **Reutilizar** arquitetura comprovada do mapa de taxa
3. **Manter** compatibilidade com filtros existentes
4. **Otimizar** queries MongoDB com aggregation pipeline existente
5. **Implementar** melhor tratamento de erros e loading states

### Riscos Mitigados

- **Performance**: Aggregation pipeline já otimizada
- **Inconsistência de dados**: Mapeamento de estados já implementado
- **Compatibilidade**: Reutilização de componentes testados
- **Complexidade**: Aproveitamento de código existente

### Próximos Passos

1. **Fase 1**: Design de contratos e modelo de dados
2. **Fase 2**: Geração de tarefas específicas de melhoria
3. **Implementação**: Melhorias incrementais no código existente
