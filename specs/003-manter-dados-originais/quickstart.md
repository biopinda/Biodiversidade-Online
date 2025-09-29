# Quickstart: Manter Dados Originais

**Data**: 2025-09-29  
**Especificação**: [spec.md](./spec.md)  
**Plano**: [plan.md](./plan.md)

## Pré-requisitos

1. **MongoDB funcionando** com as coleções configuradas
2. **Bun instalado** (versão mais recente)
3. **Variáveis de ambiente** configuradas:
   ```bash
   export MONGO_URI="mongodb://localhost:27017/biodiversidade"
   export IPT_DEFAULT_FAUNA="https://ipt.jbrj.gov.br/jbrj/resource?r=fauna_brasil"
   export IPT_DEFAULT_FLORA="https://ipt.jbrj.gov.br/jbrj/resource?r=flora_brasil"
   ```

## Cenário 1: Ingestão de Dados de Fauna (Script Local)

### 1.1 Executar Ingestão Completa

```bash
# Navegar para o diretório root do projeto
cd /Users/henrique/devel/DarwinCoreJSON

# Executar script de ingestão de fauna
bun run packages/ingest/src/scripts/ingest-fauna.ts

# Verificar resultado
echo "Status esperado: SUCCESS"
echo "Documentos criados em: taxaOriginal"
```

**Validação**:

```javascript
// Conectar ao MongoDB e verificar
use biodiversidade;
db.taxaOriginal.countDocuments({ collection_type: "fauna" });
// Deve retornar > 0

// Verificar metadados de ingestão
db.taxaOriginal.findOne({}, { ingestion_metadata: 1 });
// Deve conter timestamp recente e source_ipt
```

### 1.2 Verificar Prevenção de Reprocessamento

```bash
# Executar novamente sem mudanças no IPT
bun run packages/ingest/src/scripts/ingest-fauna.ts

# Verificar log de saída
echo "Status esperado: SKIPPED (versão não mudou)"
```

**Validação**:

```javascript
// Verificar que documentos não foram duplicados
db.taxaOriginal.aggregate([
  { $group: { _id: '$ipt_record_id', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
// Deve retornar array vazio (sem duplicatas)
```

## Cenário 2: Transformação Offline

### 2.1 Executar Transformação de Dados Originais

```bash
# Executar script de transformação
bun run packages/ingest/src/scripts/transform-fauna.ts

# Verificar resultado
echo "Status esperado: SUCCESS"
echo "Documentos criados em: taxa"
```

**Validação**:

```javascript
// Verificar documentos transformados
db.taxa.countDocuments({ collection_type: 'fauna' })
// Deve ser <= documentos em taxaOriginal

// Verificar correspondência de IDs
db.taxa.findOne({}, { _id: 1, 'original_reference.original_id': 1 })
// _id deve ser igual a original_reference.original_id
```

### 2.2 Testar Fallback em Caso de Falha

```bash
# Simular falha de transformação modificando pipeline temporariamente
# (para teste manual - quebrar uma função de transformação)

bun run packages/ingest/src/scripts/transform-fauna.ts

# Verificar que dados originais foram copiados como fallback
```

**Validação**:

```javascript
// Verificar documentos com fallback aplicado
db.taxa.countDocuments({
  'transformation_metadata.fallback_applied': true
})
// Deve ser > 0 se houve falhas na transformação
```

## Cenário 3: Workflows GitHub Actions (Ambiente CI)

### 3.1 Testar Workflow de Ingestão via Dispatch

```bash
# Usar GitHub CLI ou interface web para disparar workflow
gh workflow run ingest-fauna.yml \
  -f ipt_url="https://ipt.jbrj.gov.br/jbrj/resource?r=fauna_brasil" \
  -f force_reprocess=false

# Monitorar execução
gh run list --workflow=ingest-fauna.yml --limit=1
```

**Validação**:

- Workflow deve completar com status `success`
- Logs devem mostrar número de documentos processados
- Outputs devem conter `job_status`, `documents_processed`, `execution_time`

### 3.2 Testar Workflow de Transformação via Dispatch

```bash
# Disparar transformação offline
gh workflow run transform-fauna.yml \
  -f force_reprocess=false

# Verificar resultado
gh run list --workflow=transform-fauna.yml --limit=1
```

**Validação**:

- Workflow deve completar com status `success` ou `partial`
- Logs devem mostrar contadores de documentos transformados e com fallback

## Cenário 4: Workflows GitHub Actions (Ambiente CI)

### 4.1 Testar Workflow de Ingestão via Dispatch

```bash
# Usar GitHub CLI ou interface web para disparar workflow
gh workflow run ingest-fauna.yml \
  -f ipt_url="https://ipt.jbrj.gov.br/jbrj/resource?r=fauna_brasil" \
  -f force_reprocess=false

# Monitorar execução
gh run list --workflow=ingest-fauna.yml --limit=1
```

**Validação**:

- Workflow deve completar com status `success`
- Logs devem mostrar número de documentos processados
- Outputs devem conter `job_status`, `documents_processed`, `execution_time`

### 4.2 Testar Workflow de Transformação via Dispatch

```bash
# Disparar transformação offline
gh workflow run transform-fauna.yml \
  -f force_reprocess=false

# Verificar resultado
gh run list --workflow=transform-fauna.yml --limit=1
```

**Validação**:

- Workflow deve completar com status `success` ou `partial`
- Logs devem mostrar contadores de documentos transformados e com fallback

## Cenário 5: Validação da Aplicação Web

### 5.1 Iniciar Servidor de Desenvolvimento

```bash
# Navegar para diretório web
cd packages/web/

# Instalar dependências se necessário
bun install

# Iniciar servidor
bun run dev

# Verificar que está rodando em http://localhost:4321
```

### 5.2 Verificar Interface Web

```bash
# Verificar páginas principais da aplicação
curl -I http://localhost:4321/                    # Homepage
curl -I http://localhost:4321/taxa                # Busca de taxa
curl -I http://localhost:4321/chat                # ChatBB
curl -I http://localhost:4321/dashboard           # Dashboard

# Verificar API básica (não relacionada a ingestão)
curl http://localhost:4321/api/health

# Esperado: Todas as páginas devem retornar 200 OK
```

**Validação**:

- Interface web deve funcionar normalmente
- Dados transformados devem aparecer nas buscas
- Dashboard deve mostrar estatísticas atualizadas

## Cenário 6: Validação de Integridade dos Dados

### 6.1 Verificar Rastreabilidade Bidirecional

```javascript
// Script de validação MongoDB
use biodiversidade;

// Contar documentos originais e transformados
const originalCount = db.taxaOriginal.countDocuments({ collection_type: "fauna" });
const transformedCount = db.taxa.countDocuments({ collection_type: "fauna" });

print(`Originais: ${originalCount}, Transformados: ${transformedCount}`);
// Transformados deve ser <= Originais

// Verificar IDs correspondentes
const orphanedTransformed = db.taxa.aggregate([
  {
    $lookup: {
      from: "taxaOriginal",
      localField: "_id",
      foreignField: "_id",
      as: "original"
    }
  },
  { $match: { original: { $size: 0 } } }
]);

print(`Documentos transformados órfãos: ${orphanedTransformed.itcount()}`);
// Deve ser 0
```

### 6.2 Verificar Metadados de Processamento

```javascript
// Verificar timestamps válidos
db.taxa
  .find({
    $expr: {
      $lt: [
        '$transformation_metadata.timestamp',
        '$original_reference.ingestion_metadata.timestamp'
      ]
    }
  })
  .count()
// Deve ser 0 (transformação não pode ser antes da ingestão)

// Verificar pipeline versions
db.taxa.distinct('transformation_metadata.pipeline_version')
// Deve retornar versões válidas do pipeline
```

## Cenário 7: Performance e Escalabilidade

### 7.1 Testar Processamento em Lote

```bash
# Executar com diferentes tamanhos de lote
bun run packages/ingest/src/scripts/ingest-fauna.ts --batch-size=500
bun run packages/ingest/src/scripts/ingest-fauna.ts --batch-size=2000

# Monitorar uso de memória e tempo de execução
time bun run packages/ingest/src/scripts/ingest-fauna.ts
```

**Validação**:

- Tempo de execução deve ser < 10 minutos para IPTs típicos
- Uso de memória deve permanecer estável durante processamento
- Não deve haver timeout de conexão MongoDB

### 7.2 Testar Controle de Concorrência

```bash
# Executar duas ingestões simultâneas (deve falhar a segunda)
bun run packages/ingest/src/scripts/ingest-fauna.ts &
bun run packages/ingest/src/scripts/ingest-fauna.ts &

# Verificar que apenas uma execução prossegue
wait
echo "Uma execução deve ter falhado com erro de lock"
```

## Limpeza e Reset

### Reset Completo para Novos Testes

```javascript
// Limpar todas as coleções de teste
use biodiversidade;
db.ocorrenciasOriginal.deleteMany({ collection_type: "fauna" });
db.ocorrencias.deleteMany({ collection_type: "fauna" });
db.iptMetadata.deleteMany({ collection_type: "fauna" });
db.processingLocks.deleteMany({ resource_type: /fauna/ });
```

### Reset Parcial (Manter Originais)

```javascript
// Limpar apenas dados transformados
use biodiversidade;
db.taxa.deleteMany({ collection_type: "fauna" });
db.taxaOriginal.updateMany(
  { collection_type: "fauna" },
  { $set: { "processing_status.is_processed": false } }
);
```

## Solução de Problemas

### Erro: "Lock já existe"

```bash
# Verificar locks ativos
bun run packages/ingest/src/scripts/check-locks.ts

# Limpar locks expirados
bun run packages/ingest/src/scripts/cleanup-locks.ts
```

### Erro: "IPT inacessível"

```bash
# Verificar conectividade
curl -I "https://ipt.jbrj.gov.br/jbrj/resource?r=fauna_brasil"

# Usar IPT alternativo para teste
export IPT_DEFAULT_FAUNA="https://alternative-ipt.example.com/resource"
```

### Erro: "Falha na conexão MongoDB"

```bash
# Verificar status do MongoDB
mongosh --eval "db.runCommand('ping')"

# Verificar string de conexão
echo $MONGO_URI
```

## Próximos Passos

Após validar todos os cenários:

1. **Implementar testes automatizados** baseados nestes cenários
2. **Configurar monitoramento** de performance e erros
3. **Documentar procedimentos operacionais** para produção
4. **Estabelecer alertas** para falhas de ingestão e transformação
