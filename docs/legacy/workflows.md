# Workflows do GitHub Actions

Este documento descreve todos os workflows configurados no diretório `.github/workflows` do projeto Biodiversidade Online (ChatBB).

## Índice

- [Workflows de CI/CD](#workflows-de-cicd)
- [Workflows de Ingestão de Dados](#workflows-de-ingestão-de-dados)
- [Workflows de Transformação de Dados](#workflows-de-transformação-de-dados)
- [Execução Manual](#execução-manual)

---

## Workflows de CI/CD

### docker.yml - Build e Publicação de Imagem Docker

**Localização**: `.github/workflows/docker.yml`

**Descrição**: Constrói e publica a imagem Docker da aplicação web no GitHub Container Registry.

**Triggers**:

- Execução manual apenas (`workflow_dispatch`)

**Processo**:

1. Faz checkout do repositório
2. Autentica no GitHub Container Registry
3. Extrai metadados (tags, labels) para Docker
4. Constrói e publica a imagem Docker
5. Gera atestado de proveniência do artefato

**Registry**: `ghcr.io`

**Tags geradas**:

- `latest` (apenas branch padrão)
- Tag da branch
- Tag do PR
- Versão semântica
- SHA do commit

**Nota**: O deployment para UNRAID deve ser feito manualmente através da interface do UNRAID.

---

## Workflows de Ingestão de Dados

### update-mongodb-flora.yml - Atualização de Dados de Flora

**Localização**: `.github/workflows/update-mongodb-flora.yml`

**Descrição**: Baixa e processa dados da **Flora do Brasil** no MongoDB.

**Triggers**:

- **Manual apenas**: Com opção de URL customizada de DWCA (`workflow_dispatch`)

**Fonte de dados padrão**:

- URL: `https://ipt.jbrj.gov.br/jbrj/archive.do?r=lista_especies_flora_brasil`
- Formato: Darwin Core Archive (DwCA)

**Processo**:

1. Setup do ambiente (Node.js, Bun)
2. Instalação de dependências
3. Verificação de conexão MongoDB
4. Ingestão e transformação dos dados de flora
5. Tratamento de erros com mensagens de troubleshooting

**Runner**: `self-hosted`

**Timeout**: 30 minutos

---

### update-mongodb-fauna.yml - Atualização de Dados de Fauna

**Localização**: `.github/workflows/update-mongodb-fauna.yml`

**Descrição**: Baixa e processa dados da **Fauna do Brasil** no MongoDB.

**Triggers**:

- **Manual apenas**: Com opção de URL customizada de DWCA (`workflow_dispatch`)

**Fonte de dados padrão**:

- URL: `https://ipt.jbrj.gov.br/jbrj/archive.do?r=catalogo_taxonomico_da_fauna_do_brasil`
- Formato: Darwin Core Archive (DwCA)

**Processo**:

1. Setup do ambiente (Node.js, Bun)
2. Instalação de dependências
3. Verificação de conexão MongoDB
4. Ingestão e transformação dos dados de fauna
5. Tratamento de erros com mensagens de troubleshooting

**Runner**: `self-hosted`

**Timeout**: 30 minutos

---

### update-mongodb-occurrences.yml - Atualização de Dados de Ocorrências

**Localização**: `.github/workflows/update-mongodb-occurrences.yml`

**Descrição**: Processa dados de **Ocorrências** de espécies no MongoDB e regenera o cache.

**Triggers**:

- **Manual apenas**: Via `workflow_dispatch`

**Processo**:

1. Setup do ambiente (Node.js, Bun)
2. Instalação de dependências
3. Verificação de conexão MongoDB
4. Ingestão e transformação dos dados de ocorrências
5. Limpeza e regeneração do cache de ocorrências
6. Tratamento de erros com mensagens de troubleshooting

**Runner**: `self-hosted`

**Timeout**: 30 minutos

**Nota**: A regeneração do cache pode falhar sem interromper o workflow (apenas um warning).

---

## Workflows de Transformação de Dados

### transform-taxa.yml - Re-transformação de Dados de Taxa

**Localização**: `.github/workflows/transform-taxa.yml`

**Descrição**: Re-transforma dados de taxa (espécies) manualmente.

**Triggers**:

- **Manual apenas**: Via `workflow_dispatch`

**Processo**:

1. Setup do ambiente (Node.js, Bun)
2. Instalação de dependências com lockfile congelado
3. Execução do script de transformação de taxa

**Comando**: `bun run transform:taxa`

**Runner**: `self-hosted`

---

### transform-occurrences.yml - Re-transformação de Dados de Ocorrências

**Localização**: `.github/workflows/transform-occurrences.yml`

**Descrição**: Re-transforma dados de ocorrências manualmente.

**Triggers**:

- **Manual apenas**: Via `workflow_dispatch`

**Processo**:

1. Setup do ambiente (Node.js, Bun)
2. Instalação de dependências com lockfile congelado
3. Execução do script de transformação de ocorrências
4. Limpeza e regeneração do cache de ocorrências

**Comandos**:

- `bun run transform:occurrences`
- `bun run --filter @biodiversidade/web clear-occurrence-cache`

**Runner**: `self-hosted`

---

### transform-weekly.yml - Pipeline de Transformação Semanal

**Localização**: `.github/workflows/transform-weekly.yml`

**Descrição**: Pipeline completo de transformação de dados com sistema de lock distribuído e validação.

**Triggers**:

- **Manual apenas**: Via `workflow_dispatch`

**Processo**:

1. Setup do ambiente (Node.js 20.19.4, Bun 1.2.21)
2. Instalação de dependências
3. **Aquisição de lock distribuído** (timeout de 1 hora)
   - Verifica se outra transformação está em execução
   - Cria arquivo de lock em `/tmp/transform.lock`
4. Execução do pipeline de transformação
5. Verificação dos resultados da transformação
6. Validação pós-transformação
7. Notificação de sucesso/falha
8. Upload de logs como artifacts (retenção de 30 dias)
9. Liberação do lock distribuído

**Comando**: `bun run transform:execute`

**Runner**: `ubuntu-latest`

**Timeout total**: 180 minutos (3 horas)

**Timeout de transformação**: 120 minutos (2 horas)

**Variáveis de ambiente**:

- `MONGO_URI`: URI de conexão MongoDB
- `MONGO_DB_NAME`: `dwc2json`
- `NODE_ENV`: `production`

---

## Execução Manual

**Todos os workflows devem ser executados manualmente através da interface do GitHub Actions.**

Não há mais execuções agendadas (schedule/cron) ou automáticas (push triggers). Todos os workflows foram configurados para usar apenas `workflow_dispatch`.

### Ordem Recomendada para Atualização de Dados

Quando realizar atualização manual dos dados, siga esta sequência:

```
1. update-mongodb-flora.yml
     ↓
2. update-mongodb-fauna.yml
     ↓
3. update-mongodb-occurrences.yml
     ↓
4. transform-weekly.yml (se necessário)
```

---

## Segredos Necessários

Os seguintes segredos devem estar configurados em **Settings > Secrets and variables > Actions**:

| Segredo     | Usado por                             | Descrição                  |
| ----------- | ------------------------------------- | -------------------------- |
| `MONGO_URI` | Workflows de ingestão e transformação | URI de conexão com MongoDB |

---

## Runners

O projeto utiliza dois tipos de runners:

### Self-hosted Runners

Usados para workflows de ingestão e transformação que requerem:

- Acesso direto ao MongoDB
- Processamento intensivo de dados
- Maior controle sobre recursos

**Workflows**:

- `update-mongodb-flora.yml`
- `update-mongodb-fauna.yml`
- `update-mongodb-occurrences.yml`
- `transform-taxa.yml`
- `transform-occurrences.yml`

### GitHub-hosted Runners (ubuntu-latest)

Usados para workflows de CI/CD:

**Workflows**:

- `docker.yml`
- `transform-weekly.yml`

---

## Troubleshooting

### Problemas Comuns

**MongoDB Connection Failed**

- Verificar se o segredo `MONGO_URI` está configurado
- Validar conectividade do runner com MongoDB
- Verificar formato da URI: `mongodb://host:port/database`

**DWCA Download Failed**

- Verificar se as URLs do IPT estão acessíveis
- Validar conectividade com `ipt.jbrj.gov.br`
- Tentar execução manual com URL customizada

**Transform Lock Timeout**

- Aguardar conclusão da transformação em andamento (timeout 1h)
- Verificar logs da execução anterior
- Em casos extremos, remover manualmente `/tmp/transform.lock`

**Cache Regeneration Failed**

- Verificar logs da aplicação web
- Validar esquema do MongoDB
- O workflow continua mesmo se o cache falhar (apenas warning)

---

## Manutenção

### Atualizando URLs de Fonte de Dados

As URLs padrão de DWCA estão definidas como variáveis de ambiente nos workflows:

**Flora**: Editar `update-mongodb-flora.yml`

```yaml
env:
  DWCA_URL: https://ipt.jbrj.gov.br/jbrj/archive.do?r=lista_especies_flora_brasil
```

**Fauna**: Editar `update-mongodb-fauna.yml`

```yaml
env:
  DWCA_URL: https://ipt.jbrj.gov.br/jbrj/archive.do?r=catalogo_taxonomico_da_fauna_do_brasil
```

---

## Referências

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Darwin Core Archive Format](https://dwc.tdwg.org/text/)
