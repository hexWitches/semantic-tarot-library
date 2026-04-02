document.addEventListener('DOMContentLoaded', async () => {
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

function getLocalImagePath(imageUrl) {
    if (!imageUrl) return 'assets/images/explore/people/portrait-placeholder.jpg';
    if (imageUrl.includes('github.com') && imageUrl.includes('/blob/')) {
        return imageUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
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
        imgEl.src = getLocalImagePath(rawUrl);
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

        // Find all decks where this person is author or illustrator
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

            return checkRef(item.author_id) || checkRef(item.illustrator_id);
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
                subtitleEl.innerText = 'Collaborator';
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
