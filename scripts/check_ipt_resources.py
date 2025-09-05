#!/usr/bin/env python3
import os
import requests
import xml.etree.ElementTree as ET
import csv
import json
import re
from datetime import datetime

# Tentar carregar variáveis de ambiente de .env se disponível
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Configurações
ipt_rss = 'https://ipt.jbrj.gov.br/jabot/rss.do'
grist_api_key = os.getenv('GRIST_API_KEY', '')
doc_id = os.getenv('GRIST_DOC_ID', '')
table_id = 'Datasets'
api_url = f'https://docs.getgrist.com/api/docs/{doc_id}/tables/{table_id}/records'
columns_url = f'https://docs.getgrist.com/api/docs/{doc_id}/tables/{table_id}/columns'

def fetch_grist_data(url, api_key):
    """Faz requisição à API do Grist"""
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Erro ao buscar dados do Grist: {e}")
        return None

def fetch_ipt_rss_data(rss_url):
    """Busca dados do RSS do IPT"""
    try:
        response = requests.get(rss_url, timeout=30)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Erro ao buscar RSS do IPT: {e}")
        return None

def extract_tag_from_link(link):
    """Extrai a tag da URL do link RSS
    Exemplo: https://ipt.jbrj.gov.br/jabot/resource?r=hhm -> retorna 'hhm'
    """
    if not link:
        return ''
    
    # Extrair a parte após "resource?r="
    match = re.search(r'resource\?r=([^&]+)', link)
    if match:
        return match.group(1)
    
    return ''

def parse_ipt_resources(rss_content):
    """Extrai recursos do RSS e suas tags"""
    resources = []
    
    try:
        root = ET.fromstring(rss_content)
        
        for item in root.findall('.//item'):
            title_elem = item.find('title')
            link_elem = item.find('link')
            guid_elem = item.find('guid')
            description_elem = item.find('description')
            pub_date_elem = item.find('pubDate')
            
            title = title_elem.text if title_elem is not None else ''
            link = link_elem.text if link_elem is not None else ''
            guid = guid_elem.text if guid_elem is not None else ''
            description = description_elem.text if description_elem is not None else ''
            pub_date = pub_date_elem.text if pub_date_elem is not None else ''
            
            # Extrair tag do link principal
            tag = extract_tag_from_link(link)
            
            # Se não encontrou no link, tenta no guid
            if not tag:
                tag = extract_tag_from_link(guid)
            
            resources.append({
                'title': title,
                'link': link,
                'guid': guid,
                'tag': tag,  # Nova propriedade: tag extraída do link
                'description': description,
                'pub_date': pub_date
            })
    except ET.ParseError as e:
        print(f"Erro ao parsear RSS XML: {e}")
        return []
    
    return resources

def get_grist_table_structure(doc_id, table_id, api_key):
    """Obtém a estrutura da tabela do Grist"""
    columns_url = f'https://docs.getgrist.com/api/docs/{doc_id}/tables/{table_id}/columns'
    columns_data = fetch_grist_data(columns_url, api_key)
    
    if not columns_data:
        return []
    
    columns = []
    for column in columns_data.get('columns', []):
        columns.append({
            'id': column.get('id'),
            'label': column.get('label', column.get('id')),
            'type': column.get('type')
        })
    
    return columns

def find_missing_resources(ipt_resources, grist_records):
    """Encontra recursos do IPT que não estão no Grist
    Compara a tag extraída do RSS link com o campo $tag do GRIST
    """
    missing = []
    
    # Criar conjunto de tags do Grist
    grist_tags = set()
    grist_tags_debug = {}  # Para debug - mapear tag para informações do registro
    
    for record in grist_records:
        fields = record.get('fields', {})
        
        # Verificar especificamente o campo 'tag' no GRIST
        if 'tag' in fields and fields['tag']:
            tag_value = str(fields['tag']).strip()
            grist_tags.add(tag_value)
            # Guardar informações para debug
            grist_tags_debug[tag_value] = {
                'nome': fields.get('nome', 'N/A'),
                'record_id': record.get('id', 'N/A')
            }
    
    print(f"📊 Total de tags encontradas no GRIST: {len(grist_tags)}")
    print(f"🏷️  Primeiras 10 tags do GRIST: {list(grist_tags)[:10]}")
    
    # Verificar cada recurso do IPT
    for resource in ipt_resources:
        found = False
        match_info = []
        
        rss_tag = resource['tag']
        
        if rss_tag:
            # Verificar se a tag do RSS existe no GRIST
            if rss_tag in grist_tags:
                found = True
                grist_info = grist_tags_debug.get(rss_tag, {})
                match_info.append(f"Tag match: '{rss_tag}' -> Nome GRIST: '{grist_info.get('nome', 'N/A')}'")
            else:
                # Para debug, mostrar tag que não foi encontrada
                print(f"❌ Tag não encontrada no GRIST: '{rss_tag}' (do recurso: {resource['title'][:50]}...)")
        
        if not found:
            # Adicionar informação de debug para recursos não encontrados
            resource['debug_info'] = {
                'rss_tag': rss_tag,
                'rss_title': resource['title']
            }
            missing.append(resource)
        else:
            # Para debug - mostrar matches encontrados
            print(f"✓ Recurso encontrado: {resource['title'][:50]}... - {', '.join(match_info)}")
    
    return missing

def remove_version_from_title(title):
    """Remove a parte 'Version' do título para os arquivos de saída"""
    if not title:
        return ''
    
    # Remove padrões como "Version X.X", "Version X", "v X.X", etc.
    # Preserva o texto antes da versão
    patterns = [
        r'\s+-\s+Version\s+\d+(\.\d+)*\s*$',  # " - Version 1.0", " - Version 2", etc.
        r'\s+Version\s+\d+(\.\d+)*\s*$',      # " Version 1.0", " Version 2", etc.
        r'\s+Version\s+\d+(\.\d+)*\s+.*$',    # " Version 1.0 something"
        r'\s+v\d+(\.\d+)*\s*$',               # " v1.0", " v2", etc.
        r'\s+v\.\d+(\.\d+)*\s*$',             # " v.1.0", " v.2", etc.
    ]
    
    cleaned_title = title
    for pattern in patterns:
        cleaned_title = re.sub(pattern, '', cleaned_title, flags=re.IGNORECASE)
    
    return cleaned_title.strip()

def create_files_from_missing(missing_resources, columns, base_filename):
    """Cria arquivos CSV e TSV com recursos faltantes no formato específico solicitado"""
    if not missing_resources:
        print("Nenhum recurso faltante para criar arquivos")
        return
    
    # Preparar dados
    fieldnames = ['nome', 'repositorio', 'kingdom', 'tag', 'url']
    rows = []
    for resource in missing_resources:
        row = {
            'nome': remove_version_from_title(resource['title']),  # Título sem versão
            'repositorio': 'jabot',     # Valor fixo "jabot"
            'kingdom': 'Plantae',       # Valor fixo "Plantae"  
            'tag': resource['tag'],     # Tag extraída pelo script
            'url': 'https://ipt.jbrj.gov.br/jabot/'  # URL base fixa
        }
        rows.append(row)
    
    # Gerar arquivo CSV (delimitado por vírgula)
    csv_filename = base_filename.replace('.csv', '.csv')  # Garantir extensão .csv
    with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, delimiter=',')
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    print(f"📄 CSV criado (delimitado por vírgula): {csv_filename}")
    
    # Gerar arquivo TSV (delimitado por TAB)
    tsv_filename = base_filename.replace('.csv', '.tsv')
    with open(tsv_filename, 'w', newline='', encoding='utf-8') as tsvfile:
        writer = csv.DictWriter(tsvfile, fieldnames=fieldnames, delimiter='\t')
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    print(f"📄 TSV criado (delimitado por TAB): {tsv_filename}")

def main():
    # Verificar variáveis de ambiente obrigatórias
    if not grist_api_key:
        print("❌ Erro: GRIST_API_KEY não definida nas variáveis de ambiente")
        return
    
    if not doc_id:
        print("❌ Erro: GRIST_DOC_ID não definida nas variáveis de ambiente")
        return
        
    print("Buscando dados do IPT RSS...")
    rss_content = fetch_ipt_rss_data(ipt_rss)
    
    if not rss_content:
        print("Falha ao buscar dados do RSS do IPT")
        return
    
    print("Parseando recursos do IPT...")
    ipt_resources = parse_ipt_resources(rss_content)
    print(f"Encontrados {len(ipt_resources)} recursos no IPT\n")
    
    print("Buscando dados do Grist...")
    grist_data = fetch_grist_data(api_url, grist_api_key)
    
    if not grist_data:
        print("Falha ao buscar dados do Grist")
        return
    
    grist_records = grist_data.get('records', [])
    print(f"Encontrados {len(grist_records)} registros no Grist\n")
    
    print("Obtendo estrutura da tabela Grist...")
    table_columns = get_grist_table_structure(doc_id, table_id, grist_api_key)
    print(f"Estrutura da tabela: {[col['label'] for col in table_columns]}\n")
    
    print("Comparando recursos (tag do RSS link vs campo $tag do GRIST)...")
    missing_resources = find_missing_resources(ipt_resources, grist_records)
    
    # Exibir estatísticas
    total_ipt = len(ipt_resources)
    total_missing = len(missing_resources)
    total_found = total_ipt - total_missing
    
    print("\n" + "=" * 60)
    print("RESUMO DA COMPARAÇÃO")
    print("=" * 60)
    print(f"Total de recursos no IPT RSS: {total_ipt}")
    print(f"Recursos encontrados no GRIST: {total_found}")
    print(f"Recursos faltantes no GRIST: {total_missing}")
    print(f"Taxa de cobertura: {(total_found/total_ipt*100):.1f}%")
    
    # Mostrar algumas tags extraídas do RSS para debug
    print("\n🏷️  Exemplos de tags extraídas do RSS:")
    for i, resource in enumerate(ipt_resources[:10]):
        if resource['tag']:
            print(f"  - Tag: '{resource['tag']}' (do título: {resource['title'][:50]}...)")
    
    # Exibir resultados detalhados no console
    print("\n" + "=" * 60)
    print("RECURSOS FALTANTES NO GRIST")
    print("=" * 60)
    
    if not missing_resources:
        print("✓ Todos os recursos do IPT estão presentes no Grist!")
    else:
        print(f"Encontrados {len(missing_resources)} recursos faltantes:\n")
        
        for i, resource in enumerate(missing_resources, 1):
            print(f"{i}. Título (RSS): {resource['title']}")
            print(f"   Tag extraída do link: '{resource['tag']}'")
            print(f"   Link: {resource['link']}")
            print(f"   Data: {resource['pub_date']}")
            print()
        
        # Gerar arquivos CSV e TSV
        base_filename = f'missing_resources_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        create_files_from_missing(missing_resources, table_columns, base_filename)
    
    print("Verificação concluída!")

if __name__ == "__main__":
    main()