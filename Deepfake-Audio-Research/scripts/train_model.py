import os
import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

df = pd.read_csv("output/features/audio_features.csv")

print("Dataset Loaded Successfully!\n")

print(df.head())

X = df.drop("label", axis=1)

y = df["label"]


X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.25,
    random_state=42,
    stratify=y
)
    

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(
    X_train,
    y_train
)

print("Model trained successfully!")

predictions = model.predict(X_test)

accuracy = accuracy_score(
    y_test,
    predictions
)

print(f"\nAccuracy : {accuracy*100:.2f}%")

print("\nClassification Report\n")

print(
    classification_report(
        y_test,
        predictions
    )
)

print("\nConfusion Matrix\n")

print(
    confusion_matrix(
        y_test,
        predictions
    )
)

os.makedirs("model", exist_ok=True)


joblib.dump(
    model,
    "model/deepfake_voice_detector.pkl"
)

print("\nModel Saved Successfully!")

