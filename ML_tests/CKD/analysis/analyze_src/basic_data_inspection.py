# info() - describe() - value_counts() - unique() - nunique()

import pandas as pd
from abc import ABC, abstractmethod

# Strategy Design Pattern for Data Ingestion


# abstract
class DataInspectionStrategy(ABC):
      @abstractmethod
      def inspect(self, df: pd.DataFrame): 
            pass
      
# info() 
class DataTypesInspectionStrategy(DataInspectionStrategy):
      def inspect(self, df: pd.DataFrame):
            print("\n Data Types & Non-null Counts: \n")
            df.info()


# describe() - numerical & categorical features
class SummaryStatisticsInspectionStrategy(DataInspectionStrategy):
      def inspect(self, df: pd.DataFrame):
            print("\n Summary Statistics (Numerical Features): \n")
            print(df.describe())
            print("\n Summary Statistics (Categorical Features): \n")
            print(df.describe(include='O'))


# value_counts() - unique() - nunique() - categorical & numerical features
class UniqueValuesInspectionStrategy(DataInspectionStrategy):
      def inspect(self, df: pd.DataFrame):
           print("\n Unique Values and Counts for Categorical Features: \n")
           for col in df.select_dtypes(include='object').columns:
                  print(f"\n Column: {col}")
                  print(df[col].unique())
                  print(df[col].value_counts())
           print("\n Unique Values and Counts for Numerical Features: \n")
           for col in df.select_dtypes(include='number').columns:
                 print(f"\n Column: {col}")
                 print(df[col].nunique())
                 print(df[col].value_counts())


class DataInspector:
      def __init__(self, strategy: DataInspectionStrategy):
            self._strategy = strategy
      def set_strategy(self, strategy: DataInspectionStrategy):
            self._strategy = strategy
      def execute_inspection(self, df: pd.DataFrame):
            self._strategy.inspect(df)


if __name__ == "__main__":
      df = pd.read_csv(
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/updated_ckd_dataset_with_stages.csv"
        )
      
      inspector = DataInspector(DataTypesInspectionStrategy())
      inspector.execute_inspection(df)

      inspector.set_strategy(SummaryStatisticsInspectionStrategy())
      inspector.execute_inspection(df)

      inspector.set_strategy(UniqueValuesInspectionStrategy())
      inspector.execute_inspection(df)