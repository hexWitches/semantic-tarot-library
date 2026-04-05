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


// Discovery section carousel - Infinite Loop Version
window.initCarouselLogic = function () {
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

    if (scrollLeft >= currentItemWidth * (totalItems + 1) - 10) {
      carouselInner.scrollTo({ left: currentItemWidth, behavior: 'auto' });
    }

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
    const currentIndex = Math.round(carouselInner.scrollLeft / currentItemWidth);
    carouselInner.scrollTo({ left: currentIndex * currentItemWidth, behavior: 'auto' });
  });

  carouselInner.addEventListener("scroll", () => {
    clearTimeout(window.carouselJumpTimeout);
    window.carouselJumpTimeout = setTimeout(handleLoop, 600);
  }, { passive: true });

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

      this.classList.toggle('open', !isOpen);
      if (suboptions) suboptions.classList.toggle('open', !isOpen);
    });
  });

});

// dropdown deck
function dropdownDeck(deckId) {
  const dropdown = document.getElementById(deckId);

  const allDropdown = document.querySelectorAll('.dropdown-content');
  allDropdown.forEach(el => {
    if (el.id !== deckId) {
      el.classList.remove('show');
    }
  });

  if (dropdown.classList.contains('show')) {
    dropdown.classList.remove('show');
  } else {
    dropdown.classList.add('show');
  }
}

// Metadata toggle in small screens 
document.addEventListener("DOMContentLoaded", function () {
  const toggleBtn = document.getElementById('toggleMetadata');
  const metaGrid = document.getElementById('metadataCollapse');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
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

// SMT GRAPH VISUALIZATION
(function () {
  'use strict';

  const ontologyTree = {
    name: 'Thing',
    description: 'Root class (owl:Thing) — the implicit superclass of all ontology classes.',
    prefix: 'owl',
    children: [
      {
        name: 'DeckCard',
        prefix: 'odi',
        description: 'A card belonging to a tarot deck.',
        children: [
          {
            name: 'MajorArcana',
            prefix: 'smt',
            description: 'The 22 cards representing universal archetypal and symbolic themes',
            value: 94
          },
          {
            name: 'MinorArcana',
            prefix: 'smt',
            description: 'The 56 cards composed of four suits (pentacles, swords, wands, cups).',
            children: [
              {
                name: 'NumberedCard',
                prefix: 'smt',
                description: 'A category of minor arcana cards identified by a number, ranging from Ace to Ten',
                value: 167
              },
              {
                name: 'CourtCard',
                prefix: 'smt',
                description: 'A category of minor arcana cards representing the four ranks: pages, knights, queens and kings.',
                value: 64
              }
            ]
          }
        ]
      },
      {
        name: 'Concept',
        prefix: 'skos',
        description: 'A SKOS concept used for archetype and symbolic figure classification within the library.',
        children: [
          {
            name: 'Archetype',
            prefix: 'smt',
            description: 'The universal concept depicted in the Major Arcana card.',
            value: 22
          },
          {
            name: 'SymbolicFigure',
            prefix: 'smt',
            description: 'A symbolic element depicted in the Major Arcana card (animal, object, etc.).',
            value: 41
          }
        ]
      },
      {
        name: 'Person',
        prefix: 'odi',
        description: 'A person related to tarot decks or cards.',
        value: 10
      },
      {
        name: 'TarotDeck',
        prefix: 'odi',
        description: 'A tarot deck contained in the SMT Library.',
        value: 6
      },
      {
        name: 'Place',
        prefix: 'odi',
        description: "A geographic location related to a deck or current conservation site.",
        value: 9
      },
      {
        name: 'DeckLineage',
        prefix: 'smt',
        description: 'A conceptual category representing a specific historical tradition from which individual tarot deck editions or versions derive their structure and imagery.',
        value: 3
      },
      {
        name: 'Dataset',
        prefix: 'void',
        description: 'The VoID dataset descriptor for the SMT graph itself.',
        value: 1
      }
    ]
  };

  const colorMap = {
    // DeckCard family — amethyst purples
    'DeckCard': '#3D1F7A',
    'MajorArcana': '#6B4FA0',
    'MinorArcana': '#9C78C3',
    'NumberedCard': '#C4AADE',
    'CourtCard': '#DDD0EF',

    // Concept family — warm reds
    'Concept': '#AB3428',
    'Archetype': '#C4594D',
    'SymbolicFigure': '#D98880',

    // Other classes
    'Person': '#5A3A31',
    'TarotDeck': '#C47D22',
    'Place': '#9ABCA7',
    'DeckLineage': '#B5D6D6',
    'Dataset': '#9B9B9B'
  };

  // Text colour for arc labels — dark if segment is very light
  const lightSegments = new Set(['CourtCard', 'DeckLineage', 'Dataset', 'Place', 'NumberedCard']);

  // Legend groups
  const legendGroups = [
    {
      label: 'Cards',
      items: ['DeckCard', 'MajorArcana', 'MinorArcana', 'NumberedCard', 'CourtCard']
    },
    {
      label: 'Concepts',
      items: ['Concept', 'Archetype', 'SymbolicFigure']
    },
    {
      label: 'Other Classes',
      items: ['Person', 'TarotDeck', 'Place', 'DeckLineage', 'Dataset']
    }
  ];

  function initKnowledgeGraphChart() {
    const container = document.getElementById('kg-chart-container');
    const tooltip = document.getElementById('kg-tooltip');
    const legend = document.getElementById('kg-legend');
    if (!container || !tooltip || !legend) return;

    container.innerHTML = '';

    const totalWidth = container.clientWidth || 560;
    const size = Math.min(totalWidth, 560);
    const radius = size / 2;
    const centerHole = radius * 0.27;

    const MAX_DEPTH = 3;

    function getInnerR(depth) {
      if (depth === 0) return 0;
      const usable = radius - centerHole;
      return centerHole + ((depth - 1) / MAX_DEPTH) * usable;
    }
    function getOuterR(depth) {
      if (depth === 0) return 0;
      const usable = radius - centerHole;
      return centerHole + (depth / MAX_DEPTH) * usable;
    }

    const root = d3.hierarchy(ontologyTree)
      .sum(d => d.value || 0)
      .sort((a, b) => b.value - a.value);

    d3.partition().size([2 * Math.PI, 1])(root);
    const totalInstances = root.value;

    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.012))
      .padRadius(centerHole)
      .innerRadius(d => getInnerR(d.depth) + 2)
      .outerRadius(d => getOuterR(d.depth) - 2);

    const svg = d3.select('#kg-chart-container')
      .append('svg')
      .attr('width', size)
      .attr('height', size)
      .attr('viewBox', `${-radius} ${-radius} ${size} ${size}`)
      .attr('aria-label', 'SMT ontology class distribution sunburst chart');

    svg.append('circle')
      .attr('r', centerHole - 3)
      .attr('fill', '#FFF8F0');

    const paths = svg.append('g')
      .attr('class', 'kg-arcs')
      .selectAll('path')
      .data(root.descendants().filter(d => d.depth > 0))
      .join('path')
      .attr('class', 'kg-arc')
      .attr('fill', d => colorMap[d.data.name] || '#aaa')
      .attr('fill-opacity', 0.88)
      .attr('stroke', '#FFF8F0')
      .attr('stroke-width', 0.8)
      .attr('d', arc)
      .style('cursor', 'pointer')
      .attr('tabindex', 0);

    // -- TOOLTIP LOGIC --
    function showTooltip(event, d) {
      let ancestor = d;
      while (ancestor.depth > 1) { ancestor = ancestor.parent; }

      const ttBgColor = ancestor.data.name === 'DeckCard' ? '#240046' : (colorMap[ancestor.data.name] || '#240046');
      const isTtLight = lightSegments.has(ancestor.data.name);

      const pct = ((d.value / totalInstances) * 100).toFixed(1);

      // -- Dynamic Accent Colors based on family --
      let accentColor, subTextColor;

      if (isTtLight) {
        accentColor = 'rgba(0,0,0,0.5)';
        subTextColor = 'rgba(36,0,70,0.7)';
      } else {
        
        const family = ancestor.data.name;
        if (family === 'Concept') {
          accentColor = '#F7B7A3';
          subTextColor = '#FFDED6';
        } else if (family === 'TarotDeck') {
          accentColor = '#FFE5B4';
          subTextColor = '#FFF4E0';
        } else if (['DeckCard', 'MajorArcana', 'MinorArcana'].includes(family)) {
          accentColor = '#C5AEDE';
          subTextColor = '#E8DFF5';
        } else {
          accentColor = '#D5DBDB';
          subTextColor = '#F2F4F4';
        }
      }

      const textColor = isTtLight ? '#240046' : '#FFF8F0';

      const formatName = (name) => name[0].toUpperCase() + name.slice(1).toLowerCase();
      const displayName = formatName(d.data.name);

      const parentName = d.parent && d.parent.depth > 0
        ? `<div class="kg-tt-parent" style="color: ${accentColor}">subClassOf <em style="color: ${isTtLight ? '#240046' : subTextColor}">${d.parent.data.prefix}:${formatName(d.parent.data.name)}</em></div>`
        : '';

      tooltip.innerHTML = `
        <div class="kg-tt-name" style="color: ${textColor}">
          <span class="kg-tt-prefix" style="color: ${accentColor}">${d.data.prefix}:</span>${displayName}
        </div>
        ${parentName}
        <div class="kg-tt-stats" style="color: ${textColor}">
          <strong>${d.value.toLocaleString()}</strong> instances
          <span class="kg-tt-pct" style="color: ${accentColor}"> · ${pct}%</span>
        </div>
        <div class="kg-tt-desc" style="color: ${subTextColor}">${d.data.description}</div>
      `;

      // Use the root class color for the tooltip background
      tooltip.style.background = ttBgColor;
      tooltip.style.display = 'block';
    }

    function moveTooltip(event) {
      const rect = container.getBoundingClientRect();
      let left = event.clientX - rect.left + 14;
      let top = event.clientY - rect.top - 10;
      if (left + 240 > rect.width) left = event.clientX - rect.left - 254;
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }

    function hideTooltip() {
      tooltip.style.display = 'none';
      tooltip.style.background = ''; // reset
    }

    paths
      .on('mouseover', function (event, d) {
        d3.select(this).attr('fill-opacity', 1).attr('stroke-width', 1.5);
        showTooltip(event, d);
      })
      .on('mousemove', moveTooltip)
      .on('mouseout', function () {
        d3.select(this).attr('fill-opacity', 0.88).attr('stroke-width', 0.8);
        hideTooltip();
      })
      .on('focus', function (event, d) {
        d3.select(this).attr('fill-opacity', 1);
        showTooltip(event, d);
      })
      .on('blur', function () {
        d3.select(this).attr('fill-opacity', 0.88);
        hideTooltip();
      });

    // -- Arc labels
    const labelThresholdAngle = 0.16;
    const charWidth = 6.8;
    const excludedClasses = new Set(['Person', 'TarotDeck', 'Place', 'DeckLineage', 'Dataset']);

    svg.append('g')
      .attr('class', 'kg-labels')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .selectAll('text')
      .data(
        root.descendants().filter(d => {
          if (d.depth === 0 || excludedClasses.has(d.data.name)) return false;
          const angleWidth = d.x1 - d.x0;
          const rMid = (getInnerR(d.depth) + getOuterR(d.depth)) / 2;
          const arcLen = rMid * angleWidth;
          return angleWidth > labelThresholdAngle && arcLen > (d.data.name.length * charWidth * 0.7);
        })
      )
      .join('text')
      .attr('dy', '0.35em')
      .attr('font-family', 'Spectral, serif')
      .attr('font-size', d => d.depth === 1 ? '11.5px' : '10px')
      .attr('fill', d => lightSegments.has(d.data.name) ? '#240046' : '#FFF8F0')
      .attr('transform', d => {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const r = (getInnerR(d.depth) + getOuterR(d.depth)) / 2;
        const flip = x > 90 && x < 270;
        let rotation = flip ? -90 : 90;
        if (d.data.name === 'MajorArcana' || d.data.name === 'NumberedCard') {
          rotation += 180;
        }
        return `rotate(${x - 90}) translate(${r},0) rotate(${rotation})`;
      })
      .text(d => d.data.name);

    // -- Centre label
    const centre = svg.append('g')
      .attr('class', 'kg-centre-label')
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none');

    centre.append('text')
      .attr('class', 'kg-centre-class')
      .attr('dy', '-0.55em')
      .attr('font-family', 'Cinzel, serif')
      .attr('font-size', '13px')
      .attr('fill', '#7B6D8D')
      .text('owl:Thing');

    centre.append('text')
      .attr('class', 'kg-centre-count')
      .attr('dy', '0.9em')
      .attr('font-family', 'Spectral, serif')
      .attr('font-size', '11px')
      .attr('fill', '#240046')
      .text(`${totalInstances} instances`);

    legend.innerHTML = '';
    legendGroups.forEach(group => {
      const groupEl = document.createElement('div');
      groupEl.className = 'kg-legend-group';

      const groupLabel = document.createElement('div');
      groupLabel.className = 'kg-legend-group-label';
      groupLabel.textContent = group.label;
      groupEl.appendChild(groupLabel);

      const itemsEl = document.createElement('div');
      itemsEl.className = 'kg-legend-items';

      group.items.forEach(name => {
        const node = root.descendants().find(d => d.data.name === name);
        if (!node) return;

        const item = document.createElement('div');
        item.className = 'kg-legend-item';

        const swatch = document.createElement('span');
        swatch.className = 'kg-legend-swatch';
        swatch.style.background = colorMap[name] || '#aaa';

        const label = document.createElement('span');
        label.className = 'kg-legend-label';
        label.textContent = name;

        const count = document.createElement('span');
        count.className = 'kg-legend-count';
        count.textContent = node.value;

        item.appendChild(swatch);
        item.appendChild(label);
        item.appendChild(count);
        itemsEl.appendChild(item);
      });

      groupEl.appendChild(itemsEl);
      legend.appendChild(groupEl);
    });
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(initKnowledgeGraphChart, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKnowledgeGraphChart);
  } else {
    initKnowledgeGraphChart();
  }

  window.addEventListener('resize', onResize);
})();
