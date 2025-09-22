#!/usr/bin/env python3
"""
Script simplificado para testar apenas a busca de recursos dos IPTs
(sem comparação com Grist)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from check_ipt_resources import (
    load_ipts_from_csv, 
    fetch_ipt_rss_data, 
    parse_ipt_resources,
    occurrences_csv_path
)

def main():
    print("=== TESTE DE BUSCA DE RECURSOS DOS IPTs ===\n")
    
    # Carregar IPTs
    print("Carregando IPTs do CSV...")
    ipts = load_ipts_from_csv(occurrences_csv_path)
    
    if not ipts:
        print("ERRO: Nenhum IPT encontrado")
        return
    
    # Remover duplicatas
    seen = set()
    unique_ipts = []
    for ipt in ipts:
        key = (ipt['repositorio'], ipt['base_url'])
        if key not in seen:
            seen.add(key)
            unique_ipts.append(ipt)
    
    print(f"IPTs únicos encontrados: {len(unique_ipts)}\n")
    
    # Buscar recursos de todos os IPTs
    all_resources = []
    ipt_stats = {}
    
    for i, ipt in enumerate(unique_ipts, 1):
        repo = ipt['repositorio']
        rss_url = ipt['rss_url']
        
        print(f"[{i:2d}/{len(unique_ipts)}] Processando {repo}...")
        
        rss_content = fetch_ipt_rss_data(rss_url, repo)
        
        if not rss_content:
            print(f"    ERRO: Falha ao buscar RSS")
            ipt_stats[repo] = {'recursos': 0, 'erro': True}
            continue
        
        resources = parse_ipt_resources(rss_content, ipt)
        resource_count = len(resources)
        
        print(f"    ✓ {resource_count} recursos encontrados")
        
        all_resources.extend(resources)
        ipt_stats[repo] = {'recursos': resource_count, 'erro': False}
    
    # Estatísticas finais
    print(f"\n" + "="*50)
    print("RESUMO FINAL")
    print("="*50)
    print(f"Total de recursos encontrados: {len(all_resources)}")
    print(f"IPTs processados com sucesso: {sum(1 for s in ipt_stats.values() if not s['erro'])}")
    print(f"IPTs com erro: {sum(1 for s in ipt_stats.values() if s['erro'])}")
    
    print(f"\nRecursos por IPT:")
    for repo, stats in ipt_stats.items():
        if stats['erro']:
            print(f"  {repo:12} : ERRO")
        else:
            print(f"  {repo:12} : {stats['recursos']:3d} recursos")
    
    # Exemplos de tags
    print(f"\nExemplos de tags encontradas:")
    tag_count = 0
    for resource in all_resources:
        if resource['tag'] and tag_count < 10:
            repo = resource.get('repositorio', 'unknown')
            print(f"  [{repo:8}] {resource['tag']}")
            tag_count += 1
    
    print(f"\nProcessamento concluído!")

if __name__ == "__main__":
    main()