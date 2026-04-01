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
INDEX_PATH = os.path.join(SCRIPT_DIR, "../index.html")

def roman_to_int(roman):
    """Converts a Roman numeral to an integer."""
    if not roman: return None
    roman = roman.upper().strip()
    roman_map = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}
    # Special cases for additive notation common in tarot (e.g., IIII instead of IV)
    if roman == "IIII": return 4
    if roman == "VIIII": return 9
    if roman == "XIIII": return 14
    if roman == "XVIIII": return 19
    
    res = 0
    for i in range(len(roman)):
        if i > 0 and roman_map[roman[i]] > roman_map[roman[i - 1]]:
            res += roman_map[roman[i]] - 2 * roman_map[roman[i - 1]]
        else:
            res += roman_map[roman[i]]
    return res

def get_normalized_number(num_str):
    """Attempts to get a clean integer from a card_number string."""
    if not num_str: return None
    num_str = str(num_str).strip()
    if num_str.isdigit():
        return int(num_str)
    # Try Roman
    try:
        return roman_to_int(num_str)
    except:
        return None

# Combined mapping for Major Arcana numbers (Marseille Standard)
MAJOR_NUMBER_MAP = {
    0: "the_fool", 1: "the_juggler", 2: "the_popess", 3: "the_empress",
    4: "the_emperor", 5: "the_pope", 6: "the_lovers", 7: "the_chariot",
    8: "justice", 9: "the_hermit", 10: "wheel_of_fortune", 11: "strenght",
    12: "the_hanged_man", 13: "death", 14: "temperance", 15: "the_devil",
    16: "the_tower", 17: "the_star", 18: "the_moon", 19: "the_sun",
    20: "judgement", 21: "the_world"
}

SUIT_MAPPING = {
    "smtg:wands": "wands",
    "smtg:cups": "cups",
    "smtg:pentacles": "pentacles",
    "smtg:coins": "pentacles",
    "smtg:swords": "swords"
}

RANK_MAPPING = {
    "1": "ace", "2": "two", "3": "three", "4": "four", "5": "five",
    "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten"
}

COURT_KEYWORDS = {
    "king": "king", "re": "king", "roi": "king",
    "queen": "queen", "regina": "queen", "royne": "queen",
    "knight": "knight", "cavaliere": "knight", "chevalier": "knight",
    "page": "page", "fante": "page", "valet": "page", "knave": "page"
}

def github_to_local_path(url):
    """Converts a GitHub URL to a local relative path starting with 'website/'."""
    if not url:
        return ""
    if "website/" in url:
        return "website/" + url.split("website/")[1]
    return url

def get_generic_description(card_node, texts_data):
    """Retrieves generic description from texts.json["card_of_the_day"]."""
    cotd_texts = texts_data.get("card_of_the_day", {})
    
    types = card_node.get("@type", [])
    is_major = "smt:MajorArcana" in types
    is_minor = "smt:MinorArcana" in types
    
    num_val = get_normalized_number(card_node.get("card_number"))
    deck_id = card_node.get("contained_in_deck_id", {}).get("@id", "")
    
    if is_major:
        if num_val is not None:
            # Handle RWS Justice/Strength swap
            if "rider-waite-smith" in deck_id:
                if num_val == 8: key = "strenght"
                elif num_val == 11: key = "justice"
                else: key = MAJOR_NUMBER_MAP.get(num_val)
            else:
                key = MAJOR_NUMBER_MAP.get(num_val)
            
            if key:
                return cotd_texts.get("major_arcana", {}).get(key)
            
    if is_minor:
        suit_id = card_node.get("suit_id", {}).get("@id", "")
        suit_key = SUIT_MAPPING.get(suit_id)
        if not suit_key: return None
        
        title = card_node.get("title", "").lower()
        rank_key = None
        
        # 1. Try numeric rank
        if num_val is not None and str(num_val) in RANK_MAPPING:
            rank_key = RANK_MAPPING[str(num_val)]
        else:
            # 2. Try keyword mapping in title (for Court cards)
            for kw, r_key in COURT_KEYWORDS.items():
                if kw in title:
                    rank_key = r_key
                    break
        
        if rank_key:
            full_rank_key = f"{rank_key}_of_{suit_key}"
            return cotd_texts.get("minor_arcana", {}).get(suit_key, {}).get(full_rank_key)
            
    return None

def update_homepage():
    # Load Data
    with open(GRAPH_PATH, 'r') as f:
        graph_data = json.load(f)["@graph"]
    
    with open(TEXTS_PATH, 'r') as f:
        texts_root = json.load(f)
        texts_cards = texts_root.get("cards", {})

    # Filter for Deck Cards
    cards = [node for node in graph_data if "odi:DeckCard" in node.get("@type", [])]
    
    # Exclude Sola Busca deck
    cards = [c for c in cards if c.get("contained_in_deck_id", {}).get("@id") != "smtg:deck-sola-busca"]
    
    if not cards:
        print("No cards found in graph after filtering.")
        return

    # SELECTION LOGIC: Restore daily seeding so it changes every day
    import datetime
    today_seed = datetime.date.today().toordinal()
    random.seed(today_seed)
    
    # NEW SELECTION LOGIC: Only pick cards that have a valid generic description
    valid_cards_with_desc = []
    for c in cards:
        desc = get_generic_description(c, texts_root)
        if desc:
            valid_cards_with_desc.append((c, desc))
            
    if not valid_cards_with_desc:
        print("No cards with generic descriptions found.")
        return
        
    selected_card, desc = random.choice(valid_cards_with_desc)
    title = selected_card.get("title", "Unknown Card")
    print(f"Using generic description for: {title} ({selected_card['@id']})")

    if isinstance(desc, list): desc = desc[0]
    
    # Strip HTML tags and clean up whitespace
    desc = re.sub(r'<[^>]+>', '', desc)
    desc = " ".join(desc.split())
    
    import itertools
    

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
        # Minor Arcana: Suits box
        right_column_html = f'''
                                <div class="evolution-frame compact-evolution mt-0 mx-0">
                                    <div class="evolution-content">
                                        <h3 class="evolution-heading">
                                            The mundane mirrored. <br>Explore the <span class="highlight">four suits</span> and their meanings.
                                        </h3>
                                    </div>
            
                                    <a href="suits.html" id="dailyCardDiscoverMore" class="discover-more">
                                        <span class="discover-svg">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                                <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/>
                                            </svg>
                                        </span>
                                        <span class="discover-label">Discover <br>more</span>
                                    </a>
                                </div>'''
    else:
        # Major Arcana: Show Evolution
        all_evo = [c for c in cards if c.get("archetype_id", {}).get("@id") == archetype_id and c["@id"] != selected_card["@id"]]
        evolution_cards = list(itertools.islice(all_evo, 3))
        
        evo_html = ""
        for evo in evolution_cards:
            img_url = github_to_local_path(evo.get("image_url", {}).get("@id", ""))
            evo_id = evo.get("@id", "").replace("smtg:", "")
            evo_url = f"card.html?id={evo_id}"
            evo_html += f'''
                                            <div class="mini-card-thumb">
                                                <a href="{evo_url}">
                                                    <img src="{img_url}" alt="Related Version">
                                                </a>
                                                <span></span>
                                            </div>'''
        
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
                                        <span class="discover-label">Discover <br>more</span>
                                    </a>
                                </div>'''

    # Build the block replacement
    new_content = f'''
                        <h2 class="section-title text-center mb-3">CARD OF THE DAY</h2>
                        <div class="content-box content-box-large">
                            <div class="row align-items-center gy-4">
                                <div class="col-md-3 text-center">
                                    <a href="{detail_url}" id="dailyCardLink">
                                        <img src="{main_image}" id="dailyCardImage" class="img-fluid rounded-3" alt="Card of the Day" style="max-height: 320px; width: auto; display: block; margin: 0 auto; color: var(--deep-plum);">
                                    </a>
                                </div>
                                
                                <div class="col-md-5 px-md-4 text-md-start">
                                    <h3 id="dailyCardTitle" style="font-family: 'Cinzel', serif; font-size: 1.6rem; margin-bottom: 0.5rem; color: var(--deep-plum);">{title}</h3>
                                    <p id="dailyCardDesc" class="mb-0" style="font-size: 1.15rem; line-height: 1.5; color: var(--deep-plum);">{desc}</p>
                                </div>
                                
                                <div class="col-md-4" id="dailyCardRightCol">
{right_column_html}
                                </div>
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
