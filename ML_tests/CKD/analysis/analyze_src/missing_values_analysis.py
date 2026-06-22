# check if there's missing values in the dataset, and if so, how many and in which columns
#  isnull().sum() - visualize missing values with heatmap or bar plot

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from abc import ABC, abstractmethod

# Template Method Design Pattern for Missing Values Analysis

class MissingValuesAnalysisTemplate(ABC):
       def analyze(self, df: pd.DataFrame):
              self.identify_missing_values(df)
              self.visualize_missing_values(df)
       @abstractmethod
       def identify_missing_values(self, df: pd.DataFrame):
               pass
       @abstractmethod
       def visualize_missing_values(self, df: pd.DataFrame):
               pass
              

class SimpleMissingValuesAnalysis(MissingValuesAnalysisTemplate):
       def identify_missing_values(self, df: pd.DataFrame):
              print("\nMissing Values Count by Column:")
              missing_values = df.isnull().sum()
              print(missing_values[missing_values > 0])

       def visualize_missing_values(self, df: pd.DataFrame):
              print("\nVisualizing Missing Values...")
              plt.figure(figsize=(12, 8))
              sns.heatmap(df.isnull(), cbar=False, cmap="viridis")
              plt.title("Missing Values Heatmap")
              plt.show()

if __name__ == "__main__":
      df = pd.read_csv(
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/updated_ckd_dataset_with_stages.csv"
        )
      missing_values_analyzer = SimpleMissingValuesAnalysis()
      missing_values_analyzer.analyze(df)
      pass

