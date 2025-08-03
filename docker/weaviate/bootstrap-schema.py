#!/usr/bin/env python3
"""
/docker/weaviate/bootstrap-schema.py
""" 

import os
import json
import requests
import time

WEAVIATE_URL = os.environ.get("WEAVIATE_URL", "http://weaviate:8080")
SCHEMA_FILE  = os.environ.get("WEAVIATE_SCHEMA", "schema.json")

def wait_for_weaviate():
    for _ in range(30):
        try:
            r = requests.get(f"{WEAVIATE_URL}/v1/.well-known/ready")
            if r.ok:
                return True
        except Exception:
            pass
        time.sleep(2)
    return False

def main():
    if not wait_for_weaviate():
        raise RuntimeError("Weaviate not ready after 60s")
    with open(SCHEMA_FILE) as f:
        schema = json.load(f)
    # POST each class (Weaviate API does not take all at once)
    for cls in schema["classes"]:
        url = f"{WEAVIATE_URL}/v1/schema"
        r = requests.post(url, json=cls)
        if r.status_code not in (200, 201):
            print(f"Error creating class {cls['class']}: {r.text}")
        else:
            print(f"Created class {cls['class']}")

if __name__ == "__main__":
    main()