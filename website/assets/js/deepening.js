/**
 * Dynamically fills deepening.html with content from texts.json.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const topicId = urlParams.get('id');

    if (!topicId) {
        console.error("Topic ID missing in URL.");
        // Optional: redirect or show error message
        return;
    }

    try {
        const response = await fetch('assets/json/texts.json');
        const data = await response.json();
        const exploreData = data.explore || {};
        const pageData = exploreData[topicId];

        if (pageData) {
            renderTopicPage(pageData);
        } else {
            console.warn(`Topic "${topicId}" not found in texts.json.`);
            // Update UI to show "Topic not found"
            document.querySelector('.page-title').innerText = "Topic Not Found";
        }
    } catch (error) {
        console.error("Error loading the deepening page:", error);
    }
});

/**
 * Main rendering function for the deepening page.
 * @param {Object} pageData - Data object from texts.json.
 */
function renderTopicPage(pageData) {
    // 1. Update Head Title & Breadcrumb
    const title = pageData.title || "Explore the Topic";
    document.title = `${title} - The SMT Library`;

    const breadcrumbTopic = document.getElementById('breadcrumb_topic');
    if (breadcrumbTopic) breadcrumbTopic.innerText = title;

    // 2. Header: Title & Intro
    const titleEl = document.querySelector('.page-title');
    if (titleEl) titleEl.innerHTML = title;

    // 2. Intro Text
    const introEl = document.querySelector('.collection-desc');
    if (introEl) {
        introEl.innerHTML = pageData.intro || pageData.subtitle || "";
    }

    // 3. Banner Image
    const bannerSection = document.querySelector('.topic-banner');
    const bannerImg = bannerSection ? bannerSection.querySelector('img') : null;
    
    // Check for banner data in various possible formats
    const bannerData = pageData.banner_image || pageData.image_banner || pageData.banner || pageData.img;
    
    if (bannerData && bannerData.path && bannerImg) {
        bannerImg.src = bannerData.path;
        bannerImg.alt = bannerData.alt || title;
        bannerSection.style.display = 'block';
    } else if (bannerSection) {
        bannerSection.style.display = 'none';
    }

    // 4. Body Content (Sections)
    const container = document.querySelector('.topic-text-container');
    if (!container) return;
    container.innerHTML = ''; // Clear fallback content

    // Use body_content or body (array or string)
    const bodyData = pageData.body_content || pageData.body;

    if (bodyData) {
        if (typeof bodyData === 'string') {
            // Case A: Simple body string (like legacy formats)
            renderTextSection(container, bodyData);
        } else if (Array.isArray(bodyData)) {
            // Case B: Array of sections (new flexible format)
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
        // Case C: Multi-key structure (fallback for specific legacy layouts)
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
 * Helper: Appends a heading (subtitle) to the container.
 */
function renderHeadingSection(container, content) {
    if (!content) return;
    const h3 = document.createElement('h3');
    h3.className = 'mt-5 mb-4';
    h3.innerHTML = content;
    container.appendChild(h3);
}

/**
 * Helper: Appends a text section to the container.
 */
function renderTextSection(container, content, heading = null) {
    if (!content) return;

    if (heading) {
        renderHeadingSection(container, heading);
    }

    const div = document.createElement('div');
    div.className = 'topic-text-block mb-4';
    div.innerHTML = content;
    container.appendChild(div);
}

/**
 * Helper: Appends an image section to the container.
 */
function renderImageSection(container, src, alt, caption = null) {
    if (!src) return;

    const figure = document.createElement('figure');
    figure.className = 'topic-image-block my-5 text-center';

    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || "Topic image";
    img.className = 'img-fluid rounded shadow-sm';
    img.style.maxWidth = '100%';

    figure.appendChild(img);

    if (caption) {
        const figcaption = document.createElement('figcaption');
        figcaption.className = 'mt-3 small text-muted italic';
        figcaption.innerHTML = caption;
        figure.appendChild(figcaption);
    }

    container.appendChild(figure);
}
