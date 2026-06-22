import pandas as pd

from abc import ABC, abstractmethod

# Factory Design Pattern for Data Ingestion

# Abstract base class for data ingestion
class DataIngestor(ABC):
     @abstractmethod
     def ingest(self, file_path: str) -> pd.DataFrame:
          pass


# Concrete implementation for CSV data ingestion
class CSVDataIngestor(DataIngestor):
     def ingest(self, file_path: str) -> pd.DataFrame:
          return pd.read_csv(file_path)
     

# To import in steps/data_ingestion_step.py
class DataIngestorFactory:
     @staticmethod
     def get_data_ingestor(file_extension: str) -> DataIngestor:
          if file_extension == ".csv":
               return CSVDataIngestor()
          else:
               raise ValueError(f"Unsupported format: {file_extension}")



if __name__ == "__main__":
    ingestor = CSVDataIngestor()

    file_path = pd.read_csv(
    "extracted_data/updated_ckd_dataset_with_stages.csv"
)

    df = ingestor.ingest(file_path)

    print(df.head())