# Sistema de Cache do Dashboard

Este sistema implementa uma estratégia de cache para melhorar significativamente o desempenho do dashboard, evitando consultas pesadas ao MongoDB em cada carregamento da página.

## Como Funciona

1. **Job de Cache**: Um job automatizado executa todas as consultas MongoDB necessárias para o dashboard
2. **Armazenamento**: Os resultados são salvos em um arquivo JSON (`cache/dashboard-data.json`)
3. **Dashboard**: A página do dashboard carrega os dados do arquivo JSON ao invés de fazer consultas diretas
4. **Agendamento**: O job executa automaticamente todo dia às 01:00h

## Estrutura de Arquivos

```
web/
├── src/
│   └── scripts/
│       └── dashboard-cache-job.ts          # Script principal do job
├── cache/
│   └── dashboard-data.json                 # Dados em cache do dashboard
├── cron-dashboard.js                       # Sistema de agendamento
└── package.json                           # Inclui novos scripts
```

## Scripts Disponíveis

```bash
# Executar o job de cache manualmente
npm run cache-dashboard

# Iniciar o sistema de agendamento (cron)
npm run start-cache-cron
```

## Dados Armazenados no Cache

O arquivo JSON contém:

- **Occurrences**: Contadores de ocorrências por reino
- **Taxa**: Contadores de taxa por reino
- **Threatened**: Espécies ameaçadas (contadores e categorias)
- **Invasive**: Espécies invasoras (contadores e rankings)
- **Taxa Breakdown**: Top ordens/famílias por reino
- **Top Collections**: Principais coleções por reino
- **lastUpdated**: Timestamp da última atualização

## Benefícios de Performance

- **Antes**: 22+ consultas MongoDB pesadas a cada carregamento
- **Depois**: 1 leitura de arquivo JSON simples
- **Resultado**: Carregamento ~10x mais rápido

## Configuração de Produção

1. Instalar dependências: `npm install`
2. Configurar variável MONGO_URI no arquivo `.env`
3. Executar job inicial: `npm run cache-dashboard`
4. Iniciar sistema de agendamento: `npm run start-cache-cron`

O sistema executa automaticamente às 01:00h todos os dias, garantindo dados sempre atualizados.
