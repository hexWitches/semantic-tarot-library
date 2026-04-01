/**
 * Search functionality
 * Handles fuzzy search across smtGraph.jsonld and texts.json
 */

document.addEventListener('DOMContentLoaded', () => {
    // Detect whether we are running from the repo root (index.html) or from inside website/
    // Root pages have a pathname like '/' or '/index.html'; website pages contain '/website/'
    const isRoot = !window.location.pathname.includes('/website/');
    const basePath = isRoot ? 'website/' : '';

    let smtData = null;
    let textsData = null;
    let isDataLoaded = false;
    let allKeywords = [];

    // Search containers across different layouts (navbar, hero, mobile)
    const searchInputs = document.querySelectorAll('input[type="search"]');

    // Create a results overlay if it doesn't exist
    let resultsOverlay = document.getElementById('search-results-overlay');
    if (!resultsOverlay) {
        resultsOverlay = document.createElement('div');
        resultsOverlay.id = 'search-results-overlay';
        resultsOverlay.className = 'search-results-overlay';
        document.body.appendChild(resultsOverlay);
    }

    /**
     * Load required data
     */
    async function loadSearchData() {
        try {
            const [graphRes, textsRes] = await Promise.all([
                fetch(`${basePath}assets/json/smtGraph.jsonld`),
                fetch(`${basePath}assets/json/texts.json`)
            ]);
            smtData = await graphRes.json();
            textsData = await textsRes.json();

            // Build exhaustive keyword dictionary for suggestions
            const keywordsSet = new Set();

            const addKeyword = (k) => {
                if (!k || typeof k !== 'string') return;
                const trimmed = k.trim();
                if (trimmed.length < 2) return;
                keywordsSet.add(trimmed);

                // Also add individual words for multi-word titles/keywords
                if (trimmed.includes(' ')) {
                    trimmed.split(/\s+/).forEach(word => {
                        const w = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
                        if (w.length > 3) keywordsSet.add(w);
                    });
                }
            };

            // From graph
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

            // From texts keywords
            const extractFromTexts = (obj) => {
                Object.values(obj || {}).forEach(data => {
                    if (data.keywords) data.keywords.forEach(k => addKeyword(k));
                    if (data.card_name) addKeyword(data.card_name);
                    if (data.description) {
                        // Extract significant words from descriptions as potential keywords? 
                        // Maybe too much. Let's stick to core metadata for now.
                    }
                });
            };
            extractFromTexts(textsData.decks);
            extractFromTexts(textsData.cards);
            extractFromTexts(textsData.person);

            // Sort by length (shorter first for better prefix matching)
            allKeywords = Array.from(keywordsSet).sort((a, b) => a.length - b.length);

            isDataLoaded = true;
            console.log("Search indexing complete. Keywords:", allKeywords.length);
        } catch (error) {
            console.error("Error loading search data:", error);
        }
    }

    /**
     * Perform fuzzy search
     */
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

        // 1. Search in smtGraph.jsonld (titles)
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

        // 2. Search in texts.json (keywords)
        // Search Decks keywords
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

        // Search Cards keywords
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

        // Skip textsData.person search to avoid cross-polluting person results (e.g. Sforza showing up when searching Bembo)

        renderResults(results);
    }

    /**
     * Helper to format generic names from IDs
     */
    function formatName(id) {
        return id.replace(/^(person|deck|card)_/, '').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    /**
     * Render results to the overlay
     */
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
                const nameId = person.id.replace('person-', '');
                const specificPlaceholder = `${basePath}assets/images/explore/people/${nameId}-placeholder.jpg`;
                const generalPlaceholder = `${basePath}assets/images/explore/people/portrait-placeholder.jpg`;
                
                let imgUrl = getImageUrl(person.image, 'person');
                if (imgUrl.endsWith('portrait-placeholder.jpg')) {
                    imgUrl = specificPlaceholder;
                }
                
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
        
        // 1. Check for specific portrait or image URL
        const portraitUrl = node.person_portrait_url?.['@id'] || node.person_portrait_url;
        if (portraitUrl && typeof portraitUrl === 'string') return portraitUrl;

        const imageUrl = node.image_url?.['@id'] || node.image_url;
        if (imageUrl && typeof imageUrl === 'string') return imageUrl;

        const isPerson = node['@type'] === 'odi:Person' || (Array.isArray(node['@type']) && node['@type'].includes('odi:Person'));
        if (isPerson) return null;
        
        // 2. For cards and decks (or as fallback for persons), look through the graph

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

                // Person check (author or illustrator)
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

                // Fallback sort to get genuinely the "first" card as fallback
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

    /**
     * Convert GitHub URLs
     */
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

    /**
     * Update the ghost suggestion text
     */
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
            // Sync font + padding so text aligns exactly with the input text
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

            // Use transparent prefix + visible suffix for the suggestion
            ghost.innerHTML = `<span style="color: transparent;">${val}</span>${match.substring(val.length)}`;
        } else {
            ghost.innerHTML = '';
        }
    }

    // Event listeners
    searchInputs.forEach(input => {
        const form = input.closest('form');
        const clearBtn = input.parentElement.querySelector('.search-clear-btn');

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                input.value = '';
                input.focus();
                // Manually trigger input event for live update
                input.dispatchEvent(new Event('input'));
            });
        }

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            updateSuggestion(input);
            performSearch(query);
        });

        // Autocomplete on Tab or Right Arrow
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

    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (!resultsOverlay.contains(e.target) && !Array.from(searchInputs).some(i => i.contains(e.target))) {
            resultsOverlay.classList.remove('show');
        }
    });

    // Initialize indexing
    loadSearchData();
});
