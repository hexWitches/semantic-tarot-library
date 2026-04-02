import csv
from rdflib import Graph 
import json 

# Load the graph
g = Graph()
g.parse("ontology/smtGraph.ttl", format="turtle")

# Define the "Context"
context = {
        "smtg": "https://w3id.org/smt-library/graph/",
        "dcterms" : "http://purl.org/dc/terms/",
        "foaf" : "http://xmlns.com/foaf/0.1/",
        "gn" : "http://www.geonames.org/ontology#",
        "odi" : "https://purl.org/ebr/odi#",
        "owl" : "http://www.w3.org/2002/07/owl#",
        "rdfs" : "http://www.w3.org/2000/01/rdf-schema#",
        "schema" : "https://schema.org/",
        "smt" : "https://w3id.org/smt-library/ontology#",
        "viaf" : "http://viaf.org/viaf/",
        "wd" : "https://www.wikidata.org/entity/",
        "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "xsd": "http://www.w3.org/2001/XMLSchema#",
        "skos": "http://www.w3.org/2004/02/skos/core#",
        "vann": "http://purl.org/vocab/vann/",
        "void": "http://rdfs.org/ns/void#"
}

context["@language"] = "en"

## Read mapping.csv to add property aliases
try:
    with open("mapping-files/mapping.csv", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            alias = row["predicate"].strip()
            prefix = row["ontology_prefix"].strip()
            prop = row["ontology_predicate"].strip()
            
            # Skip aliasing rdf:type to prevent hiding @type
            if prefix == "rdf" and prop == "type":
                continue
            
            # Create the JSON-LD mapping
            context[alias] = f"{prefix}:{prop}"
except FileNotFoundError:
    print("Warning: mapping.csv not found, using base prefixes only.")


# Serialize to JSON-LD
jsonld_output = g.serialize(format='json-ld', context=context, indent=4)

# Save the result
with open("website/assets/json/smtGraph.jsonld", "w", encoding="utf-8") as f:
    f.write(jsonld_output)

print("The spell has been cast: smtGraph.jsonld appeared.")