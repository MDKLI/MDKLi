import pandas as pd
from pathlib import Path
from zenml import step

from src.ingest_data import DataIngestorFactory
from centralized_logging.logger import get_logger

logger = get_logger()


@step(enable_cache=False)
def data_ingestion_step(file_path: str, file_type: str = ".csv") -> pd.DataFrame:
    """Ingests raw CBC data from the given source using the appropriate ingestor strategy."""
    logger.info(f"Starting data ingestion from: {file_path}")

    data_ingestor = DataIngestorFactory.get_data_ingestor(file_type)
    ingested_data = data_ingestor.ingest(file_path)

    logger.info(f"Data ingestion completed. Shape: {ingested_data.shape}")
    return ingested_data


# python -m steps.data_ingestion_step