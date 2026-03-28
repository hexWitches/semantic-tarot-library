import json
import random
import os
from datetime import date
import re

# Constants
# Get the directory of the current script to handle relative paths correctly
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.join(SCRIPT_DIR, "../website")

GRAPH_PATH = os.path.join(PROJECT_ROOT, "assets/json/smtGraph.jsonld")
TEXTS_PATH = os.path.join(PROJECT_ROOT, "assets/json/texts.json")
INDEX_PATH = os.path.join(PROJECT_ROOT, "index.html")

def github_to_local_path(url):
    """Converts a GitHub URL to a local relative path."""
    if not url:
        return ""
    if "website/" in url:
        return url.split("website/")[1]
    return url

def get_card_short_id(full_id):
    """Converts smtg:card-name-01 to card_name_01 for texts.json lookup."""
    return full_id.replace("smtg:card-", "card_").replace("-", "_")

def update_homepage():
    # Load Data
    with open(GRAPH_PATH, 'r') as f:
        graph_data = json.load(f)["@graph"]
    
    with open(TEXTS_PATH, 'r') as f:
        texts_data = json.load(f).get("cards", {})

    # Filter for Deck Cards
    cards = [node for node in graph_data if "odi:DeckCard" in node.get("@type", [])]
    
    if not cards:
        print("No cards found in graph.")
        return

    # DETERMINISTIC RANDOM SEED (for daily use)
    today = date.today()
    random.seed(today.toordinal())
    
    # Pick a card that has a description if possible
    valid_cards = [c for c in cards if get_card_short_id(c["@id"]) in texts_data]
    if not valid_cards: valid_cards = cards
    
    selected_card = random.choice(valid_cards)

    print(f"Selected card ID: {selected_card['@id']} -> Text ID: {get_card_short_id(selected_card['@id'])}")
    
    # Get Metadata
    text_id = get_card_short_id(selected_card["@id"])
    card_data = texts_data.get(text_id, {})
    
    title = selected_card.get("title", "Unknown Card")
    # Try to get a nicer title or description from texts.json
    desc = card_data.get("description") or "Discover the hidden meanings and history of this card."
    if isinstance(desc, list): desc = desc[0]
    
    # Strip HTML tags and clean up whitespace
    desc = re.sub(r'<[^>]+>', '', desc)
    desc = " ".join(desc.split())
    
    import itertools
    
    # Trim description if too long
    if len(desc) > 200:
        desc = "".join(itertools.islice(desc, 197)) + "..."

    main_image = github_to_local_path(selected_card.get("image_url", {}).get("@id", ""))
    
    # Archetype Name (Major Arcana only)
    archetype_id = selected_card.get("archetype_id", {}).get("@id")
    archetype_name = ""
    if archetype_id:
        archetype_node = next((n for n in graph_data if n["@id"] == archetype_id), {})
        archetype_name = archetype_node.get("http://www.w3.org/2004/02/skos/core#prefLabel", title)
        if isinstance(archetype_name, dict): archetype_name = archetype_name.get("@value", title)

    is_minor = "smt:MinorArcana" in selected_card.get("@type", [])
    
    # Detail Link - Corrected to use 'id' and keep 'card-' prefix for card.js
    detail_id = selected_card["@id"].replace("smtg:", "")
    detail_url = f"card.html?id={detail_id}"

    # Build the dynamic content for the right column
    if is_minor:
        # Minor Arcana: Link Discover More to Suits approfondimento
        right_column_html = f'''
                                <div class="evolution-frame compact-evolution mt-0 mx-0">
                                    <div class="evolution-content">
                                        <h3 class="evolution-heading">
                                            Minor Arcana: The mundane mirrored. <br>Explore the <span class="highlight">four suits</span> and their meanings.
                                        </h3>
                                    </div>
            
                                    <a href="suits.html" id="dailyCardDiscoverMore" class="discover-more">
                                        <span class="discover-svg">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                                <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/>
                                            </svg>
                                        </span>
                                        <span class="discover-label">Discover<br>more</span>
                                    </a>
                                </div>'''
    else:
        # Major Arcana: Show Evolution
        # Find Evolution (same archetype, different decks)
        all_evo = [c for c in cards if c.get("archetype_id", {}).get("@id") == archetype_id and c["@id"] != selected_card["@id"]]
        evolution_cards = list(itertools.islice(all_evo, 3))
        
        evo_html = ""
        for evo in evolution_cards:
            img_url = github_to_local_path(evo.get("image_url", {}).get("@id", ""))
            
            # Using str concatenation instead of f-string formatting to avoid LiteralString typing issues
            html_chunk = '\n' + '                                            <div class="mini-card-thumb">\n' + '                                                <img src="' + img_url + '" alt="Related Version">\n' + '                                            </div>'
            evo_html += html_chunk
        
        right_column_html = f'''
                                <div class="evolution-frame compact-evolution mt-0 mx-0">
                                    <div class="evolution-content">
                                        <h3 class="evolution-heading">
                                            One archetype, infinite interpretations. Discover the many faces of <span id="dailyCardArchetype" class="highlight">{archetype_name}</span>.
                                        </h3>
                                        
                                        <div id="dailyCardEvolution" class="archetype-comparison-preview">
{evo_html}
                                        </div>
                                    </div>
            
                                    <a href="{detail_url}" id="dailyCardDiscoverMore" class="discover-more">
                                        <span class="discover-svg">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                                <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/>
                                            </svg>
                                        </span>
                                        <span class="discover-label">Discover<br>more</span>
                                    </a>
                                </div>'''

    # Build the block replacement
    new_content = f'''
                        <div class="row align-items-center gy-4">
                            <div class="col-md-3 text-center">
                                <a href="{detail_url}" id="dailyCardLink">
                                    <img src="{main_image}" id="dailyCardImage" class="img-fluid rounded-3" alt="Card of the Day" style="max-height: 320px; width: auto; display: block; margin: 0 auto;">
                                </a>
                            </div>
                            
                            <div class="col-md-5 px-md-4 text-center text-md-start">
                                <h2 class="section-title mb-3">CARD OF THE DAY</h2>
                                <h3 id="dailyCardTitle" style="font-family: 'Cinzel', serif; font-size: 1.6rem; margin-bottom: 0.5rem; color: var(--deep-plum);">{title}</h3>
                                <p id="dailyCardDesc" class="mb-0" style="font-size: 1.15rem; line-height: 1.5;">{desc}</p>
                            </div>
                            
                            <div class="col-md-4">
{right_column_html}
                            </div>
                        </div>'''

    # Update index.html
    with open(INDEX_PATH, 'r') as f:
        index_html = f.read()

    pattern = r'<!-- CARD_OF_THE_DAY_START -->.*?<!-- CARD_OF_THE_DAY_END -->'
    updated_html = re.sub(pattern, f'<!-- CARD_OF_THE_DAY_START -->{new_content}\n                        <!-- CARD_OF_THE_DAY_END -->', index_html, flags=re.DOTALL)

    with open(INDEX_PATH, 'w') as f:
        f.write(updated_html)
    
    print(f"Successfully updated index.html with card: {title} ({detail_id})")

if __name__ == "__main__":
    update_homepage()
