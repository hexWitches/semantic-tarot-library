// --- HOMEPAGE --- //
document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.getElementById('mainNavbar');
  const homepageContent = document.getElementById('homepageContent');
  const scrollThreshold = 50;

  if (navbar && homepageContent && window.scrollY > scrollThreshold) {
    navbar.classList.remove('initial-navbar');
    navbar.classList.add('scrolled-navbar');
    homepageContent.classList.add('revealed');
  }

  window.addEventListener('scroll', () => {
    if (!navbar || !homepageContent) return;

    if (window.scrollY > scrollThreshold) {
      if (navbar.classList.contains('initial-navbar')) {
        navbar.classList.remove('initial-navbar');
        navbar.classList.add('scrolled-navbar');
        homepageContent.classList.add('revealed');
      }
    } else {
      if (navbar.classList.contains('scrolled-navbar')) {
        navbar.classList.remove('scrolled-navbar');
        navbar.classList.add('initial-navbar');
      }
    }
  });

  initCarouselLogic();
  if (document.getElementById('ontology-graph')) {
    initOntologyPanning();
  }
});

// SEARCH FUNCTIONALITY //
document.addEventListener('DOMContentLoaded', () => {
    // Detect whether we are running from the repo root (index.html) or from inside website/
    const isRoot = !window.location.pathname.includes('/website/');
    const basePath = isRoot ? 'website/' : '';

    let smtData = null;
    let textsData = null;
    let isDataLoaded = false;
    let allKeywords = [];

    const searchInputs = document.querySelectorAll('input[type="search"]');

    let resultsOverlay = document.getElementById('search-results-overlay');
    if (!resultsOverlay) {
        resultsOverlay = document.createElement('div');
        resultsOverlay.id = 'search-results-overlay';
        resultsOverlay.className = 'search-results-overlay';
        document.body.appendChild(resultsOverlay);
    }

    // Load required data
    async function loadSearchData() {
        try {
            const [graphRes, textsRes] = await Promise.all([
                fetch(`${basePath}assets/json/smtGraph.jsonld`),
                fetch(`${basePath}assets/json/texts.json`)
            ]);
            smtData = await graphRes.json();
            textsData = await textsRes.json();

            const keywordsSet = new Set();

            const addKeyword = (k) => {
                if (!k || typeof k !== 'string') return;
                const trimmed = k.trim();
                if (trimmed.length < 2) return;
                keywordsSet.add(trimmed);

                if (trimmed.includes(' ')) {
                    trimmed.split(/\s+/).forEach(word => {
                        const w = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
                        if (w.length > 3) keywordsSet.add(w);
                    });
                }
            };

            (smtData['@graph'] || []).forEach(node => {
                addKeyword(node.title);
                addKeyword(node.given_name);
                addKeyword(node.family_name);
                addKeyword(node.suit);
                addKeyword(node.origin);
                addKeyword(node.lineage);
                addKeyword(node.deck_lineage);
                addKeyword(node.arcana_type);
                if (node.artist) addKeyword(node.artist);
                if (Array.isArray(node.author_id)) node.author_id.forEach(a => addKeyword(a['@id']?.split(':').pop()));
            });

            const extractFromTexts = (obj) => {
                Object.values(obj || {}).forEach(data => {
                    if (data.keywords) data.keywords.forEach(k => addKeyword(k));
                    if (data.card_name) addKeyword(data.card_name)
                });
            };
            extractFromTexts(textsData.decks);
            extractFromTexts(textsData.cards);
            extractFromTexts(textsData.person);

            allKeywords = Array.from(keywordsSet).sort((a, b) => a.length - b.length);

            isDataLoaded = true;
            console.log("Search indexing complete. Keywords:", allKeywords.length);
        } catch (error) {
            console.error("Error loading search data:", error);
        }
    }

    // fuzzy search
    function performSearch(query) {
        if (!isDataLoaded || !query || query.length < 2) {
            resultsOverlay.classList.remove('show');
            return;
        }

        const q = query.toLowerCase();
        const results = {
            cards: [],
            decks: [],
            persons: []
        };

        const graph = smtData['@graph'] || [];
        graph.forEach(node => {
            const title = (node.title || "").toLowerCase();
            const givenName = node.given_name || "";
            const familyName = node.family_name || "";
            const fullName = `${givenName} ${familyName}`.trim();
            const fullNameLower = fullName.toLowerCase();
            
            const type = node['@type'] || "";
            const isCard = Array.isArray(type) ? type.includes('odi:DeckCard') : type === 'odi:DeckCard';
            const isDeck = Array.isArray(type) ? type.includes('odi:TarotDeck') : type === 'odi:TarotDeck';
            const isPerson = Array.isArray(type) ? type.includes('odi:Person') : type === 'odi:Person';

            if (title.includes(q) || (isPerson && fullNameLower.includes(q))) {
                const id = node['@id'].split(/[:\/]/).pop();
                const resultObj = { 
                    id, 
                    title: node.title || fullName || formatName(id), 
                    image: getCoverImageForNode(node, graph) 
                };

                if (isCard) results.cards.push(resultObj);
                else if (isDeck) results.decks.push(resultObj);
                else if (isPerson) results.persons.push(resultObj);
            }
        });

        Object.entries(textsData.decks || {}).forEach(([deckId, data]) => {
            const keywords = (data.keywords || []).map(k => k.toLowerCase());
            if (keywords.some(k => k.includes(q))) {
                const cleanId = deckId.replace('deck_', 'deck-').replace(/_/g, '-');
                if (!results.decks.find(d => d.id === cleanId)) {
                    const graphNode = graph.find(n => n['@id'].split(/[:\/]/).pop() === cleanId);
                    results.decks.push({ id: cleanId, title: graphNode?.title || formatName(deckId), image: getCoverImageForNode(graphNode, graph) });
                }
            }
        });

        Object.entries(textsData.cards || {}).forEach(([cardId, data]) => {
            const keywords = (data.keywords || []).map(k => k.toLowerCase());
            if (keywords.some(k => k.includes(q))) {
                const cleanId = cardId.replace('card_', 'card-').replace(/_/g, '-');
                if (!results.cards.find(c => c.id === cleanId)) {
                    let graphNode = graph.find(n => n['@id'].split(/[:\/]/).pop() === cleanId);
                    if (!graphNode && data.card_name) {
                        // Fallback: Mismatched ID, match by exact title instead
                        graphNode = graph.find(n => n.title === data.card_name && (n['@type'] === 'odi:DeckCard' || (Array.isArray(n['@type']) && n['@type'].includes('odi:DeckCard'))));
                    }
                    results.cards.push({ id: cleanId, title: data.card_name || formatName(cardId), image: getCoverImageForNode(graphNode, graph) });
                }
            }
        });

        renderResults(results);
    }

    // Helper to format generic names from IDs
    function formatName(id) {
        return id.replace(/^(person|deck|card)_/, '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // Render results to the overlay
    function renderResults(results) {
        const hasResults = results.cards.length > 0 || results.decks.length > 0 || results.persons.length > 0;

        if (!hasResults) {
            resultsOverlay.innerHTML = '<div class="p-4 text-center">No results found.</div>';
            resultsOverlay.classList.add('show');
            return;
        }

        let html = '<div class="search-results-content">';

        // --- DECKS ---
        if (results.decks.length > 0) {
            html += `<div class="search-section"><h4>Decks</h4><div class="search-scroller">`;
            results.decks.forEach(deck => {
                const imgUrl = getImageUrl(deck.image);
                html += `
                    <a href="${basePath}deck.html?id=${deck.id}" class="search-result-item deck-result">
                        <div class="search-card-img">
                            <img src="${imgUrl}" alt="${deck.title}" loading="lazy" onerror="this.src='${basePath}assets/images/placeholder_card.jpg';">
                        </div>
                        <div class="search-item-info">${deck.title}</div>
                    </a>`;
            });
            html += `</div></div>`;
        }

        // --- PERSONS ---
        if (results.persons.length > 0) {
            html += `<div class="search-section"><h4>Persons</h4><div class="search-scroller">`;
            results.persons.forEach(person => {
                const generalPlaceholder = `${basePath}assets/images/explore/people/portrait-placeholder.jpg`;
                
                let imgUrl = getImageUrl(person.image, 'person');
                
                html += `
                    <a href="${basePath}person.html?id=${person.id}" class="search-result-item person-result">
                        <div class="person-img-wrapper">
                            <img src="${imgUrl}" alt="${person.title}" onerror="this.src='${generalPlaceholder}';">
                        </div>
                        <div class="search-item-info">${person.title}</div>
                    </a>`;
            });
            html += `</div></div>`;
        }

        // --- CARDS ---
        if (results.cards.length > 0) {
            html += `<div class="search-section"><h4>Cards</h4><div class="search-scroller">`;
            results.cards.forEach(card => {
                const imgUrl = getImageUrl(card.image);
                html += `
                    <a href="${basePath}card.html?id=${card.id}" class="search-result-item card-result">
                        <div class="search-card-img">
                            <img src="${imgUrl}" alt="${card.title}" loading="lazy" onerror="this.src='${basePath}assets/images/placeholder_card.jpg';">
                        </div>
                        <div class="search-item-info">${card.title}</div>
                    </a>`;
            });
            html += `</div></div>`;
        }

        html += '</div>';
        resultsOverlay.innerHTML = html;
        resultsOverlay.classList.add('show');
    }

    function getCoverImageForNode(node, graph) {
        if (!node) return null;
        
        const portraitUrl = node.person_portrait_url?.['@id'] || node.person_portrait_url;
        if (portraitUrl && typeof portraitUrl === 'string') return portraitUrl;

        const imageUrl = node.image_url?.['@id'] || node.image_url;
        if (imageUrl && typeof imageUrl === 'string') return imageUrl;

        const isPerson = node['@type'] === 'odi:Person' || (Array.isArray(node['@type']) && node['@type'].includes('odi:Person'));
        if (isPerson) return null;
        if (graph) {
            const nodeId = node['@id'];
            const childCards = graph.filter(n => {
                // Deck check
                let deckId = null;
                if (n.contained_in_deck_id) {
                    deckId = typeof n.contained_in_deck_id === 'string'
                        ? n.contained_in_deck_id
                        : n.contained_in_deck_id['@id'];
                }

                let isAuthor = false;
                if (n.author_id) {
                    const authors = Array.isArray(n.author_id) ? n.author_id : [n.author_id];
                    isAuthor = authors.some(a => (typeof a === 'string' ? a : a['@id']) === nodeId);
                }
                let isIllustrator = false;
                if (n.illustrator_id) {
                    const illusts = Array.isArray(n.illustrator_id) ? n.illustrator_id : [n.illustrator_id];
                    isIllustrator = illusts.some(i => (typeof i === 'string' ? i : i['@id']) === nodeId);
                }

                return (deckId === nodeId || isAuthor || isIllustrator) && n.image_url?.['@id'];
            });

            if (childCards.length > 0) {
                const fool = childCards.find(c => {
                    const name = (c.title || '').toLowerCase();
                    const num = c.card_number;
                    return name.includes('fool') || num === '0' || num === '00' || num === 'I' || name.includes('matto');
                });

                if (fool) return fool.image_url['@id'];

                childCards.sort((a, b) => {
                    const valA = parseInt(a.card_number) || 999;
                    const valB = parseInt(b.card_number) || 999;
                    return valA - valB;
                });
                return childCards[0].image_url['@id'];
            }
        }
        return null;
    }

    // Convert GitHub URLs
    function getImageUrl(imgId, type = 'card') {
        if (!imgId || typeof imgId !== 'string') {
            if (type === 'person') {
                return `${basePath}assets/images/explore/people/portrait-placeholder.jpg`;
            }
            return `${basePath}assets/images/placeholder_card.jpg`;
        }
        if (imgId.includes('github.com') && imgId.includes('/blob/')) {
            return imgId
                .replace('github.com', 'raw.githubusercontent.com')
                .replace('/blob/', '/');
        }
        return imgId;
    }

    // Update the ghost suggestion text
    function updateSuggestion(input) {
        const wrapper = input.parentElement;
        const ghost = wrapper.querySelector('.search-suggestion-ghost');
        if (!ghost) return;

        const val = input.value;
        if (!val || !isDataLoaded) {
            ghost.textContent = '';
            return;
        }

        const match = allKeywords.find(k => k.toLowerCase().startsWith(val.toLowerCase()));
        if (match && match.toLowerCase() !== val.toLowerCase()) {
            const style = window.getComputedStyle(input);
            const props = [
                'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom',
                'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
                'letterSpacing', 'textTransform', 'textIndent',
                'lineHeight', 'boxSizing'
            ];
            props.forEach(prop => {
                ghost.style[prop] = style[prop];
            });

            ghost.innerHTML = `<span style="color: transparent;">${val}</span>${match.substring(val.length)}`;
        } else {
            ghost.innerHTML = '';
        }
    }

    searchInputs.forEach(input => {
        const form = input.closest('form');
        const clearBtn = input.parentElement.querySelector('.search-clear-btn');

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                input.value = '';
                input.focus();
                input.dispatchEvent(new Event('input'));
            });
        }

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            updateSuggestion(input);
            performSearch(query);
        });

        input.addEventListener('keydown', (e) => {
            const wrapper = input.parentElement;
            const ghost = wrapper.querySelector('.search-suggestion-ghost');

            if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghost && ghost.textContent) {
                if (input.selectionStart === input.value.length) {
                    e.preventDefault();
                    input.value = ghost.textContent;
                    ghost.textContent = '';
                    performSearch(input.value);
                }
            } else if (e.key === 'Escape') {
                resultsOverlay.classList.remove('show');
                if (ghost) ghost.textContent = '';
            }
        });

        if (form) {
            form.addEventListener('submit', (e) => {
                const query = input.value.trim();
                if (query) {
                    e.preventDefault();
                    window.location.href = `${basePath}collection.html?search=${encodeURIComponent(query)}`;
                }
            });
        }
    });

    document.addEventListener('click', (e) => {
        if (!resultsOverlay.contains(e.target) && !Array.from(searchInputs).some(i => i.contains(e.target))) {
            resultsOverlay.classList.remove('show');
        }
    });

    loadSearchData();
});

// CARD OF THE DAY //
(function () {
    const GRAPH_PATH = "website/assets/json/smtGraph.jsonld";
    const TEXTS_PATH = "website/assets/json/texts.json";

    // ----- Constants for Mapping -----
    const MAJOR_NUMBER_MAP = {
        0: "the_fool", 1: "the_juggler", 2: "the_popess", 3: "the_empress",
        4: "the_emperor", 5: "the_pope", 6: "the_lovers", 7: "the_chariot",
        8: "justice", 9: "the_hermit", 10: "wheel_of_fortune", 11: "strenght",
        12: "the_hanged_man", 13: "death", 14: "temperance", 15: "the_devil",
        16: "the_tower", 17: "the_star", 18: "the_moon", 19: "the_sun",
        20: "judgement", 21: "the_world"
    };

    const SUIT_MAPPING = {
        "smtg:wands": "wands",
        "smtg:cups": "cups",
        "smtg:pentacles": "pentacles",
        "smtg:coins": "pentacles",
        "smtg:swords": "swords"
    };

    const RANK_MAPPING = {
        "1": "ace", "2": "two", "3": "three", "4": "four", "5": "five",
        "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten"
    };

    const COURT_KEYWORDS = {
        "king": "king", "re": "king", "roi": "king",
        "queen": "queen", "regina": "queen", "royne": "queen",
        "knight": "knight", "cavaliere": "knight", "chevalier": "knight",
        "page": "page", "fante": "page", "valet": "page", "knave": "page"
    };

    // ----- Roman Numeral Helper -----
    function romanToInt(roman) {
        if (!roman) return null;
        roman = roman.toUpperCase().trim();
        const romanMap = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000};
        if (roman === "IIII") return 4;
        if (roman === "VIIII") return 9;
        if (roman === "XIIII") return 14;
        if (roman === "XVIIII") return 19;
        
        let res = 0;
        for (let i = 0; i < roman.length; i++) {
            const current = romanMap[roman[i]];
            const next = romanMap[roman[i + 1]];
            if (next && current < next) {
                res += next - current;
                i++;
            } else {
                res += current;
            }
        }
        return res;
    }

    function getNormalizedNumber(numStr) {
        if (!numStr) return null;
        numStr = String(numStr).trim();
        if (/^\d+$/.test(numStr)) return parseInt(numStr, 10);
        return romanToInt(numStr);
    }

    function githubUrlToLocal(url) {
        const marker = "website/";
        const idx = url.indexOf(marker);
        return idx !== -1 ? url.slice(idx) : url;
    }

    function graphIdToCardParam(graphId) {
        return graphId.replace(/^smtg:/, "");
    }

    function getGenericDescription(cardNode, textsData) {
        const cotdTexts = textsData["card_of_the_day"] || {};
        const types = Array.isArray(cardNode["@type"]) ? cardNode["@type"] : [cardNode["@type"]];
        const isMajor = types.includes("smt:MajorArcana");
        const isMinor = types.includes("smt:MinorArcana");
        const numVal = getNormalizedNumber(cardNode.card_number);
        const deckId = cardNode.contained_in_deck_id?.["@id"] || "";

        if (isMajor && numVal !== null) {
            let key = MAJOR_NUMBER_MAP[numVal];
            if (deckId.includes("rider-waite-smith")) {
                if (numVal === 8) key = "strenght";
                else if (numVal === 11) key = "justice";
            }
            if (key) return cotdTexts.major_arcana?.[key];
        }

        if (isMinor) {
            const suitId = cardNode.suit_id?.["@id"] || "";
            const suitKey = SUIT_MAPPING[suitId];
            if (!suitKey) return null;

            const title = (cardNode.title || "").toLowerCase();
            let rankKey = RANK_MAPPING[String(numVal)];

            if (!rankKey) {
                for (const [kw, rKey] of Object.entries(COURT_KEYWORDS)) {
                    if (title.includes(kw)) {
                        rankKey = rKey;
                        break;
                    }
                }
            }

            if (rankKey) {
                const fullRankKey = `${rankKey}_of_${suitKey}`;
                return cotdTexts.minor_arcana?.[suitKey]?.[fullRankKey];
            }
        }
        return null;
    }

    async function loadCardOfTheDay() {
        try {
            const [graphResponse, textsResponse] = await Promise.all([
                fetch(GRAPH_PATH),
                fetch(TEXTS_PATH)
            ]);
            if (!graphResponse.ok || !textsResponse.ok) return;

            const graphData = await graphResponse.json();
            const textsData = await textsResponse.json();

            let cards = (graphData["@graph"] || []).filter(node => {
                const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
                return types.includes("odi:DeckCard");
            });

            // Exclude Sola Busca
            cards = cards.filter(c => c.contained_in_deck_id?.["@id"] !== "smtg:deck-sola-busca");

            if (cards.length === 0) return;

            // --- Daily Seed Selection ---
            const todayStr = new Date().toISOString().slice(0, 10);
            let seed = 0;
            for (let i = 0; i < todayStr.length; i++) {
                seed = ((seed << 5) - seed) + todayStr.charCodeAt(i);
                seed |= 0;
            }
            const absSeed = Math.abs(seed);

            // Filter to cards matching the generic description criteria
            const validCards = cards.filter(c => !!getGenericDescription(c, textsData));
            const pool = validCards.length > 0 ? validCards : cards;
            const selected = pool[absSeed % pool.length];

            const description = getGenericDescription(selected, textsData) || "Explore the symbolism and history of this card.";
            const title = selected.title || "Tarot Card";
            const localImg = githubUrlToLocal(selected.image_url?.["@id"] || "");
            const cardParam = graphIdToCardParam(selected["@id"] || "");
            const cardLink = `website/card.html?id=${cardParam}`;

            // Update DOM
            const imgEl   = document.getElementById("dailyCardImage");
            const linkEl  = document.getElementById("dailyCardLink");
            const titleEl = document.getElementById("dailyCardTitle");
            const descEl  = document.getElementById("dailyCardDesc");

            if (imgEl)   { imgEl.src = localImg; imgEl.alt = title; }
            if (linkEl)  { linkEl.href = cardLink; }
            if (titleEl) { titleEl.textContent = title; }
            if (descEl)  { descEl.innerHTML = description; }

            // --- Update Right Column (Evolution or Suits) ---
            const rightColEl = document.getElementById("dailyCardRightCol");
            if (rightColEl) {
                const types = Array.isArray(selected["@type"]) ? selected["@type"] : [selected["@type"]];
                const isMinor = types.includes("smt:MinorArcana");
                let rightColHtml = "";

                if (isMinor) {
                    rightColHtml = `
                        <div class="evolution-frame compact-evolution mt-0 mx-0">
                            <div class="evolution-content">
                                <h3 class="evolution-heading">
                                    The mundane mirrored. <br>Explore the <span class="highlight">four suits</span> and their meanings.
                                </h3>
                            </div>
                            <a href="website/deepening.html?id=suits_page" id="dailyCardDiscoverMore" class="discover-more">
                                <span class="discover-svg">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                        <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/>
                                    </svg>
                                </span>
                                <span class="discover-label">Discover <br>more</span>
                            </a>
                        </div>`;
                } else {
                    // Major Arcana: Find Evolution
                    const archetypeId = selected.archetype_id?.["@id"];
                    let archetypeName = title;
                    if (archetypeId) {
                        const archetypeNode = graphData["@graph"]?.find(n => n["@id"] === archetypeId);
                        if (archetypeNode) {
                            const prefLabel = archetypeNode["http://www.w3.org/2004/02/skos/core#prefLabel"];
                            archetypeName = (typeof prefLabel === 'object' ? prefLabel?.["@value"] : prefLabel) || title;
                        }
                    }

                    const evolutionCards = cards.filter(c => 
                        c.archetype_id?.["@id"] === archetypeId && 
                        c["@id"] !== selected["@id"]
                    ).slice(0, 3);

                    let evoHtml = "";
                    evolutionCards.forEach(evo => {
                        const evoImg = githubUrlToLocal(evo.image_url?.["@id"] || "");
                        const evoParam = graphIdToCardParam(evo["@id"] || "");
                        const evoUrl = `website/card.html?id=${evoParam}`;
                        evoHtml += `
                            <div class="mini-card-thumb">
                                <a href="${evoUrl}">
                                    <img src="${evoImg}" alt="Related Version">
                                </a>
                                <span></span>
                            </div>`;
                    });

                    const archetypeParam = archetypeId ? graphIdToCardParam(archetypeId) : "";
                    const archetypeLink = archetypeParam ? `website/deepening.html?id=${archetypeParam}` : cardLink;

                    rightColHtml = `
                        <div class="evolution-frame compact-evolution mt-0 mx-0">
                            <div class="evolution-content">
                                <h3 class="evolution-heading">
                                    One archetype, infinite interpretations. Discover the many faces of <span id="dailyCardArchetype" class="highlight">${archetypeName}</span>.
                                </h3>
                                <div id="dailyCardEvolution" class="archetype-comparison-preview">
                                    ${evoHtml}
                                </div>
                            </div>
                            <a href="${archetypeLink}" id="dailyCardDiscoverMore" class="discover-more">
                                <span class="discover-svg">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                        <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/>
                                    </svg>
                                </span>
                                <span class="discover-label">Discover <br>more</span>
                            </a>
                        </div>`;
                }
                rightColEl.innerHTML = rightColHtml;
            }

            // --- Ensure Left-Aligned Layout ---
            const cotdRow = imgEl.closest('.row');
            if (cotdRow) {
                // Ensure vertical centering but horizontal left-alignment for content
                cotdRow.classList.remove('align-items-start');
                cotdRow.classList.add('align-items-center');
                
                // Keep image at consistent height
                imgEl.style.maxHeight = "320px";

                const textCol = titleEl.closest('.col-md-5');
                if (textCol) {
                    textCol.classList.remove('text-center');
                    textCol.classList.add('text-md-start');
                }

                // Handle section title (Center it as requested)
                const sectionTitle = cotdRow.parentElement.querySelector('.section-title');
                if (sectionTitle) {
                    sectionTitle.classList.remove('text-start');
                    sectionTitle.classList.add('text-center');
                    sectionTitle.classList.replace('mb-4', 'mb-3'); // Small space: mb-3
                    sectionTitle.classList.replace('mb-2', 'mb-3'); 
                }
            }

        } catch (err) {
            console.error("Card of the Day error:", err);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadCardOfTheDay);
    } else {
        loadCardOfTheDay();
    }
})();

// Discovery section carousel
window.initCarouselLogic = function () {
  const carousel = document.getElementById("multiCarousel");
  const carouselInner = document.getElementById("carouselInner");
  if (!carousel || !carouselInner) return;

  // Setup Clones for Infinite Loop
  const originalItems = Array.from(carouselInner.querySelectorAll(".multi-carousel-item:not(.clone)"));
  const totalItems = originalItems.length;
  if (totalItems === 0) return;

  const firstClone = originalItems[0].cloneNode(true);
  const lastClone = originalItems[totalItems - 1].cloneNode(true);
  firstClone.classList.add('clone');
  lastClone.classList.add('clone');

  carouselInner.appendChild(firstClone);
  carouselInner.insertBefore(lastClone, originalItems[0]);

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  function getScrollAmount() {
    const item = carouselInner.querySelector('.multi-carousel-item');
    return item ? item.offsetWidth : carouselInner.clientWidth;
  }

  // Set initial position to the first real item
  const itemWidth = getScrollAmount();
  carouselInner.scrollLeft = itemWidth;

  let isTransitioning = false;

  function handleLoop() {
    const scrollLeft = carouselInner.scrollLeft;
    const currentItemWidth = getScrollAmount();

    if (scrollLeft >= currentItemWidth * (totalItems + 1) - 10) {
      carouselInner.scrollTo({ left: currentItemWidth, behavior: 'auto' });
    }

    else if (scrollLeft <= 10) {
      carouselInner.scrollTo({ left: currentItemWidth * totalItems, behavior: 'auto' });
    }
    isTransitioning = false;
  }

  function scrollNext() {
    if (isTransitioning) return;
    isTransitioning = true;
    const currentItemWidth = getScrollAmount();
    carouselInner.scrollBy({ left: currentItemWidth, behavior: 'smooth' });
  }

  function scrollPrev() {
    if (isTransitioning) return;
    isTransitioning = true;
    const currentItemWidth = getScrollAmount();
    carouselInner.scrollBy({ left: -currentItemWidth, behavior: 'smooth' });
  }

  if (nextBtn) nextBtn.onclick = scrollNext;
  if (prevBtn) prevBtn.onclick = scrollPrev;

  window.addEventListener('resize', () => {
    const currentItemWidth = getScrollAmount();
    const currentIndex = Math.round(carouselInner.scrollLeft / currentItemWidth);
    carouselInner.scrollTo({ left: currentIndex * currentItemWidth, behavior: 'auto' });
  });

  carouselInner.addEventListener("scroll", () => {
    clearTimeout(window.carouselJumpTimeout);
    window.carouselJumpTimeout = setTimeout(handleLoop, 600);
  }, { passive: true });

  let autoAdvanceInterval;
  let isHovering = false;

  function startAutoAdvance() {
    clearInterval(autoAdvanceInterval);
    autoAdvanceInterval = setInterval(() => {
      if (!isHovering) scrollNext();
    }, 8000);
  }

  startAutoAdvance();

  carousel.addEventListener("mouseenter", () => isHovering = true);
  carousel.addEventListener("mouseleave", () => {
    isHovering = false;
    startAutoAdvance();
  });

  carouselInner.addEventListener("scroll", () => {
    clearInterval(autoAdvanceInterval);
    if (!isHovering) {
      startAutoAdvance();
    }
  }, { passive: true });

  document.addEventListener("keydown", function (e) {
    if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.isContentEditable) return;

    switch (e.key) {
      case "ArrowLeft":
        scrollPrev();
        break;
      case "ArrowRight":
        scrollNext();
        break;
    }
  });
};

// GRAPH VISUALIZATION
(function () {
  'use strict';

  const ontologyTree = {
    name: 'Thing',
    description: 'Root class (owl:Thing) — the implicit superclass of all ontology classes.',
    prefix: 'owl',
    children: [
      {
        name: 'DeckCard',
        prefix: 'odi',
        description: 'A card belonging to a tarot deck.',
        children: [
          {
            name: 'MajorArcana',
            prefix: 'smt',
            description: 'The 22 cards representing universal archetypal and symbolic themes',
            value: 94
          },
          {
            name: 'MinorArcana',
            prefix: 'smt',
            description: 'The 56 cards composed of four suits (pentacles, swords, wands, cups).',
            children: [
              {
                name: 'NumberedCard',
                prefix: 'smt',
                description: 'A category of minor arcana cards identified by a number, ranging from Ace to Ten',
                value: 167
              },
              {
                name: 'CourtCard',
                prefix: 'smt',
                description: 'A category of minor arcana cards representing the four ranks: pages, knights, queens and kings.',
                value: 64
              }
            ]
          }
        ]
      },
      {
        name: 'Concept',
        prefix: 'skos',
        description: 'A SKOS concept used for archetype and symbolic figure classification within the library.',
        children: [
          {
            name: 'Archetype',
            prefix: 'smt',
            description: 'The universal concept depicted in the Major Arcana card.',
            value: 22
          },
          {
            name: 'SymbolicFigure',
            prefix: 'smt',
            description: 'A symbolic element depicted in the Major Arcana card (animal, object, etc.).',
            value: 41
          }
        ]
      },
      {
        name: 'Person',
        prefix: 'odi',
        description: 'A person related to tarot decks or cards.',
        value: 10
      },
      {
        name: 'TarotDeck',
        prefix: 'odi',
        description: 'A tarot deck contained in the SMT Library.',
        value: 6
      },
      {
        name: 'Place',
        prefix: 'odi',
        description: "A geographic location related to a deck or current conservation site.",
        value: 9
      },
      {
        name: 'DeckLineage',
        prefix: 'smt',
        description: 'A conceptual category representing a specific historical tradition from which individual tarot deck editions or versions derive their structure and imagery.',
        value: 3
      },
      {
        name: 'Dataset',
        prefix: 'void',
        description: 'The VoID dataset descriptor for the SMT graph itself.',
        value: 1
      }
    ]
  };

  const colorMap = {
    // DeckCard family — amethyst purples
    'DeckCard': '#3D1F7A',
    'MajorArcana': '#6B4FA0',
    'MinorArcana': '#9C78C3',
    'NumberedCard': '#C4AADE',
    'CourtCard': '#DDD0EF',

    // Concept family — warm reds
    'Concept': '#AB3428',
    'Archetype': '#C4594D',
    'SymbolicFigure': '#D98880',

    // Other classes
    'Person': '#5A3A31',
    'TarotDeck': '#C47D22',
    'Place': '#9ABCA7',
    'DeckLineage': '#B5D6D6',
    'Dataset': '#9B9B9B'
  };

  // Text colour for arc labels — dark if segment is very light
  const lightSegments = new Set(['CourtCard', 'DeckLineage', 'Dataset', 'Place', 'NumberedCard']);

  // Legend groups
  const legendGroups = [
    {
      label: 'Cards',
      items: ['DeckCard', 'MajorArcana', 'MinorArcana', 'NumberedCard', 'CourtCard']
    },
    {
      label: 'Concepts',
      items: ['Concept', 'Archetype', 'SymbolicFigure']
    },
    {
      label: 'Other Classes',
      items: ['Person', 'TarotDeck', 'Place', 'DeckLineage', 'Dataset']
    }
  ];

  function initKnowledgeGraphChart() {
    const container = document.getElementById('kg-chart-container');
    const tooltip = document.getElementById('kg-tooltip');
    const legend = document.getElementById('kg-legend');
    if (!container || !tooltip || !legend) return;

    container.innerHTML = '';

    const totalWidth = container.clientWidth || 560;
    const size = Math.min(totalWidth, 560);
    const radius = size / 2;
    const centerHole = radius * 0.27;

    const MAX_DEPTH = 3;

    function getInnerR(depth) {
      if (depth === 0) return 0;
      const usable = radius - centerHole;
      return centerHole + ((depth - 1) / MAX_DEPTH) * usable;
    }
    function getOuterR(depth) {
      if (depth === 0) return 0;
      const usable = radius - centerHole;
      return centerHole + (depth / MAX_DEPTH) * usable;
    }

    const root = d3.hierarchy(ontologyTree)
      .sum(d => d.value || 0)
      .sort((a, b) => b.value - a.value);

    d3.partition().size([2 * Math.PI, 1])(root);
    const totalInstances = root.value;

    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.012))
      .padRadius(centerHole)
      .innerRadius(d => getInnerR(d.depth) + 2)
      .outerRadius(d => getOuterR(d.depth) - 2);

    const svg = d3.select('#kg-chart-container')
      .append('svg')
      .attr('width', size)
      .attr('height', size)
      .attr('viewBox', `${-radius} ${-radius} ${size} ${size}`)
      .attr('aria-label', 'SMT ontology class distribution sunburst chart');

    svg.append('circle')
      .attr('r', centerHole - 3)
      .attr('fill', '#FFF8F0');

    const paths = svg.append('g')
      .attr('class', 'kg-arcs')
      .selectAll('path')
      .data(root.descendants().filter(d => d.depth > 0))
      .join('path')
      .attr('class', 'kg-arc')
      .attr('fill', d => colorMap[d.data.name] || '#aaa')
      .attr('fill-opacity', 0.88)
      .attr('stroke', '#FFF8F0')
      .attr('stroke-width', 0.8)
      .attr('d', arc)
      .style('cursor', 'pointer')
      .attr('tabindex', 0);

    // -- TOOLTIP LOGIC --
    function showTooltip(event, d) {
      let ancestor = d;
      while (ancestor.depth > 1) { ancestor = ancestor.parent; }

      const ttBgColor = ancestor.data.name === 'DeckCard' ? '#240046' : (colorMap[ancestor.data.name] || '#240046');
      const isTtLight = lightSegments.has(ancestor.data.name);

      const pct = ((d.value / totalInstances) * 100).toFixed(1);

      // -- Dynamic Accent Colors based on family --
      let accentColor, subTextColor;

      if (isTtLight) {
        accentColor = 'rgba(0,0,0,0.5)';
        subTextColor = 'rgba(36,0,70,0.7)';
      } else {
        
        const family = ancestor.data.name;
        if (family === 'Concept') {
          accentColor = '#F7B7A3';
          subTextColor = '#FFDED6';
        } else if (family === 'TarotDeck') {
          accentColor = '#FFE5B4';
          subTextColor = '#FFF4E0';
        } else if (['DeckCard', 'MajorArcana', 'MinorArcana'].includes(family)) {
          accentColor = '#C5AEDE';
          subTextColor = '#E8DFF5';
        } else {
          accentColor = '#D5DBDB';
          subTextColor = '#F2F4F4';
        }
      }

      const textColor = isTtLight ? '#240046' : '#FFF8F0';

      const formatName = (name) => name;
      const displayName = formatName(d.data.name);

      const parentName = d.parent && d.parent.depth > 0
        ? `<div class="kg-tt-parent" style="color: ${accentColor}">subClassOf <em style="color: ${isTtLight ? '#240046' : subTextColor}">${d.parent.data.prefix}:${formatName(d.parent.data.name)}</em></div>`
        : '';

      tooltip.innerHTML = `
        <div class="kg-tt-name" style="color: ${textColor}">
          <span class="kg-tt-prefix" style="color: ${accentColor}">${d.data.prefix}:</span>${displayName}
        </div>
        ${parentName}
        <div class="kg-tt-stats" style="color: ${textColor}">
          <strong>${d.value.toLocaleString()}</strong> instances
          <span class="kg-tt-pct" style="color: ${accentColor}"> · ${pct}%</span>
        </div>
        <div class="kg-tt-desc" style="color: ${subTextColor}">${d.data.description}</div>
      `;

      // Use the root class color for the tooltip background
      tooltip.style.background = ttBgColor;
      tooltip.style.display = 'block';
    }

    function moveTooltip(event) {
      const rect = container.getBoundingClientRect();
      let left = event.clientX - rect.left + 14;
      let top = event.clientY - rect.top - 10;
      if (left + 240 > rect.width) left = event.clientX - rect.left - 254;
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }

    function hideTooltip() {
      tooltip.style.display = 'none';
      tooltip.style.background = ''; // reset
    }

    paths
      .on('mouseover', function (event, d) {
        d3.select(this).attr('fill-opacity', 1).attr('stroke-width', 1.5);
        showTooltip(event, d);
      })
      .on('mousemove', moveTooltip)
      .on('mouseout', function () {
        d3.select(this).attr('fill-opacity', 0.88).attr('stroke-width', 0.8);
        hideTooltip();
      })
      .on('focus', function (event, d) {
        d3.select(this).attr('fill-opacity', 1);
        showTooltip(event, d);
      })
      .on('blur', function () {
        d3.select(this).attr('fill-opacity', 0.88);
        hideTooltip();
      });

    // -- Arc labels
    const labelThresholdAngle = 0.16;
    const charWidth = 6.8;
    const excludedClasses = new Set(['Person', 'TarotDeck', 'Place', 'DeckLineage', 'Dataset']);

    svg.append('g')
      .attr('class', 'kg-labels')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .selectAll('text')
      .data(
        root.descendants().filter(d => {
          if (d.depth === 0 || excludedClasses.has(d.data.name)) return false;
          const angleWidth = d.x1 - d.x0;
          const rMid = (getInnerR(d.depth) + getOuterR(d.depth)) / 2;
          const arcLen = rMid * angleWidth;
          return angleWidth > labelThresholdAngle && arcLen > (d.data.name.length * charWidth * 0.7);
        })
      )
      .join('text')
      .attr('dy', '0.35em')
      .attr('font-family', 'Spectral, serif')
      .attr('font-size', d => d.depth === 1 ? '11.5px' : '10px')
      .attr('fill', d => lightSegments.has(d.data.name) ? '#240046' : '#FFF8F0')
      .attr('transform', d => {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const r = (getInnerR(d.depth) + getOuterR(d.depth)) / 2;
        const flip = x > 90 && x < 270;
        let rotation = flip ? -90 : 90;
        if (d.data.name === 'MajorArcana' || d.data.name === 'NumberedCard') {
          rotation += 180;
        }
        return `rotate(${x - 90}) translate(${r},0) rotate(${rotation})`;
      })
      .text(d => d.data.name);

    // -- Centre label
    const centre = svg.append('g')
      .attr('class', 'kg-centre-label')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none');

    centre.append('text')
      .attr('class', 'kg-centre-class')
      .attr('dy', '0.35em')
      .attr('font-family', 'Cinzel, serif')
      .attr('font-size', '13px')
      .attr('fill', '#7B6D8D')
      .text('owl:Thing');

    legend.innerHTML = '';
    legendGroups.forEach(group => {
      const groupEl = document.createElement('div');
      groupEl.className = 'kg-legend-group';

      const groupLabel = document.createElement('div');
      groupLabel.className = 'kg-legend-group-label';
      groupLabel.textContent = group.label;
      groupEl.appendChild(groupLabel);

      const itemsEl = document.createElement('div');
      itemsEl.className = 'kg-legend-items';

      group.items.forEach(name => {
        const node = root.descendants().find(d => d.data.name === name);
        if (!node) return;

        const item = document.createElement('div');
        item.className = 'kg-legend-item';

        const swatch = document.createElement('span');
        swatch.className = 'kg-legend-swatch';
        swatch.style.background = colorMap[name] || '#aaa';

        const label = document.createElement('span');
        label.className = 'kg-legend-label';
        label.textContent = name;

        const count = document.createElement('span');
        count.className = 'kg-legend-count';
        count.textContent = node.value;

        item.appendChild(swatch);
        item.appendChild(label);
        item.appendChild(count);
        itemsEl.appendChild(item);
      });

      groupEl.appendChild(itemsEl);
      legend.appendChild(groupEl);
    });
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(initKnowledgeGraphChart, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKnowledgeGraphChart);
  } else {
    initKnowledgeGraphChart();
  }

  window.addEventListener('resize', onResize);
})();


// --- COLLECTION PAGE --- //
document.addEventListener('DOMContentLoaded', () => {

  const deckView = document.getElementById('deck-view');
  const gridView = document.getElementById('grid-view');

  const expandableBtns = document.querySelectorAll('.filter-expandable');

  expandableBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      console.log("Filter Clicked - Multi-open version active");
      const group = this.closest('.filter-group');
      const suboptions = group ? group.querySelector('.filter-suboptions') : null;
      const isOpen = this.classList.contains('open');

      this.classList.toggle('open', !isOpen);
      if (suboptions) suboptions.classList.toggle('open', !isOpen);
    });
  });

});

// dropdown deck
function dropdownDeck(deckId) {
  const dropdown = document.getElementById(deckId);

  const allDropdown = document.querySelectorAll('.dropdown-content');
  allDropdown.forEach(el => {
    if (el.id !== deckId) {
      el.classList.remove('show');
    }
  });

  if (dropdown.classList.contains('show')) {
    dropdown.classList.remove('show');
  } else {
    dropdown.classList.add('show');
  }
}

// Metadata toggle in small screens 
document.addEventListener("DOMContentLoaded", function () {
  const toggleBtn = document.getElementById('toggleMetadata');
  const metaGrid = document.getElementById('metadataCollapse');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      const isExpanded = metaGrid.classList.contains('show');

      // Toggle classes
      metaGrid.classList.toggle('show');
      toggleBtn.classList.toggle('active');

      // Update ARIA for accessibility
      toggleBtn.setAttribute('aria-expanded', !isExpanded);
    });
  }
});

// --- SPARQL ENDPOINT --- //
document.addEventListener('DOMContentLoaded', () => {
  const yasguiElement = document.getElementById("yasgui");
  if (yasguiElement) {
    const yasgui = new Yasgui(yasguiElement, {
      requestConfig: {
        endpoint: "https://api.triplydb.com/datasets/sararoggi/smt-dataset/sparql",
      },
      copyEndpointGui: true,
      persistenceId: "smt-library-yasgui"
    });
    yasgui.getTab().setQuery("SELECT * WHERE {\n  ?sub ?pred ?obj .\n} LIMIT 10");
  }
});


// --- ABOUT PAGE --- //
// Ontology SVG Pan/Zoom logic
function initOntologyPanning() {
  const container = document.getElementById('ontology-graph');
  const img = document.getElementById('ontologySvg');
  if (!container || !img) return;

  let scale = 1, startX = 0, startY = 0, translateX = 0, translateY = 0, isDragging = false;

  function applyTransform() {
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  // Zoom on scroll
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.min(Math.max(1, scale + delta), 6);

    if (newScale !== scale) {
      scale = newScale;
      applyTransform();
    }
  }, { passive: false });

  // Drag to pan
  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    container.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    applyTransform();
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.cursor = 'grab';
  });

  // Touch support
  let lastTouchDist = null;
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - translateX;
      startY = e.touches[0].clientY - translateY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });
  container.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging) {
      translateX = e.touches[0].clientX - startX;
      translateY = e.touches[0].clientY - startY;
      applyTransform();
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDist) {
        scale = Math.min(Math.max(1, scale * (dist / lastTouchDist)), 6);
        applyTransform();
      }
      lastTouchDist = dist;
    }
  }, { passive: true });
  container.addEventListener('touchend', () => { isDragging = false; lastTouchDist = null; });
}
