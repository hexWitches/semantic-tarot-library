# Scripts Directory

This directory contains the Python-based automation and data processing pipeline for the Semantic Tarot Library. These tools handle everything from converting raw data into Linked Data to dynamically updating the website's daily content.

## Setup

1. **Install Dependencies**:
   Ensure you have Python installed, then run from the root directory:
   ```bash
   pip install -r scripts/requirements.txt
   ```

## Directory Summary

### Data Processing & Linked Data
* **`csv_to_rdf.py`**: The primary ingestion engine. It reads raw metadata from `data/*.csv` and maps it to the project ontology using `mapping-files/mapping.csv`. It handles URI normalization, manages authority links for locations (Wikidata/GeoNames), and exports a structured Turtle (`.ttl`) graph.
* **`turtle_to_jsonld.py`**: A conversion utility that transforms the Turtle RDF graph into a web-optimized `smtGraph.jsonld` file. It dynamically builds a JSON-LD context based on the project's mapping files to ensure the frontend can easily traverse the semantic relationships.

> [!WARNING]
> Both `csv_to_rdf.py` and `turtle_to_jsonld.py` depend on relative file paths extending from the repository root (e.g. `data/deck.csv` and `ontology/smtGraph.ttl`). Always execute them from the **project root** directory to avoid `FileNotFoundError`s:
> ```bash
> python scripts/csv_to_rdf.py
> python scripts/turtle_to_jsonld.py
> ```

### Image Acquisition (IIIF)
* **`iiif_gallica.py`**: A specialized downloader for the Bibliothèque nationale de France (Gallica). It includes sophisticated "politeness" features, such as randomized delays, 429 error back-off logic, and batch pauses to ensure stable high-resolution downloads.
* **`iiif_yale.py`**: A streamlined downloader for IIIF manifests from the Yale Beinecke Library and other standard IIIF endpoints, allowing for custom image sizing and automated directory organization.

**Usage:**
```bash
# Polite Downloader (BnF Gallica)
python scripts/iiif_gallica.py "MANIFEST_URL" -o "MyOutputFolder"

# Standard Library Downloader (Yale, Harvard)
python scripts/iiif_yale.py "MANIFEST_URL" -o "MyOutputFolder" -s 2500
```

### Website Automation
* **`card_of_the_day.py`**: Automates the "Card of the Day" feature on the homepage. It selects a card based on the current date, retrieves its generic description and archetype evolution, and performs a regex-based injection of the new HTML content directly into `index.html`.

**Usage:**
```bash
# Safely resolves paths relative to its location, allowing execution from anywhere!
python scripts/card_of_the_day.py
```