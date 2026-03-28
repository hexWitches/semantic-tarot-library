import csv
from rdflib import Graph 
import json 

# 1. Load the graph you created from CSVs
g = Graph()
g.parse("ontology/smtGraph.ttl", format="turtle")

# 2. Define the "Context"
# This is the most important part of JSON-LD. 
# It tells the computer: "When I say 'label', I actually mean 'rdfs:label'".
context = {
        "smtg": "https://w3id.org/smt-library/graph/",
        "dcterms" : "http://purl.org/dc/terms/",
        "foaf" : "http://xmlns.com/foaf/0.1/",
        "gn" : "http://www.geonames.org/ontology#",
        "odi" : "https://purl.org/ebr/odi#",
        "owl" : "http://www.w3.org/2002/07/owl#",
        "rdfs" : "http://www.w3.org/2000/01/rdf-schema#",
        "schema" : "https://schema.org/",
        "smt" : "https://github.com/hexWitches/semantic-tarot-library/ontology#",
        "viaf" : "http://viaf.org/viaf/",
        "wd" : "https://www.wikidata.org/entity/"
}

## 3. Read mapping.csv to add property aliases
# Expected columns: predicate (CSV header), ontology_prefix, ontology_predicate
try:
    with open("mapping-files/mapping.csv", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            alias = row["predicate"].strip() # e.g., "birth_year"
            prefix = row["ontology_prefix"].strip() # e.g., "schema"
            prop = row["ontology_predicate"].strip() # e.g., "birthDate"
            
            # Create the JSON-LD mapping: "birth_year": "schema:birthDate"
            context[alias] = f"{prefix}:{prop}"
except FileNotFoundError:
    print("Warning: mapping.csv not found, using base prefixes only.")


# 5. Serialize to JSON-LD
# We pass the dynamically built context here
jsonld_output = g.serialize(format='json-ld', context=context, indent=4)

# 6. Save the result
with open("website/assets/json/smtGraph.jsonld", "w", encoding="utf-8") as f:
    f.write(jsonld_output)

print("The spell has been cast: smtGraph.jsonld appeared.")