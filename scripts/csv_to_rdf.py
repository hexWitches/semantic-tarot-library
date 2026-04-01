import csv
import unicodedata
import re
from rdflib import Graph, URIRef, Literal, Namespace
from rdflib.namespace import RDF, RDFS, OWL, XSD

# Namespace configuration
GRAPH_URI = Namespace("https://w3id.org/smt-library/graph/")

namespaces = {
    "smtg" : Namespace(GRAPH_URI),
    "smt": Namespace("https://w3id.org/smt-library/ontology#"),
    "dcterms": Namespace("http://purl.org/dc/terms/"),
    "owl": Namespace("http://www.w3.org/2002/07/owl#"),
    "schema": Namespace("https://schema.org/"), 
    "rdfs": Namespace("http://www.w3.org/2000/01/rdf-schema#"),
    "rdf": Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
    "odi": Namespace("https://purl.org/ebr/odi#"),
    "foaf": Namespace("http://xmlns.com/foaf/0.1/"),
    "xsd": Namespace("http://www.w3.org/2001/XMLSchema#"),
    "skos": Namespace("http://www.w3.org/2004/02/skos/core#"),
    "viaf": Namespace("http://viaf.org/viaf/"),
    "wd": Namespace("https://www.wikidata.org/entity/"),
    "gn": Namespace("http://www.geonames.org/ontology#"),
    "vann": Namespace("http://purl.org/vocab/vann/")
}

# Associate CSV columns with ontology properties 
predicate_map = {}
with open("mapping-files/mapping.csv", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        prefix = row["ontology_prefix"].strip()
        prop = row["ontology_predicate"].strip()
        predicate = row["predicate"].strip()
        if prefix in namespaces:
            predicate_map[predicate.strip()] = URIRef(namespaces[prefix.strip()][prop.strip()]) # strip() whitespace

# Authority mapping for locations (Wikidata/GeoNames)
mapping_entities = {}
with open("mapping-files/mapping_authority_entities.csv", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        name = row["name"].strip()
        mapping_entities[name] = {
            "wikidata": URIRef(row["wikidata_id"].strip()) if row["wikidata_id"] else None,
            "geonames": URIRef(row["geonames_id"].strip()) if row["geonames_id"] else None
        }

# Identifier cleaning function: remove accents, special chracters, replace space with dashes to create valid URIs
def clean_id(text): 
    if not text:
        return ""
    text = str(text)
    text = unicodedata.normalize('NFKD', text)
    # convert to ASCII ignoring characters that cannot be converted (e.g. accents)
    text.encode('ascii', 'ignore').decode('ascii')
    # remove everything that is not a letter, number, space or dash 
    text = re.sub(r'[^\w\s-]', '', text).strip().lower()
    # replace spaces and underscores with a single dash
    text = re.sub(r'[-\s_]+', '-', text)
    return text 

# Graph initializations
g = Graph()
for prefix, ns in namespaces.items():
    g.bind(prefix, ns)

DATA = namespaces["smtg"]
SMT = namespaces["smt"]


def process_csv(file_path, id_column, default_class):
    with open(file_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            subject_id = clean_id(row[id_column])
            if not subject_id: continue
            
            subject_uri = DATA[subject_id]
            g.add((subject_uri, RDF.type, default_class))
            
            for header, value in row.items():
                if not value or header == id_column: continue
                val = value.strip()
                
                # Arcana Type 
                if header in ["arcana_type", "minor_arcana_type"] :
                    class_name = val.replace(" ", "") # "Major Arcana" -> "MajorArcana"
                    g.add((subject_uri, RDF.type, SMT[class_name]))
                
                # Entities
                elif header in ["suit_id", "contained_in_deck_id", "author_id", "illustrator_id", "archetype_id", "broader_archetype_id", "symbolic_figure_id", "deck_lineage_id"]:
                    if header in predicate_map:
                        # split multiple IDs and clean
                        ids = [clean_id(i) for i in val.split(",")]
                        for entity_id in ids:
                            g.add((subject_uri, predicate_map[header], DATA[entity_id]))
                
                # Locations 
                elif header in ["location_created", "current_location"]:
                    loc_id = clean_id(val)
                    loc_uri = DATA[loc_id]
                    
                    if header == "location_created":
                        g.add((subject_uri, namespaces["schema"]["locationCreated"], loc_uri))
                        g.add((loc_uri, RDF.type, namespaces["schema"]["Place"]))
                        g.add((loc_uri, RDFS.label, Literal(val)))
                    else:
                        g.add((subject_uri, namespaces["odi"]["hasCurrentLocation"], loc_uri))
                        g.add((loc_uri, RDF.type, namespaces["odi"]["Place"]))
                        g.add((loc_uri, RDFS.label, Literal(val)))
                    
                    # apply authority links for locations if mapped 
                    if val in mapping_entities:
                        if mapping_entities[val]["wikidata"]:
                            g.add((loc_uri, OWL.sameAs, namespaces["wd"][mapping_entities[val]["wikidata"]]))
                        if mapping_entities[val]["geonames"]:
                            g.add((loc_uri, OWL.sameAs, namespaces["gn"][mapping_entities[val]["geonames"]]))
                
                # Descriptions 
                elif header == "description":
                    g.add((subject_uri, namespaces["dcterms"]["description"], Literal(val, lang="en")))
                
                # Authority (Wikidata/VIAF)
                elif header in ["wiki_authority", "viaf_authority"]: 
                    if header == "wiki_authority":
                        g.add((subject_uri, OWL.sameAs, namespaces["wd"][val]))
                    else:
                        g.add((subject_uri, OWL.sameAs, namespaces["viaf"][val]))
                
                # Dates and labels 
                elif header in ["birth_year", "death_year"]:
                    predicate = namespaces["schema"]["birthDate"] if "birth" in header else namespaces["schema"]["deathDate"]
                    g.add((subject_uri, predicate, Literal(val)))

                # Generic mapping from mapping.csv
                elif header in predicate_map:
                    predicate = predicate_map[header]
                    
                    if "url" in header.lower() or "source" in header.lower():
                        g.add((subject_uri, predicate, URIRef(val)))
                    else:
                        if "," in val and header in ["alt_title", "alternative_title", "label"]:
                            items = [i.strip() for i in val.split(",")]
                            for item in items:
                                g.add((subject_uri, predicate, Literal(item)))
                        else:
                            g.add((subject_uri, predicate, Literal(val)))

process_csv("data/deck.csv", "deck_id", namespaces["odi"]["TarotDeck"])
process_csv("data/person.csv", "person_id", namespaces["odi"]["Person"])
process_csv("data/card.csv", "card_id", namespaces["odi"]["DeckCard"])
process_csv("data/archetypes.csv", "archetype_id", namespaces["smt"]["Archetype"])
process_csv("data/figures.csv", "symbolic_figure_id", namespaces["smt"]["SymbolicFigure"])
process_csv("data/deck_lineage.csv", "deck_lineage_id", namespaces["smt"]["DeckLineage"])

# Saving
g.serialize(destination="ontology/smtGraph.ttl", format="turtle", base=GRAPH_URI)
print("The spell has been cast: smtGraph.ttl appeared.")