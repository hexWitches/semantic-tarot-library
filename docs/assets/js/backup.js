// HOMEPAGE //
document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('mainNavbar');
    const homepageContent = document.getElementById('homepageContent');
    const scrollThreshold = 50;

    if (window.scrollY > scrollThreshold) {
        navbar.classList.remove('initial-navbar');
        navbar.classList.add('scrolled-navbar');
        homepageContent.classList.add('revealed');
    }

    window.addEventListener('scroll', () => {
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
});


// COLLECTION PAGE //

document.addEventListener('DOMContentLoaded', () => {

    const deckView = document.getElementById('deck-view');
    const gridView = document.getElementById('grid-view');

    // -------------------------------------------------------
    // expansion logic is kept in collection.js or main.js but sub-option selection is handled in collection.js
    const expandableBtns = document.querySelectorAll('.filter-expandable');

    expandableBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const group = this.closest('.filter-group');
            const suboptions = group ? group.querySelector('.filter-suboptions') : null;
            const isOpen = this.classList.contains('open');

            document.querySelectorAll('.filter-expandable.open').forEach(b => {
                if (b !== this) {
                    b.classList.remove('open');
                    const g = b.closest('.filter-group');
                    if (g) g.querySelector('.filter-suboptions')?.classList.remove('open');
                }
            });

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
    // Discovery section carousel
    // -------------------------------------------------------
window.initCarouselLogic = function() {
    // DYNAMIC CHANGE: Find all real items injected by deck.js
    const originalItems = Array.from(
        document.querySelectorAll(".multi-carousel-item:not(.clone)")
    );
    
    // DYNAMIC CHANGE: Update totalItems based on actual cards found
    const totalItems = originalItems.length;
    if (totalItems === 0) return;

    // Configuration
    let itemsPerSlide = window.innerWidth < 720 ? 1 : 3; 
    let slideBy = 1;

    // DOM elements
    const carousel = document.getElementById("multiCarousel");
    const carouselInner = document.getElementById("carouselInner");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");

    // Function to update configuration based on screen size
    function updateConfig() {
      const width = window.innerWidth;

      if (width < 720) {
        // Mobile: 1 card visible
        itemsPerSlide = 1;
      } else if (width < 1200) {
        // Tablet: 3 cards visible
        itemsPerSlide = 3;
      } else {
        // Desktop: 5 cards visible
        itemsPerSlide = 5;
      }

      // Keep slideBy at 1 to ensure smooth, one-at-a-time navigation
      slideBy = 1; 
    }

    // Dynamically add clone elements
    function initializeClones() {
        // DYNAMIC CHANGE: Re-select items to ensure we are cloning the newly injected ones
        const currentOriginals = Array.from(
            document.querySelectorAll(".multi-carousel-item:not(.clone)")
        );

        document.querySelectorAll(".clone").forEach((clone) => clone.remove());

        const lastClones = currentOriginals
                .slice(-itemsPerSlide)
                .map((item) => {
                    const clone = item.cloneNode(true);
                    clone.classList.add("clone");
                    return clone;
                })
                .reverse();
            lastClones.forEach((clone) => carouselInner.prepend(clone));

        // Append clones of first items
        const firstClones = currentOriginals.slice(0, itemsPerSlide).map((item) => {
            const clone = item.cloneNode(true);
            clone.classList.add("clone");
            return clone;
        });
        firstClones.forEach((clone) => carouselInner.append(clone));
    }

    function setCarouselHeight() {
        const carouselHeight = 300;
        document.documentElement.style.setProperty("--carousel-height", `${carouselHeight}px`);
    }
  

    // Initial setup
    updateConfig();
    initializeClones();
    setCarouselHeight();

    // Start with the first real set of images
    let currentIndex = 0; // Index of current visible center image (0 to totalItems-1)
    let position = itemsPerSlide; // Real position considering clones
    let isAnimating = false;

    // Update carousel position
    function updateCarouselPosition(animate = true) {
      if (animate) {
        carouselInner.style.transition = "transform 0.5s ease";
        // Fallback for missing transitionend
        clearTimeout(carouselInner.fallbackTimeout);
        carouselInner.fallbackTimeout = setTimeout(() => {
          if (isAnimating) {
             const event = new Event('transitionend');
             carouselInner.dispatchEvent(event);
          }
        }, 550);
      } else {
        carouselInner.style.transition = "none";
      }

      const translateX = (position * -100) / itemsPerSlide;
      carouselInner.style.transform = `translateX(${translateX}%)`;
    }

    // Initialize position
    updateCarouselPosition(false);

    // Handle transition end
    carouselInner.addEventListener("transitionend", function (e) {
      if (e.target !== carouselInner) return;
      isAnimating = false;

      // Handle infinite loop logic
      if (position >= totalItems + itemsPerSlide) {
        position = itemsPerSlide + (position - (totalItems + itemsPerSlide));
        updateCarouselPosition(false);
      } else if (position < itemsPerSlide) {
        position = totalItems + position;
        updateCarouselPosition(false);
      }

      currentIndex = (position - itemsPerSlide) % totalItems;
    });

    // Navigation functions
    function next() {
      if (isAnimating) return;
      isAnimating = true;
      position += slideBy;
      updateCarouselPosition();
    }

    function prev() {
      if (isAnimating) return;
      isAnimating = true;
      position -= slideBy;
      updateCarouselPosition();
    }

    // DYNAMIC CHANGE: Using .onclick to prevent multiple listener attachments
    nextBtn.onclick = next;
    prevBtn.onclick = prev;

    // Mouse drag functionality
    let isDragging = false;
    let isSwipe = false;
    let startX = 0;
    let startPosition = 0;

    carousel.onmousedown = startDrag;
    carousel.ontouchstart = startDrag;
    carousel.onmousemove = drag;
    carousel.ontouchmove = drag;
    window.onmouseup = endDrag; 
    window.ontouchend = endDrag;

    // Prevent native link clicking only if the user actually swiped
    carousel.addEventListener('click', (e) => {
      if (isSwipe) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // Prevent image drag
    const carouselImages = document.querySelectorAll("#carouselInner img");
    carouselImages.forEach((img) => {
      img.addEventListener("dragstart", (e) => {
        e.preventDefault();
      });
    });

    function startDrag(e) {
      if (isAnimating) return;

      isDragging = true;
      isSwipe = false; // Reset swipe detection
      startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
      startPosition = position;
      carousel.classList.add("dragging");
      carouselInner.style.transition = "none";
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      registerUserActivity();
    }

    function drag(e) {
      if (!isDragging) return;

      const x = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
      const currentDistance = x - startX;

      // If they move the mouse more than 5px horizontally, treat it as a swipe, not a click
      if (Math.abs(currentDistance) > 5) {
        isSwipe = true;
      }

      // Visual movement
      const walk = (currentDistance / carousel.offsetWidth) * itemsPerSlide;
      const newPosition = startPosition - walk;
      const translateX = (newPosition * -100) / itemsPerSlide;
      
      carouselInner.style.transform = `translateX(${translateX}%)`;
    }

    function endDrag(e) {
      if (!isDragging) return;

      isDragging = false;
      carousel.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      
      // Bring back the animation for the "snap"
      carouselInner.style.transition = "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

      const x = e.type?.includes("mouse")
        ? e.clientX
        : (e.changedTouches ? e.changedTouches[0].clientX : startX);
      
      // Calculate how far we moved in pixels
      const deltaX = x - startX;
      // Threshold: if dragged more than 50px, swap cards
      const threshold = 50; 

      if (deltaX > threshold) {
        prev();
      } else if (deltaX < -threshold) {
        next();
      } else {
        updateCarouselPosition(); // Snap back to current
      }

      registerUserActivity();
    }

    // Keyboard navigation
    document.addEventListener("keydown", function (e) {
      if (
        carousel.offsetParent === null ||
        document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA" ||
        document.activeElement.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          prev();
          registerUserActivity();
          break;
        case "ArrowRight":
          e.preventDefault();
          next();
          registerUserActivity();
          break;
      }
    });

    // Auto-advance system
    let autoAdvanceInterval;
    let userActivityTimeout;
    let isHovering = false;

    function startAutoAdvance() {
      clearInterval(autoAdvanceInterval);
      autoAdvanceInterval = setInterval(next, 5000);
    }

    function resetAutoAdvanceTimer() {
      clearTimeout(userActivityTimeout);
      clearInterval(autoAdvanceInterval);
      if (!isHovering) {
        userActivityTimeout = setTimeout(startAutoAdvance, 10000);
      }
    }

    function registerUserActivity() {
      resetAutoAdvanceTimer();
    }

    startAutoAdvance();

    carousel.addEventListener("mouseenter", () => {
      isHovering = true;
      clearInterval(autoAdvanceInterval);
      clearTimeout(userActivityTimeout);
    });

    carousel.addEventListener("mouseleave", () => {
      isHovering = false;
      resetAutoAdvanceTimer();
    });

    carousel.addEventListener("click", registerUserActivity);
    // Horizontal sliding via touchpad / mouse scroll wheel
    let isWheelCooldown = false;
    let wheelTimer;

    carousel.addEventListener("wheel", function(e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault(); // Stop native navigation

        if (!isWheelCooldown && !isAnimating) {
          if (e.deltaX > 0) {
            next();
          } else if (e.deltaX < 0) {
            prev();
          }
          isWheelCooldown = true;
        }
        
        // Keep cooldown active as long as wheel momentum continues
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => {
          isWheelCooldown = false;
        }, 100);
      }
      registerUserActivity();
    }, { passive: false });


    // Handle window resize
    window.onresize = function () {
      const wasMobile = itemsPerSlide === 1;
      updateConfig();
      if (wasMobile !== (itemsPerSlide === 1)) {
        initializeClones();
        position = itemsPerSlide;
        updateCarouselPosition(false);
      }
    };
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