import numpy as np
from sklearn.base import BaseEstimator


class HierarchicalClassifier(BaseEstimator):
    def __init__(self, stage1_model, stage2_model):
        self.stage1_model = stage1_model
        self.stage2_model = stage2_model

    def fit(self, X, y_stage1, X_rare, y_stage2):
        self.stage1_model.fit(X, y_stage1)
        self.stage2_model.fit(X_rare, y_stage2)
        return self

    def predict(self, X):
        stage1_preds = self.stage1_model.predict(X)
        final_preds = list(stage1_preds)

        others_idx = [i for i, p in enumerate(stage1_preds) if p == "Others"]
        if others_idx:
            stage2_preds = self.stage2_model.predict(X.iloc[others_idx])
            for idx, pred in zip(others_idx, stage2_preds):
                final_preds[idx] = pred

        return final_preds

    def predict_proba(self, X):
        stage1_classes = list(self.stage1_model.classes_)
        stage2_classes = list(self.stage2_model.classes_)
        all_classes = [c for c in stage1_classes if c != "Others"] + stage2_classes

        stage1_proba = self.stage1_model.predict_proba(X)
        stage1_preds = self.stage1_model.predict(X)

        proba = np.zeros((X.shape[0], len(all_classes)))

        for i, cls in enumerate(stage1_classes):
            if cls == "Others":
                continue
            proba[:, all_classes.index(cls)] = stage1_proba[:, i]

        others_idx = [i for i, p in enumerate(stage1_preds) if p == "Others"]
        if others_idx and "Others" in stage1_classes:
            others_col = stage1_classes.index("Others")
            stage2_proba = self.stage2_model.predict_proba(X.iloc[others_idx])
            for row_pos, idx in enumerate(others_idx):
                weight = stage1_proba[idx, others_col]
                for j, cls in enumerate(stage2_classes):
                    proba[idx, all_classes.index(cls)] = stage2_proba[row_pos, j] * weight

        row_sums = proba.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1
        return proba / row_sums

    @property
    def classes_(self):
        stage1_classes = list(self.stage1_model.classes_)
        stage2_classes = list(self.stage2_model.classes_)
        return np.array([c for c in stage1_classes if c != "Others"] + stage2_classes)
