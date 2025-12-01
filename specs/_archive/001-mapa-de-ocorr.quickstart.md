# Quickstart: Mapa de Ocorrências por Estado

**Date**: 2025-09-22
**Phase**: 1 - Design & Contracts

## Validação Rápida da Funcionalidade

### Pré-requisitos

```bash
# 1. Navegar para o diretório web
cd packages/web/

# 2. Instalar dependências (se necessário)
bun install

# 3. Verificar conexão MongoDB (variável de ambiente)
# Arquivo .env deve conter MONGO_URI válida
```

### Execução de Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
bun run dev

# Aguardar mensagem: "Local: http://localhost:4321/"
```

### Cenários de Teste Manual

#### Cenário 1: Carregamento Inicial

**Objetivo**: Verificar se a página carrega sem filtros

1. Abrir navegador em `https://biodiversidade.online/mapaocorrencia` (produção) ou `http://localhost:4321/mapaocorrencia` (desenvolvimento)
2. **Esperado**:
   - Mapa do Brasil exibido
   - Estados coloridos por densidade de ocorrências
   - Total de registros exibido no filtro
   - Sem erros no console

**Critério de Sucesso**: ✅ Página carrega em <3 segundos com dados

#### Cenário 2: Aplicação de Filtro Taxonômico

**Objetivo**: Verificar filtros funcionais

1. Clicar no botão de filtros
2. Selecionar "Reino" → "Animalia"
3. Aplicar filtro
4. **Esperado**:
   - Mapa atualizado com novas contagens
   - Total recalculado
   - Estados podem mudar de cor
   - Loading state visível durante carregamento

**Critério de Sucesso**: ✅ Filtro aplica em <2 segundos, dados consistentes

#### Cenário 3: Múltiplos Filtros

**Objetivo**: Verificar combinação de filtros

1. Aplicar filtro: Reino = "Animalia"
2. Adicionar filtro: Classe = "Mammalia"
3. **Esperado**:
   - Contagens reduzidas (mais específico)
   - Total menor que cenário anterior
   - Estados com zero ocorrências ficam neutros

**Critério de Sucesso**: ✅ Filtros combinam corretamente

#### Cenário 4: Hover e Tooltips

**Objetivo**: Verificar interatividade do mapa

1. Passar mouse sobre diferentes estados
2. **Esperado**:
   - Tooltip com nome do estado
   - Contagem exata de ocorrências
   - Responsividade imediata

**Critério de Sucesso**: ✅ Tooltips precisos e responsivos

#### Cenário 5: Limpeza de Filtros

**Objetivo**: Verificar reset de filtros

1. Aplicar vários filtros
2. Limpar todos os filtros
3. **Esperado**:
   - Retorno ao estado inicial
   - Total volta ao valor original
   - Mapa restaurado

**Critério de Sucesso**: ✅ Reset funciona corretamente

### Validação de API

#### Teste Manual da API

```bash
# Teste direto do endpoint sem filtros
curl "https://biodiversidade.online/api/occurrenceCountByState"
# Ou localmente:
# curl "http://localhost:4321/api/occurrenceCountByState"

# Esperado: JSON com total > 0 e array de regions
```

```bash
# Teste com filtro taxonômico
curl "https://biodiversidade.online/api/occurrenceCountByState?kingdom=Animalia"
# Ou localmente:
# curl "http://localhost:4321/api/occurrenceCountByState?kingdom=Animalia"

# Esperado: JSON com total diferente do anterior
```

#### Estrutura de Resposta Esperada

```json
{
  "total": 15432,
  "regions": [
    {
      "_id": "São Paulo",
      "count": 3245
    },
    {
      "_id": "Minas Gerais",
      "count": 2891
    }
  ]
}
```

### Verificação de Qualidade de Código

```bash
# Verificar formatação
bunx prettier --check src/

# Verificar TypeScript
bunx tsc --noEmit

# Build completo
bun run build
```

**Esperado**: Todos os comandos executam sem erros

### Verificação de Dados

#### Estados Brasileiros Válidos

**Verificar se aparecem no mapa**:

- São Paulo, Rio de Janeiro, Minas Gerais (Sudeste)
- Rio Grande do Sul, Paraná, Santa Catarina (Sul)
- Bahia, Pernambuco, Ceará (Nordeste)
- Amazonas, Pará, Acre (Norte)
- Goiás, Mato Grosso, Distrito Federal (Centro-Oeste)

#### Harmonização de Estados

**Testar normalização**:

1. Verificar se "SP" e "São Paulo" geram mesma contagem
2. Verificar se "Pará" e "Para" são tratados iguais
3. Estados desconhecidos não devem quebrar a aplicação

### Casos de Erro

#### Cenário: Erro de Conexão MongoDB

1. Parar serviço MongoDB (se local)
2. Tentar acessar página
3. **Esperado**: Mensagem de erro amigável, não crash

#### Cenário: Filtro sem Resultados

1. Aplicar filtro muito específico (ex: genus="Inexistente")
2. **Esperado**:
   - Total = 0
   - Mapa vazio (estados neutros)
   - Mensagem indicativa

### Critérios de Aceitação Final

**✅ Funcionalidade Completa**:

- [ ] Página carrega corretamente
- [ ] Filtros aplicam e funcionam
- [ ] Mapa atualiza dinamicamente
- [ ] API responde consistentemente
- [ ] Harmonização de estados funciona
- [ ] Tratamento de erro adequado

**✅ Performance**:

- [ ] Carregamento inicial < 3 segundos
- [ ] Aplicação de filtros < 2 segundos
- [ ] Sem memory leaks observáveis
- [ ] Responsivo em mobile

**✅ Qualidade**:

- [ ] Prettier sem erros
- [ ] TypeScript compila
- [ ] Build completo funciona
- [ ] Console sem warnings críticos

### Debugging Comum

#### Problema: Mapa não carrega

**Verificar**:

1. Console browser para erros JavaScript
2. Network tab para falhas de API
3. MongoDB connection string em .env

#### Problema: Contagens inconsistentes

**Verificar**:

1. Normalização de estados no mongo.ts
2. Filtros taxonômicos case-sensitive
3. Dados de teste na collection `ocorrencias`

#### Problema: Performance lenta

**Verificar**:

1. Índices MongoDB em campos filtrados
2. Tamanho da collection `ocorrencias`
3. Network latency para MongoDB

### Próximos Passos Após Validação

1. **Se todos os testes passam**: Feature pronta para produção
2. **Se há falhas**: Documentar issues específicas
3. **Se performance inadequada**: Otimizações necessárias
4. **Se dados inconsistentes**: Revisar harmonização

### Comandos de Limpeza

```bash
# Parar servidor de desenvolvimento
Ctrl+C

# Verificar portas em uso
netstat -an | grep 4321

# Limpar cache se necessário
rm -rf .astro/
```
