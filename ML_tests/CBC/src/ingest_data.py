import pandas as pd

from abc import ABC, abstractmethod


class DataIngestor(ABC):
    @abstractmethod
    def ingest(self, file_path: str) -> pd.DataFrame:
        pass


class CSVDataIngestor(DataIngestor):
    def ingest(self, file_path: str) -> pd.DataFrame:
        return pd.read_csv(file_path)


class DataIngestorFactory:
    @staticmethod
    def get_data_ingestor(file_extension: str) -> DataIngestor:
        if file_extension == ".csv":
            return CSVDataIngestor()
        else:
            raise ValueError(f"Unsupported format: {file_extension}")


if __name__ == "__main__":
    file_id = "1YGB0V3H-2o3-2__8PA3XNOLWpqXEqgI6"
    url = f"https://drive.google.com/uc?id={file_id}"

    ingestor = DataIngestorFactory.get_data_ingestor(".csv")
    df = ingestor.ingest(url)

    print(df.head())