import json

import requests

# URL of the MLflow prediction server
url = "http://127.0.0.1:8000/invocations"

# Sample input data for prediction
# Replace the values with the actual features your model expects
input_data = {
    "dataframe_records": [
        {
        'gfr': 32.94678392,
        'cluster': 5,
        'c3_c4': 138.2049887, 				
        'urine_ph': 7.864308315,
        'bun': 7.553739253,
        'ana': 0,
        'hematuria': 0,
        'serum_creatinine': 0.683682835,
        'serum_calcium': 10.03989602,
        }
    ]
}

# Convert the input data to JSON format
json_data = json.dumps(input_data)

# Set the headers for the request
headers = {"Content-Type": "application/json"}

# Send the POST request to the server
response = requests.post(url, headers=headers, data=json_data)

# Check the response status code
if response.status_code == 200:
    # If successful, print the prediction result
    prediction = response.json()
    print("Prediction:", prediction)
else:
    # If there was an error, print the status code and the response
    print(f"Error: {response.status_code}")
    print(response.text)


# python -m scripts.sample_predictor