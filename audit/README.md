# Auditorias de Segurança - ChatBB (Biodiversidade Online)

Este diretório contém relatórios de auditorias de segurança realizadas no projeto ChatBB - Brazilian Biodiversity Chat Assistant.

## Índice de Auditorias

| Data       | Componente                     | Severidade Máxima | Vulnerabilidades                                                              | Relatório                                                                            |
| ---------- | ------------------------------ | ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 2026-01-25 | Full Scan (Aplicação Completa) | **CRÍTICA**       | 18 vulnerabilidades:<br>- 4 Críticas<br>- 6 Altas<br>- 5 Médias<br>- 3 Baixas | [security-review-2026-01-25-full-scan.md](./security-review-2026-01-25-full-scan.md) |

---

## Resumo da Última Auditoria (2026-01-25)

### Vulnerabilidades Críticas Identificadas

1. **Exposição de API Keys via LocalStorage** - API keys OpenAI/Gemini armazenadas sem criptografia
2. **NoSQL Injection via RegExp** - Inputs não sanitizados em queries MongoDB
3. **Prompt Injection em Chat AI** - Falta de validação em prompts enviados aos LLMs
4. **Ausência de Autenticação** - Todos os 19 endpoints da API são públicos

### Prioridades de Correção

**Urgente (Resolver Imediatamente)**:

- [ ] Mover API keys para backend com proxy server-side
- [ ] Sanitizar todos os inputs que vão para RegExp
- [ ] Implementar validação de prompts e sandboxing de tools AI
- [ ] Adicionar sistema de autenticação (JWT ou sessões)

**Alta Prioridade (Resolver em 1 semana)**:

- [ ] Implementar rate limiting em todos os endpoints
- [ ] Corrigir configuração CORS (remover wildcard)
- [ ] Sanitizar logs removendo credenciais
- [ ] Validar MONGO_URI antes de spawnar processos

**Média Prioridade (Resolver em 2-4 semanas)**:

- [ ] Adicionar Content Security Policy
- [ ] Validar bbox em queries geográficas
- [ ] Implementar HTTPS enforcement (HSTS)
- [ ] Reduzir TTL de sessões de chat

### Estatísticas

- **Total de arquivos revisados**: 35+
- **Endpoints da API analisados**: 19
- **Componentes React revisados**: 15+
- **Scripts de ingestão analisados**: 3
- **Total de vulnerabilidades**: 18
- **CVEs potencialmente aplicáveis**: CWE-522, CWE-943, CWE-94, CWE-306

---

## Como Usar Este Diretório

1. **Para desenvolvedores**: Revise os relatórios antes de implementar novas funcionalidades
2. **Para revisores de código**: Use como checklist durante code reviews
3. **Para DevOps**: Configure scanners automáticos baseados nas vulnerabilidades identificadas
4. **Para gestores**: Acompanhe o progresso de correção das vulnerabilidades

---

## Ferramentas Recomendadas

### Scanners Automáticos

- **SAST**: `npm audit`, `bun audit`, `semgrep`
- **DAST**: OWASP ZAP, Burp Suite
- **Dependency Scanning**: Dependabot (GitHub), Snyk
- **Container Scanning**: Trivy, Clair

### Testes Manuais

- **NoSQL Injection**: NoSQLMap
- **Prompt Injection**: Manual testing com payloads customizados
- **API Security**: Postman, Insomnia com security tests

---

## Próximas Auditorias

- **Auditoria de Dependências**: Trimestral
- **Penetration Testing**: Anual
- **Code Review de Segurança**: A cada major release

---

## Contato

Para questões relacionadas à segurança, entre em contato com a equipe de desenvolvimento através dos canais oficiais do projeto.

**IMPORTANTE**: Não compartilhe publicamente vulnerabilidades não corrigidas. Este diretório deve permanecer privado no repositório.
