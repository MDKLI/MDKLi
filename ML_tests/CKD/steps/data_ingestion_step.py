import pandas as pd 
from src.ingest_data import DataIngestorFactory
from zenml import step
from pathlib import Path



@step
def data_ingestion_step(file_path: str) -> pd.DataFrame:
         file_extension = Path(file_path).suffix.lower()   # file_extension= ".csv" or ".json" or ".xlsx", etc.
         data_ingestor= DataIngestorFactory.get_data_ingestor(file_extension)
         ingested_data= data_ingestor.ingest(file_path)
         return ingested_data