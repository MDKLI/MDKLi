# visualization of multi feature at a time, to understand the relationship between the features and their relationship with the target variable
# for numerical features: pair plot, heatmap
# for categorical features: heatmap, mosaic plot

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from abc import ABC, abstractmethod

# Template method pattern for multivariate analysis

class MultivariateAnalysis(ABC):
    def analyze(self, df: pd.DataFrame):
        numeric_df = df.select_dtypes(include="number")

        if numeric_df.shape[1] > 1:
            self.generate_correlation_heatmap(numeric_df)

            top_features = numeric_df.corr().abs().mean().sort_values(ascending=False).head(5).index

            self.generate_pairplot(numeric_df[top_features])

        else:
            pass

    @abstractmethod
    def generate_correlation_heatmap(self, df: pd.DataFrame):
        pass

    @abstractmethod
    def generate_pairplot(self, df: pd.DataFrame):
        pass


class SimpleMultivariateAnalysis(MultivariateAnalysis):
    def generate_correlation_heatmap(self, df: pd.DataFrame):
        correlation_matrix = df.corr(numeric_only=True)

        plt.figure(figsize=(12, 10))

        sns.heatmap(
            correlation_matrix,
            annot=True,
            fmt=".2f",
            cmap="coolwarm",
            linewidths=0.5,
            square=True
        )

        plt.title("Correlation Heatmap", fontsize=14)
        plt.tight_layout()
        plt.show()

    def generate_pairplot(self, df: pd.DataFrame):
        df = df.dropna()

        if df.shape[1] < 2:
            print("Not enough features for pairplot")
            return

        pair_grid = sns.pairplot(
            df,
            diag_kind="kde",
            corner=True,
            height=2.5
        )


        pair_grid.fig.set_size_inches(12, 10)
        pair_grid.fig.subplots_adjust(top=0.9)

        pair_grid.fig.suptitle(
            "Pair Plot of Selected Features",
            y=1.02,
            fontsize=16
        )

        plt.show()


if __name__ == "__main__":
    df = pd.read_csv(
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/updated_ckd_dataset_with_stages.csv"
    )

    multivariate_analyzer = SimpleMultivariateAnalysis()

    selected_features = df.select_dtypes(include="number")

    multivariate_analyzer.analyze(selected_features)