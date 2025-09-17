# Scripts de Verificação IPT

## check_ipt_resources.py

Script para verificar recursos disponíveis no IPT versus os já integrados na base de dados Grist.

### Configuração

1. **Copie o arquivo de exemplo de variáveis de ambiente:**
   ```bash
   cp .env.example .env
   ```

2. **Configure as variáveis de ambiente no arquivo `.env`:**
   ```env
   GRIST_API_KEY=sua_chave_api_aqui
   GRIST_DOC_ID=seu_documento_id_aqui
   ```

### Execução

```bash
# Carregar variáveis de ambiente e executar
source .env
python3 check_ipt_resources.py
```

Ou usando python-dotenv:

```bash
pip install python-dotenv
python3 check_ipt_resources.py  # O script carregará automaticamente o .env
```

### Funcionalidades

- ✅ Busca recursos do RSS do IPT JBRJ
- ✅ Compara com registros existentes no Grist
- ✅ Gera relatórios CSV/TSV de recursos faltantes
- ✅ Extrai tags automaticamente dos links RSS
- ✅ Logging detalhado do processo

### Outputs

O script gera dois arquivos quando encontra recursos faltantes:
- `missing_resources_YYYYMMDD_HHMMSS.csv` - Formato CSV
- `missing_resources_YYYYMMDD_HHMMSS.tsv` - Formato TSV

### Segurança

⚠️ **IMPORTANTE**: Nunca commite arquivos `.env` ou exponha chaves de API no código.

As credenciais são carregadas via variáveis de ambiente para manter a segurança.