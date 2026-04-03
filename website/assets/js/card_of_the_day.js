// CARD OF THE DAY — client-side, date-seeded, deck-agnostic
// Reads image from smtGraph.jsonld and description from texts.json.
// Only updates the pre-existing elements in index.html; never rewrites markup.

(function () {
    // Paths are relative to index.html at the repository root
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
