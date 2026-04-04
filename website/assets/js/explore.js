/**
 * explore.js
 * Dynamically populates and filters the Explore page grid.
 */

let fullDataset = []; // Store the full list of items globally after fetching
let activeFilters = new Set(); // Track multiple active filter categories

const TOPICS_PER_PAGE = 12;
let currentPage = 1;

async function initExplorePage() {
    try {
        // 1. Fetch Data
        const [graphRes, textsRes] = await Promise.all([
            fetch('assets/json/smtGraph.jsonld'),
            fetch('assets/json/texts.json')
        ]);

        const graphData = await graphRes.json();
        const textsData = await textsRes.json();
        const graph = graphData['@graph'];

        fullDataset = [];

        // 2. Collect People (odi:Person)
        graph.forEach(item => {
            const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            if (types.includes('odi:Person')) {
                const fullName = [item.given_name, item.family_name].filter(Boolean).join(' ');
                const cleanId = item['@id'] ? item['@id'].replace('smtg:', '') : '';

                fullDataset.push({
                    title: fullName,
                    subtitle: "Explore the Life",
                    link: `person.html?id=${cleanId}`,
                    category: 'people'
                });
            }
        });

        // 3. Collect Archetypes (smt:Archetype)
        graph.forEach(item => {
            const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            if (types.includes('smt:Archetype')) {
                const label = item.label || item['skos:prefLabel'] || 'Archetype';
                const cleanId = item['@id'] ? item['@id'].replace('smtg:', '') : '';

                fullDataset.push({
                    title: label,
                    subtitle: "Deepen the Archetype",
                    link: `deepening.html?id=${cleanId}`,
                    category: 'arcana'
                });
            }
        });

        // 4. Collect Topics (texts.json explore keys, except archetypes_page)
        const explorePages = textsData.explore || {};
        Object.keys(explorePages).forEach(key => {
            if (key === 'archetypes_page') return;

            const pageData = explorePages[key];
            // Use the title from JSON, or a cleaned version of the key as fallback
            const title = pageData.title || key.replace(/_/g, ' ').replace('page', '').trim();

            fullDataset.push({
                title: title,
                subtitle: "Explore the Topic",
                link: `deepening.html?id=${key}`,
                // Logic: suits_page is category 'suits', everything else is 'mirroring'
                category: key === 'suits_page' ? 'suits' : 'mirroring'
            });
        });

        // 5. Initial Sort
        fullDataset.sort((a, b) => a.title.localeCompare(b.title));

        // 6. Setup Listeners
        setupFilterListeners();

        // 7. Handle URL Parameters for pre-filtering
        const urlParams = new URLSearchParams(window.location.search);
        const filterParam = urlParams.get('filter');
        if (filterParam) {
            activeFilters.add(filterParam);

            // Special handling to expand parent category if it's a subfilter
            const subBtn = document.querySelector(`.filter-suboption-btn[data-subfilter="${filterParam}"]`);
            if (subBtn) {
                const group = subBtn.closest('.filter-group');
                if (group) {
                    group.querySelectorAll('.filter-expandable, .filter-suboptions').forEach(el => el.classList.add('open'));
                }
            }
        }

        // 8. Initial Render (applying filters if any)
        updateFilterUI();
        applyFilters();

    } catch (error) {
        console.error("Error initializing Explore page:", error);
    }
}

/**
 * Renders the topic cards in the grid.
 * @param {Array} items 
 */
function renderGrid(items) {
    const exploreGrid = document.querySelector('.explore-grid');
    if (!exploreGrid) return;

    exploreGrid.innerHTML = ''; // Clear current grid

    // Pagination Logic
    const startIndex = (currentPage - 1) * TOPICS_PER_PAGE;
    const endIndex = startIndex + TOPICS_PER_PAGE;
    const itemsToShow = items.slice(startIndex, endIndex);

    itemsToShow.forEach(item => {
        const card = createTopicCard(item.title, item.subtitle, item.link);
        exploreGrid.appendChild(card);
    });

    // If no items match, show a friendly message
    if (items.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'col-12 text-center my-5';
        noResults.innerHTML = `<p class="lead" style="color: var(--floral-white); opacity: 0.7;">No items match the selected filters.</p>`;
        exploreGrid.appendChild(noResults);
    }

    updatePagination(items.length);
}

/**
 * Updates the visibility and functionality of pagination arrows.
 * @param {number} totalItems 
 */
function updatePagination(totalItems) {
    const prevBtn = document.getElementById('grid-prev-btn');
    const nextBtn = document.getElementById('grid-next-btn');
    if (!prevBtn || !nextBtn) return;

    const totalPages = Math.ceil(totalItems / TOPICS_PER_PAGE);

    // Show/Hide based on page limits
    prevBtn.style.display = currentPage <= 1 ? 'none' : 'flex';
    nextBtn.style.display = currentPage >= totalPages ? 'none' : 'flex';

    // Remove old listeners by cloning
    const newPrev = prevBtn.cloneNode(true);
    const newNext = nextBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrev, prevBtn);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);

    newPrev.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            applyFilters();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    newNext.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            applyFilters();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

/**
 * Sets up filtering listeners for sidebar buttons.
 */
function setupFilterListeners() {
    const filterBtns = document.querySelectorAll('.filter-btn, .filter-suboption-btn');
    const clearAllBtn = document.getElementById('clear-all-filters');

    // Clear All Logic
    if (clearAllBtn) {
        // Hide by default if nothing is selected
        clearAllBtn.style.display = 'none';

        clearAllBtn.addEventListener('click', () => {
            activeFilters.clear();

            // Also close any expanded menus
            document.querySelectorAll('.filter-expandable, .filter-suboptions').forEach(el => {
                el.classList.remove('open');
            });

            updateFilterUI();
            currentPage = 1; // Reset to first page
            applyFilters();
        });
    }

    // Toggle Labels Logic
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function (e) {
            const category = this.dataset.filter || this.dataset.subfilter;
            if (!category) return;

            // Toggle category in the Set
            if (activeFilters.has(category)) {
                activeFilters.delete(category);
                // If we're turning it off, also remove 'open' state if it has no suboptions
                const group = this.closest('.filter-group');
                const hasSuboptions = group ? group.querySelector('.filter-suboptions') : null;
                if (!hasSuboptions) {
                    this.classList.remove('open');
                }
            } else {
                activeFilters.add(category);
            }

            updateFilterUI();
            currentPage = 1; // Reset to first page
            applyFilters();
        });
    });
}

/**
 * Filters the dataset based on active categories and re-renders.
 */
function applyFilters() {
    if (activeFilters.size === 0) {
        renderGrid(fullDataset);
    } else {
        const filtered = fullDataset.filter(item => activeFilters.has(item.category));
        renderGrid(filtered);
    }
}

/**
 * Updates the visual state (active class) of buttons and visibility of Clear All.
 */
function updateFilterUI() {
    const filterBtns = document.querySelectorAll('.filter-btn, .filter-suboption-btn');
    const clearAllBtn = document.getElementById('clear-all-filters');

    filterBtns.forEach(btn => {
        const category = btn.dataset.filter || btn.dataset.subfilter;
        if (category && activeFilters.has(category)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (clearAllBtn) {
        clearAllBtn.style.display = activeFilters.size > 0 ? 'inline-block' : 'none';
    }
}

/**
 * Creates a standard topic card element.
 */
function createTopicCard(title, subtitle, linkUrl) {
    const linkWrapper = document.createElement('a');
    linkWrapper.href = linkUrl;
    linkWrapper.className = 'topic-card text-decoration-none';

    const innerDiv = document.createElement('div');
    innerDiv.className = 'topic-card-inner';

    const h4 = document.createElement('h4');
    h4.innerText = title;

    const p = document.createElement('p');
    p.innerText = subtitle;

    innerDiv.appendChild(h4);
    innerDiv.appendChild(p);
    linkWrapper.appendChild(innerDiv);

    return linkWrapper;
}

document.addEventListener('DOMContentLoaded', initExplorePage);
