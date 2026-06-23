# visualization of one feature at a time, to understand the distribution
# of the feature and its relationship with the target variable
# for numerical features: histogram, boxplot, violin plot, kde plot
# for categorical features: count plot, pie chart

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from abc import ABC, abstractmethod


# Strategy Design Pattern for Univariate Analysis

class UnivariateAnalysisStrategy(ABC):
    @abstractmethod
    def analyze(self, df: pd.DataFrame, feature: str):
        pass


class NumericalUnivariateAnalysis(UnivariateAnalysisStrategy):

    def analyze(self, df: pd.DataFrame, feature: str):
        numeric_cols = df.select_dtypes(include="number").columns

        if feature not in numeric_cols:
            raise ValueError(
                f"Feature '{feature}' is not numerical.\n"
                f"This analysis is only applicable for numerical features such as:\n"
                f"{', '.join(numeric_cols)}"
            )

        self.hist_plot(df, feature)
        self.box_plot(df, feature)

    def hist_plot(self, df: pd.DataFrame, feature: str):
        plt.figure(figsize=(10, 6))

        sns.histplot(
            x=df[feature].dropna(),
            kde=True,
            bins=30
        )

        plt.title(f"Distribution of {feature}")
        plt.xlabel(feature)
        plt.ylabel("Frequency")
        plt.tight_layout()
        plt.show()

    def box_plot(self, df: pd.DataFrame, feature: str):
        plt.figure(figsize=(10, 6))

        sns.boxplot(
            x=df[feature].dropna()
        )

        plt.title(f"Boxplot of {feature}")
        plt.xlabel(feature)
        plt.tight_layout()
        plt.show()


class CategoricalUnivariateAnalysis(UnivariateAnalysisStrategy):

    def analyze(self, df: pd.DataFrame, feature: str):
        categorical_cols = df.select_dtypes(
            include=["object", "category", "bool"]
        ).columns

        if feature not in categorical_cols:
            raise ValueError(
                f"Feature '{feature}' is not categorical.\n"
                f"This analysis is only applicable for categorical features such as:\n"
                f"{', '.join(categorical_cols)}"
            )

        self.count_plot(df, feature)
        self.pie_chart(df, feature)

    def count_plot(self, df: pd.DataFrame, feature: str):
        plt.figure(figsize=(10, 6))

        sns.countplot(
            data=df,
            x=feature,
            hue=feature,
            dodge=False,
            legend=False
        )

        plt.title(f"Distribution of {feature}")
        plt.xlabel(feature)
        plt.ylabel("Count")
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.show()

    def pie_chart(self, df: pd.DataFrame, feature: str):
        plt.figure(figsize=(10, 6))

        df[feature].value_counts().plot.pie(
            autopct="%1.1f%%"
        )

        plt.title(f"Distribution of {feature}")
        plt.ylabel("")
        plt.tight_layout()
        plt.show()


class UnivariateAnalyzer:

    def __init__(self, strategy: UnivariateAnalysisStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: UnivariateAnalysisStrategy):
        self._strategy = strategy

    def execute_analysis(self, df: pd.DataFrame, feature: str):
        self._strategy.analyze(df, feature)


# class AutoUnivariateAnalyzer:

#     def execute_analysis(self, df: pd.DataFrame, feature: str):

#         if pd.api.types.is_numeric_dtype(df[feature]):
#             strategy = NumericalUnivariateAnalysis()
#         else:
#             strategy = CategoricalUnivariateAnalysis()

#         strategy.analyze(df, feature)


if __name__ == "__main__":

    df = pd.read_csv(
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/updated_ckd_dataset_with_stages.csv"
    )

    # analyzer = AutoUnivariateAnalyzer()

    # analyzer.execute_analysis(df, "gfr")
    # analyzer.execute_analysis(df, "smoking")

    analyzer = UnivariateAnalyzer(NumericalUnivariateAnalysis())
    analyzer.execute_analysis(df, 'gfr')

    analyzer.set_strategy(CategoricalUnivariateAnalysis())
    analyzer.execute_analysis(df, 'smoking')
    pass


