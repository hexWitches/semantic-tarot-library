/**
 * explore.js
 * Dynamically populates the Explore page grid with People, Archetypes, and Topics.
 */

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

        const exploreGrid = document.querySelector('.explore-grid');
        if (!exploreGrid) return;

        exploreGrid.innerHTML = ''; // Clear placeholders

        const allItems = [];

        // 2. Collect People (odi:Person)
        graph.forEach(item => {
            const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            if (types.includes('odi:Person')) {
                const fullName = [item.given_name, item.family_name].filter(Boolean).join(' ');
                const cleanId = item['@id'].replace('smtg:', '');

                allItems.push({
                    title: fullName,
                    subtitle: "Biography",
                    link: `person.html?id=${cleanId}`
                });
            }
        });

        // 3. Collect Archetypes (smt:Archetype)
        graph.forEach(item => {
            const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            if (types.includes('smt:Archetype')) {
                const label = item.label || item['skos:prefLabel'] || 'Archetype';
                const cleanId = item['@id'].replace('smtg:', '');

                allItems.push({
                    title: label,
                    subtitle: "Deepen the Archetype",
                    link: `deepening.html?id=${cleanId}`
                });
            }
        });

        // 4. Collect Topics (texts.json explore keys, except archetypes_page)
        const explorePages = textsData.explore || {};
        Object.keys(explorePages).forEach(key => {
            if (key === 'archetypes_page') return;

            const pageData = explorePages[key];
            const title = pageData.title || key.replace('_', ' ').replace('page', '').trim();

            allItems.push({
                title: title,
                subtitle: "Explore the Topic",
                link: `deepening.html?id=${key}`
            });
        });

        // 5. Sort Alphabetically
        allItems.sort((a, b) => a.title.localeCompare(b.title));

        // 6. Generate Cards
        allItems.forEach(item => {
            const card = createTopicCard(item.title, item.subtitle, item.link);
            exploreGrid.appendChild(card);
        });

    } catch (error) {
        console.error("Error initializing Explore page:", error);
    }
}

/**
 * Creates a standard topic card element.
 * @param {string} title 
 * @param {string} subtitle 
 * @param {string} linkUrl 
 * @returns {HTMLElement}
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
