# Biodiversidade.Online - Web Application

Aplicação web Astro.js para visualização e consulta de dados da biodiversidade brasileira.

## Arquitetura de Dados

A aplicação consome dados de coleções MongoDB processadas em **pipeline integrado** (ingestão + transformação):

### Coleções Raw (Rastreabilidade - Não Consultar nas APIs)

- `taxa_ipt` - Dados taxonômicos brutos preservados (Flora/Fauna do Brasil)
- `occurrences_ipt` - Registros de ocorrências brutos preservados (~490 IPTs)

### Coleções Transformadas (Uso em APIs e Interfaces)

- `taxa` - Dados taxonômicos normalizados e enriquecidos
  - Normalizações: ranks, nomes científicos, localidades
  - Enriquecimentos: status de ameaça (CNCFlora/MMA), espécies invasoras (GISD)
- `occurrences` - Registros de ocorrências validados e geolocalizados
  - Validações: coordenadas, datas, países (somente Brasil)
  - Geolocalização: índice 2dsphere para queries espaciais
  - Vinculação: referências cruzadas com táxons via `taxonID`

### Coleções de Controle

- `transform_status` - Registros de locks e status de re-transformações
- `process_metrics` - Métricas de performance e auditoria

## APIs Disponíveis

### Taxa (Espécies)

**GET /api/taxa**

- Parâmetros: `scientificName`, `canonicalName`, `kingdom`, `family`, `genus`, `taxonRank`, `taxonomicStatus`, `threatStatus`, `invasive`, `limit`, `offset`
- Retorna lista paginada de táxons com metadados de paginação

**GET /api/taxa/{taxonID}**

- Retorna detalhes de um táxon específico por ID

**GET /api/taxa/count**

- Parâmetros: mesmos filtros do /api/taxa
- Retorna contagem total de táxons

**GET /api/tree**

- Retorna hierarquia taxonômica completa para navegação

### Occurrences (Ocorrências)

**GET /api/occurrences**

- Parâmetros: `scientificName`, `kingdom`, `stateProvince`, `county`, `year`, `basisOfRecord`, `bbox`, `limit`, `offset`
- Retorna lista paginada de ocorrências

**GET /api/occurrences/{occurrenceID}**

- Retorna detalhes de uma ocorrência específica

**GET /api/occurrences/count**

- Parâmetros: mesmos filtros do /api/occurrences
- Retorna contagem total de ocorrências

**GET /api/occurrences/geojson**

- Parâmetros: `bbox` (obrigatório), `scientificName`, `kingdom`, `year`, `limit`
- Retorna FeatureCollection GeoJSON para visualização em mapas
- Limite máximo: 10.000 features

**GET /api/occurrenceCountByState**

- Parâmetros: filtros taxonômicos (kingdom, family, genus, etc.)
- Retorna agregação de ocorrências por estado brasileiro

### Outras APIs

**GET /api/health**

- Status de saúde da aplicação e conexão com MongoDB

Documentação completa: https://biodiversidade.online/api

## Interfaces Web

- `/` - Homepage com links para todas as funcionalidades
- `/taxa` - Busca e navegação de espécies
- `/mapa` - Mapa de distribuição de espécies por estado
- `/tree` - Navegação hierárquica da árvore taxonômica
- `/dashboard` - Estatísticas e visualizações de dados
- `/chat` - ChatBB - Assistente de IA para consultas em linguagem natural
- `/calendario-fenologico` - Calendário fenológico das espécies

## 🚀 Estrutura do Projeto

```
/
├── public/
│   ├── api-spec.json      # Especificação OpenAPI
│   └── ...                # Assets estáticos
├── src/
│   ├── pages/             # Rotas e endpoints
│   │   ├── index.astro    # Homepage
│   │   ├── taxa.astro     # Interface de busca de espécies
│   │   ├── mapa.astro     # Mapa de distribuição
│   │   ├── tree.astro     # Árvore taxonômica
│   │   ├── dashboard.astro # Dashboard de estatísticas
│   │   ├── chat.astro     # Interface ChatBB
│   │   └── api/           # Endpoints REST
│   ├── components/        # Componentes React/Astro
│   ├── layouts/           # Layouts base
│   ├── lib/               # Utilitários e MongoDB
│   │   └── mongo/         # Funções de acesso ao banco
│   ├── prompts/           # Prompts do ChatBB
│   └── styles/            # CSS/Tailwind
├── cache/                 # Cache de dados do dashboard
└── package.json
```

## 🧞 Comandos

Todos os comandos devem ser executados a partir da raiz do monorepo:

| Comando                                         | Ação                                         |
| :---------------------------------------------- | :------------------------------------------- |
| `bun install`                                   | Instala dependências de todos os workspaces  |
| `bun run web:dev`                               | Inicia servidor dev em `localhost:4321`      |
| `bun run web:build`                             | Compila aplicação para produção em `./dist/` |
| `cd packages/web && node dist/server/entry.mjs` | Executa servidor de produção                 |
| `bun run cache-dashboard`                       | Regenera cache do dashboard                  |
| `bun run start-cache-cron`                      | Inicia job cron de cache (segundas 01:00)    |

## Variáveis de Ambiente

Crie um arquivo `.env` em `packages/web/`:

```bash
# Conexão MongoDB (obrigatório)
MONGO_URI=mongodb://localhost:27017/dwc2json

# Conexão readonly para ChatBB (opcional)
MONGODB_URI_READONLY=mongodb://readonly_user:password@localhost:27017/dwc2json
```

## Cache do Dashboard

O dashboard utiliza dados pré-computados armazenados em `cache/dashboard-data.json` para performance:

- **Atualização automática**: Segundas-feiras às 01:00 (via cron-dashboard.js)
- **Atualização manual**: `bun run cache-dashboard`
- **Dados cacheados**: Contagens de taxa/ocorrências, espécies ameaçadas, invasoras, rankings

## Fluxo de Dados

```mermaid
graph LR
    A[Ingestão DwC-A] --> B[taxa_ipt/occurrences_ipt]
    A --> |"Transform Inline"| D
    B --> |"Re-transform"| C[Transform Package]
    C --> D[taxa/occurrences]
    D --> E[APIs REST]
    D --> F[Cache Dashboard]
    E --> G[Interfaces Web]
    F --> G
```

**Ingestão Integrada**: Durante `ingest:flora`, `ingest:fauna`, `ingest:occurrences`, os dados são salvos em coleções raw **e** transformados inline para coleções processadas.

**Re-transformação**: Quando a lógica muda (novos enriquecimentos), `transform:taxa` e `transform:occurrences` reprocessam todo o histórico raw.

## Desenvolvimento

1. **Configurar MongoDB**:

   ```bash
   # Ingestão integrada (raw + transform inline - rotina semanal)
   bun run ingest:flora <URL_DWCA>
   bun run ingest:fauna <URL_DWCA>
   bun run ingest:occurrences

   # Re-transformação (quando modificar lógica em packages/transform/)
   bun run transform:taxa
   bun run transform:occurrences
   ```

2. **Iniciar servidor de desenvolvimento**:

   ```bash
   bun run web:dev
   ```

3. **Acessar aplicação**:
   - Web: http://localhost:4321
   - API: http://localhost:4321/api
   - Swagger: http://localhost:4321/api/docs

## Deploy

### Via Docker

```bash
docker build -t biodiversidade-web -f packages/web/Dockerfile .
docker run -e MONGO_URI=<sua-uri> -p 4321:4321 biodiversidade-web
```

### Via Node.js

```bash
bun run web:build
cd packages/web
PORT=4321 MONGO_URI=<sua-uri> node dist/server/entry.mjs
```

## Documentação Adicional

- [Especificação da API](https://biodiversidade.online/api)
- [Histórico do Projeto](../../README.md)
- [Pipeline de Atualização](../../docs/atualizacao.md)
- [Cache do Dashboard](./README-CACHE.md)
