import json
import requests

url = "http://127.0.0.1:8000/predict"

input_data = {
    "gfr": 32.94678392,
    "serum_creatinine": 0.683682835,
    "bun": 7.553739253,
    "serum_calcium": 10.03989602,
    "urine_ph": 7.864308315,
    "c3_c4": 138.2049887,
    "ana": 0,
    "hematuria": 0,
    "cluster": 5,
    "oxalate_levels": 5.0,
    "alcohol": 0
}

headers = {"Content-Type": "application/json"}

response = requests.post(url, headers=headers, data=json.dumps(input_data))

if response.status_code == 200:
    prediction = response.json()
    print("Prediction:", prediction)
else:
    print(f"Error: {response.status_code}")
    print(response.text)

# python -m scripts.sample_predictor