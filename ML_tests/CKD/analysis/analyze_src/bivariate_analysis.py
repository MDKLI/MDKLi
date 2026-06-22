# visualization of two feature at a time, to understand the relationship between the two features and their relationship with the target variable
# for numerical features: scatter plot, regression plot
# for categorical features: stacked bar plot, mosaic plot, heatmap, box plot

from abc import ABC, abstractmethod

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
import numpy as np

sns.set_theme(
    style="ticks",
    context="talk",
    palette="deep"
)

plt.rcParams["figure.facecolor"] = "#f8fafc"
plt.rcParams["axes.facecolor"] = "#ffffff"
plt.rcParams["axes.edgecolor"] = "#d1d5db"
plt.rcParams["axes.linewidth"] = 1.2
plt.rcParams["grid.alpha"] = 0.3
plt.rcParams["grid.linestyle"] = "--"

# Strategy Design Pattern & Template Method Design Pattern for Bivariate Analysis

class BivariateAnalysisStrategy(ABC):
       @abstractmethod
       def analyze(self, df: pd.DataFrame, feature1: str, feature2: str):
               pass


class NumericalVsNumericalAnalysis(BivariateAnalysisStrategy):
        def analyze(self, df: pd.DataFrame, feature1: str, feature2: str):
                categorical_cols = df.select_dtypes(include=["object", "category", "bool"]).columns
                numeric_cols = df.select_dtypes(include="number").columns

                if df[feature1].dtype == categorical_cols or df[feature2].dtype == categorical_cols:
                    raise ValueError("Both features must be numerical for scatter plot and regression plot.\n"
                f"This analysis is only applicable for numerical features such as:\n"
                f"{', '.join(numeric_cols)}"
                )

                else:
                    self.scatter_plot(df, feature1, feature2)
                    self.regression_plot(df, feature1, feature2)

        def scatter_plot(self, df: pd.DataFrame, feature1: str, feature2: str):
               plt.figure(figsize=(10, 6))

               sns.scatterplot(
                   x=feature1,
                   y=feature2,
                   data=df,
                   hue=feature2,
                   palette="viridis",
                   size=feature2,
                   sizes=(40, 200),
                   alpha=0.75
               )

               plt.title(f"{feature1} vs {feature2}", fontsize=16, pad=15)
               plt.xlabel(feature1)
               plt.ylabel(feature2)

               plt.legend(
                   title=feature2,
                   bbox_to_anchor=(1.02, 1),
                   loc="upper left"
               )

               sns.despine()
               plt.tight_layout()
               plt.show()

        def regression_plot(self, df: pd.DataFrame, feature1: str, feature2: str):
               plt.figure(figsize=(10, 6))

               sns.regplot(
                   x=feature1,
                   y=feature2,
                   data=df,
                   scatter_kws={
                       "alpha": 0.5,
                       "s": 60,
                       "color": "#3b82f6"
                   },
                   line_kws={
                       "color": "#ef4444",
                       "linewidth": 3,
                       "label": "Regression Line"
                   }
               )

               plt.title(f"{feature1} vs {feature2} (Regression)", fontsize=16, pad=15)
               plt.xlabel(feature1)
               plt.ylabel(feature2)

               plt.legend()

               sns.despine()
               plt.tight_layout()
               plt.show()


class CategoricalVsNumericalAnalysis(BivariateAnalysisStrategy):
        def analyze(self, df: pd.DataFrame, feature1: str, feature2: str):
                categorical_cols = df.select_dtypes(include=["object", "category", "bool"]).columns
                numeric_cols = df.select_dtypes(include="number").columns

                if df[feature1].dtype != categorical_cols and df[feature2].dtype != categorical_cols:
                    raise ValueError("At least one feature must be categorical for bar plot, box plot, and violin plot.\n"                 
                f"This analysis is only applicable for categorical features such as:\n"
                f"{', '.join(categorical_cols)}"
                )
                
                elif df[feature1].dtype == categorical_cols and df[feature2].dtype == categorical_cols:
                    raise ValueError("One feature must be numerical for bar plot, box plot, and violin plot.\n"
                f"This analysis is only applicable for numerical features such as:\n"
                f"{', '.join(numeric_cols)}"
                )

                else:
                    self.bar_plot(df, feature1, feature2)
                    self.box_plot(df, feature1, feature2)
                    self.violin_plot(df, feature1, feature2)

        def bar_plot(self, df: pd.DataFrame, feature1: str, feature2: str):
               plt.figure(figsize=(10, 6))

               sns.barplot(
                   x=feature1,
                   y=feature2,
                   hue=feature1,
                   data=df,
                   estimator=np.mean,
                   palette="Set2",
                   legend=False
               )

               plt.title(f"{feature1} vs {feature2}", fontsize=16, pad=15)
               plt.xlabel(feature1)
               plt.ylabel(feature2)

               plt.xticks(rotation=45)

               sns.despine()
               plt.tight_layout()
               plt.show()

        def box_plot(self, df: pd.DataFrame, feature1: str, feature2: str):
               plt.figure(figsize=(10, 6))

               sns.boxplot(
                   x=feature1,
                   y=feature2,
                   hue=feature1,
                   data=df,
                   palette="Pastel2",
                   legend=False
               )

               plt.title(f"{feature1} vs {feature2}", fontsize=16, pad=15)
               plt.xlabel(feature1)
               plt.ylabel(feature2)

               plt.xticks(rotation=45)

               sns.despine()
               plt.tight_layout()
               plt.show()

        def violin_plot(self, df: pd.DataFrame, feature1: str, feature2: str):
               plt.figure(figsize=(10, 6))

               sns.violinplot(
                   x=feature1,
                   y=feature2,
                   hue=feature1,
                   data=df,
                   palette="Spectral",
                   legend=False
               )

               plt.title(f"{feature1} vs {feature2}", fontsize=16, pad=15)
               plt.xlabel(feature1)
               plt.ylabel(feature2)

               plt.xticks(rotation=45)

               sns.despine()
               plt.tight_layout()
               plt.show()


class CategoricalVsCategoricalAnalysis(BivariateAnalysisStrategy):
               def analyze(self, df: pd.DataFrame, feature1: str, feature2: str):
                              categorical_cols = df.select_dtypes(include=["object", "category", "bool"]).columns
                              if df[feature1].dtype != categorical_cols or df[feature2].dtype != categorical_cols:
                                     raise ValueError("Both features must be categorical for stacked bar plot, mosaic plot, and heatmap. \n"                 
                f"This analysis is only applicable for categorical features such as:\n"
                f"{', '.join(categorical_cols)}"
                )
                              
                              else:
                                     self.stacked_bar_plot(df, feature1, feature2)

               def stacked_bar_plot(self, df: pd.DataFrame, feature1: str, feature2: str):
                      cross_tab = pd.crosstab(df[feature1], df[feature2])

                      ax = cross_tab.plot(
                          kind='bar',
                          stacked=True,
                          figsize=(10, 6),
                          colormap='tab20'
                      )

                      plt.title(f"{feature1} vs {feature2}", fontsize=16, pad=15)
                      plt.xlabel(feature1)
                      plt.ylabel("Count")

                      plt.xticks(rotation=45)

                      ax.legend(
                          title=feature2,
                          bbox_to_anchor=(1.02, 1),
                          loc="upper left"
                      )

                      sns.despine()
                      plt.tight_layout()
                      plt.show()



class BivariateAnalyzer:
    def __init__(self, strategy: BivariateAnalysisStrategy):
               self._strategy = strategy

    def set_strategy(self, strategy: BivariateAnalysisStrategy):
        self._strategy = strategy

    def execute_analysis(self, df: pd.DataFrame, feature1: str, feature2: str):
        self._strategy.analyze(df, feature1, feature2)




if __name__ == "__main__":
    df = pd.read_csv(
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/updated_ckd_dataset_with_stages.csv"
    )

    analyzer = BivariateAnalyzer(NumericalVsNumericalAnalysis())
    analyzer.execute_analysis(df, 'gfr', 'blood_pressure')

    analyzer.set_strategy(CategoricalVsNumericalAnalysis())
    analyzer.execute_analysis(df, 'smoking', 'gfr')

    analyzer.set_strategy(CategoricalVsCategoricalAnalysis())
    analyzer.execute_analysis(df, 'smoking', 'physical_activity')