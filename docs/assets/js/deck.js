

async function initDeckPage() {
    // Get the Deck ID from the URL (e.g., deck.html?id=deck-sola-busca)
    const urlParams = new URLSearchParams(window.location.search);
    const deckId = urlParams.get('id');

    if (!deckId) {
        console.error("Deck ID missing in URL.");
        return;
    }

    try {
        // Fetch both data sources simultaneously
        const [kgResponse, textsResponse] = await Promise.all([
            fetch('assets/json/smtGraph.jsonld'),
            fetch('assets/json/texts.json')
        ]);

        const kgData = await kgResponse.json();
        const textsData = await textsResponse.json();
        const graph = kgData['@graph'];

        // Find the Deck in the Knowledge Graph
        const deckData = graph.find(obj => {
            const itemId = obj['@id'];
            return itemId === `smtg:${deckId}` || itemId === deckId;
        });

        if (deckData) {
            // Match the description from texts.json (handling underscores/hyphens)
            const normalizedId = deckId.replace(/-/g, '_');

            // Access decks in JSON
            const allDecks = textsData.decks || {};
            const extraTextsKey = Object.keys(allDecks).find(key => key.trim() === normalizedId);
            const extraTexts = allDecks[extraTextsKey];

            console.log("Deck description found:", extraTexts);
            console.log("Deck data successfully found:", deckData);
                fillDeckMetadata(deckData, graph, extraTexts);
            } else {
                console.warn("Deck not found in the Knowledge Graph.");
            }
            
            renderDeckCards(graph, deckId);
        
        } catch (error) {
        console.error("Error loading the deck page:", error);
    }
}


/**
 * Helper: Finds an entity in the graph by ID and returns its human-readable label
 */
function getEntityLabel(graph, entityData) {
    if (!entityData) return null;
    
    // If it's an array (like your author_id), take the first one or handle both
    const data = Array.isArray(entityData) ? entityData[0] : entityData;
    
    const idToFind = typeof data === 'string' ? data : data['@id'];
    if (!idToFind) return null;

    const entity = graph.find(obj => obj['@id'] === idToFind);
    
    if (!entity) {
        // Safe split: only if idToFind exists and contains ':'
        return idToFind.includes(':') ? idToFind.split(':').pop().replace(/-/g, ' ') : idToFind;
    }

    // Priority: Lineage Label > Full Name > Standard Labels
    if (entity.lineage_label) return entity.lineage_label;
    // 2 Check for Person's given and family name
    if (entity.given_name || entity.family_name) {
        const first = entity.given_name || "";
        const last = entity.family_name || "";
        return `${first} ${last}`.trim();
    }

    // Handle other labels
    return entity.label || 
           entity['rdfs:label'] || 
           entity.card_name || 
           idToFind.split(':').pop().replace(/-/g, ' ');
}

/**
 * Helper: Converts GitHub blob URLs to raw image URLs
 */
function getLocalImagePath(imageUrl) {
    if (!imageUrl) return 'assets/images/placeholder_card.jpg';
    if (imageUrl.includes('github.com') && imageUrl.includes('/blob/')) {
        return imageUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
    return imageUrl;
}

/**
 * Fills the HTML placeholders with deck metadata
 */
function fillDeckMetadata(deck, graph, extraTexts) {
    // 1. Titles and Description
    const title = deck.title || "Unknown Tarot Deck";
    document.getElementById('deck_title').innerHTML = `${title.toUpperCase()}`;
    document.getElementById('meta_deck_title').innerText = title;

    // 2. Description (Only from texts.json)
    const descriptionEl = document.getElementById('deck_description');
    
    if (extraTexts && extraTexts.long_description) {
        // Inserisce la descrizione lunga supportando i tag HTML (em, br, ecc.)
        descriptionEl.innerHTML = extraTexts.long_description;
    } else {
        // Messaggio di default se il mazzo non è ancora presente in texts.json
        descriptionEl.innerText = "Detailed description coming soon for this deck.";
    }

    /**
     * Internal Helper to handle Multiple Links (Authors/Illustrators)
     */
    const setMetaLink = (elementId, entityData) => {
        const el = document.getElementById(elementId);
        if (!el) return;

        // Clear the container (the <a> tag or its parent)
        el.innerHTML = ""; 

        // If there are no data
        if (!entityData || (Array.isArray(entityData) && entityData.length === 0)) {
            el.innerText = "-";
            return;
        }

        // Convert to array if it's a single object to use the same logic
        const dataArray = Array.isArray(entityData) ? entityData : [entityData];
        let itemsAdded = 0;

        dataArray.forEach((data, index) => {
            const label = getEntityLabel(graph, data);

            // if null, return nothing
            if (!label || label === "-") {
                return; 
            }

            const fullId = data['@id'] || data;
            const cleanId = fullId.replace('smtg:', '');

            // Check if it's a location - if so, NO LINK
            if (elementId === 'location_created') {
                const span = document.createElement('span');
                span.innerText = label;
                el.appendChild(span);
            } else {
                // Decide URL based on ID
                const link = document.createElement('a');
                link.innerText = label;

                if (elementId === 'deck_lineage_id') {
                    link.href = `deck.html?id=${cleanId}`;
                } else {
                    link.href = `person.html?id=${cleanId}`;
                }
                
                el.appendChild(link);
            }

            // Add a comma and space between names, but not after the last one
            if (index < dataArray.length - 1) {
                const nextLabel = getEntityLabel(graph, dataArray[index + 1]);
                if (nextLabel && nextLabel !== "-") {
                    el.appendChild(document.createTextNode(", "));
                }
            }
        });
    };


   // 3. Populate Linked Metadata
    // Note: Use full URL key for locationCreated if mapped that way in JSON-LD
    setMetaLink('location_created', deck.location_created);
    setMetaLink('author_id', deck.author_id || deck.hasAuthor);
    setMetaLink('illustrator_id', deck.illustrator_id);
    setMetaLink('deck_lineage_id', deck.deck_lineage_id);

    // 4. Populate Simple Text Metadata
    const setMetaText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value || "-";
    };

    // Handle multiple alternative titles
    const altTitleEl = document.getElementById('alternative_title');
    if (altTitleEl && deck.alternative_title) {
        if (Array.isArray(deck.alternative_title)) {
            altTitleEl.innerText = deck.alternative_title.join(', ');
        } else {
            altTitleEl.innerText = deck.alternative_title;
        }
    } else if (altTitleEl) {
        altTitleEl.innerText = "-";
    }

    setMetaText('publication_year', deck.publication_year);
    setMetaText('publisher', deck.publisher);
    setMetaText('current_card_count', deck.current_card_count);
    setMetaText('original_card_count', deck.original_card_count);
}

/**
 * Filters the graph for cards in this deck and injects them into the carousel
 */
function renderDeckCards(graph, deckId) {
    const carouselInner = document.getElementById('carouselInner');
    if (!carouselInner) return;
    
    carouselInner.innerHTML = ""; // Clear template

    // Filter cards where 'isContainedIn' matches our deckId
    const deckCards = graph.filter(obj => {
        const container = obj.isContainedIn || obj.contained_in_deck_id;
        if (!container) return false;

        const containerData = Array.isArray(container) ? container[0] : container;
        const targetId = typeof containerData === 'string' ? containerData : containerData['@id'];

        return targetId === `smtg:${deckId}` || targetId === deckId;
    });

    if (deckCards.length === 0) {
        carouselInner.innerHTML = "<p class='text-center w-100'>No cards found for this deck.</p>";
        return;
    }

    // Sort cards numerically if possible (optional)
    // const sortedCards = deckCards.sort((a, b) => (a.isNumber || 0) - (b.isNumber || 0));
    // Sorting logic for Major Arcana (by number) and Minor Arcana (by suit then rank)
    // Helper to parse expected Roman Numerals like "II", "X", etc.
    const romanToInt = (s) => {
        if (!s) return 0;
        const romanMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
        let total = 0, current = 0, prev = 0;
        for (let i = s.length - 1; i >= 0; i--) {
            current = romanMap[s[i].toUpperCase()];
            if (!current) return parseInt(s, 10) || 0; // fallback to Arabic numbers
            if (current < prev) total -= current;
            else total += current;
            prev = current;
        }
        return total;
    };

    // Helper for Minor Arcana ranks (Ace, 2-10, Page/Knave, Knight, Queen, King)
    const getMinorRank = (card) => {
        // First try to parse the number if it's standard 1-10
        const num = parseInt(card.card_number, 10);
        if (!isNaN(num)) return num;
        
        // Next, fallback to checking titles for court cards or Aces
        const title = (card.title || "").toLowerCase();
        if (title.includes('ace')) return 1;
        if (title.includes('page') || title.includes('knave')) return 11;
        if (title.includes('knight')) return 12;
        if (title.includes('queen')) return 13;
        if (title.includes('king')) return 14;
        
        return 0; // Catch-all
    };

    const sortedCards = deckCards.sort((a, b) => {
        const typeA = Array.isArray(a['@type']) ? a['@type'] : [a['@type']];
        const typeB = Array.isArray(b['@type']) ? b['@type'] : [b['@type']];
        
        const isMajorA = typeA.includes('smt:MajorArcana');
        const isMajorB = typeB.includes('smt:MajorArcana');
        
        // 1. Prioritize Major Arcana over Minor Arcana
        if (isMajorA && !isMajorB) return -1;
        if (!isMajorA && isMajorB) return 1;
        
        // 2. Both are Major Arcana: sort by their Roman Numeral
        if (isMajorA && isMajorB) {
            return romanToInt(a.card_number) - romanToInt(b.card_number);
        }
        
        // 3. Both are Minor Arcana: Sort alphabetically by suit
        const getSuitId = (card) => card.suit_id ? (card.suit_id['@id'] || card.suit_id) : '';
        const suitA = getSuitId(a);
        const suitB = getSuitId(b);
        
        if (suitA !== suitB) {
            return suitA.localeCompare(suitB);
        }
        
        // 4. Same Suit: Sort by inherent rank (1 to 14)
        return getMinorRank(a) - getMinorRank(b);
    });

    // Generate HTML for each carousel item
    sortedCards.forEach((card, index) => {
        const fullId = card['@id'];
        const cleanCardId = fullId.replace('smtg:', '');
       
        const rawUrl = card.image_url ? card.image_url['@id'] : null;
        const imagePath = getLocalImagePath(rawUrl);

        const itemHtml = `
            <div class="multi-carousel-item" data-index="${index}">
                <a href="card.html?id=${cleanCardId}" class="img-container deck-img-container" style="display: block; text-decoration: none; color: inherit;">
                    <img src="${imagePath}" alt="${card.title || 'Tarot Card'}" class="deck-card-img" style="display: block; margin: 0 auto;" onerror="this.src='assets/images/placeholder_card.jpg';" />
                    <div class="card-overlay">
                        <span class="card-number-overlay">${card.card_number || ""}</span>
                        <h3 class="card-title-overlay">${card.title || ""}</h3>
                    </div>
                </a>
            </div>
        `;
        carouselInner.insertAdjacentHTML('beforeend', itemHtml);
    });

    // Re-initialize carousel controls (arrows/scroll) after items are added to DOM
    // if (typeof initCarouselLogic === "function") {
    //     initCarouselLogic();
    // }
    if (window.initCarouselLogic) {
        window.initCarouselLogic();
    }
}

// Start execution when the document is ready
document.addEventListener('DOMContentLoaded', initDeckPage);