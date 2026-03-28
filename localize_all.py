import json
import os

locales_dir = r"c:\Users\ibrah\.gemini\antigravity\scratch\streaming-app\pstream-frontend\locales"
en_file = os.path.join(locales_dir, "en.json")

with open(en_file, "r", encoding="utf-8") as f:
    en_data = json.load(f)

en_rows = en_data.get("rows", {})
en_auth = en_data.get("auth", {})

for filename in os.listdir(locales_dir):
    if filename == "en.json" or not filename.endswith(".json"):
        continue
    
    filepath = os.path.join(locales_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Update rows
    if "rows" not in data:
        data["rows"] = {}
    for k, v in en_rows.items():
        if k not in data["rows"]:
            data["rows"][k] = v
            
    # Update auth
    if "auth" not in data:
        data["auth"] = {}
    for k, v in en_auth.items():
        if k not in data["auth"]:
            data["auth"][k] = v
            
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

print("All locales updated with missing keys from en.json")
