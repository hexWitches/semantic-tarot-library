// --- EXPLORE PAGE --- //
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

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('explore.html')) initExplorePage();
});


// DEEPENING //
/**
 * Dynamically fills deepening.html with content from texts.json and smtGraph.jsonld.
 * Handles both standard topic pages and specialized Archetype pages.
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.location.pathname.includes('deepening.html')) return;
    const urlParams = new URLSearchParams(window.location.search);
    const topicId = urlParams.get('id');

    if (!topicId) {
        console.error("Topic ID missing in URL.");
        return;
    }

    try {
        // 1. Fetch text data first to identify the page type
        const textResponse = await fetch('assets/json/texts.json');
        const textData = await textResponse.json();
        const exploreData = textData.explore || {};

        // Normalize ID for texts.json (underscores)
        const normalizedId = topicId.replace(/-/g, '_');

        // Check if it's a standard topic or a specific archetype
        let pageData = exploreData[topicId] || exploreData[normalizedId];
        let isArchetype = false;

        // If not found in root explore, check archetypes_page
        if (!pageData && exploreData.archetypes_page) {
            pageData = exploreData.archetypes_page[normalizedId];
            if (pageData) isArchetype = true;
        }

        if (pageData) {
            if (isArchetype) {
                // For archetypes, also fetch the Graph data for formal metadata
                const graphResponse = await fetch('assets/json/smtGraph.jsonld');
                const graphData = await graphResponse.json();
                const graph = graphData['@graph'] || [];

                // Find the archetype in the graph using the original (hyphenated) ID
                const archetypeGraphData = graph.find(item =>
                    item['@id'] === `smtg:${topicId}` || item['@id'] === `smtg:${normalizedId}`
                );

                renderArchetypePage(pageData, archetypeGraphData, graph);
            } else {
                renderTopicPage(pageData);
            }
        } else {
            console.warn(`Topic "${topicId}" not found.`);
            document.querySelector('.page-title').innerText = "Topic Not Found";
        }
    } catch (error) {
        console.error("Error loading the deepening page:", error);
    }
});

/**
 * Specialized rendering for Archetype pages.
 * Integrates formal Graph metadata with narrative content and a side portrait.
 */
function renderArchetypePage(pageData, graphData, allGraph) {
    const title = (graphData && graphData.label) ? graphData.label : (pageData.title || "Archetype Detail");

    // 1. Setup Base Layout (Banner hidden)
    setupBasePageLayout(title, pageData, true);

    // 2. Render Archetype Related Cards Carousel
    if (graphData) {
        renderArchetypeCarousel(graphData['@id'], title, allGraph);
    }

    // 3. Render Archetype Metadata Table
    if (graphData) {
        renderArchetypeMetadata(graphData);
    }

    // 4. Render Narrative Body
    renderBodyContent(pageData);
}

/**
 * Standard rendering for Topic pages.
 */
function renderTopicPage(pageData) {
    const title = pageData.title || "Explore the Topic";
    setupBasePageLayout(title, pageData, false);
    renderBodyContent(pageData);
}

/**
 * Sets up the base UI elements (Title, Breadcrumb, Banner, Intro).
 * Also handles the grid structural shifts between Archetype and Standard topics.
 */
function setupBasePageLayout(title, pageData, isArchetype) {
    document.title = `${title} - The SMT Library`;

    // Breadcrumb
    const breadcrumbTopic = document.getElementById('breadcrumb_topic');
    if (breadcrumbTopic) breadcrumbTopic.innerText = title;

    // Header (Title & Intro - Always Centered)
    const titleEl = document.querySelector('.page-title');
    if (titleEl) titleEl.innerHTML = title;

    const introEl = document.querySelector('.collection-desc');
    if (introEl) {
        introEl.innerHTML = pageData.intro || pageData.subtitle || "";
    }

    // --- GRID ADJUSTMENTS ---
    const parentRow = document.getElementById('deepening-main-row');
    const metadataCol = document.getElementById('metadata-col');
    const contentCol = document.getElementById('main-content-col');
    const carouselSection = document.getElementById('archetype-carousel-section');

    if (isArchetype) {
        // Archetype Layout: Metadata (col-4) + Text (col-8)
        if (parentRow) parentRow.classList.remove('justify-content-center');
        if (metadataCol) metadataCol.style.display = 'block';
        if (contentCol) {
            contentCol.className = 'col-lg-8 mb-4';
        }
        if (carouselSection) carouselSection.style.display = 'block';
    } else {
        // Standard Topic Layout: Centered (col-9)
        if (parentRow) parentRow.classList.add('justify-content-center');
        if (metadataCol) metadataCol.style.display = 'none';
        if (contentCol) {
            contentCol.className = 'col-lg-9 mx-auto mb-4';
        }
        if (carouselSection) carouselSection.style.display = 'none';
    }

    // --- BANNER HANDLING (Only for Topics) ---
    const bannerSection = document.querySelector('.topic-banner');
    if (bannerSection) {
        // ... (banner logic remains the same but wrapped in isArchetype check)
        if (isArchetype) {
            bannerSection.style.display = 'none';
        } else {
            const bannerImg = bannerSection.querySelector('img');
            const bannerData = pageData.banner_image || pageData.image_banner || pageData.banner;

            if (bannerData && bannerData.path && bannerImg) {
                bannerImg.src = bannerData.path;
                bannerImg.alt = bannerData.alt || title;
                bannerSection.style.display = 'block';
            } else {
                bannerSection.style.display = 'none';
            }
        }
    }

    // Hide metadata container if not an archetype
    const metaContainer = document.getElementById('archetype-metadata-container');
    if (metaContainer && !isArchetype) {
        metaContainer.style.display = 'none';
    }
}

/**
 * Generates and injects the Archetype Metadata table.
 */
function renderArchetypeMetadata(graphData) {
    const container = document.getElementById('archetype-metadata-container');
    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = ''; // Clear previous content

    const table = document.createElement('table');
    table.className = 'archetype-metadata-table';

    const rows = [
        { label: 'Archetype Number', value: graphData.archetype_number || 'N/A' },
        { label: 'Description', value: graphData['dcterms:description'] ? graphData['dcterms:description']['@value'] : 'N/A', class: 'metadata-description' }
    ];

    if (graphData.alt_title) {
        const altTitles = Array.isArray(graphData.alt_title) ? graphData.alt_title : [graphData.alt_title];
        const tagsHtml = altTitles.map(t => `<span class="alt-title-tag">${t}</span>`).join('');
        rows.unshift({ label: 'Alternative Titles', value: `<div class="metadata-alt-titles">${tagsHtml}</div>` });
    }

    rows.forEach(row => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.innerText = row.label;

        const td = document.createElement('td');
        if (row.class) td.className = row.class;
        td.innerHTML = row.value;

        tr.appendChild(th);
        tr.appendChild(td);
        table.appendChild(tr);
    });

    container.appendChild(table);
}

/**
 * Renders the body narrative sections into the container.
 */
function renderBodyContent(pageData) {
    const container = document.querySelector('.topic-text-container');
    if (!container) return;
    container.innerHTML = '';

    const bodyData = pageData.body_content || pageData.body;

    if (bodyData) {
        if (typeof bodyData === 'string') {
            renderTextSection(container, bodyData);
        } else if (Array.isArray(bodyData)) {
            bodyData.forEach(section => {
                const content = section.content || section.text || section.concept;
                if (section.type === 'image') {
                    renderImageSection(container, section.path, section.alt, section.caption);
                } else if (section.type === 'subtitle') {
                    renderHeadingSection(container, content);
                } else {
                    renderTextSection(container, content);
                }
            });
        }
    } else {
        // Fallback for legacy multi-key objects
        const metadataKeys = ['title', 'intro', 'subtitle', 'banner', 'image_banner', 'banner_image', 'img', 'body', 'body_content'];
        Object.keys(pageData).forEach(key => {
            if (!metadataKeys.includes(key)) {
                const heading = key.charAt(0).toUpperCase() + key.slice(1);
                renderTextSection(container, pageData[key], heading);
            }
        });
    }
}

/**
 * Renders the carousel of cards associated with a specific archetype.
 */
function renderArchetypeCarousel(archetypeId, archetypeLabel, graph) {
    const scroller = document.getElementById('archetype-cards-scroller');
    const section = document.getElementById('archetype-carousel-section');
    const titleEl = document.getElementById('archetype-carousel-title');

    if (!scroller || !section || !titleEl) return;

    // Set dynamic title
    titleEl.innerText = `Discover the many faces of ${archetypeLabel}`;

    // Filter cards that represent this archetype
    const relatedCards = graph.filter(item => {
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (!types.includes('odi:DeckCard')) return false;

        const arch = item.archetype_id;
        if (!arch) return false;

        const archId = typeof arch === 'string' ? arch : arch['@id'];
        return archId === archetypeId;
    });

    if (relatedCards.length === 0) {
        section.style.display = 'none';
        return;
    }

    scroller.innerHTML = relatedCards.map(card => {
        const imgUrl = getLocalImagePath(card.image_url?.['@id']);
        const cardName = card.title || 'Tarot Card';
        const cardNumber = card.card_number || '';
        const cleanId = (card['@id'] || '').replace('smtg:', '');

        return `
            <a href="card.html?id=${cleanId}" class="img-container deck-img-container scroller-card">
                <img src="${imgUrl}" alt="${cardName}" class="deck-card-img" loading="lazy" onerror="this.src='assets/images/placeholder_card.jpg';">
            </a>`;
    }).join('');

    initScrollers();
}

/**
 * Initializes carousel arrow sliding.
 */
function initScrollers() {
    const SCROLL_STEP = 330;
    document.querySelectorAll('.card-scroller-wrapper').forEach(wrapper => {
        const prevArrow = wrapper.querySelector('.scroller-prev');
        const nextArrow = wrapper.querySelector('.scroller-next');
        const scroller = wrapper.querySelector('.card-scroller');

        if (!scroller || !prevArrow || !nextArrow) return;

        // Use standard event listeners (cloning is safer for multiple calls)
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

function getLocalImagePath(imgId, type = 'card') {
    if (!imgId || typeof imgId !== 'string') {
        return 'assets/images/placeholder_card.jpg';
    }
    return imgId;
}

/**
 * Rendering Helpers
 */
function renderHeadingSection(container, content) {
    if (!content) return;
    const h3 = document.createElement('h3');
    h3.className = 'mt-5 mb-4';
    h3.innerHTML = content;
    container.appendChild(h3);
}

function renderTextSection(container, content, heading = null) {
    if (!content) return;
    if (heading) renderHeadingSection(container, heading);
    const div = document.createElement('div');
    div.className = 'topic-text-block mb-4';
    div.innerHTML = content;
    container.appendChild(div);
}

function renderImageSection(container, src, alt, caption = null) {
    if (!src) return;
    const figure = document.createElement('figure');
    figure.className = 'topic-image-block my-5 text-center';
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || "Topic image";
    img.className = 'img-fluid rounded shadow-sm';
    figure.appendChild(img);
    if (caption) {
        const figcaption = document.createElement('figcaption');
        figcaption.className = 'mt-3 small text-muted italic';
        figcaption.innerHTML = caption;
        figure.appendChild(figcaption);
    }
    container.appendChild(figure);
}


// PERSON //
document.addEventListener('DOMContentLoaded', async () => {
    if (!window.location.pathname.includes('person.html')) return;
    const urlParams = new URLSearchParams(window.location.search);
    const personId = urlParams.get('id'); // e.g., 'person-waite'

    if (!personId) {
        console.error("Person ID missing in URL.");
        return;
    }

    try {
        const [kgResponse, textsResponse] = await Promise.all([
            fetch('assets/json/smtGraph.jsonld'),
            fetch('assets/json/texts.json')
        ]);

        const kgData = await kgResponse.json();
        const textsData = await textsResponse.json();
        const graph = kgData['@graph'];

        // Find Person in Graph
        const personData = graph.find(obj => {
            const itemId = obj['@id'];
            return itemId === `smtg:${personId}` || itemId === personId;
        });

        if (personData) {
            // Match description from texts.json 
            const normalizedId = personId.replace(/-/g, '_');
            const allPersonsText = textsData.person || {};
            const extraTextsKey = Object.keys(allPersonsText).find(key => key.trim() === normalizedId);
            const extraTexts = allPersonsText[extraTextsKey];

            fillPersonMetadata(personData, extraTexts, graph);
        } else {
            console.warn("Person not found in the Knowledge Graph.");
        }
    } catch (error) {
        console.error("Error loading the person page:", error);
    }
});

function getLocalPersonImagePath(imageUrl) {
    if (!imageUrl) return 'assets/images/explore/people/portrait-placeholder.jpg';
    return imageUrl;
}

/**
 * Helper: Finds an entity in the graph by ID and returns its human-readable label
 */
function getEntityLabel(graph, entityData) {
    if (!entityData) return null;

    const data = Array.isArray(entityData) ? entityData[0] : entityData;
    const idToFind = typeof data === 'string' ? data : data['@id'];
    if (!idToFind) return null;

    const entity = graph.find(obj => obj['@id'] === idToFind);

    if (!entity) {
        return idToFind.includes(':') ? idToFind.split(':').pop().replace(/-/g, ' ') : idToFind;
    }

    if (entity.given_name || entity.family_name) {
        const first = entity.given_name || "";
        const last = entity.family_name || "";
        return `${first} ${last}`.trim();
    }

    return entity.label ||
        entity['rdfs:label'] ||
        entity.lineage_label ||
        idToFind.split(':').pop().replace(/-/g, ' ');
}

function fillPersonMetadata(person, extraTexts, graph) {
    const givenName = person.given_name || '';
    const familyName = person.family_name || '';
    const fullName = `${givenName} ${familyName}`.trim() || 'Unknown Person';

    const nameEl = document.getElementById('person-name');
    if (nameEl) nameEl.innerText = fullName;

    document.title = `${fullName} - The SMT Library`;

    const breadcrumb = document.getElementById('breadcrumb-person');
    if (breadcrumb) breadcrumb.innerText = fullName;

    // Nationality
    const natEl = document.getElementById('person-nationality');
    if (natEl) {
        natEl.innerText = person.nationality || "";
        if (!person.nationality) {
            natEl.style.display = 'none';
            // Also hide the separator
            const separator = natEl.nextElementSibling;
            if (separator && separator.textContent.trim() === '|') {
                separator.style.display = 'none';
            }
        }
    }

    // Dates
    const datesEl = document.getElementById('person-dates');
    if (datesEl) {
        if (person.dates_display) {
            let displayVal = Array.isArray(person.dates_display) ? person.dates_display[0] : person.dates_display;
            datesEl.innerText = typeof displayVal === 'object' ? displayVal['@value'] : displayVal;
        } else {
            let birthStr = person.birth_year ? person.birth_year : "?";
            let deathStr = person.death_year ? person.death_year : "?";
            datesEl.innerText = `${birthStr} - ${deathStr}`;
        }
    }

    // Authorities
    const authEl = document.getElementById('person-authorities');
    if (authEl) {
        authEl.innerHTML = '';
        if (person['owl:sameAs']) {
            const auths = Array.isArray(person['owl:sameAs']) ? person['owl:sameAs'] : [person['owl:sameAs']];
            auths.forEach(auth => {
                const id = typeof auth === 'object' ? auth['@id'] : auth;
                if (!id) return;

                let href = '';
                let label = '';

                if (id.startsWith('wd:')) {
                    href = `https://www.wikidata.org/wiki/${id.replace('wd:', '')}`;
                    label = 'Wikidata';
                } else if (id.startsWith('viaf:')) {
                    href = `http://viaf.org/viaf/${id.replace('viaf:', '')}`;
                    label = 'VIAF';
                }

                if (href && label) {
                    const badge = document.createElement('a');
                    badge.href = href;
                    badge.target = '_blank';
                    badge.rel = 'noopener noreferrer';
                    badge.className = 'badge rounded-pill border border-secondary text-secondary text-decoration-none px-3 py-2 fw-normal';
                    badge.style.transition = 'all 0.2s';
                    badge.onmouseover = () => { badge.classList.replace('text-secondary', 'text-dark'); badge.classList.replace('border-secondary', 'border-dark'); };
                    badge.onmouseout = () => { badge.classList.replace('text-dark', 'text-secondary'); badge.classList.replace('border-dark', 'border-secondary'); };
                    badge.innerHTML = `<i class="bi bi-box-arrow-up-right me-1"></i> ${label}`;
                    authEl.appendChild(badge);
                }
            });
        }
    }

    // Portrait Image
    const imgEl = document.getElementById('person-portrait');
    if (imgEl) {
        const rawUrl = person.person_portrait_url ? (person.person_portrait_url['@id'] || person.person_portrait_url) : null;
        imgEl.src = getLocalPersonImagePath(rawUrl);
        imgEl.alt = fullName;
    }

    // Bio
    const bioContainer = document.getElementById('person-bio-container');
    const bioExcerpt = document.getElementById('bio-excerpt');
    const bioFull = document.getElementById('bio-full');
    const bioAccordion = document.getElementById('bioAccordion');

    if (bioContainer) {
        bioContainer.classList.remove('d-none');

        if (extraTexts && extraTexts.bio) {
            const tmpDiv = document.createElement('div');
            tmpDiv.innerHTML = extraTexts.bio;
            const paragraphs = Array.from(tmpDiv.querySelectorAll('p'));

            if (paragraphs.length > 0) {
                if (bioExcerpt) bioExcerpt.innerHTML = paragraphs[0].outerHTML;

                if (paragraphs.length > 1) {
                    paragraphs.shift();
                    if (bioFull) bioFull.innerHTML = paragraphs.map(p => p.outerHTML).join('');
                } else {
                    if (bioAccordion) bioAccordion.style.display = 'none';
                }
            } else {
                if (bioExcerpt) bioExcerpt.innerHTML = extraTexts.bio;
                if (bioAccordion) bioAccordion.style.display = 'none';
            }
        } else {
            if (bioExcerpt) bioExcerpt.innerText = "Detailed biography coming soon.";
            if (bioAccordion) bioAccordion.style.display = 'none';
        }
    }

    // Related Topics (Decks)
    const topicsContainer = document.getElementById('topicsCarousel');
    const topicsSection = document.querySelector('.related-topics-section');
    if (topicsContainer && topicsSection && graph) {
        topicsContainer.innerHTML = ''; // Start empty

        // Find all decks where this person is author, illustrator or publisher
        const relatedDecks = graph.filter(item => {
            const typeArr = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            if (!typeArr.includes('odi:TarotDeck')) return false;

            const checkRef = (field) => {
                if (!field) return false;
                const arr = Array.isArray(field) ? field : [field];
                return arr.some(r => {
                    const id = typeof r === 'object' ? r['@id'] : r;
                    return id === person['@id'];
                });
            };

            return checkRef(item.author_id) || checkRef(item.illustrator_id) || checkRef(item.publisher);
        });

        if (relatedDecks && relatedDecks.length > 0) {
            const collaborators = new Map(); // ID -> Name

            // 1. Show Decks
            relatedDecks.forEach(deck => {
                const deckId = deck['@id'];
                const cleanDeckId = deckId.replace('smtg:', '');
                const title = deck.title || deck.alternative_title || 'Tarot Deck';

                const cardEl = document.createElement('a');
                cardEl.href = `deck.html?id=${cleanDeckId}`;
                cardEl.className = 'topic-card text-decoration-none';
                cardEl.style.backgroundColor = 'var(--dark-amethyst)';

                const innerEl = document.createElement('div');
                innerEl.className = 'topic-card-inner';

                const titleEl = document.createElement('h4');
                titleEl.innerText = title;
                titleEl.className = 'm-0';

                const subtitleEl = document.createElement('p');
                subtitleEl.innerText = 'Deck';
                subtitleEl.className = 'small mt-2 mb-0 text-uppercase tracking-wide';

                innerEl.appendChild(titleEl);
                innerEl.appendChild(subtitleEl);
                cardEl.appendChild(innerEl);
                topicsContainer.appendChild(cardEl);

                // Collect collaborators
                const collectCollaborators = (field) => {
                    if (!field) return;
                    const arr = Array.isArray(field) ? field : [field];
                    arr.forEach(ref => {
                        const id = typeof ref === 'object' ? ref['@id'] : ref;
                        if (id && id !== person['@id']) {
                            const label = getEntityLabel(graph, id);
                            if (label) collaborators.set(id, label);
                        }
                    });
                };
                collectCollaborators(deck.author_id);
                collectCollaborators(deck.illustrator_id);
            });

            // 2. Show Collaborators
            collaborators.forEach((name, id) => {
                const cleanId = id.replace('smtg:', '');
                const cardEl = document.createElement('a');
                cardEl.href = `person.html?id=${cleanId}`;
                cardEl.className = 'topic-card text-decoration-none';
                cardEl.style.backgroundColor = 'var(--dark-amethyst)';

                const innerEl = document.createElement('div');
                innerEl.className = 'topic-card-inner';

                const titleEl = document.createElement('h4');
                titleEl.innerText = name;
                titleEl.className = 'm-0';

                const subtitleEl = document.createElement('p');
                subtitleEl.innerText = 'Person';
                subtitleEl.className = 'small mt-2 mb-0 text-uppercase tracking-wide';

                innerEl.appendChild(titleEl);
                innerEl.appendChild(subtitleEl);
                cardEl.appendChild(innerEl);
                topicsContainer.appendChild(cardEl);
            });

            topicsSection.classList.remove('d-none');
        } else {
            topicsSection.classList.add('d-none');
        }
    }
}
