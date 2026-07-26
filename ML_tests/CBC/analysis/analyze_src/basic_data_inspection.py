import pandas as pd
from abc import ABC, abstractmethod


class DataInspectionStrategy(ABC):
    @abstractmethod
    def inspect(self, df: pd.DataFrame):
        pass


class DataTypesInspectionStrategy(DataInspectionStrategy):
    def inspect(self, df: pd.DataFrame):
        print("\n Data Types & Non-null Counts: \n")
        df.info()


class SummaryStatisticsInspectionStrategy(DataInspectionStrategy):
    def inspect(self, df: pd.DataFrame):
        print("\n Summary Statistics (Numerical Features): \n")
        print(df.describe())

        print("\n Summary Statistics (Categorical Features): \n")
        print(df.describe(include="object"))


class UniqueValuesInspectionStrategy(DataInspectionStrategy):
    def inspect(self, df: pd.DataFrame):
        print("\n Unique Values and Counts for Categorical Features: \n")
        for col in df.select_dtypes(include="object").columns:
            print(f"\n Column: {col}")
            print(df[col].unique())
            print(df[col].value_counts())

        # print("\n Unique Values and Counts for Numerical Features: \n")
        # for col in df.select_dtypes(include="number").columns:
        #     print(f"\n Column: {col}")
        #     print(df[col].nunique())
        #     print(df[col].value_counts())


class DataInspector:
    def __init__(self, strategy: DataInspectionStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: DataInspectionStrategy):
        self._strategy = strategy

    def execute_inspection(self, df: pd.DataFrame):
        self._strategy.inspect(df)


if __name__ == "__main__":
    file_id = "1YGB0V3H-2o3-2__8PA3XNOLWpqXEqgI6"
    url = f"https://drive.google.com/uc?id={file_id}"

    df = pd.read_csv(url)

    inspector = DataInspector(DataTypesInspectionStrategy())
    inspector.execute_inspection(df)

    inspector.set_strategy(SummaryStatisticsInspectionStrategy())
    inspector.execute_inspection(df)

    inspector.set_strategy(UniqueValuesInspectionStrategy())
    inspector.execute_inspection(df)