// HOMEPAGE //
document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('mainNavbar');
    const homepageContent = document.getElementById('homepageContent');
    const scrollThreshold = 50;

    if (navbar && homepageContent && window.scrollY > scrollThreshold) {
        navbar.classList.remove('initial-navbar');
        navbar.classList.add('scrolled-navbar');
        homepageContent.classList.add('revealed');
    }

    window.addEventListener('scroll', () => {
        if (!navbar || !homepageContent) return;
        
        if (window.scrollY > scrollThreshold) {
            if (navbar.classList.contains('initial-navbar')) {
                navbar.classList.remove('initial-navbar');
                navbar.classList.add('scrolled-navbar');
                homepageContent.classList.add('revealed');
            }
        } else {
            if (navbar.classList.contains('scrolled-navbar')) {
                navbar.classList.remove('scrolled-navbar');
                navbar.classList.add('initial-navbar');
            }
        }
    });

    initCarouselLogic();
    if (document.getElementById('ontology-graph')) {
        initOntologyPanning();
    }
});

// Ontology SVG Pan/Zoom logic
function initOntologyPanning() {
    const container = document.getElementById('ontology-graph');
    const img = document.getElementById('ontologySvg');
    if (!container || !img) return;

    let scale = 1, startX = 0, startY = 0, translateX = 0, translateY = 0, isDragging = false;

    function applyTransform() {
        img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    // Zoom on scroll
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.min(Math.max(1, scale + delta), 6);
        
        if (newScale !== scale) {
            scale = newScale;
            applyTransform();
        }
    }, { passive: false });

    // Drag to pan
    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        container.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
    });
    window.addEventListener('mouseup', () => {
        isDragging = false;
        container.style.cursor = 'grab';
    });

    // Touch support
    let lastTouchDist = null;
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX - translateX;
            startY = e.touches[0].clientY - translateY;
        } else if (e.touches.length === 2) {
            isDragging = false;
            lastTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: true });
    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isDragging) {
            translateX = e.touches[0].clientX - startX;
            translateY = e.touches[0].clientY - startY;
            applyTransform();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (lastTouchDist) {
                scale = Math.min(Math.max(1, scale * (dist / lastTouchDist)), 6);
                applyTransform();
            }
            lastTouchDist = dist;
        }
    }, { passive: true });
    container.addEventListener('touchend', () => { isDragging = false; lastTouchDist = null; });
}


// COLLECTION PAGE //

document.addEventListener('DOMContentLoaded', () => {

    const deckView = document.getElementById('deck-view');
    const gridView = document.getElementById('grid-view');

    // -------------------------------------------------------
    // expansion logic is kept in collection.js or main.js but sub-option selection is handled in collection.js
    const expandableBtns = document.querySelectorAll('.filter-expandable');

    expandableBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            console.log("Filter Clicked - Multi-open version active");
            const group = this.closest('.filter-group');
            const suboptions = group ? group.querySelector('.filter-suboptions') : null;
            const isOpen = this.classList.contains('open');

            // Remove accordion behavior: do not close others

            this.classList.toggle('open', !isOpen);
            if (suboptions) suboptions.classList.toggle('open', !isOpen);
        });
    });

});

// dropdown deck
function dropdownDeck(deckId) {
    const dropdown = document.getElementById(deckId);

    // Close all other open tendinas
    const allDropdown = document.querySelectorAll('.dropdown-content');
    allDropdown.forEach(el => {
        if (el.id !== deckId) {
            el.classList.remove('show');
        }
    });
    
    // Toggle the clicked one
    if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
    } else {
        dropdown.classList.add('show');
    }
}


    // -------------------------------------------------------
    // Discovery section carousel - Infinite Loop Version
    // -------------------------------------------------------
window.initCarouselLogic = function() {
    const carousel = document.getElementById("multiCarousel");
    const carouselInner = document.getElementById("carouselInner");
    if (!carousel || !carouselInner) return;

    // 1. Setup Clones for Infinite Loop
    const originalItems = Array.from(carouselInner.querySelectorAll(".multi-carousel-item:not(.clone)"));
    const totalItems = originalItems.length;
    if (totalItems === 0) return;

    // Clone first and last
    const firstClone = originalItems[0].cloneNode(true);
    const lastClone = originalItems[totalItems - 1].cloneNode(true);
    firstClone.classList.add('clone');
    lastClone.classList.add('clone');

    // Append/Prepend
    carouselInner.appendChild(firstClone);
    carouselInner.insertBefore(lastClone, originalItems[0]);

    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    function getScrollAmount() {
        const item = carouselInner.querySelector('.multi-carousel-item');
        return item ? item.offsetWidth : carouselInner.clientWidth;
    }

    // Set initial position to the first real item
    const itemWidth = getScrollAmount();
    carouselInner.scrollLeft = itemWidth;

    let isTransitioning = false;

    function handleLoop() {
        const scrollLeft = carouselInner.scrollLeft;
        const currentItemWidth = getScrollAmount();
        
        // If we've reached the last clone (at the end), jump to the first real item
        if (scrollLeft >= currentItemWidth * (totalItems + 1) - 10) {
            carouselInner.scrollTo({ left: currentItemWidth, behavior: 'auto' });
        }
        // If we've reached the first clone (at the start), jump to the last real item
        else if (scrollLeft <= 10) {
            carouselInner.scrollTo({ left: currentItemWidth * totalItems, behavior: 'auto' });
        }
        isTransitioning = false;
    }

    function scrollNext() {
        if (isTransitioning) return;
        isTransitioning = true;
        const currentItemWidth = getScrollAmount();
        carouselInner.scrollBy({ left: currentItemWidth, behavior: 'smooth' });
    }

    function scrollPrev() {
        if (isTransitioning) return;
        isTransitioning = true;
        const currentItemWidth = getScrollAmount();
        carouselInner.scrollBy({ left: -currentItemWidth, behavior: 'smooth' });
    }

    if (nextBtn) nextBtn.onclick = scrollNext;
    if (prevBtn) prevBtn.onclick = scrollPrev;

    // Recalibrate on resize
    window.addEventListener('resize', () => {
        const currentItemWidth = getScrollAmount();
        // Determine which item we are currently on (roughly)
        const currentIndex = Math.round(carouselInner.scrollLeft / currentItemWidth);
        // Snap to that item with the new width
        carouselInner.scrollTo({ left: currentIndex * currentItemWidth, behavior: 'auto' });
    });

    // Listen for scroll end to handle the seamless jump
    carouselInner.addEventListener("scroll", () => {
        // Simple debounce or check to see if we landed on a clone
        clearTimeout(window.carouselJumpTimeout);
        window.carouselJumpTimeout = setTimeout(handleLoop, 600); // Wait for smooth scroll to finish
    }, { passive: true });

    // Auto-advance loop (Slower: 8 seconds)
    let autoAdvanceInterval;
    let isHovering = false;

    function startAutoAdvance() {
        clearInterval(autoAdvanceInterval);
        autoAdvanceInterval = setInterval(() => {
            if (!isHovering) scrollNext();
        }, 8000); 
    }

    startAutoAdvance();

    carousel.addEventListener("mouseenter", () => isHovering = true);
    carousel.addEventListener("mouseleave", () => {
        isHovering = false;
        startAutoAdvance();
    });

    carouselInner.addEventListener("scroll", () => {
        clearInterval(autoAdvanceInterval);
        if (!isHovering) {
            startAutoAdvance();
        }
    }, { passive: true });

    // Keyboard navigation
    document.addEventListener("keydown", function (e) {
        if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.isContentEditable) return;
        
        switch (e.key) {
            case "ArrowLeft":
                scrollPrev(); 
                break;
            case "ArrowRight":
                scrollNext();
                break;
        }
    });
};




// Metadata toggle in small screens 

document.addEventListener("DOMContentLoaded", function() {
    const toggleBtn = document.getElementById('toggleMetadata');
    const metaGrid = document.getElementById('metadataCollapse');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            const isExpanded = metaGrid.classList.contains('show');
            
            // Toggle classes
            metaGrid.classList.toggle('show');
            toggleBtn.classList.toggle('active');
            
            // Update ARIA for accessibility
            toggleBtn.setAttribute('aria-expanded', !isExpanded);
        });
    }
});

// SPARQL ENDPOINT //
document.addEventListener('DOMContentLoaded', () => {
    const yasguiElement = document.getElementById("yasgui");
    if (yasguiElement) {
        const yasgui = new Yasgui(yasguiElement, {
            requestConfig: {
                endpoint: "https://api.triplydb.com/datasets/sararoggi/smt-dataset/sparql",
            },
            copyEndpointGui: true,
            persistenceId: "smt-library-yasgui"
        });
        yasgui.getTab().setQuery("SELECT * WHERE {\n  ?sub ?pred ?obj .\n} LIMIT 10");
    }
});