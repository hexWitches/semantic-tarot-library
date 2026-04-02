async function initCardPage() {
    // Get the Card ID from the URL (e.g., card.html?id=card-modrone-38)
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('id');

    if (!cardId) {
        console.error("Card ID missing in URL.");
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

        // Find the Card in the Knowledge Graph
        const cardData = graph.find(obj => {
            const itemId = obj['@id'];
            return itemId === `smtg:${cardId}` || itemId === cardId;
        });

        if (cardData) {
            // Match the description from texts.json (handling underscores/hyphens)
            const normalizedId = cardId.replace(/-/g, '_');

            // Access cards in JSON (fallback to flat structure if needed)
            const allCards = textsData.cards || {};
            const extraTextsKey = Object.keys(allCards).find(key => key.trim() === normalizedId);
            const extraTexts = allCards[extraTextsKey];

            console.log("Card description found:", extraTexts);
            console.log("Card data successfully found:", cardData);

            fillCardMetadata(cardData, graph, extraTexts);
            updateNavigation(cardData, graph);
            generateRelatedTopics(cardData, graph);
        } else {
            console.warn("Card not found in the Knowledge Graph.");
        }

    } catch (error) {
        console.error("Error loading the card page:", error);
    }
}

/**
 * Helper: Finds an entity in the graph by ID and returns its human-readable label
 */
function getEntityLabel(graph, entityData) {
    if (!entityData) return null;

    // If it's an array, take the first one or handle both
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
    if (entity.given_name || entity.family_name) {
        const first = entity.given_name || "";
        const last = entity.family_name || "";
        return `${first} ${last}`.trim();
    }

    return entity.label ||
        entity['rdfs:label'] ||
        entity.title ||
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
 * Fills the HTML placeholders with card metadata
 */
function fillCardMetadata(card, graph, extraTexts) {
    // 1. Titles and Numbers
    const title = card.title || card.card_name || "Unknown Card";
    document.getElementById('card_name').innerText = title;

    const cardNumberEl = document.getElementById('card_number');
    if (cardNumberEl) {
        cardNumberEl.innerText = card.card_number || "-";
    }

    // 2. Image
    const imgEl = document.getElementById('image_url');
    if (imgEl) {
        const rawUrl = card.image_url ? (card.image_url['@id'] || card.image_url) : null;
        imgEl.src = getLocalImagePath(rawUrl);
        imgEl.alt = title;
    }

    // 3. Description (Only from texts.json)
    const descriptionBox = document.querySelector('.description-box p');
    if (descriptionBox) {
        if (extraTexts && extraTexts.description) {
            descriptionBox.innerHTML = extraTexts.description;
        } else if (card.description) {
            descriptionBox.innerText = card.description;
        } else {
            descriptionBox.innerText = "Detailed description coming soon for this card.";
        }
    }

    // 4. Update the highlight span in the evolution frame
    const highlightSpan = document.querySelector('.evolution-heading .highlight');
    if (highlightSpan) {
        highlightSpan.innerText = title;
    }

    // Helper for generating Metadata Links
    const setMetaLink = (elementId, entityData, pagePath) => {
        const el = document.getElementById(elementId);
        if (!el) return;

        el.innerHTML = "";

        if (!entityData || (Array.isArray(entityData) && entityData.length === 0)) {
            el.innerText = "-";
            return;
        }

        const dataArray = Array.isArray(entityData) ? entityData : [entityData];

        dataArray.forEach((data, index) => {
            const label = getEntityLabel(graph, data);
            if (!label || label === "-") return;

            const fullId = data['@id'] || data;
            const cleanId = fullId.replace('smtg:', '');

            // If a pagePath is provided, generate a link
            if (pagePath) {
                const link = document.createElement('a');
                link.innerText = label;
                link.href = `${pagePath}.html?id=${cleanId}`;
                el.appendChild(link);
            } else {
                const span = document.createElement('span');
                span.innerText = label;
                span.style.textTransform = "capitalize";
                el.appendChild(span);
            }

            if (index < dataArray.length - 1) {
                el.appendChild(document.createTextNode(", "));
            }
        });
    };

    // 5. Populate Linked Metadata
    setMetaLink('author_id', card.author_id, 'person');

    // Check if location should be linked or just text
    setMetaLink('current_location', card.current_location, null);
    setMetaLink('contained_in_deck_id', card.contained_in_deck_id || card.isContainedIn, 'deck');
    setMetaLink('suit_id', card.suit_id, null);

    // Update Breadcrumbs
    const deckLabel = getEntityLabel(graph, card.contained_in_deck_id || card.isContainedIn);
    const breadcrumbDeck = document.getElementById('breadcrumb_deck');
    if (breadcrumbDeck && deckLabel) {
        breadcrumbDeck.innerText = deckLabel;
        const deckId = (card.contained_in_deck_id || card.isContainedIn)['@id'] || card.contained_in_deck_id;
        breadcrumbDeck.href = `deck.html?id=${deckId.replace('smtg:', '')}`;
    }

    const breadcrumbCard = document.getElementById('breadcrumb_card');
    if (breadcrumbCard) {
        breadcrumbCard.innerText = title;
    }

    // 6. Arcana Types Logic
    const arcanaTypeEl = document.getElementById('arcana_type');
    const minorArcanaTypeEl = document.getElementById('minor_arcana_type');

    const types = Array.isArray(card['@type']) ? card['@type'] : [card['@type']];

    if (arcanaTypeEl) {
        if (types.includes('smt:MajorArcana')) arcanaTypeEl.innerText = "Major Arcana";
        else if (types.includes('smt:MinorArcana')) arcanaTypeEl.innerText = "Minor Arcana";
        else arcanaTypeEl.innerText = "-";
    }

    if (minorArcanaTypeEl) {
        if (types.includes('smt:CourtCard')) minorArcanaTypeEl.innerText = "Court Card";
        else if (types.includes('smt:NumberedCard')) minorArcanaTypeEl.innerText = "Numbered Card";
        else minorArcanaTypeEl.innerText = "-";
    }

    // 7. Evolution Frame (Archetypes & Suits)
    const evolutionFrame = document.querySelector('.evolution-frame');
    if (evolutionFrame) {

        // --- Render Helpers ---
        const renderThumbs = (relatedCardsList) => {
            const previewContainer = document.querySelector('.archetype-comparison-preview');
            if (!previewContainer) return;

            previewContainer.innerHTML = ''; // Clear hardcoded previews

            // Take up to 3 related cards
            const displayCards = relatedCardsList.slice(0, 3);

            displayCards.forEach(relCard => {
                let label = relCard.title || "Tarot Card";
                const deckRef = relCard.contained_in_deck_id || relCard.isContainedIn;

                if (deckRef) {
                    const deckId = deckRef['@id'] || deckRef;
                    const deckObj = graph.find(d => d['@id'] === deckId);
                    if (deckObj) {
                        const deckTitle = deckObj.title || deckObj.label;
                        const year = deckObj.publication_year ? ` (${deckObj.publication_year})` : '';
                        if (deckTitle) label = `${deckTitle}${year}`;
                    }
                }

                const imgUrl = relCard.image_url ? (relCard.image_url['@id'] || relCard.image_url) : null;
                const cleanRelId = relCard['@id'].replace('smtg:', '');

                const thumbHtml = `
                    <div class="mini-card-thumb">
                        <a href="card.html?id=${cleanRelId}" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; align-items: center;">
                            <img src="${getLocalImagePath(imgUrl)}" alt="${label}" onerror="this.src='assets/images/placeholder_card.jpg';">
                            <span>${label}</span>
                        </a>
                    </div>
                `;
                previewContainer.insertAdjacentHTML('beforeend', thumbHtml);
            });

            if (displayCards.length === 0) {
                evolutionFrame.style.display = 'none';
            }
        };

        const updateDiscoverLink = (url) => {
            const discoverBtn = document.querySelector('.discover-more');
            if (discoverBtn) discoverBtn.href = url;
        };
        // ----------------------

        if (types.includes('smt:MajorArcana') && card.archetype_id) {
            evolutionFrame.style.display = 'flex';

            // Reset heading text
            const heading = document.querySelector('.evolution-heading');
            if (heading) {
                heading.innerHTML = `One archetype, infinite interpretations. Discover the many faces of <span class="highlight">${title}</span>.`;
            }

            const archetypeId = Array.isArray(card.archetype_id) ? (card.archetype_id[0]['@id'] || card.archetype_id[0]) : (card.archetype_id['@id'] || card.archetype_id);

            const relatedCards = graph.filter(obj => {
                if (obj['@id'] === card['@id']) return false;
                const arch = obj.archetype_id;
                if (!arch) return false;
                const archId = Array.isArray(arch) ? (arch[0]['@id'] || arch[0]) : (arch['@id'] || arch);
                return archId === archetypeId;
            });

            renderThumbs(relatedCards);
            updateDiscoverLink('#'); // Change later

        } else if (types.includes('smt:MinorArcana') && card.suit_id) {
            evolutionFrame.style.display = 'flex';

            const suitLabel = getEntityLabel(graph, card.suit_id);
            const suitIdRaw = Array.isArray(card.suit_id) ? (card.suit_id[0]['@id'] || card.suit_id[0]) : (card.suit_id['@id'] || card.suit_id);

            // Change heading text for minor arcana
            const heading = document.querySelector('.evolution-heading');
            if (heading) {
                const capitalizedSuit = suitLabel ? suitLabel.charAt(0).toUpperCase() + suitLabel.slice(1) : "";
                heading.innerHTML = `One suit, infinite visions. Uncover the hidden meaning of the Suit of <span class="highlight">${capitalizedSuit}</span>.`;
            }

            const relatedCards = graph.filter(obj => {
                if (obj['@id'] === card['@id']) return false;
                const s = obj.suit_id;
                if (!s) return false;
                const sId = Array.isArray(s) ? (s[0]['@id'] || s[0]) : (s['@id'] || s);
                return sId === suitIdRaw;
            });

            // Randomize and take 3
            const shuffledCards = relatedCards.sort(() => 0.5 - Math.random());
            renderThumbs(shuffledCards);
            updateDiscoverLink('#'); // Keep empty/placeholder as requested

        } else {
            // Hide for anything lacking an archetype or suit
            evolutionFrame.style.display = 'none';
        }
    }
}

/**
 * Helper: Updates Previous & Next Card Navigation Arrows
 */
function updateNavigation(currentCard, graph) {
    const deckRef = currentCard.contained_in_deck_id || currentCard.isContainedIn;
    if (!deckRef) return;
    const deckId = deckRef['@id'] || deckRef;

    // 1. Filter cards from the same deck
    const deckCards = graph.filter(obj => {
        if (!obj['@type']) return false;
        const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
        const isCard = types.some(t => ['smt:MajorArcana', 'smt:MinorArcana', 'smt:NumberedCard', 'smt:CourtCard'].includes(t));
        if (!isCard) return false;

        const cDeckRef = obj.contained_in_deck_id || obj.isContainedIn;
        if (!cDeckRef) return false;
        const cDeckId = cDeckRef['@id'] || cDeckRef;
        return cDeckId === deckId;
    });

    // 2. Sorting Helpers
    const parseNumber = (numStr) => {
        if (!numStr) return 0; // Default undefined numbers (like the Fool) to 0
        const s = numStr.toString().trim().toUpperCase();
        if (/^\d+$/.test(s)) return parseInt(s, 10);
        
        // Roman Numeral parser
        const romanMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
        let num = 0;
        for (let i = 0; i < s.length; i++) {
            const curr = romanMap[s[i]];
            if (!curr) continue;
            const next = romanMap[s[i + 1]];
            if (next && curr < next) {
                num += (next - curr);
                i++;
            } else {
                num += curr;
            }
        }
        return num || 0;
    };

    const getRankValue = (cardObj) => {
        if (cardObj.card_number) return parseNumber(cardObj.card_number);
        
        let baseVal = 20; 
        const label = (cardObj.label || cardObj.title || cardObj.card_name || getEntityLabel(graph, cardObj) || "").toLowerCase();
        
        if (label.includes("page") || label.includes("fante")) return 11;
        if (label.includes("knight") || label.includes("cavalliere") || label.includes("cavaliere")) return 12;
        if (label.includes("queen") || label.includes("regina")) return 13;
        if (label.includes("king") || label.includes("re")) return 14;
        
        return baseVal;
    };

    // 3. Sort Cards
    deckCards.sort((a, b) => {
        const typesA = Array.isArray(a['@type']) ? a['@type'] : [a['@type']];
        const typesB = Array.isArray(b['@type']) ? b['@type'] : [b['@type']];

        const isMajorA = typesA.includes('smt:MajorArcana');
        const isMajorB = typesB.includes('smt:MajorArcana');

        if (isMajorA && !isMajorB) return -1;
        if (!isMajorA && isMajorB) return 1;

        if (isMajorA && isMajorB) {
            return parseNumber(a.card_number) - parseNumber(b.card_number);
        }

        // Both Minor Arcana
        const suitA = getEntityLabel(graph, a.suit_id) || "";
        const suitB = getEntityLabel(graph, b.suit_id) || "";

        if (suitA.toLowerCase() < suitB.toLowerCase()) return -1;
        if (suitA.toLowerCase() > suitB.toLowerCase()) return 1;

        return getRankValue(a) - getRankValue(b);
    });

    // 4. Update UI Arrows
    const currentIndex = deckCards.findIndex(c => c['@id'] === currentCard['@id']);
    if (currentIndex === -1) return;

    const setArrow = (idPrefix, targetIndex) => {
        const desktopEl = document.getElementById(`${idPrefix}_card_desktop`);
        const mobileEl = document.getElementById(`${idPrefix}_card_mobile`);
        const elList = [desktopEl, mobileEl];
        
        if (targetIndex >= 0 && targetIndex < deckCards.length) {
            const targetId = deckCards[targetIndex]['@id'].replace('smtg:', '');
            elList.forEach(el => {
                if (el) {
                    el.href = `card.html?id=${targetId}`;
                    el.classList.remove('disabled');
                    el.style.opacity = '1';
                    el.style.pointerEvents = 'auto';
                }
            });
        } else {
            elList.forEach(el => {
                if (el) {
                    el.href = '#';
                    el.classList.add('disabled');
                    el.style.opacity = '0.3';
                    el.style.pointerEvents = 'none';
                }
            });
        }
    };

    setArrow('prev', currentIndex - 1);
    setArrow('next', currentIndex + 1);
}

/**
 * Populates the Related Topics Section Dynamically
 */
function generateRelatedTopics(card, graph) {
    const topicsCarousel = document.getElementById('topicsCarousel');
    if (!topicsCarousel) return;

    topicsCarousel.innerHTML = ''; // clear placeholders

    const types = Array.isArray(card['@type']) ? card['@type'] : [card['@type']];
    const isMajor = types.includes('smt:MajorArcana');
    const isMinor = types.includes('smt:MinorArcana') || types.includes('smt:CourtCard') || types.includes('smt:NumberedCard');

    // Helper to create a card
    const createTopicCard = (title, subtitle, linkUrl) => {
        const linkWrapper = document.createElement('a');
        linkWrapper.href = linkUrl;
        linkWrapper.style.textDecoration = 'none';
        linkWrapper.style.color = 'inherit';
        linkWrapper.style.display = 'block';

        const cardDiv = document.createElement('div');
        cardDiv.className = 'topic-card';
        
        const innerDiv = document.createElement('div');
        innerDiv.className = 'topic-card-inner';
        
        const h4 = document.createElement('h4');
        h4.innerText = title;
        
        const p = document.createElement('p');
        p.innerText = subtitle;
        
        innerDiv.appendChild(h4);
        innerDiv.appendChild(p);
        cardDiv.appendChild(innerDiv);
        linkWrapper.appendChild(cardDiv);
        
        topicsCarousel.appendChild(linkWrapper);
    };

    let deckObj = null;
    const deckRef = card.contained_in_deck_id || card.isContainedIn;
    if (deckRef) {
        const deckId = deckRef['@id'] || deckRef;
        deckObj = graph.find(d => d['@id'] === deckId);
    }

    if (isMajor) {
        // Archetypes
        if (card.archetype_id) {
            const archIdRaw = Array.isArray(card.archetype_id) ? card.archetype_id[0] : card.archetype_id;
            const archId = (archIdRaw['@id'] || archIdRaw).replace('smtg:', '');
            let label = getEntityLabel(graph, card.archetype_id);
            if (!label || label === '-') label = 'Archetype';
            createTopicCard(label, 'Dig deeper into the meaning', `deepening.html?id=${archId}`);
        }
        
        // Symbols
        createTopicCard('Symbols', 'Explore the hidden symbols', '#');
    }

    // Persons connected (author, illustrator, publisher)
    const personProps = ['author_id', 'illustrator_id', 'publisher'];
    const personMap = new Map();

    personProps.forEach(prop => {
        const propData = card[prop] || (deckObj && deckObj[prop]);
        if (propData) {
            const persons = Array.isArray(propData) ? propData : [propData];
            persons.forEach(personData => {
                const label = getEntityLabel(graph, personData);
                const isEntity = typeof personData === 'object' && personData['@id'];
                
                if (label && label !== "-" && isEntity) {
                    const fullId = personData['@id'];
                    const cleanId = fullId.replace('smtg:', '');
                    
                    let roleStr = "Author";
                    if (prop === 'illustrator_id') roleStr = "Illustrator";
                    if (prop === 'publisher') roleStr = "Publisher";
                    
                    if (personMap.has(cleanId)) {
                        const existing = personMap.get(cleanId);
                        if (!existing.roles.includes(roleStr)) {
                            existing.roles.push(roleStr);
                        }
                    } else {
                        personMap.set(cleanId, {
                            label: label,
                            roles: [roleStr]
                        });
                    }
                }
            });
        }
    });

    personMap.forEach((data, cleanId) => {
        const rolesCombined = data.roles.join(" & ");
        createTopicCard(data.label, `Discover the ${rolesCombined}`, `person.html?id=${cleanId}`);
    });

    // Deck
    if (deckObj) {
        const deckLabel = getEntityLabel(graph, deckObj) || 'Deck';
        const deckId = deckObj['@id'].replace('smtg:', '');
        createTopicCard(deckLabel, 'Explore the full deck', `deck.html?id=${deckId}`);
    }

    // Suits (if minor arcana)
    if (isMinor) {
        if (card.suit_id) {
            const suitIdRaw = Array.isArray(card.suit_id) ? card.suit_id[0] : card.suit_id;
            const suitId = (suitIdRaw['@id'] || suitIdRaw).replace('smtg:', '');
            let suitLabel = getEntityLabel(graph, card.suit_id);
            if (!suitLabel || suitLabel === "-") suitLabel = 'Suit';
            
            const capitalizedSuit = suitLabel.charAt(0).toUpperCase() + suitLabel.slice(1);
            createTopicCard(capitalizedSuit, 'Discover the Suit', `deepening.html?id=${suitId}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', initCardPage);
