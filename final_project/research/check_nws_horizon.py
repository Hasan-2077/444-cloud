import json
from datetime import datetime

with open("research/api-samples/nws-hourly.json") as f:
    data = json.load(f)

periods = data["properties"]["periods"]

first = datetime.fromisoformat(periods[0]["startTime"])
last = datetime.fromisoformat(periods[-1]["startTime"])

print("First hourly forecast:", first.isoformat())
print("Last hourly forecast :", last.isoformat())
print("Hours represented    :", (last - first).total_seconds() / 3600)
print("Hourly records       :", len(periods))
