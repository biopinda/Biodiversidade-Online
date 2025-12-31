# Workflows do GitHub Actions

Este documento descreve todos os workflows configurados no diretório `.github/workflows` do projeto Biodiversidade Online (ChatBB).

## Índice

- [Workflows de CI/CD](#workflows-de-cicd)
- [Workflows de Ingestão de Dados](#workflows-de-ingestão-de-dados)
- [Workflows de Transformação de Dados](#workflows-de-transformação-de-dados)
- [Workflows de IA](#workflows-de-ia)
- [Cronograma de Execução](#cronograma-de-execução)

---

## Workflows de CI/CD

### docker.yml - Build e Publicação de Imagem Docker

**Localização**: `.github/workflows/docker.yml`

**Descrição**: Constrói e publica a imagem Docker da aplicação web no GitHub Container Registry.

**Triggers**:

- Push de alterações em `packages/web/**`
- Push de alterações em `.github/workflows/docker.yml`
- Execução manual (`workflow_dispatch`)

**Processo**:

1. Faz checkout do repositório
2. Autentica no GitHub Container Registry
3. Extrai metadados (tags, labels) para Docker
4. Constrói e publica a imagem Docker
5. Gera atestado de proveniência do artefato
6. Dispara automaticamente o workflow de deploy se estiver no branch `main`

**Registry**: `ghcr.io`

**Tags geradas**:

- `latest` (apenas branch padrão)
- Tag da branch
- Tag do PR
- Versão semântica
- SHA do commit

---

### ssh-deploy.yml - Deploy via SSH

**Localização**: `.github/workflows/ssh-deploy.yml`

**Descrição**: Deploy da nova versão da aplicação em servidor remoto usando Watchtower.

**Triggers**:

- Execução manual (`workflow_dispatch`)
- Disparado automaticamente pelo workflow `docker.yml`

**Processo**:

1. Conecta ao servidor via SSH
2. Executa Watchtower para atualizar o container `DwC2JSON`
3. Remove containers antigos e reinicia o container atualizado

**Runner**: `self-hosted`

**Segredos necessários**:

- `SSH_HOST`: Endereço do servidor
- `SSH_USERNAME`: Usuário SSH
- `SSH_DEPLOY_KEY`: Chave SSH privada

---

## Workflows de Ingestão de Dados

### update-mongodb-flora.yml - Atualização de Dados de Flora

**Localização**: `.github/workflows/update-mongodb-flora.yml`

**Descrição**: Baixa e processa dados da **Flora do Brasil** no MongoDB.

**Triggers**:

- **Agendado**: Domingos às 02:00 UTC (cron: `0 2 * * 0`)
- **Manual**: Com opção de URL customizada de DWCA
- **Automático**: Pushes que modificam:
  - `packages/ingest/src/lib/**`
  - `packages/ingest/src/flora.ts`
  - `packages/transform/src/**`
  - `.github/workflows/update-mongodb-flora.yml`

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

- **Agendado**: Domingos às 02:30 UTC (cron: `30 2 * * 0`)
- **Manual**: Com opção de URL customizada de DWCA
- **Automático**: Pushes que modificam:
  - `packages/ingest/src/lib/**`
  - `packages/ingest/src/fauna.ts`
  - `packages/transform/src/**`
  - `.github/workflows/update-mongodb-fauna.yml`

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

- **Agendado**: Domingos às 03:00 UTC (cron: `0 3 * * 0`)
- **Manual**: Via `workflow_dispatch`
- **Automático**: Pushes que modificam:
  - `packages/ingest/src/lib/**`
  - `packages/ingest/src/ocorrencia.ts`
  - `packages/transform/src/**`
  - `packages/ingest/referencias/occurrences.csv`
  - `packages/web/src/scripts/clear-occurrence-cache.ts`
  - `.github/workflows/update-mongodb-occurrences.yml`

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

**Descrição**: Re-transforma dados de taxa (espécies) quando o código de transformação é alterado.

**Triggers**:

- **Automático**: Pushes que modificam:
  - `packages/transform/src/taxa/**`
  - `packages/transform/package.json`
  - `packages/shared/src/**`
  - `.github/workflows/transform-taxa.yml`
- **Manual**: Via `workflow_dispatch`

**Processo**:

1. Setup do ambiente (Node.js, Bun)
2. Instalação de dependências com lockfile congelado
3. Execução do script de transformação de taxa

**Comando**: `bun run transform:taxa`

**Runner**: `self-hosted`

---

### transform-occurrences.yml - Re-transformação de Dados de Ocorrências

**Localização**: `.github/workflows/transform-occurrences.yml`

**Descrição**: Re-transforma dados de ocorrências quando o código de transformação é alterado.

**Triggers**:

- **Automático**: Pushes que modificam:
  - `packages/transform/src/occurrences/**`
  - `packages/transform/package.json`
  - `packages/shared/src/**`
  - `.github/workflows/transform-occurrences.yml`
- **Manual**: Via `workflow_dispatch`

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

- **Agendado**: Segundas-feiras às 04:00 UTC (cron: `0 4 * * 1`)
- **Manual**: Via `workflow_dispatch`

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

## Workflows de IA

### claude.yml - Claude Code Interativo

**Localização**: `.github/workflows/claude.yml`

**Descrição**: Permite invocar o assistente Claude diretamente em issues e pull requests através da menção `@claude`.

**Triggers**:

- Comentários em issues contendo `@claude`
- Comentários em PRs contendo `@claude`
- Reviews de PRs contendo `@claude`
- Issues abertas/atribuídas com `@claude` no título ou corpo

**Processo**:

1. Verifica se `@claude` foi mencionado
2. Faz checkout do repositório
3. Executa Claude Code Action
4. Claude executa as instruções especificadas no comentário

**Permissões**:

- Leitura de conteúdo, PRs, issues
- Leitura de resultados de CI em PRs
- Escrita de tokens de identidade

**Segredo necessário**: `CLAUDE_CODE_OAUTH_TOKEN`

**Runner**: `ubuntu-latest`

---

### claude-code-review.yml - Revisão Automática de Código

**Localização**: `.github/workflows/claude-code-review.yml`

**Descrição**: Revisão automática de código usando Claude quando um Pull Request é aberto ou atualizado.

**Triggers**:

- Pull requests abertos (`opened`)
- Pull requests atualizados (`synchronize`)

**Aspectos analisados**:

- Qualidade do código e boas práticas
- Bugs potenciais e issues
- Considerações de performance
- Problemas de segurança
- Cobertura de testes

**Processo**:

1. Faz checkout do repositório
2. Executa Claude Code Review
3. Claude analisa as mudanças do PR
4. Posta feedback construtivo como comentário no PR usando `gh pr comment`

**Configuração**:

- Usa `CLAUDE.md` como guia para estilo e convenções
- Ferramentas permitidas: `gh issue`, `gh search`, `gh pr` (view, diff, comment, list)

**Permissões**:

- Leitura de conteúdo, PRs, issues
- Escrita de tokens de identidade

**Segredo necessário**: `CLAUDE_CODE_OAUTH_TOKEN`

**Runner**: `ubuntu-latest`

---

## Cronograma de Execução

### Horários Agendados (UTC)

| Dia/Hora  | Workflow                         | Descrição                                  |
| --------- | -------------------------------- | ------------------------------------------ |
| Dom 02:00 | `update-mongodb-flora.yml`       | Atualização de dados de Flora do Brasil    |
| Dom 02:30 | `update-mongodb-fauna.yml`       | Atualização de dados de Fauna do Brasil    |
| Dom 03:00 | `update-mongodb-occurrences.yml` | Atualização de dados de Ocorrências        |
| Seg 04:00 | `transform-weekly.yml`           | Pipeline completo de transformação semanal |

### Fluxo de Dados Semanal

```
Domingo 02:00 UTC → Flora Ingest
     ↓
Domingo 02:30 UTC → Fauna Ingest
     ↓
Domingo 03:00 UTC → Occurrences Ingest
     ↓
Segunda 04:00 UTC → Weekly Transform Pipeline
```

---

## Segredos Necessários

Os seguintes segredos devem estar configurados em **Settings > Secrets and variables > Actions**:

| Segredo                   | Usado por                              | Descrição                           |
| ------------------------- | -------------------------------------- | ----------------------------------- |
| `MONGO_URI`               | Workflows de ingestão e transformação  | URI de conexão com MongoDB          |
| `SSH_HOST`                | `ssh-deploy.yml`                       | Endereço do servidor de produção    |
| `SSH_USERNAME`            | `ssh-deploy.yml`                       | Usuário SSH para deploy             |
| `SSH_DEPLOY_KEY`          | `ssh-deploy.yml`                       | Chave SSH privada para autenticação |
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude.yml`, `claude-code-review.yml` | Token OAuth para Claude Code        |

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
- `ssh-deploy.yml`

### GitHub-hosted Runners (ubuntu-latest)

Usados para workflows de CI/CD e IA:

**Workflows**:

- `docker.yml`
- `transform-weekly.yml`
- `claude.yml`
- `claude-code-review.yml`

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

### Ajustando Horários de Execução

Os horários são definidos em formato cron nos workflows:

```yaml
schedule:
  - cron: '0 2 * * 0' # Minuto Hora Dia Mês DiaDaSemana
```

Converter UTC para seu fuso horário local ao ajustar horários.

---

## Referências

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cron Schedule Syntax](https://crontab.guru/)
- [Darwin Core Archive Format](https://dwc.tdwg.org/text/)
- [Claude Code Action](https://github.com/anthropics/claude-code-action)
- [Watchtower Documentation](https://containrrr.dev/watchtower/)
