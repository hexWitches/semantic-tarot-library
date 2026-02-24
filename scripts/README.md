# IIIF Image Downloader Collection

A set of Python tools designed to download high-resolution images from IIIF (International Image Interoperability Framework) manifests. 

These scripts handle both **IIIF Presentation API v2.0 and v3.0**, making them compatible with major archives like Gallica (BnF), Yale University, British Library, and more.


## Features
- **Dual Methodologies**: Choose between a "polite" manual downloader for restricted servers or a high-speed library-based downloader for open archives.
- **Universal Logic**: Automatically detects manifest versions and extracts the highest resolution image URLs.
- **Rate-Limit Protection**: Built-in retry logic and "human-like" randomized delays to prevent IP blocking.

---

## Setup

1. **Install Dependencies**:
   Ensure you have Python installed, then run:
   ```bash
   pip install requests tqdm iiif-download
   ```

## Usage

### 1. The Polite Downloader (`iiif_gallica.py`)
**Best for**: Gallica (BnF) and archives with strict rate limits. 

```bash
python iiif_gallica.py "MANIFEST_URL" -o "MyOutputFolder"
```

### 2. The Library Downloader (`iiif_yale.py`)
**Best for**: Yale, Harvard, and most university libraries.

```bash
python iiif_yale.py "MANIFEST_URL" -o "MyOutputFolder" -s 2500
```