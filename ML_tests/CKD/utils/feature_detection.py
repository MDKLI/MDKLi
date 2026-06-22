def detect_feature_type(df, col):
    if df[col].dtype == "object":
        return "categorical"
    else:
        return "numerical"