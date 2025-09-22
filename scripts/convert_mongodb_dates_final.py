#!/usr/bin/env python3
"""
Script final para converter valores string para numéricos em base de dados MongoDB.
Converte atributos 'year', 'month' e 'day' de string para int quando possível,
e extrai essas informações de 'eventDate' quando os atributos não existem.

Modifica diretamente a coleção 'ocorrencias' na base de dados 'dwc2json'.
"""

from pymongo import MongoClient
from datetime import datetime
import re
import logging

# Configuração de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# String de conexão MongoDB
CONNECTION_STRING = "mongodb://dwc2json:REDACTED_PASSWORD@192.168.1.10:27017/?authSource=admin&authMechanism=DEFAULT"
DATABASE_NAME = "dwc2json"
COLLECTION_NAME = "ocorrencias"

def is_numeric_string(value):
    """Verifica se uma string contém apenas números."""
    if not isinstance(value, str):
        return False
    return value.isdigit()

def parse_event_date(event_date):
    """
    Extrai year, month e day de eventDate.
    Suporta vários formatos de data comuns.
    """
    if not event_date or not isinstance(event_date, str):
        return None, None, None
    
    # Patterns para diferentes formatos de data
    patterns = [
        # YYYY-MM-DD
        r'^(\d{4})-(\d{1,2})-(\d{1,2})$',
        # YYYY/MM/DD
        r'^(\d{4})/(\d{1,2})/(\d{1,2})$',
        # DD/MM/YYYY
        r'^(\d{1,2})/(\d{1,2})/(\d{4})$',
        # DD-MM-YYYY
        r'^(\d{1,2})-(\d{1,2})-(\d{4})$',
        # YYYY-MM
        r'^(\d{4})-(\d{1,2})$',
        # YYYY/MM
        r'^(\d{4})/(\d{1,2})$',
        # YYYY
        r'^(\d{4})$'
    ]
    
    for i, pattern in enumerate(patterns):
        match = re.match(pattern, event_date.strip())
        if match:
            groups = match.groups()
            
            if i in [0, 1]:  # YYYY-MM-DD ou YYYY/MM/DD
                year, month, day = int(groups[0]), int(groups[1]), int(groups[2])
            elif i in [2, 3]:  # DD/MM/YYYY ou DD-MM-YYYY
                day, month, year = int(groups[0]), int(groups[1]), int(groups[2])
            elif i in [4, 5]:  # YYYY-MM ou YYYY/MM
                year, month, day = int(groups[0]), int(groups[1]), None
            elif i == 6:  # YYYY
                year, month, day = int(groups[0]), None, None
            
            # Validação básica
            if year and (year < 1700 or year > 2030):
                continue
            if month and (month < 1 or month > 12):
                continue
            if day and (day < 1 or day > 31):
                continue
                
            return year, month, day
    
    # Tentativa com datetime.strptime para outros formatos
    try:
        for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y/%m/%d', '%Y-%m', '%Y']:
            try:
                dt = datetime.strptime(event_date.strip(), fmt)
                year = dt.year
                month = dt.month if fmt not in ['%Y'] else None
                day = dt.day if fmt not in ['%Y', '%Y-%m'] else None
                return year, month, day
            except ValueError:
                continue
    except Exception:
        pass
    
    return None, None, None

def main():
    """Função principal do script."""
    
    # Contadores para estatísticas
    total_processed = 0
    string_to_numeric_conversions = {
        'year': 0,
        'month': 0,
        'day': 0
    }
    eventdate_extractions = {
        'year': 0,
        'month': 0,
        'day': 0
    }
    
    try:
        # Conectar ao MongoDB
        logger.info("Conectando ao MongoDB...")
        client = MongoClient(CONNECTION_STRING)
        db = client[DATABASE_NAME]
        
        # Verificar conexão
        client.admin.command('ping')
        logger.info("Conexão estabelecida com sucesso!")
        
        collection = db[COLLECTION_NAME]
        
        # Contar registros totais
        total_records = collection.count_documents({})
        logger.info(f"Total de registros para processar: {total_records}")
        
        # Processar registros em lotes
        batch_size = 1000
        processed_count = 0
        
        cursor = collection.find({})
        
        for record in cursor:
            update_operations = {}
            record_updated = False
            
            # Processar year, month, day existentes - converter strings numéricas para int
            for field in ['year', 'month', 'day']:
                if field in record and is_numeric_string(record[field]):
                    update_operations[field] = int(record[field])
                    string_to_numeric_conversions[field] += 1
                    record_updated = True
            
            # Extrair valores de eventDate para campos ausentes
            missing_fields = [field for field in ['year', 'month', 'day'] if field not in record]
            
            if missing_fields and 'eventDate' in record:
                extracted_year, extracted_month, extracted_day = parse_event_date(record['eventDate'])
                
                if 'year' not in record and extracted_year:
                    update_operations['year'] = extracted_year
                    eventdate_extractions['year'] += 1
                    record_updated = True
                    
                if 'month' not in record and extracted_month:
                    update_operations['month'] = extracted_month
                    eventdate_extractions['month'] += 1
                    record_updated = True
                    
                if 'day' not in record and extracted_day:
                    update_operations['day'] = extracted_day
                    eventdate_extractions['day'] += 1
                    record_updated = True
            
            # Atualizar registro se necessário
            if record_updated:
                collection.update_one(
                    {'_id': record['_id']},
                    {'$set': update_operations}
                )
            
            total_processed += 1
            
            # Log de progresso
            if total_processed % batch_size == 0:
                logger.info(f"Processados {total_processed}/{total_records} registros")
        
        logger.info("Processamento concluído!")
        
        # Resumo das conversões
        logger.info("\n" + "="*50)
        logger.info("RESUMO DAS CONVERSÕES")
        logger.info("="*50)
        logger.info(f"Total de registros processados: {total_processed}")
        logger.info("")
        
        logger.info("Conversões de string para numérico:")
        for field, count in string_to_numeric_conversions.items():
            logger.info(f"  {field}: {count} registros")
        
        logger.info("")
        logger.info("Extrações de eventDate:")
        for field, count in eventdate_extractions.items():
            logger.info(f"  {field}: {count} registros")
        
        # Estatísticas finais da coleção
        logger.info("")
        logger.info("Estatísticas finais:")
        total_with_numeric_year = collection.count_documents({"year": {"$type": "number"}})
        total_with_numeric_month = collection.count_documents({"month": {"$type": "number"}})
        total_with_numeric_day = collection.count_documents({"day": {"$type": "number"}})
        
        logger.info(f"Registros com year numérico: {total_with_numeric_year}")
        logger.info(f"Registros com month numérico: {total_with_numeric_month}")
        logger.info(f"Registros com day numérico: {total_with_numeric_day}")
        
        # Resumo consolidado
        total_eventdate_extractions = sum(eventdate_extractions.values())
        total_string_conversions = sum(string_to_numeric_conversions.values())
        
        print("\n" + "="*50)
        print("RESUMO FINAL")
        print("="*50)
        print(f"Total de conversões string → numérico: {total_string_conversions}")
        print(f"Total de extrações de eventDate: {total_eventdate_extractions}")
        print(f"Registros com novos atributos year/month/day: {len(set([eventdate_extractions[f] for f in eventdate_extractions if eventdate_extractions[f] > 0]))}")
        
    except Exception as e:
        logger.error(f"Erro durante execução: {e}")
        raise
    finally:
        if 'client' in locals():
            client.close()
            logger.info("Conexão MongoDB fechada")

if __name__ == "__main__":
    main()