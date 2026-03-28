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
    return id.split(':').pop().split('_').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function loadCollection() {
    // Initialize view from URL first (prevents CORS blockage from hiding search)
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    
    if (searchParam) {
        currentSearch = searchParam;
        isGridView = true;
        // Immediate show of banner
        const searchBanner = document.getElementById('search-results-banner');
        const searchDisplay = document.getElementById('search-query-display');
        if (searchBanner) searchBanner.style.display = 'block';
        if (searchDisplay) searchDisplay.innerText = currentSearch;
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

window.goToPage = function(page) {
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
            personsHTML += `
                <a href="person.html?id=${cleanId}" class="person-circle-item text-center text-decoration-none" style="width: 120px;">
                    <div class="person-img-circle mx-auto mb-2">
                         <img src="assets/images/logo/purple.png" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;">
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
            const name = (nodeToName(id) || "").toLowerCase();
            const personId = id.replace(/-/g, '_');
            const keywords = (textsData.person?.[personId]?.keywords || []).map(k => k.toLowerCase());
            return name.includes(query) || keywords.some(k => k.includes(query));
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
}

// UI rendering functions -> generate the html content
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

// convert GitHub blob URLs to raw image URLs (same as deck.js)
function getLocalImagePath(imgId) {
    if (!imgId || typeof imgId !== 'string') return 'assets/images/placeholder_card.jpg';
    if (imgId.includes('github.com') && imgId.includes('/blob/')) {
        return imgId
            .replace('github.com', 'raw.githubusercontent.com')
            .replace('/blob/', '/');
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

document.addEventListener('DOMContentLoaded', loadCollection);
