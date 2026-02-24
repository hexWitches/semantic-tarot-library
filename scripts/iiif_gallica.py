import os
import time
import random
import requests
import argparse
from tqdm import tqdm

def download_iiif(manifest_url, output_dir, batch_size, batch_pause):
    os.makedirs(output_dir, exist_ok=True)

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "Accept": "application/json",
        "Referer": "https://gallica.bnf.fr/"
    }

    session = requests.Session()
    session.headers.update(headers)

    # --- fetch manifest ---
    print(f"Fetching manifest: {manifest_url}")
    r = session.get(manifest_url)
    r.raise_for_status()
    manifest = r.json()

    if "sequences" in manifest:
        canvases = manifest["sequences"][0]["canvases"]
    elif "items" in manifest:
        canvases = manifest["items"]
    else:
        print("Error: Could not find images in manifest.")
        return


    for i, canvas in enumerate(tqdm(canvases), start=1):
        filename = f"{i:03}.jpg"
        path = os.path.join(output_dir, filename)

        if os.path.exists(path):
            continue

        # Extract image URL logic
        try:
            if "images" in canvas:
                image_info = canvas["images"][0]["resource"]
                base_id = image_info["@id"]
            else:
                base_id = canvas["items"][0]["items"][0]["body"]["id"]
            
            base_url = base_id.rsplit("/", 4)[0]
            image_url = f"{base_url}/full/max/0/default.jpg"

        except Exception as e:
            print(f"Skipping image {i}: {e}")
            continue

        for attempt in range(1, 7):
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

        # Random delay to be polite to the server
        time.sleep(random.uniform(2.5, 4.5))

        # Long pause every batch
        if i % batch_size == 0:
            print(f"\nBatch pause — sleeping {batch_pause}s\n")
            time.sleep(batch_pause)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download high-res images from any IIIF Manifest.")
    parser.add_argument("url", nargs='?', default="default_url_here", help="The IIIF Manifest JSON URL")
    parser.add_argument("-o", "--output", default="downloaded_images", help="Folder name for images")
    parser.add_argument("-b", "--batch", type=int, default=8, help="Images per batch before a long pause")
    parser.add_argument("-p", "--pause", type=int, default=20, help="Seconds to pause between batches")

    args = parser.parse_args()
    
    download_iiif(args.url, args.output, args.batch, args.pause)