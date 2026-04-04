/**
 * Dynamically fills deepening.html with content from texts.json and smtGraph.jsonld.
 * Handles both standard topic pages and specialized Archetype pages.
 */

document.addEventListener('DOMContentLoaded', async () => {
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
    if (imgId.includes('github.com') && imgId.includes('/blob/')) {
        return imgId
            .replace('github.com', 'raw.githubusercontent.com')
            .replace('/blob/', '/');
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
