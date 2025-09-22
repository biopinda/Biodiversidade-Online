#!/usr/bin/env python3
"""
Script para converter valores string para numéricos em base de dados MongoDB.
Converte atributos 'year', 'month' e 'day' de string para int quando possível,
e extrai essas informações de 'eventDate' quando os atributos não existem.
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
SOURCE_COLLECTION = "ocorrencias"
TARGET_COLLECTION = "novadata"

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

def convert_record(record):
    """
    Converte um registro, processando year, month, day.
    """
    new_record = {
        '_id': record['_id'],
        'canonicalName': record.get('canonicalName')
    }
    
    # Processar year, month, day existentes
    for field in ['year', 'month', 'day']:
        if field in record:
            value = record[field]
            if is_numeric_string(value):
                new_record[field] = int(value)
            else:
                new_record[field] = value
    
    # Se algum dos campos não existe, tentar extrair de eventDate
    missing_fields = [field for field in ['year', 'month', 'day'] if field not in record]
    
    if missing_fields and 'eventDate' in record:
        extracted_year, extracted_month, extracted_day = parse_event_date(record['eventDate'])
        
        if 'year' not in record and extracted_year:
            new_record['year'] = extracted_year
        if 'month' not in record and extracted_month:
            new_record['month'] = extracted_month
        if 'day' not in record and extracted_day:
            new_record['day'] = extracted_day
    
    return new_record

def main():
    """Função principal do script."""
    try:
        # Conectar ao MongoDB
        logger.info("Conectando ao MongoDB...")
        client = MongoClient(CONNECTION_STRING)
        db = client[DATABASE_NAME]
        
        # Verificar conexão
        client.admin.command('ping')
        logger.info("Conexão estabelecida com sucesso!")
        
        # Coleções
        source_collection = db[SOURCE_COLLECTION]
        target_collection = db[TARGET_COLLECTION]
        
        # Limpar coleção de destino se existir
        target_collection.drop()
        logger.info(f"Coleção {TARGET_COLLECTION} limpa/criada")
        
        # Contar registros na coleção origem
        total_records = source_collection.count_documents({})
        logger.info(f"Total de registros para processar: {total_records}")
        
        # Processar registros em lotes
        batch_size = 1000
        processed_count = 0
        
        cursor = source_collection.find({})
        batch = []
        
        for record in cursor:
            converted_record = convert_record(record)
            batch.append(converted_record)
            
            if len(batch) >= batch_size:
                target_collection.insert_many(batch)
                processed_count += len(batch)
                logger.info(f"Processados {processed_count}/{total_records} registros")
                batch = []
        
        # Inserir último lote se houver registros restantes
        if batch:
            target_collection.insert_many(batch)
            processed_count += len(batch)
        
        logger.info(f"Processamento concluído! Total de registros processados: {processed_count}")
        
        # Estatísticas finais
        final_count = target_collection.count_documents({})
        numeric_year_count = target_collection.count_documents({"year": {"$type": "number"}})
        numeric_month_count = target_collection.count_documents({"month": {"$type": "number"}})
        numeric_day_count = target_collection.count_documents({"day": {"$type": "number"}})
        
        logger.info(f"Registros na coleção {TARGET_COLLECTION}: {final_count}")
        logger.info(f"Registros com year numérico: {numeric_year_count}")
        logger.info(f"Registros com month numérico: {numeric_month_count}")
        logger.info(f"Registros com day numérico: {numeric_day_count}")
        
    except Exception as e:
        logger.error(f"Erro durante execução: {e}")
        raise
    finally:
        if 'client' in locals():
            client.close()
            logger.info("Conexão MongoDB fechada")

if __name__ == "__main__":
    main()