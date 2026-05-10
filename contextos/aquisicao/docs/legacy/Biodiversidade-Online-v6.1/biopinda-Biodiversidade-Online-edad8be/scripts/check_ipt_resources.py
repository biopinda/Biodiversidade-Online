#!/usr/bin/env python3
"""
Script de Verificação de Recursos IPTs vs Grist

Este script compara recursos de biodiversidade entre múltiplas fontes:
1. IPTs específicos (Integrated Publishing Toolkit) pré-definidos via RSS feeds
2. Base de dados Grist (tabela Datasets)

Funcionalidades principais:
- Consulta lista fixa de IPTs específicos (JBRJ/Jabot, CRIA, JBRJ/Reflora)
- Busca recursos dos RSS feeds dos IPTs configurados
- Extrai tags dos recursos a partir dos links do RSS
- Interpreta kingdom baseado no nome/título do repositório
- Compara com registros existentes na tabela Datasets do Grist
- Identifica recursos dos IPTs que não estão presentes no Grist
- Gera relatórios consolidados em formato CSV e TSV com recursos faltantes
- Exibe estatísticas de cobertura por IPT e consolidadas

Pré-requisitos:
- Variáveis de ambiente: GRIST_API_KEY e GRIST_DOC_ID
- Conexão com internet para acessar RSS feeds e API do Grist

Uso: python check_ipt_resources.py
"""
import os
import requests
import xml.etree.ElementTree as ET
import csv
import json
import re
from datetime import datetime
import unicodedata
from difflib import SequenceMatcher

# Tentar carregar variáveis de ambiente de .env se disponível
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Configurações
# Lista específica de IPTs para consultar
IPTS_ESPECIFICOS = [
    {
        'repositorio': 'jabot',
        'base_url': 'https://ipt.jbrj.gov.br/jabot/',
        'rss_url': 'https://ipt.jbrj.gov.br/jabot/rss.do',
        'kingdom_hint': 'Plantae'  # JBRJ é principalmente herbário
    },
    {
        'repositorio': 'cria',
        'base_url': 'http://ipt1.cria.org.br/ipt/',
        'rss_url': 'http://ipt1.cria.org.br/ipt/rss.do',
        'kingdom_hint': 'Animalia'  # CRIA tem dados diversos, mas principalmente fauna
    },
    {
        'repositorio': 'reflora',
        'base_url': 'https://ipt.jbrj.gov.br/reflora/',
        'rss_url': 'https://ipt.jbrj.gov.br/reflora/rss.do',
        'kingdom_hint': 'Plantae'  # Reflora é específico para flora
    }
]

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

def get_ipts_especificos():
    """Retorna lista específica de IPTs para consultar"""
    return IPTS_ESPECIFICOS.copy()

def fetch_ipt_rss_data(rss_url, repo_name=''):
    """Busca dados do RSS do IPT"""
    try:
        response = requests.get(rss_url, timeout=30)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Erro ao buscar RSS do IPT {repo_name} ({rss_url}): {e}")
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

def interpret_kingdom_from_title(title, repositorio, default_kingdom):
    """Interpreta o kingdom baseado no título do recurso e repositório"""
    if not title:
        return default_kingdom
    
    title_lower = title.lower()
    
    # Palavras-chave para diferentes kingdoms
    plantae_keywords = [
        'flora', 'plant', 'botanic', 'herb', 'tree', 'flower', 'leaf', 'seed',
        'pollen', 'algae', 'moss', 'fern', 'grass', 'fungi', 'mushroom',
        'lichen', 'bryophyte', 'pteridophyte', 'gymnosperm', 'angiosperm'
    ]
    
    animalia_keywords = [
        'fauna', 'animal', 'bird', 'mammal', 'fish', 'insect', 'beetle',
        'butterfly', 'spider', 'reptile', 'amphibian', 'mollusk', 'arthropod',
        'vertebrate', 'invertebrate', 'zoo'
    ]
    
    # Verificar palavras-chave no título
    for keyword in plantae_keywords:
        if keyword in title_lower:
            return 'Plantae'
    
    for keyword in animalia_keywords:
        if keyword in title_lower:
            return 'Animalia'
    
    # Se não encontrou palavras-chave específicas, usar o padrão do repositório
    return default_kingdom

def parse_ipt_resources(rss_content, ipt_info=None):
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
            
            # Determinar kingdom baseado no título e repositório
            default_kingdom = ipt_info.get('kingdom_hint', 'Animalia') if ipt_info else 'Animalia'
            repositorio = ipt_info.get('repositorio', '') if ipt_info else ''
            kingdom = interpret_kingdom_from_title(title, repositorio, default_kingdom)
            
            resource = {
                'title': title,
                'link': link,
                'guid': guid,
                'tag': tag,  # Nova propriedade: tag extraída do link
                'description': description,
                'pub_date': pub_date,
                'kingdom': kingdom  # Kingdom interpretado
            }
            
            # Adicionar informações do IPT se disponível
            if ipt_info:
                resource.update({
                    'repositorio': ipt_info.get('repositorio', ''),
                    'base_url': ipt_info.get('base_url', '')
                })
            
            resources.append(resource)
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
    Usa múltiplas estratégias de comparação: tag, título normalizado e similaridade
    """
    missing = []
    
    # Preparar dados do GRIST para comparação
    grist_data = {
        'tags': set(),
        'titles_normalized': {},  # título normalizado -> dados originais
        'records_by_tag': {},     # tag -> registro completo
        'records_by_title': {}    # título original -> registro completo
    }
    
    # Processar registros do GRIST
    for record in grist_records:
        fields = record.get('fields', {})
        
        # Processar tag
        if 'tag' in fields and fields['tag']:
            tag_value = str(fields['tag']).strip()
            grist_data['tags'].add(tag_value)
            grist_data['records_by_tag'][tag_value] = {
                'nome': fields.get('nome', 'N/A'),
                'record_id': record.get('id', 'N/A'),
                'original_title': fields.get('nome', 'N/A')
            }
        
        # Processar título/nome
        if 'nome' in fields and fields['nome']:
            original_title = str(fields['nome']).strip()
            normalized_title = normalize_text_for_comparison(original_title)
            
            if normalized_title:  # Só adicionar se a normalização resultou em algo
                grist_data['titles_normalized'][normalized_title] = {
                    'original_title': original_title,
                    'record_id': record.get('id', 'N/A'),
                    'tag': fields.get('tag', 'N/A')
                }
                grist_data['records_by_title'][original_title] = {
                    'nome': original_title,
                    'record_id': record.get('id', 'N/A'),
                    'tag': fields.get('tag', 'N/A')
                }
    
    print(f"📊 Total de tags encontradas no GRIST: {len(grist_data['tags'])}")
    print(f"📊 Total de títulos únicos no GRIST: {len(grist_data['titles_normalized'])}")
    print(f"🏷️  Primeiras 10 tags do GRIST: {list(grist_data['tags'])[:10]}")
    
    # Verificar cada recurso do IPT
    for resource in ipt_resources:
        found = False
        match_info = []
        match_method = None
        
        rss_tag = resource['tag']
        rss_title = resource['title']
        rss_title_normalized = normalize_text_for_comparison(remove_version_from_title(rss_title))
        
        # Estratégia 1: Comparação exata por tag
        if rss_tag and rss_tag in grist_data['tags']:
            found = True
            match_method = "tag_exact"
            grist_info = grist_data['records_by_tag'].get(rss_tag, {})
            match_info.append(f"Tag exata: '{rss_tag}' -> GRIST: '{grist_info.get('nome', 'N/A')}'")
        
        # Estratégia 2: Comparação por título normalizado (igualdade exata)
        elif rss_title_normalized and rss_title_normalized in grist_data['titles_normalized']:
            found = True
            match_method = "title_normalized_exact"
            grist_info = grist_data['titles_normalized'][rss_title_normalized]
            match_info.append(f"Título normalizado exato: '{rss_title_normalized}' -> GRIST: '{grist_info.get('original_title', 'N/A')}'")
        
        # Estratégia 3: Comparação por similaridade de título
        else:
            if rss_title_normalized:
                for grist_title_norm, grist_info in grist_data['titles_normalized'].items():
                    if titles_are_similar(rss_title_normalized, grist_title_norm, threshold=0.90):
                        found = True
                        match_method = "title_similarity"
                        similarity = calculate_similarity(rss_title_normalized, grist_title_norm)
                        match_info.append(f"Título similar ({similarity:.2%}): '{rss_title_normalized}' ~ '{grist_title_norm}' -> GRIST: '{grist_info.get('original_title', 'N/A')}'")
                        break
        
        if not found:
            # Adicionar informação detalhada de debug para recursos não encontrados
            resource['debug_info'] = {
                'rss_tag': rss_tag,
                'rss_title': rss_title,
                'rss_title_normalized': rss_title_normalized,
                'checked_strategies': ['tag_exact', 'title_normalized_exact', 'title_similarity']
            }
            missing.append(resource)
            print(f"❌ Recurso NÃO encontrado: '{rss_title[:50]}...' (tag: '{rss_tag}')")
        else:
            # Para debug - mostrar matches encontrados
            print(f"✓ Recurso encontrado via {match_method}: {rss_title[:50]}... - {', '.join(match_info)}")
    
    return missing

def normalize_text_for_comparison(text):
    """Normaliza texto para comparação, removendo acentos, espaços extras e convertendo para minúsculas"""
    if not text:
        return ''
    
    # Remover acentos e caracteres especiais
    text = unicodedata.normalize('NFD', text)
    text = ''.join(char for char in text if unicodedata.category(char) != 'Mn')
    
    # Converter para minúsculas e remover espaços extras
    text = re.sub(r'\s+', ' ', text.lower().strip())
    
    # Remover pontuação comum
    text = re.sub(r'[.,;:!?()[\]{}"\'-]', '', text)
    
    return text

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

def calculate_similarity(text1, text2):
    """Calcula similaridade entre dois textos usando SequenceMatcher"""
    return SequenceMatcher(None, text1, text2).ratio()

def titles_are_similar(title1, title2, threshold=0.85):
    """Verifica se dois títulos são similares com base em normalização e similaridade"""
    if not title1 or not title2:
        return False
    
    # Normalizar ambos os títulos
    norm_title1 = normalize_text_for_comparison(remove_version_from_title(title1))
    norm_title2 = normalize_text_for_comparison(remove_version_from_title(title2))
    
    # Verificar igualdade exata após normalização
    if norm_title1 == norm_title2:
        return True
    
    # Verificar similaridade usando SequenceMatcher
    similarity = calculate_similarity(norm_title1, norm_title2)
    return similarity >= threshold

def create_files_from_missing(missing_resources, columns, base_filename):
    """Cria arquivos CSV e TSV com recursos faltantes no formato específico solicitado"""
    if not missing_resources:
        print("Nenhum recurso faltante para criar arquivos")
        return
    
    # Preparar dados
    fieldnames = ['nome', 'repositorio', 'kingdom', 'tag', 'url']
    rows = []
    for resource in missing_resources:
        # Usar o kingdom já interpretado durante o parsing
        kingdom = resource.get('kingdom', 'Animalia')
        
        row = {
            'nome': remove_version_from_title(resource['title']),  # Título sem versão
            'repositorio': resource.get('repositorio', 'unknown'),  # Repositório do recurso
            'kingdom': kingdom,  # Kingdom interpretado do título
            'tag': resource['tag'],     # Tag extraída pelo script
            'url': resource.get('base_url', '')  # URL base do IPT
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
        print("ERRO: GRIST_API_KEY não definida nas variáveis de ambiente")
        return
    
    if not doc_id:
        print("ERRO: GRIST_DOC_ID não definida nas variáveis de ambiente")
        return
        
    # Carregar IPTs específicos
    print("Carregando lista específica de IPTs...")
    unique_ipts = get_ipts_especificos()
    
    if not unique_ipts:
        print("ERRO: Nenhum IPT específico configurado")
        return
    
    print(f"✓ {len(unique_ipts)} IPTs específicos configurados para processar:\n")
    for ipt in unique_ipts:
        print(f"  - {ipt['repositorio']}: {ipt['base_url']} (Kingdom padrão: {ipt['kingdom_hint']})")
    print()
    
    # Buscar recursos de todos os IPTs
    all_ipt_resources = []
    ipt_stats = {}
    
    for i, ipt in enumerate(unique_ipts, 1):
        repo = ipt['repositorio']
        rss_url = ipt['rss_url']
        
        print(f"[{i}/{len(unique_ipts)}] Processando IPT {repo} ({rss_url})...")
        
        rss_content = fetch_ipt_rss_data(rss_url, repo)
        
        if not rss_content:
            print(f"  ERRO: Falha ao buscar RSS do IPT {repo}")
            ipt_stats[repo] = {'recursos': 0, 'erro': True}
            continue
        
        ipt_resources = parse_ipt_resources(rss_content, ipt)
        resource_count = len(ipt_resources)
        
        print(f"  ✓ {resource_count} recursos encontrados")
        
        all_ipt_resources.extend(ipt_resources)
        ipt_stats[repo] = {'recursos': resource_count, 'erro': False}
    
    print(f"\n📊 TOTAL: {len(all_ipt_resources)} recursos encontrados em {len(unique_ipts)} IPTs")
    
    print("\nBuscando dados do Grist...")
    grist_data = fetch_grist_data(api_url, grist_api_key)
    
    if not grist_data:
        print("ERRO: Falha ao buscar dados do Grist")
        return
    
    grist_records = grist_data.get('records', [])
    print(f"✓ Encontrados {len(grist_records)} registros no Grist\n")
    
    print("Obtendo estrutura da tabela Grist...")
    table_columns = get_grist_table_structure(doc_id, table_id, grist_api_key)
    print(f"Estrutura da tabela: {[col['label'] for col in table_columns]}\n")
    
    print("Comparando recursos usando múltiplas estratégias (tag, título normalizado, similaridade)...")
    missing_resources = find_missing_resources(all_ipt_resources, grist_records)
    
    # Exibir estatísticas consolidadas
    total_ipt = len(all_ipt_resources)
    total_missing = len(missing_resources)
    total_found = total_ipt - total_missing
    
    print("\n" + "=" * 80)
    print("RESUMO DA COMPARAÇÃO DETALHADA - CONSOLIDADO")
    print("=" * 80)
    print(f"Total de recursos em todos os IPTs: {total_ipt}")
    print(f"Recursos encontrados no GRIST: {total_found}")
    print(f"Recursos faltantes no GRIST: {total_missing}")
    print(f"Taxa de cobertura geral: {(total_found/total_ipt*100):.1f}%")
    print()
    print("MÉTODOS DE COMPARAÇÃO UTILIZADOS:")
    print("1. Comparação exata por tag")
    print("2. Comparação por título normalizado (sem acentos, versões, pontuação)")
    print("3. Comparação por similaridade de texto (threshold: 90%)")
    print("4. Normalização remove: acentos, versões, pontuação, espaços extras")
    
    # Estatísticas por IPT
    print(f"\n📈 ESTATÍSTICAS POR IPT:")
    for repo, stats in ipt_stats.items():
        if stats['erro']:
            print(f"  - {repo}: ERRO ao buscar dados")
        else:
            print(f"  - {repo}: {stats['recursos']} recursos")
    
    # Mostrar algumas tags extraídas do RSS para debug
    print("\n🏷️  Exemplos de tags extraídas dos RSS feeds:")
    tag_examples = 0
    for resource in all_ipt_resources:
        if resource['tag'] and tag_examples < 10:
            repo = resource.get('repositorio', 'unknown')
            print(f"  - [{repo}] Tag: '{resource['tag']}' (do título: {resource['title'][:50]}...)")
            tag_examples += 1
    
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