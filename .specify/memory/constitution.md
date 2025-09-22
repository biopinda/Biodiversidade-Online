<!--
SYNC IMPACT REPORT - Constitution v1.1.0
=========================================

Version Change: v1.0.0 → v1.1.0 (MINOR: Added comprehensive governance sections)

Core Principles (unchanged):
- I. Documentação em Português Brasileiro (NON-NEGOTIABLE)
- II. Qualidade de Código com Ferramentas Automatizadas
- III. Simplicidade na Experiência do Usuário
- IV. Estrutura Monorepo com Separação Clara
- V. Integração Contínua e Dados Atualizados

New Sections Added (v1.1.0):
- Integridade de Dados e Padrões Científicos (nomenclatura, qualidade, rastreabilidade)
- Comunidade e Colaboração (acessibilidade, transparência, interoperabilidade)
- Segurança e Privacidade (proteção de dados, integridade, compliance)
- Enhanced Governança (procedimentos de alteração, revisão periódica)

Templates Updated:
✅ .specify/templates/plan-template.md - Updated Constitution Check section and version reference

Templates Requiring Manual Review:
⚠ .specify/templates/spec-template.md - Should include scientific data quality requirements
⚠ .specify/templates/tasks-template.md - Should validate Portuguese documentation and data integrity
⚠ .specify/templates/agent-file-template.md - Should reference scientific standards and Brazilian focus

Follow-up TODOs:
- Update plan-template.md Constitution Check section to include new governance areas
- Review agent-specific files (AGENTS.md, .github/copilot-instructions.md) for constitution alignment
- Add data integrity validation to task generation rules
- Include security and privacy considerations in spec template

Date: 2025-09-22
-->

# Biodiversidade.Online Constitution

## Core Principles

### I. Documentação em Português Brasileiro (NON-NEGOTIABLE)

Toda documentação deve ser escrita em português brasileiro. Isso inclui READMEs, comentários de código, mensagens de commit, e issues. O projeto serve à comunidade científica brasileira e deve ser acessível em nosso idioma nacional. Termos técnicos podem ser mantidos em inglês quando universalmente aceitos (ex: "commit", "pull request").

### II. Qualidade de Código com Ferramentas Automatizadas

Linting, formatação e verificação de tipos são obrigatórios antes de qualquer commit. Use Prettier para formatação automática (`bunx prettier --write .`), verificação TypeScript (`bunx tsc --noEmit`), e lint-staged para garantir qualidade. Todas as ferramentas devem executar em menos de 30 segundos.

### III. Simplicidade na Experiência do Usuário

Interfaces devem priorizar clareza sobre complexidade. Cada tela deve ter propósito único e claro. Navegação intuitiva é mandatória - usuários devem encontrar informações de biodiversidade em máximo 3 cliques. Performance e acessibilidade são requisitos, não opcionais.

### IV. Estrutura Monorepo com Separação Clara

Mantenha `packages/ingest/` para processamento de dados e `packages/web/` para aplicação web. Use Bun workspaces e catalog dependencies. Scripts devem ser executados no diretório correto - web commands em `packages/web/`, data processing no root. Dependências compartilhadas no catalog raiz.

### V. Integração Contínua e Dados Atualizados

GitHub Actions deve manter dados de biodiversidade sempre atualizados. Builds nunca devem demorar mais que 60 segundos. MongoDB é dependência crítica - aplicação deve falhar graciosamente sem conexão. Validação manual em http://localhost:4321/ é obrigatória após mudanças.

## Padrões Técnicos Obrigatórios

**Stack Tecnológico**: TypeScript + Bun + Astro + MongoDB + Tailwind CSS são as tecnologias base. Novas dependências devem ser justificadas e adicionadas via catalog no package.json raiz. Node.js v20.19.4+ é requisito mínimo.

**Performance**: Aplicação web deve carregar em <2 segundos. Scripts de ingestão devem processar dados DwC-A em <10 minutos para arquivos típicos. Build completo deve executar em <60 segundos.

**Dados Científicos**: Seguir padrões Darwin Core. Preservar integridade taxonômica e nomenclatura científica. Validar coordenadas geográficas e datas de coleta. Manter rastreabilidade das fontes de dados.

## Fluxo de Desenvolvimento

**Comandos Base**: Sempre verificar formatação (`bunx prettier --check src/`), TypeScript (`bunx tsc --noEmit`), e build (`bun run build`) antes de commits. Usar `cd packages/web/` para comandos web e root para ingestão de dados.

**Pull Requests**: Devem ser escritos em português brasileiro. Incluir validação manual das funcionalidades afetadas. CI/CD deve passar em todas as verificações. Mudanças em schemas de dados requerem migração documentada.

**Deployment**: Docker builds automáticos via GitHub Actions. Ambiente de produção usa `node dist/server/entry.mjs` (não `bun preview`). MongoDB connection string deve estar configurada via variáveis de ambiente.

## Integridade de Dados e Padrões Científicos

**Nomenclatura Taxonômica**: Seguir rigorosamente os códigos de nomenclatura (ICBN, ICZN, ICN) e referências oficiais (Flora e Funga do Brasil, Catálogo Taxonômico da Fauna do Brasil). Mudanças nomenclaturais devem ser documentadas com referências bibliográficas.

**Qualidade dos Dados de Ocorrência**: Coordenadas geográficas devem ser validadas contra limites territoriais brasileiros. Datas de coleta devem ser consistentes e plausíveis. Coletores devem seguir padrões de canonicalização para evitar duplicações.

**Rastreabilidade**: Cada registro deve manter referência à fonte original (IPT, herbário, coleção). Metadados de processamento devem incluir data de ingestão, versão dos scripts, e transformações aplicadas.

## Comunidade e Colaboração

**Acessibilidade Científica**: Dados devem ser disponibilizados em formatos padrão (JSON, DwC-A) via APIs RESTful bem documentadas. Interface web deve ser otimizada para pesquisadores com diferentes níveis técnicos.

**Transparência**: Código fonte aberto, documentação pública, e processo de desenvolvimento transparente. Issues e discussões técnicas em português para incluir toda a comunidade científica brasileira.

**Interoperabilidade**: Manter compatibilidade com GBIF, SiBBr, e outras plataformas de biodiversidade. Seguir padrões internacionais sem comprometer a acessibilidade local.

## Segurança e Privacidade

**Proteção de Dados**: Informações de localização de espécies sensíveis (ameaçadas, invasoras) devem seguir protocolos de obscuração geográfica quando necessário.

**Integridade do Sistema**: Backups automáticos do MongoDB. Logs de acesso e modificações. Validação de entrada para prevenir injeção de dados maliciosos.

**Compliance**: Aderir às normas do ICMBio, IBAMA, e legislação brasileira sobre acesso e uso de dados de biodiversidade.

## Governança

Esta constituição substitui todas as outras práticas de desenvolvimento. Alterações requerem consenso dos mantenedores principais e plano de migração documentado. Violações dos princípios devem ser justificadas caso a caso.

Todos os PRs e reviews devem verificar conformidade com os princípios acima. Complexidade adicional deve ser justificada com benefício claro para a comunidade científica brasileira. Use `AGENTS.md` e `.github/copilot-instructions.md` para orientações específicas dos assistentes de IA.

**Procedimento de Alteração**: Mudanças na constituição requerem: (1) proposta documentada com justificativa, (2) período de discussão de 7 dias em issue pública, (3) consenso dos mantenedores principais, (4) atualização da versão seguindo semantic versioning, (5) migração dos templates dependentes.

**Revisão Periódica**: Esta constituição deve ser revisada a cada 6 meses ou após grandes atualizações tecnológicas. Feedback da comunidade científica é considerado prioritário nas revisões.

**Version**: 1.1.0 | **Ratified**: 2025-09-22 | **Last Amended**: 2025-09-22
