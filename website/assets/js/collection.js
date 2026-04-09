// --- COLLECTION PAGE --- //

// data conversion and utility functions
function romanToInt(roman) {
    if (!roman || typeof roman !== 'string') return 0;
    const romanMap = { 'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000 };
    let total = 0;
    for (let i = 0; i < roman.length; i++) {
        const current = romanMap[roman[i]];
        const next = romanMap[roman[i + 1]];
        if (next > current) {
            total += next - current;
            i++;
        } else {
            total += current;
        }
    }
    return total;
}

function getCardValue(card) {
    const num = card.card_number;
    if (!num) return 999;
    if (typeof num === 'number') return num;
    if (!isNaN(num)) return parseInt(num);
    return romanToInt(num);
}

// data loading functions
function sortCards(cards) {
    return cards.sort((a, b) => {
        const typeA = Array.isArray(a['@type']) ? a['@type'] : [a['@type']];
        const typeB = Array.isArray(b['@type']) ? b['@type'] : [b['@type']];

        const isMajorA = typeA.some(t => t.includes('MajorArcana'));
        const isMajorB = typeB.some(t => t.includes('MajorArcana'));

        if (isMajorA && !isMajorB) return -1;
        if (!isMajorA && isMajorB) return 1;

        if (isMajorA && isMajorB) {
            return getCardValue(a) - getCardValue(b);
        }

        // For Minor Arcana, sort by suit then value
        const suitA = a.suit_id?.['@id'] || '';
        const suitB = b.suit_id?.['@id'] || '';
        if (suitA < suitB) return -1;
        if (suitA > suitB) return 1;

        return getCardValue(a) - getCardValue(b);
    });
}

const DECKS_PER_PAGE = 3;
const CARDS_PER_GRID_PAGE = 12;

let allDecks = [];
let allCards = [];
let allPersons = [];
let filteredCards = [];
let textsData = null;
let currentPage = 1;
let isGridView = false;

let activeFilters = {
    'author': [],
    'suit': [],
    'origin': [],
    'year': [],
    'lineage': [],
    'arcana-type': []
};
let currentSearch = '';
let matchingDecks = [];
let matchingPersons = [];

function nodeToName(id) {
    if (!id) return "";
    const parts = id.split(/[:\/]/);
    const lastPart = parts.pop();
    const cleanName = lastPart.replace(/^(person|deck|card)-/, '').replace(/-/g, ' ');
    return cleanName.replace(/\b\w/g, c => c.toUpperCase());
}

async function loadCollection() {
    // Initialize view from URL first (prevents CORS blockage from hiding search)
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    const filterParam = urlParams.get('filter');
    const valueParam = urlParams.get('value');

    if (searchParam) {
        currentSearch = searchParam;
        isGridView = true;
        // Immediate show of banner
        const searchBanner = document.getElementById('search-results-banner');
        const searchDisplay = document.getElementById('search-query-display');
        if (searchBanner) searchBanner.style.display = 'block';
        if (searchDisplay) searchDisplay.innerText = currentSearch;
    } else if (filterParam && valueParam && activeFilters[filterParam]) {
        activeFilters[filterParam].push(valueParam);
        isGridView = true;
    }

    try {
        const [graphRes, textsRes] = await Promise.all([
            fetch('assets/json/smtGraph.jsonld'),
            fetch('assets/json/texts.json')
        ]);

        if (!graphRes.ok || !textsRes.ok) throw new Error('Failed to load data');

        const data = await graphRes.json();
        textsData = await textsRes.json();
        const graph = data['@graph'];

        // Filter for decks, cards, and persons
        const decks = graph.filter(item =>
            item['@type'] === 'odi:TarotDeck' ||
            (Array.isArray(item['@type']) && item['@type'].includes('odi:TarotDeck'))
        );
        allCards = graph.filter(item =>
            item['@type'] === 'odi:DeckCard' ||
            (Array.isArray(item['@type']) && item['@type'].includes('odi:DeckCard')) ||
            (Array.isArray(item['@type']) && item['@type'].some(t => t.includes('Arcana')))
        );
        allPersons = graph.filter(item =>
            item['@type'] === 'odi:Person' ||
            (Array.isArray(item['@type']) && item['@type'].includes('odi:Person'))
        );

        // Map and sort cards to decks for the deck view
        allDecks = decks.map(deck => {
            const deckYear = parseInt(deck.publication_year) || 0;
            const originObj = deck['https://schema.org/locationCreated'] || deck['location_created'];
            const originId = originObj?.['@id'] || '';

            const cityToNation = {
                'smtg:milan': 'italy',
                'smtg:venice': 'italy',
                'smtg:paris': 'france',
                'smtg:london': 'united-kingdom'
            };
            const nation = cityToNation[originId] || '';
            const lineageId = deck.deck_lineage_id?.['@id'] || deck.deck_lineage_id || '';

            let deckCards = allCards.filter(card => {
                const containedIn = card.contained_in_deck_id;
                if (!containedIn) return false;
                const deckId = typeof containedIn === 'string' ? containedIn : containedIn['@id'];
                const match = deckId === deck['@id'];
                if (match) {
                    card.deck_year = deckYear;
                    card.origin = originId;
                    card.nation = nation;
                    card.lineage_id = lineageId;
                }
                return match;
            });

            deckCards = sortCards(deckCards);
            return { ...deck, cards: deckCards };
        });
        applyFiltering();
        attachFilterListeners();

    } catch (error) {
        console.error("Error loading collection:", error);
        // Still apply filtering for search view even if data fails (to show query banner)
        applyFiltering();
    }
}

// filtering functions
function renderContent() {
    const deckView = document.getElementById('deck-view');
    const gridView = document.getElementById('grid-view');
    const searchView = document.getElementById('search-view');
    const searchBanner = document.getElementById('search-results-banner');

    if (!deckView || !gridView || !searchView || !searchBanner) return;

    // Hide everything first
    deckView.style.display = 'none';
    gridView.style.display = 'none';
    searchView.style.display = 'none';
    searchBanner.style.display = 'none';

    if (currentSearch) {
        searchView.style.display = 'block';
        searchBanner.style.display = 'block';
        document.getElementById('search-query-display').innerText = currentSearch;
        renderSearchView();
    } else if (isGridView || hasActiveFilters()) {
        gridView.style.display = 'block';
        renderGridView();
    } else {
        deckView.style.display = 'block';
        renderDecks();
    }
    updatePagination();
}

function hasActiveFilters() {
    return Object.values(activeFilters).some(vals => vals.length > 0);
}

const SEARCH_PER_PAGE = 12;

window.goToPage = function (page) {
    currentPage = page;
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function renderSearchView() {
    const container = document.getElementById('search-view');
    if (!container) return;
    container.innerHTML = '';

    const allResults = [
        ...matchingDecks.map(d => ({ type: 'deck', data: d })),
        ...matchingPersons.map(p => ({ type: 'person', data: p })),
        ...filteredCards.map(c => ({ type: 'card', data: c }))
    ];

    const startIndex = (currentPage - 1) * SEARCH_PER_PAGE;
    const endIndex = startIndex + SEARCH_PER_PAGE;
    const resultsToShow = allResults.slice(startIndex, endIndex);

    if (allResults.length === 0) {
        container.innerHTML = '<p class="text-center py-5">No items found matching your search. Try different keywords.</p>';
        return;
    }

    // group current page results back into types for section rendering
    const pageDecks = resultsToShow.filter(r => r.type === 'deck').map(r => r.data);
    const pagePersons = resultsToShow.filter(r => r.type === 'person').map(r => r.data);
    const pageCards = resultsToShow.filter(r => r.type === 'card').map(r => r.data);

    // matching decks
    if (pageDecks.length > 0) {
        let decksHTML = `
            <div class="search-section-wrapper mb-5">
                <h3 class="search-section-title">Matching Decks</h3>
                <div class="search-decks-grid">
        `;
        pageDecks.forEach(deck => {
            const cleanId = deck['@id'].replace('smtg:', '');
            let coverImg = 'assets/images/placeholder_card.jpg';
            if (deck.cards && deck.cards.length > 0) coverImg = getLocalImagePath(deck.cards[0].image_url?.['@id']);

            decksHTML += `
                <a href="deck.html?id=${cleanId}" class="img-container deck-img-container search-deck-result">
                    <div class="deck-card-img">
                        <img src="${coverImg}" alt="${deck.title}" onerror="this.src='assets/images/placeholder_card.jpg';">
                    </div>
                    <div class="card-overlay search-deck-overlay">
                        <div class="deck-title-wrapper">
                            <span class="deck-title-prefix">TAROT</span>
                            <h3 class="card-title-overlay">${deck.title.replace('Tarot', '').trim()}</h3>
                        </div>
                    </div>
                </a>
            `;
        });
        decksHTML += `</div></div>`;
        container.insertAdjacentHTML('beforeend', decksHTML);
    }

    // matching persons
    if (pagePersons.length > 0) {
        let personsHTML = `
            <div class="search-section-wrapper mb-5">
                <h3 class="search-section-title">Matching Persons</h3>
                <div class="search-scroller-simple d-flex gap-4 flex-wrap">
        `;
        pagePersons.forEach(person => {
            const cleanId = person['@id'].replace('smtg:', '');
            const name = person.title || (person.given_name + " " + person.family_name);
            const portraitUrl = person.person_portrait_url?.['@id'] || person.person_portrait_url || null;
            let imgUrl = getLocalImagePath(typeof portraitUrl === 'string' ? portraitUrl : null, 'person');

            const generalPlaceholder = 'assets/images/explore/people/portrait-placeholder.jpg';

            personsHTML += `
                <a href="person.html?id=${cleanId}" class="person-circle-item text-center text-decoration-none" style="width: 120px;">
                    <div class="person-img-circle mx-auto mb-2">
                         <img src="${imgUrl}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='${generalPlaceholder}';">
                    </div>
                    <span class="person-name text-white small d-block">${name}</span>
                </a>
            `;
        });
        personsHTML += `</div></div>`;
        container.insertAdjacentHTML('beforeend', personsHTML);
    }

    // matching cards (grid)
    if (pageCards.length > 0) {
        let cardsHTML = `
            <div class="search-section-wrapper">
                <h3 class="search-section-title">Matching Cards</h3>
                <div class="cards-grid">
        `;
        pageCards.forEach(card => {
            const imgUrl = getLocalImagePath(card.image_url?.['@id']);
            const cardName = card.title || 'Tarot Card';
            const cardNumber = card.card_number || '';
            const cleanId = card['@id'].replace('smtg:', '');

            cardsHTML += `
                <div class="grid-card-wrapper">
                    <a href="card.html?id=${cleanId}" class="img-container deck-img-container" style="display:block;text-decoration:none;color:inherit;">
                        <img src="${imgUrl}" alt="${cardName}" class="deck-card-img" loading="lazy" style="display:block;margin:0 auto;" onerror="this.src='assets/images/placeholder_card.jpg';">
                        <div class="card-overlay">
                            <span class="card-number-overlay">${cardNumber}</span>
                            <h3 class="card-title-overlay">${cardName}</h3>
                        </div>
                    </a>
                </div>
            `;
        });
        cardsHTML += `</div></div>`;
        container.insertAdjacentHTML('beforeend', cardsHTML);
    }

    // pagination controls for search results
    const totalPages = Math.ceil(allResults.length / SEARCH_PER_PAGE);

    let paginationHTML = `
        <div class="pagination-container" id="search-pagination" style="margin-top: 40px; margin-bottom: 40px;">
            <button class="nav-circle-btn" id="search-prev-btn" onclick="goToPage(${currentPage - 1})" aria-label="Previous Page" style="display: ${currentPage <= 1 ? 'none' : 'flex'};">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m11 17-5-5 5-5" />
                    <path d="m18 17-5-5 5-5" />
                </svg>
            </button>
            <button class="nav-circle-btn" id="search-next-btn" onclick="goToPage(${currentPage + 1})" aria-label="Next Page" style="display: ${currentPage >= totalPages ? 'none' : 'flex'};">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m6 17 5-5-5-5" />
                    <path d="m13 17 5-5-5-5" />
                </svg>
            </button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', paginationHTML);

    initScrollers();
}

function applyFilter(filterType, subfilter) {
    if (filterType === 'search') {
        currentSearch = subfilter;
    } else {
        const index = activeFilters[filterType].indexOf(subfilter);
        if (index > -1) {
            activeFilters[filterType].splice(index, 1);
        } else {
            activeFilters[filterType].push(subfilter);
        }
    }

    if (currentSearch || hasActiveFilters()) {
        isGridView = true;
    } else {
        isGridView = false;
    }

    currentPage = 1;
    applyFiltering();
}

function applyFiltering() {
    // filter decks and persons based on currentSearch
    if (currentSearch) {
        const query = currentSearch.toLowerCase();

        // match decks
        matchingDecks = allDecks.filter(deck => {
            const title = (deck.title || "").toLowerCase();
            const deckId = deck['@id']?.replace('smtg:', '').replace(/-/g, '_') || '';
            const keywords = (textsData.decks?.[deckId]?.keywords || []).map(k => k.toLowerCase());
            return title.includes(query) || keywords.some(k => k.includes(query));
        });

        // match persons
        matchingPersons = allPersons.filter(person => {
            const id = person['@id']?.replace('smtg:', '');
            const givenName = person.given_name || "";
            const familyName = person.family_name || "";
            const fullName = `${givenName} ${familyName}`.trim();
            const fullNameLower = fullName.toLowerCase();
            const idName = (nodeToName(id) || "").toLowerCase();

            return fullNameLower.includes(query) || idName.includes(query);
        });

        // filter cards based on search
        filteredCards = allCards.filter(card => {
            const title = (card.title || "").toLowerCase();
            const cardId = card['@id']?.replace('smtg:', '').replace(/-/g, '_') || '';
            const keywords = (textsData.cards?.[cardId]?.keywords || []).map(k => k.toLowerCase());
            return title.includes(query) || keywords.some(k => k.includes(query));
        });
    } else {
        matchingDecks = [];
        matchingPersons = [];
        filteredCards = [...allCards];
    }

    // apply category fitlers (AND between categories, OR within values of same category)
    Object.entries(activeFilters).forEach(([type, values]) => {
        if (values.length === 0) return;

        filteredCards = filteredCards.filter(card => {
            const types = Array.isArray(card['@type']) ? card['@type'] : [card['@type']];

            return values.some(val => {
                if (type === 'arcana-type') {
                    const targetType = val === 'major-arcana' ? 'MajorArcana' : 'MinorArcana';
                    return types.some(t => t.includes(targetType));
                }
                if (type === 'author') {
                    const authors = Array.isArray(card.author_id) ? card.author_id : [card.author_id];
                    return authors.some(a => {
                        const id = a?.['@id'] || '';
                        const lowerId = id.toLowerCase();
                        if (val === 'waite-smith') return lowerId.includes('waite') || lowerId.includes('smith');
                        return lowerId.includes(val.toLowerCase());
                    });
                }
                if (type === 'suit') {
                    const suitId = card.suit_id?.['@id'] || '';
                    return suitId.toLowerCase().includes(val.toLowerCase());
                }
                if (type === 'origin') {
                    const nation = card.nation || '';
                    return nation === val;
                }
                if (type === 'year') {
                    const year = card.deck_year || 0;
                    if (val === '1400-1500') return year >= 1400 && year <= 1500;
                    if (val === '1500-1800') return year > 1500 && year <= 1800;
                    if (val === 'after-1800') return year > 1800;
                }
                if (type === 'lineage') {
                    const lineage = card.lineage_id || '';
                    return lineage.toLowerCase().includes(val.toLowerCase());
                }
                return false;
            });
        });
    });

    renderContent();
    updateActiveFilterUI();
}

function applySearchFilter(query) {
    applyFilter('search', query);
}

function resetFilters() {
    activeFilters = {
        'author': [],
        'suit': [],
        'origin': [],
        'year': [],
        'lineage': [],
        'arcana-type': []
    };
    currentSearch = '';
    isGridView = false;
    currentPage = 1;
    filteredCards = [];

    // clear search param from URL without refreshing
    const url = new URL(window.location);
    url.searchParams.delete('search');
    window.history.pushState({}, '', url);

    renderContent();
    updateActiveFilterUI();
}

function attachFilterListeners() {
    const subButtons = document.querySelectorAll('.filter-suboption-btn');
    subButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filterGroup = btn.closest('.filter-group');
            const filterType = filterGroup.querySelector('.filter-btn').dataset.filter;
            const subfilter = btn.dataset.subfilter;
            applyFilter(filterType, subfilter);
        });
    });

    // Clear All Filters button
    const clearAllBtn = document.getElementById('clear-all-filters');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            resetFilters();
            // Close all expandable menus for a clean reset
            document.querySelectorAll('.filter-expandable').forEach(btn => {
                const group = btn.closest('.filter-group');
                const suboptions = group.querySelector('.filter-suboptions');
                btn.classList.remove('open');
                if (suboptions) suboptions.classList.remove('open');
            });
        });
    }
}

function updateActiveFilterUI() {
    // update sub-option buttons
    document.querySelectorAll('.filter-suboption-btn').forEach(btn => {
        const group = btn.closest('.filter-group');
        const type = group?.querySelector('.filter-btn')?.dataset.filter;
        const val = btn.dataset.subfilter;

        let isActive = false;
        if (type && activeFilters[type]) {
            isActive = activeFilters[type].includes(val);
        }
        btn.classList.toggle('active', isActive);
    });

    // update category buttons (filter-btn)
    document.querySelectorAll('.filter-group').forEach(group => {
        const type = group.querySelector('.filter-btn')?.dataset.filter;
        let isCategoryActive = false;
        if (type && activeFilters[type] && activeFilters[type].length > 0) {
            isCategoryActive = true;
        }
        group.querySelector('.filter-btn')?.classList.toggle('active', isCategoryActive);
    });

    // update clear all button visibility
    const clearAllBtn = document.getElementById('clear-all-filters');
    if (clearAllBtn) {
        const anyFilter = hasActiveFilters() || currentSearch !== '';
        clearAllBtn.style.display = anyFilter ? 'inline-block' : 'none';
    }
}

// UI rendering functions
function renderGridView() {
    const gridContainer = document.querySelector('.cards-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';

    const startIndex = (currentPage - 1) * CARDS_PER_GRID_PAGE;
    const endIndex = startIndex + CARDS_PER_GRID_PAGE;
    const cardsToShow = filteredCards.slice(startIndex, endIndex);

    if (cardsToShow.length === 0) {
        gridContainer.innerHTML = '<p class="text-center w-100 py-5">No cards found matching this filter.</p>';
        return;
    }

    cardsToShow.forEach(card => {
        const imgUrl = getLocalImagePath(card.image_url?.['@id']);
        const cardName = card.title || 'Tarot Card';
        const cardNumber = card.card_number || '';
        const fullId = card['@id'] || '';
        const cleanCardId = fullId.replace('smtg:', '');

        const cardHTML = `
            <div class="grid-card-wrapper">
                <a href="card.html?id=${cleanCardId}" class="img-container deck-img-container" style="display:block;text-decoration:none;color:inherit;">
                    <img src="${imgUrl}" alt="${cardName}" class="deck-card-img" loading="lazy" style="display:block;margin:0 auto;" onerror="this.src='assets/images/placeholder_card.jpg';">
                    <div class="card-overlay">
                        <span class="card-number-overlay">${cardNumber}</span>
                        <h3 class="card-title-overlay">${cardName}</h3>
                    </div>
                </a>
            </div>
        `;
        gridContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
}

// get image URL or placeholder
function getLocalImagePath(imgId, type = 'card') {
    if (!imgId || typeof imgId !== 'string') {
        if (type === 'person') {
            return 'assets/images/explore/people/portrait-placeholder.jpg';
        }
        return 'assets/images/placeholder_card.jpg';
    }
    return imgId;
}

function renderDecks() {
    const container = document.getElementById('deck-view');
    if (!container) return;

    const existingWrappers = container.querySelectorAll('.deck-item-wrapper');
    existingWrappers.forEach(el => el.remove());

    const startIndex = (currentPage - 1) * DECKS_PER_PAGE;
    const endIndex = startIndex + DECKS_PER_PAGE;
    const decksToShow = allDecks.slice(startIndex, endIndex);

    decksToShow.forEach((deck, index) => {
        const deckId = (deck['@id'] || 'deck-' + index).replace(/[:/.]/g, '-');
        // necessary to link to deck.html)
        const cleanId = (deck['@id'] || '').replace('smtg:', '');
        const deckTitle = deck.title || deck.title || 'Untitled Deck';
        const description = deck['dcterms:description']?.['@value'] || 'No description available.';

        let coverImg = 'assets/images/placeholder.jpg';
        if (deck.cards && deck.cards.length > 0) {
            const fool = deck.cards.find(c => {
                const name = (c.title || '').toLowerCase();
                const num = c.card_number;
                return name.includes('fool') || num === '0' || num === '00' || num === 'I' || name.includes('matto');
            });
            coverImg = getLocalImagePath((fool || deck.cards[0]).image_url?.['@id']);
        }

        const deckHTML = `
            <div class="deck-item-wrapper">
                <div class="deck-item" id="deck-wrapper-${deckId}">
                    <div class="deck-content" onclick="dropdownDeck('${deckId}')">
                        <img src="${coverImg}" alt="${deckTitle}" class="deck-cover" loading="lazy">
                        <div class="deck-info">
                            <h3>${deckTitle}</h3>
                            <p>${description}</p>
                        </div>
                        <a href="deck.html?id=${cleanId}" class="discover-btn" onclick="event.stopPropagation()" aria-label="Discover more about ${deckTitle}">
                            <span class="discover-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                    <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="12" cy="8" r="1.5"/>
                                </svg>
                            </span>
                            <span class="discover-label">Discover <br>more</span>
                        </a>
                    </div>
                    <div class="dropdown-content" id="${deckId}">
                        <div class="card-scroller-wrapper">
                            <button class="scroller-arrow scroller-prev nav-circle-btn" aria-label="Previous cards">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>
                                </svg>
                            </button>
                            <div class="card-scroller">
                                ${renderCardThumbnails(deck.cards)}
                            </div>
                            <button class="scroller-arrow scroller-next nav-circle-btn" aria-label="Next cards">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="view-deck-tab">
                    <button class="view-deck-btn" onclick="dropdownDeck('${deckId}')">View deck</button>
                </div>
            </div>
        `;

        const paginationContainer = container.querySelector('.pagination-container');
        if (paginationContainer) {
            paginationContainer.insertAdjacentHTML('beforebegin', deckHTML);
        } else {
            container.insertAdjacentHTML('beforeend', deckHTML);
        }
    });

    initScrollers();
}

function renderCardThumbnails(cards) {
    if (!cards || cards.length === 0) return '<p class="text-center w-100 py-3">No cards available.</p>';
    return cards.map(card => {
        const imgUrl = getLocalImagePath(card.image_url?.['@id']);
        const cardName = card.title || 'Card';
        const cardNumber = card.card_number || '';
        const cleanCardId = (card['@id'] || '').replace('smtg:', '');
        return `
            <a href="card.html?id=${cleanCardId}" class="img-container deck-img-container scroller-card" style="display:block;text-decoration:none;color:inherit;">
                <img src="${imgUrl}" alt="${cardName}" class="deck-card-img" loading="lazy" style="display:block;margin:0 auto;" onerror="this.src='assets/images/placeholder_card.jpg';">
                <div class="card-overlay">
                    <span class="card-number-overlay">${cardNumber}</span>
                    <h3 class="card-title-overlay">${cardName}</h3>
                </div>
            </a>`;
    }).join('');
}

function initScrollers() {
    const SCROLL_STEP = 220;
    document.querySelectorAll('.card-scroller-wrapper').forEach(wrapper => {
        const prevArrow = wrapper.querySelector('.scroller-prev');
        const nextArrow = wrapper.querySelector('.scroller-next');
        const scroller = wrapper.querySelector('.card-scroller');

        if (!scroller || !prevArrow || !nextArrow) return;

        const newPrev = prevArrow.cloneNode(true);
        const newNext = nextArrow.cloneNode(true);
        prevArrow.parentNode.replaceChild(newPrev, prevArrow);
        nextArrow.parentNode.replaceChild(newNext, nextArrow);

        newPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            scroller.scrollBy({ left: -SCROLL_STEP, behavior: 'smooth' });
        });

        newNext.addEventListener('click', (e) => {
            e.stopPropagation();
            scroller.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' });
        });
    });
}

function updatePagination() {
    let items = [];
    let perPage = 1;
    let prevBtn = null;
    let nextBtn = null;
    let otherPrevBtn = null;
    let otherNextBtn = null;

    if (currentSearch) {
        // search view renders its own pagination inline. Just hide the global ones
        document.getElementById('grid-prev-btn').style.display = 'none';
        document.getElementById('grid-next-btn').style.display = 'none';
        document.getElementById('prev-btn-bottom').style.display = 'none';
        document.getElementById('next-btn-bottom').style.display = 'none';
        return;
    } else if (isGridView || hasActiveFilters()) {
        items = filteredCards;
        perPage = CARDS_PER_GRID_PAGE;
        prevBtn = document.getElementById('grid-prev-btn');
        nextBtn = document.getElementById('grid-next-btn');
        otherPrevBtn = document.getElementById('prev-btn-bottom');
        otherNextBtn = document.getElementById('next-btn-bottom');
    } else {
        items = allDecks;
        perPage = DECKS_PER_PAGE;
        prevBtn = document.getElementById('prev-btn-bottom');
        nextBtn = document.getElementById('next-btn-bottom');
        otherPrevBtn = document.getElementById('grid-prev-btn');
        otherNextBtn = document.getElementById('grid-next-btn');
    }

    if (!prevBtn || !nextBtn) return;
    if (otherPrevBtn) otherPrevBtn.style.display = 'none';
    if (otherNextBtn) otherNextBtn.style.display = 'none';

    const totalPages = Math.ceil(items.length / perPage);

    prevBtn.style.display = currentPage <= 1 ? 'none' : 'flex';
    nextBtn.style.display = currentPage >= totalPages ? 'none' : 'flex';

    const newPrev = prevBtn.cloneNode(true);
    const newNext = nextBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrev, prevBtn);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);

    newPrev.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderContent();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    newNext.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderContent();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('collection.html')) loadCollection();
});




// --- DECK PAGE --- //
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
        entity.title ||
        entity.card_name ||
        idToFind.split(':').pop().replace(/-/g, ' ');
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
            const cleanId = typeof fullId === 'string' ? fullId.replace('smtg:', '') : '';
            const isEntity = typeof data === 'object' && data['@id'];

            // Check if it's a location or a simple literal - if so, NO LINK
            if (elementId === 'location_created' || !isEntity) {
                const span = document.createElement('span');
                span.innerText = label;
                el.appendChild(span);
            } else {
                // Decide URL based on ID
                const link = document.createElement('a');
                link.innerText = label;

                if (elementId === 'deck_lineage_id') {
                    link.href = `collection.html?filter=lineage&value=${cleanId}`;
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
    setMetaLink('publisher', deck.publisher);
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
    setMetaText('current_card_count', deck.current_card_count);
    setMetaText('original_card_count', deck.original_card_count);

    // Set Digital Source URL
    const sourceUrlEl = document.getElementById('source_url');
    if (sourceUrlEl) {
        if (deck.source_url) {
            let url = deck.source_url;
            if (typeof url === 'object' && url['@id']) {
                url = url['@id'];
            } else if (Array.isArray(url)) {
                url = url[0]['@id'] || url[0];
            }
            sourceUrlEl.href = url;
            sourceUrlEl.target = '_blank';
            sourceUrlEl.innerText = 'View original';
            sourceUrlEl.style.textDecoration = '';
            sourceUrlEl.style.pointerEvents = 'auto';
        } else {
            sourceUrlEl.removeAttribute('href');
            sourceUrlEl.innerText = '-';
            sourceUrlEl.style.textDecoration = 'none';
            sourceUrlEl.style.color = 'inherit';
            sourceUrlEl.style.pointerEvents = 'none';
        }
    }
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

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('deck.html')) initDeckPage();
});


// --- CARD PAGE --- //
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
            generateRelatedTopics(cardData, graph, textsData);
        } else {
            console.warn("Card not found in the Knowledge Graph.");
        }

    } catch (error) {
        console.error("Error loading the card page:", error);
    }
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
    const suitIdEl = document.getElementById('suit_id');

    const types = Array.isArray(card['@type']) ? card['@type'] : [card['@type']];
    const isMajorArcana = types.includes('smt:MajorArcana');

    if (arcanaTypeEl) {
        if (isMajorArcana) arcanaTypeEl.innerText = "Major Arcana";
        else if (types.includes('smt:MinorArcana')) arcanaTypeEl.innerText = "Minor Arcana";
        else arcanaTypeEl.innerText = "-";
    }

    if (minorArcanaTypeEl) {
        if (types.includes('smt:CourtCard')) minorArcanaTypeEl.innerText = "Court Card";
        else if (types.includes('smt:NumberedCard')) minorArcanaTypeEl.innerText = "Numbered Card";
        else minorArcanaTypeEl.innerText = "-";
    }

    // Hide Suit and Minor Arcana Type container rows if the card is a Major Arcana
    if (isMajorArcana) {
        if (suitIdEl && suitIdEl.closest('.meta-row')) suitIdEl.closest('.meta-row').style.display = 'none';
        if (minorArcanaTypeEl && minorArcanaTypeEl.closest('.meta-row')) minorArcanaTypeEl.closest('.meta-row').style.display = 'none';
    } else {
        if (suitIdEl && suitIdEl.closest('.meta-row')) suitIdEl.closest('.meta-row').style.display = 'flex';
        if (minorArcanaTypeEl && minorArcanaTypeEl.closest('.meta-row')) minorArcanaTypeEl.closest('.meta-row').style.display = 'flex';
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
            const cleanArchId = archetypeId.replace('smtg:', '');
            updateDiscoverLink(`deepening.html?id=${cleanArchId}`);

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
            updateDiscoverLink('deepening.html?id=suits_page');

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
function generateRelatedTopics(card, graph, textsData) {
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

    // --- Add topics related to the DECK itself ---
    if (deckObj && textsData && textsData.decks) {
        const deckIdRaw = deckObj['@id'].replace('smtg:', '');
        const normalizedDeckId = deckIdRaw.replace(/-/g, '_');
        const deckTextData = textsData.decks[normalizedDeckId];

        if (deckTextData && deckTextData.related_topics) {
            deckTextData.related_topics.forEach(topicId => {
                const topic = textsData.explore && textsData.explore[topicId];
                if (topic) {
                    createTopicCard(
                        topic.title || "Related Topic",
                        'Discover the history of this deck',
                        `deepening.html?id=${topicId}`
                    );
                }
            });
        }
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
        const symbolsWrapper = document.createElement('div'); // Using div instead of <a> for local script trigger
        symbolsWrapper.style.cursor = 'pointer';

        const cardDiv = document.createElement('div');
        cardDiv.className = 'topic-card';

        const innerDiv = document.createElement('div');
        innerDiv.className = 'topic-card-inner';

        const h4 = document.createElement('h4');
        h4.innerText = 'Symbols';

        const p = document.createElement('p');
        p.innerText = 'Explore the hidden symbols';

        innerDiv.appendChild(h4);
        innerDiv.appendChild(p);
        cardDiv.appendChild(innerDiv);
        symbolsWrapper.appendChild(cardDiv);

        symbolsWrapper.addEventListener('click', (e) => {
            e.preventDefault();
            showSymbolismOverlay(card, graph);
        });

        topicsCarousel.appendChild(symbolsWrapper);
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


/**
 * Shows the Symbolism Overlay with a two-column master-detail view
 */
function showSymbolismOverlay(card, graph) {
    const backdrop = document.getElementById('symbolism-backdrop');
    const overlay = document.getElementById('symbolism-overlay');
    const symbolListCol = document.getElementById('symbol-list-col');
    const relatedCardsGrid = document.getElementById('symbol-related-cards');

    if (!backdrop || !overlay || !symbolListCol || !relatedCardsGrid) return;

    symbolListCol.innerHTML = '';
    relatedCardsGrid.innerHTML = '';

    const figureIds = card.symbolic_figure_id || [];

    if (figureIds.length === 0) {
        symbolListCol.innerHTML = `<p class="symbol-empty-msg">We haven't mapped this card’s symbols yet. In the meantime, try filtering by 'Scepter', 'Dog', 'Eagle', 'Pillars' or 'Water' to see how our semantic search works!</p>`;
        document.getElementById('symbol-details-col').style.display = 'none';
        overlay.classList.add('single-column'); // Optional CSS helper
    } else {
        document.getElementById('symbol-details-col').style.display = 'block';
        overlay.classList.remove('single-column');

        const idList = Array.isArray(figureIds) ? figureIds : [figureIds];

        idList.forEach((id, index) => {
            const figureId = typeof id === 'string' ? id : id['@id'];
            const figure = graph.find(obj => obj['@id'] === figureId);
            const label = figure ? (figure.label || figure['rdfs:label'] || figureId.split(':').pop().replace(/_/g, ' ')) : 'Unknown Symbol';

            const symbolItem = document.createElement('div');
            symbolItem.className = 'symbol-item';
            symbolItem.dataset.id = figureId;

            const mainLabel = document.createElement('strong');
            mainLabel.className = 'symbol-main-label';
            mainLabel.innerText = label;
            symbolItem.appendChild(mainLabel);

            // Related Figures (sub-line)
            if (figure && figure.related_to_id) {
                let relatedIds = [];
                if (Array.isArray(figure.related_to_id)) {
                    relatedIds = figure.related_to_id;
                } else if (typeof figure.related_to_id === 'string') {
                    relatedIds = figure.related_to_id.split(',').map(s => s.trim());
                } else {
                    relatedIds = [figure.related_to_id];
                }

                const relatedLabels = relatedIds.map(relId => {
                    const rId = (typeof relId === 'string' ? relId : relId['@id']).replace('smtg:', '');
                    const lookupId1 = `smtg:${rId.replace(/_/g, '-')}`;
                    const lookupId2 = `smtg:${rId.replace(/-/g, '_')}`;
                    const relFigure = graph.find(obj => obj['@id'] === lookupId1 || obj['@id'] === lookupId2 || obj['@id'] === rId);
                    return relFigure ? (relFigure.label || relFigure['rdfs:label']) : rId.replace(/_/g, ' ').replace(/-/g, ' ');
                }).filter(l => l);

                if (relatedLabels.length > 0) {
                    const relatedList = document.createElement('p');
                    relatedList.className = 'symbol-related-list';
                    relatedList.innerText = relatedLabels.join(', ');
                    symbolItem.appendChild(relatedList);
                }
            }

            // Click Handler
            symbolItem.addEventListener('click', () => {
                // Clear active states
                document.querySelectorAll('.symbol-item').forEach(el => el.classList.remove('active'));
                symbolItem.classList.add('active');

                // Show details (description + cards)
                renderSymbolDetails(figureId, figure, graph, symbolItem);
            });

            symbolListCol.appendChild(symbolItem);

            // Auto-select first symbol
            if (index === 0) {
                symbolItem.click();
            }
        });
    }

    backdrop.style.display = 'block';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

/**
 * Renders the description under the symbol and updates the right column with related cards
 */
function renderSymbolDetails(symbolId, symbolObj, graph, parentElement) {
    // 1. Handle Description in Left Column
    document.querySelectorAll('.symbol-description').forEach(el => el.remove());

    if (symbolObj && symbolObj['dcterms:description']) {
        const descContent = typeof symbolObj['dcterms:description'] === 'object'
            ? (symbolObj['dcterms:description']['@value'] || symbolObj['dcterms:description'].label)
            : symbolObj['dcterms:description'];

        if (descContent) {
            const descEl = document.createElement('div');
            descEl.className = 'symbol-description';
            descEl.innerText = descContent;
            parentElement.appendChild(descEl);
        }
    }

    // 2. Handle Related Cards in Right Column
    const relatedCardsGrid = document.getElementById('symbol-related-cards');
    relatedCardsGrid.innerHTML = '';

    // A. Render Primary Symbol Section
    const primaryCards = findCardsBySymbol(symbolId, graph);
    const primaryLabel = symbolObj ? (symbolObj.label || symbolId.replace('smtg:', '').replace(/_/g, ' ')) : "this symbol";
    renderCardSection(relatedCardsGrid, `Also found in`, primaryCards);

    // B. Render Related Symbols Sections
    if (symbolObj && symbolObj.related_to_id) {
        let relatedIds = [];
        if (Array.isArray(symbolObj.related_to_id)) {
            relatedIds = symbolObj.related_to_id;
        } else if (typeof symbolObj.related_to_id === 'string') {
            relatedIds = symbolObj.related_to_id.split(',').map(s => s.trim());
        } else {
            relatedIds = [symbolObj.related_to_id];
        }

        relatedIds.forEach(relId => {
            const rId = (typeof relId === 'string' ? relId : relId['@id']).replace('smtg:', '');
            const lookupId1 = `smtg:${rId.replace(/_/g, '-')}`;
            const lookupId2 = `smtg:${rId.replace(/-/g, '_')}`;
            const relFigure = graph.find(obj => obj['@id'] === lookupId1 || obj['@id'] === lookupId2 || obj['@id'] === rId);

            const relLabel = relFigure ? (relFigure.label || relFigure['rdfs:label']) : rId.replace(/_/g, ' ').replace(/-/g, ' ');
            const relCards = findCardsBySymbol(relFigure ? relFigure['@id'] : lookupId1, graph);

            if (relCards.length > 0) {
                renderCardSection(relatedCardsGrid, `Related Symbol: ${relLabel}`, relCards, true);
            }
        });
    }
}

/**
 * Global search for any DeckCard that contains a specific symbol
 */
function findCardsBySymbol(symbolId, graph) {
    if (!symbolId) return [];
    return graph.filter(obj => {
        if (!obj['@type']) return false;
        const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
        if (!types.some(t => t.includes('DeckCard'))) return false;

        const cardSymbols = obj.symbolic_figure_id;
        if (!cardSymbols) return false;

        const symbolList = Array.isArray(cardSymbols) ? cardSymbols : [cardSymbols];
        return symbolList.some(s => {
            const sId = typeof s === 'string' ? s : s['@id'];
            return sId === symbolId;
        });
    });
}

/**
 * Appends a titled section of card thumbnails to the container
 */
function renderCardSection(container, title, cards, isSubSection = false) {
    if (!cards || cards.length === 0) return;

    // Create Section Header
    const sectionHeader = document.createElement('h5');
    sectionHeader.className = isSubSection ? 'symbol-subsection-title mt-4' : 'symbol-section-subtitle mb-4';
    sectionHeader.innerText = title;
    container.appendChild(sectionHeader);

    const grid = document.createElement('div');
    grid.className = 'symbol-related-cards-grid px-2 mb-4';

    cards.forEach(card => {
        const cardTitle = card.title || card.label || "Tarot Card";
        const imgUrl = card.image_url ? (card.image_url['@id'] || card.image_url) : null;
        const cleanId = card['@id'].replace('smtg:', '');

        const cardLink = document.createElement('a');
        cardLink.className = 'mini-card-cross-ref';
        cardLink.href = `card.html?id=${cleanId}`;
        cardLink.innerHTML = `
            <img src="${getLocalImagePath(imgUrl)}" alt="${cardTitle}" onerror="this.src='assets/images/placeholder_card.jpg';">
            <span>${cardTitle}</span>
        `;
        grid.appendChild(cardLink);
    });

    container.appendChild(grid);
}

function closeSymbolismOverlay() {
    const backdrop = document.getElementById('symbolism-backdrop');
    const overlay = document.getElementById('symbolism-overlay');
    if (backdrop) backdrop.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('card.html')) {
        initCardPage();
    }

    // Close listeners
    const closeBtn = document.getElementById('closeSymbolism');
    const backdrop = document.getElementById('symbolism-backdrop');

    if (closeBtn) closeBtn.addEventListener('click', closeSymbolismOverlay);
    if (backdrop) backdrop.addEventListener('click', closeSymbolismOverlay);
});

