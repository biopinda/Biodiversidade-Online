# Melhorias de Segurança - Proteção de API Keys

Este documento detalha as melhorias de segurança implementadas para mitigar a vulnerabilidade crítica de exposição de API Keys armazenadas no cliente.

## Vulnerabilidade Identificada

**Tipo**: Exposição de API Keys de Terceiros via Armazenamento Local
**Severidade**: CRÍTICA
**CWE**: CWE-312 (Cleartext Storage of Sensitive Information)

### Problema Original

As API Keys do OpenAI e Google Gemini eram armazenadas em texto claro no `localStorage` do navegador, expondo-as a:

1. Acesso por scripts maliciosos (XSS)
2. Persistência indefinida mesmo após fechar o navegador
3. Possível extração por extensões de navegador maliciosas
4. Falta de proteção contra leitura excessiva (sem rate limiting)

## Soluções Implementadas

### 1. Substituição de localStorage por sessionStorage

**Arquivo**: `packages/web/src/components/Chat.tsx`

**Mudanças**:

- Substituído `localStorage` por `sessionStorage` para todas as operações de armazenamento de API Keys
- Dados agora expiram automaticamente ao fechar o navegador
- Histórico de chat também movido para `sessionStorage`

**Benefícios**:

- Reduz janela de exposição temporal
- Força reautenticação a cada sessão
- Impede persistência de longo prazo de credenciais

### 2. Criptografia de API Keys com Web Crypto API

**Arquivos Criados**:

- `packages/web/src/lib/crypto.ts`
- `packages/web/src/components/EncryptionPasswordDialog.tsx`

**Implementação**:

#### Derivação de Chave (PBKDF2)

```typescript
- Algoritmo: PBKDF2 com SHA-256
- Iterações: 100.000 (proteção contra ataques de força bruta)
- Salt: 16 bytes aleatórios por criptografia
- Chave derivada: 256 bits
```

#### Criptografia (AES-GCM)

```typescript
- Algoritmo: AES-GCM (Authenticated Encryption)
- Tamanho da chave: 256 bits
- IV (Initialization Vector): 12 bytes aleatórios
- Autenticação integrada contra adulteração
```

**Fluxo de Segurança**:

1. **Primeira Configuração**:
   - Usuário cria senha forte (validação obrigatória)
   - Senha nunca é armazenada, apenas mantida em memória durante sessão
   - API Keys são criptografadas antes de armazenar no sessionStorage

2. **Sessões Subsequentes**:
   - Usuário fornece senha de descriptografia
   - API Keys são descriptografadas em memória
   - Falha na descriptografia exige reconfiguração

3. **Validação de Senha**:
   - Mínimo 8 caracteres
   - Deve conter: maiúsculas, minúsculas, números e caracteres especiais
   - Confirmação obrigatória no primeiro uso

### 3. Content Security Policy (CSP) Restritiva

**Arquivo**: `packages/web/src/middleware.ts`

**Políticas Implementadas**:

```typescript
default-src 'self'
  - Padrão: apenas recursos da mesma origem

script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.partytown.io https://www.googletagmanager.com
  - Scripts: origem própria + Partytown + GTM
  - 'unsafe-inline' e 'unsafe-eval' necessários para Astro/React (considerar remoção futura)

style-src 'self' 'unsafe-inline'
  - Estilos: origem própria + inline (necessário para styled-components)

img-src 'self' data: https: blob:
  - Imagens: origem própria + data URIs + HTTPS + blobs

connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com
  - Conexões: apenas APIs autorizadas

frame-ancestors 'none'
  - Bloqueia incorporação em iframes (clickjacking)

base-uri 'self'
  - Previne ataques de manipulação de base URL

form-action 'self'
  - Restringe envio de formulários

upgrade-insecure-requests
  - Força upgrade de HTTP para HTTPS
```

**Proteção Oferecida**:

- Mitigação de XSS (Cross-Site Scripting)
- Prevenção de carregamento de scripts maliciosos
- Restrição de destinos de conexão (apenas APIs legítimas)
- Proteção contra clickjacking

### 4. Rate Limiting por Sessão

**Arquivo**: `packages/web/src/components/Chat.tsx`

**Implementação**:

```typescript
class SessionRateLimiter {
  - Janela de tempo: 60 segundos
  - Máximo de operações: 100 por janela
  - Escopo: leitura e escrita de API Keys
}
```

**Funcionalidades**:

- Limita operações de armazenamento a 100/minuto
- Rastreamento em memória (não persistente)
- Mensagem de erro amigável ao usuário
- Auto-reset após janela de tempo
- Aviso visual temporário (5 segundos)

**Proteção Oferecida**:

- Mitigação de ataques de força bruta
- Prevenção de leitura excessiva por scripts maliciosos
- Limitação de tentativas de descriptografia

## Componentes de UI Adicionados

### EncryptionPasswordDialog

- Diálogo modal para solicitar senha de criptografia
- Modo "primeira vez" com confirmação de senha
- Modo "desbloquear" para sessões subsequentes
- Validação de força de senha integrada
- Aviso sobre impossibilidade de recuperação de senha

### PasswordInput (Aprimorado)

- Adicionado suporte para `value`, `onChange`, `onKeyDown`
- Mantém funcionalidade de toggle de visibilidade
- Compatibilidade com uso controlado e não-controlado

## Arquivos Modificados

1. **packages/web/src/components/Chat.tsx**
   - Substituição de localStorage por sessionStorage
   - Integração de criptografia/descriptografia
   - Adição de rate limiting
   - Gerenciamento de estado de senha de criptografia
   - Callback para primeiro acesso

2. **packages/web/src/middleware.ts**
   - Adição de Content Security Policy
   - Correção de async/await para compatibilidade

3. **packages/web/src/components/PasswordInput.tsx**
   - Extensão de propriedades para uso controlado
   - Tipagem TypeScript melhorada

## Arquivos Criados

1. **packages/web/src/lib/crypto.ts**
   - Funções de criptografia/descriptografia
   - Derivação de chave segura
   - Validação de força de senha

2. **packages/web/src/components/EncryptionPasswordDialog.tsx**
   - Componente de diálogo para senha
   - Integração com sistema de criptografia

3. **packages/web/src/components/ui/label.tsx**
   - Componente de label acessível (Radix UI)

## Dependências Adicionadas

- `@radix-ui/react-label@2.1.8`

## Considerações de Segurança

### Pontos Fortes

- Criptografia forte (AES-GCM 256-bit)
- Derivação de chave robusta (PBKDF2 100k iterações)
- Proteção contra adulteração (GCM autenticado)
- Expiração automática de sessão
- Rate limiting efetivo
- CSP restritiva

### Limitações Conhecidas

- Senha de criptografia mantida em memória durante sessão
- Não protege contra malware com acesso à memória do processo
- Requer senha forte do usuário (fator humano)
- Senha perdida = necessidade de reconfiguração
- `unsafe-inline` e `unsafe-eval` em CSP (necessário para Astro/React)

### Recomendações Futuras

1. **Implementação de Proxy Backend** (Recomendação 1 do relatório)
   - Mover API Keys completamente para backend
   - Autenticação de usuário no ChatBB
   - API Keys nunca expostas ao cliente

2. **Remoção de unsafe-inline/unsafe-eval**
   - Refatorar código para usar nonces ou hashes
   - Melhoria incremental do CSP

3. **Implementação de HSM/Vault**
   - Para ambiente de produção com múltiplos usuários
   - Armazenamento seguro de secrets no backend

4. **Auditoria de Segurança Periódica**
   - Revisão de dependências
   - Scan de vulnerabilidades
   - Testes de penetração

## Impacto na Experiência do Usuário

### Mudanças Visíveis

1. Solicitação de senha na primeira configuração de API Keys
2. Solicitação de senha ao retornar após fechar navegador
3. Possível aviso de rate limit em caso de uso anormal

### Mudanças Invisíveis

1. API Keys agora criptografadas no armazenamento
2. CSP bloqueia scripts/conexões não autorizados
3. Rate limiting previne abuso

## Testes Recomendados

### Testes Funcionais

- [ ] Configuração inicial de API Keys com senha
- [ ] Persistência durante navegação (mesma sessão)
- [ ] Perda de dados ao fechar navegador (comportamento esperado)
- [ ] Descriptografia com senha correta
- [ ] Rejeição com senha incorreta
- [ ] Validação de senha fraca
- [ ] Rate limiting após 100 operações em 60s

### Testes de Segurança

- [ ] Verificar API Keys criptografadas no sessionStorage (DevTools)
- [ ] Confirmar expiração ao fechar navegador
- [ ] Validar bloqueio de scripts externos via CSP
- [ ] Confirmar bloqueio de conexões não autorizadas

## Conclusão

Esta implementação fornece proteção significativamente melhorada para API Keys armazenadas no cliente, embora a solução ideal permaneça sendo mover as API Keys completamente para o backend (Recomendação 1). As melhorias implementadas seguem as melhores práticas de segurança web e reduzem substancialmente o risco de exposição acidental ou maliciosa de credenciais.
