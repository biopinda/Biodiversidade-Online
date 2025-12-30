# Correção de Vulnerabilidade CVE-2024-53382

## Status: ⚠️ Requer Atualização do Lockfile

### Vulnerabilidade Identificada

**CVE-2024-53382**: PrismJS DOM Clobbering vulnerability (XSS)

- **Severidade**: Baixa (CVSS 4.9)
- **Versões afetadas**: prismjs ≤ 1.29.0
- **Versão corrigida**: prismjs ≥ 1.30.0

### Mudanças Aplicadas

✅ **Commit `00b4185`** incluiu:

1. **Override global de prismjs** no `package.json` raiz:

   ```json
   "overrides": {
     "prismjs": "^1.30.0"
   }
   ```

   Isso força TODAS as dependências transitivas a usar prismjs 1.30.0+

2. **Atualização preventiva do sharp**: 0.33.5 → 0.34.5

### ⚠️ Ação Necessária

Para completar a correção, **execute localmente**:

```bash
# Atualizar o lockfile com as novas versões
bun install

# Verificar que prismjs foi atualizado
bunx bun --version  # Deve mostrar bun 1.2.21 ou superior

# Fazer commit do lockfile atualizado
git add bun.lock
git commit -m "chore: Atualizar bun.lock com prismjs 1.30.0"
git push origin main
```

### Verificação

Após executar `bun install` e fazer push, o Dependabot deve:

1. Detectar que prismjs 1.30.0 está no `bun.lock`
2. Fechar automaticamente o alerta #39
3. Remover a mensagem de vulnerabilidade do GitHub

### Por que o Override Não Foi Suficiente?

O GitHub Dependabot analisa o **lockfile** (`bun.lock`), não apenas o `package.json`.

Embora o override garanta que NOVAS instalações usem prismjs 1.30.0, o lockfile existente ainda referencia versões antigas (como `refractor` usando `prismjs ~1.27.0`).

Executar `bun install` reconstruirá o lockfile aplicando os overrides.

### Referências

- **CVE Details**: https://nvd.nist.gov/vuln/detail/CVE-2024-53382
- **GitHub Advisory**: https://github.com/advisories/GHSA-x7hr-w5r2-h6wg
- **Dependabot Alert**: https://github.com/biopinda/Biodiversidade-Online/security/dependabot/39

---

**Atualizado em**: 2025-12-20
