import os
import time
import random
import requests
from tqdm import tqdm

MANIFEST_URL = "https://gallica.bnf.fr/iiif/ark:/12148/btv1b105109641/manifest.json"
OUTPUT_DIR = "TarotNoblet"

os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Accept": "application/json",
    "Referer": "https://gallica.bnf.fr/"
}

MIN_DELAY = 2.5
MAX_DELAY = 4.5
BATCH_SIZE = 8
BATCH_PAUSE = 20
MAX_RETRIES = 6

session = requests.Session()
session.headers.update(HEADERS)

# --- fetch manifest ---
r = session.get(MANIFEST_URL)
r.raise_for_status()
manifest = r.json()

canvases = manifest["sequences"][0]["canvases"]
print(f"Found {len(canvases)} images")

for i, canvas in enumerate(tqdm(canvases), start=1):
    filename = f"{i:03}.jpg"
    path = os.path.join(OUTPUT_DIR, filename)

    if os.path.exists(path):
        continue

    image_info = canvas["images"][0]["resource"]
    base_url = image_info["@id"].rsplit("/", 4)[0]
    image_url = f"{base_url}/full/full/0/default.jpg"

    for attempt in range(1, MAX_RETRIES + 1):
        resp = session.get(image_url)

        if resp.status_code == 200:
            with open(path, "wb") as f:
                f.write(resp.content)
            break

        if resp.status_code == 429:
            wait = random.uniform(10, 20) * attempt
            print(f"\n429 — backing off {wait:.1f}s")
            time.sleep(wait)
            continue

        resp.raise_for_status()

    # human-like delay
    time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))

    # long pause every batch
    if i % BATCH_SIZE == 0:
        print(f"\nBatch pause — sleeping {BATCH_PAUSE}s\n")
        time.sleep(BATCH_PAUSE)