import os
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("FREEMODEL_API_KEY")
print(f"API Key present: {api_key is not None}")
if api_key:
    print(f"Key starts with: {api_key[:10]}...")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

payload = {
    "model": "gemini-1.5-flash",
    "messages": [
        {"role": "user", "content": "Return a JSON object containing a greeting. Output format: {\"greeting\": \"text\"}"}
    ],
    "response_format": {"type": "json_object"},
    "temperature": 0.2
}

try:
    response = requests.post(
        "https://api.freemodel.dev/v1/chat/completions",
        json=payload,
        headers=headers,
        timeout=15
    )
    print("Status Code:", response.status_code)
    print("Response JSON:", response.json())
except Exception as e:
    print("Failed to call FreeModel API:", e)
