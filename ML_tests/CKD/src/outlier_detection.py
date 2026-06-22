import logging 
from abc import ABC, abstractmethod

import numpy as np 
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns


logging.basicConfig(level= logging.INFO, format= "%(asctime)s - %(levelname)s - %(message)s")

class OutlierDetectionStrategy(ABC):
               @abstractmethod
               def detect_outliers(self, df: pd.DataFrame)-> pd.DataFrame:
                       pass

# Z-Score
class ZScoreOutlierDetection(OutlierDetectionStrategy):
        def __init__(self, threshold= 3):
                self.threshold= threshold
        def detect_outliers(self, df: pd.DataFrame) ->  pd.DataFrame:
                logging.info("Detecting outliers using the Z-score method.")
                z_score= np.abs((df - df.mean()) / df.std())
                outliers= z_score > self.threshold
                logging.info(f"Outliers detected with Z-score threshold: {self.threshold}.")
                return outliers
                

# IQR
class IQROutlierDetection(OutlierDetectionStrategy):
        def detect_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
                logging.info("Detecting outliers using IQR.")
                Q1= df.quantile(0.25)
                Q3= df.quantile(0.75)
                IQR= Q3 - Q1
                outliers = ((df < (Q1 - 1.5 * IQR)) | (df > (Q3 + 1.5 * IQR)))
                logging.info("Outliers detected using IQR method.")
                return outliers
        



class OutlierDetector:
     def __init__(self, strategy: OutlierDetectionStrategy):
                self._strategy= strategy

     def set_strategy(self, strategy: OutlierDetectionStrategy):
                logging.info("Switching outlier detection strategy.")
                self._strategy= strategy
     def detect_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
                logging.info("Executing outlier detection strategy.")
                return self._strategy.detect_outliers(df)

# until here make DataFrame True/Flase but not remove/cap outliers so:

     def handle_outliers(self, df: pd.DataFrame, method= "remove", **kwargs) ->pd.DataFrame:
                outliers= self.detect_outliers(df)
                if method == "remove":
                        logging.info("Removing outliers from the dataset.")
                        df_cleaned= df[(~outliers).all(axis= 1)]
                elif method == "cap":
                        logging.info("Capping outliers in the dataset.")
                        df_cleaned= df.clip(lower= df.quantile(0.01), upper= df.quantile(0.99), axis= 1)
                else:
                        logging.warning(f"Unknown method '{method}'. No outlier handling performed.")
                        return df
                logging.info("Outlier handling complete.")
                return df_cleaned

     def visualize_outliers(self, df: pd.DataFrame, features: list):
        logging.info(f"Visualizing outliers for features: {features}")
        for feature in features:
            plt.figure(figsize=(10, 6))
            sns.boxplot(x=df[feature])
            plt.title(f"Boxplot of {feature}")
            plt.show()
        logging.info("Outlier visualization completed.")



# remove
"""
~outliers:



(~) means:

Age	Weight	Height
False	False	False
True	False	False

will:

Age	Weight	Height
True	True	True
False	True	True


all():
means is it all values True if not remove it
axis= 1 to remove rows
"""






# cap
"""
[4000, 5000, 6000, 7000, 100000]



1% ≈ 4000
99% ≈ 7000


before:
[4000, 5000, 6000, 7000, 100000]

after:

[4000, 5000, 6000, 7000, 7000]
"""


if __name__ == "__main__":
        df= pd.read_csv( 
                          "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
                          "extracted_data/updated_ckd_dataset_with_stages.csv"
    )
        
        df_numeric= df.select_dtypes(include= [np.number]).dropna()

        outlier_detector= OutlierDetector(IQROutlierDetection())
#         outliers= outlier_detector.detect_outliers(df_numeric)
#         df_cleaned = outlier_detector.handle_outliers(df_numeric, method="remove")

#         print(df_cleaned.shape)
#         outlier_detector.visualize_outliers(df_cleaned, features=['gfr', 'blood_pressure'])

# مش شاذة هي نادرة بس في الداتا دي


        outlier_detector.set_strategy(ZScoreOutlierDetection())
        outliers= outlier_detector.detect_outliers(df_numeric)
        df_cleaned = outlier_detector.handle_outliers(df_numeric, method="remove")


        print(df_cleaned.shape)
        # outlier_detector.visualize_outliers(df_cleaned, features=['gfr', 'blood_pressure'])


        pass
