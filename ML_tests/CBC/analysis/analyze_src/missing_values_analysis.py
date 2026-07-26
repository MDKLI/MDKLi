import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from abc import ABC, abstractmethod


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
                print("\nMissing Value Count by Column: ")
                missing_value= df.isnull().sum()
                print(missing_value[missing_value > 0])
        def visualize_missing_values(self, df: pd.DataFrame):
                print("\nVisualizing MIssing Values...")
                plt.figure(figsize= (12, 8))
                sns.heatmap(df.isnull(), cbar= False, cmap= 'viridis')
                plt.title("Missing Values Heatmap")
                plt.show()


if __name__ == "__main__":
    file_id = "1YGB0V3H-2o3-2__8PA3XNOLWpqXEqgI6"
    url = f"https://drive.google.com/uc?id={file_id}"

    df = pd.read_csv(url)
    missing_values_analyzer= SimpleMissingValuesAnalysis()
    missing_values_analyzer.analyze(df)
    pass
