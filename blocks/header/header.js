import { events } from '../../scripts/oro-events.js';
import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { fetchPlaceholders, rootLink } from '../../scripts/commerce.js';
import { autocomplete, getConfig } from '../../scripts/oro-api.js';
import { resolveImageUrl, fetchImageAsObjectUrl } from '../../scripts/oro-utils.js';

import renderAuthCombine from './renderAuthCombine.js';
import { renderAuthButton } from './renderAuthDropdown.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

const labels = await fetchPlaceholders();

const overlay = document.createElement('div');
overlay.classList.add('overlay');
document.querySelector('header').insertAdjacentElement('afterbegin', overlay);

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      toggleAllNavSections(navSections);
      overlay.classList.remove('show');
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      toggleMenu(nav, navSections);
      overlay.classList.remove('show');
      nav.querySelector('button').focus();
      const navWrapper = document.querySelector('.nav-wrapper');
      navWrapper.classList.remove('active');
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
    if (navSectionExpanded && isDesktop.matches) {
      toggleAllNavSections(navSections, false);
      overlay.classList.remove('show');
    } else if (!isDesktop.matches) {
      toggleMenu(nav, navSections, true);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    toggleAllNavSections(focused.closest('.nav-sections'));
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  sections
    .querySelectorAll('.nav-sections .default-content-wrapper > ul > li')
    .forEach((section) => {
      section.setAttribute('aria-expanded', expanded);
    });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = expanded || isDesktop.matches ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  // enable nav dropdown keyboard accessibility
  const navDrops = navSections.querySelectorAll('.nav-drop');
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.classList.remove('active');
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }

  // enable menu collapse on escape keypress
  if (!expanded || isDesktop.matches) {
    // collapse menu on escape press
    window.addEventListener('keydown', closeOnEscape);
    // collapse menu on focus lost
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

const subMenuHeader = document.createElement('div');
subMenuHeader.classList.add('submenu-header');
subMenuHeader.innerHTML = '<h5 class="back-link">All Categories</h5><hr />';

/**
 * Sets up the submenu
 * @param {navSection} navSection The nav section element
 */
function setupSubmenu(navSection) {
  if (navSection.querySelector('ul')) {
    let label;
    if (navSection.childNodes.length) {
      [label] = navSection.childNodes;
    }

    const submenu = navSection.querySelector('ul');
    const wrapper = document.createElement('div');
    const header = subMenuHeader.cloneNode(true);
    const title = document.createElement('h6');
    title.classList.add('submenu-title');
    title.textContent = label.textContent;

    wrapper.classList.add('submenu-wrapper');
    wrapper.appendChild(header);
    wrapper.appendChild(title);
    wrapper.appendChild(submenu.cloneNode(true));

    navSection.appendChild(wrapper);
    navSection.removeChild(submenu);
  }
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections
      .querySelectorAll(':scope .default-content-wrapper > ul > li')
      .forEach((navSection) => {
        if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
        setupSubmenu(navSection);
        navSection.addEventListener('click', (event) => {
          if (event.target.tagName === 'A') return;
          if (!isDesktop.matches) {
            navSection.classList.toggle('active');
          }
        });
        navSection.addEventListener('mouseenter', () => {
          toggleAllNavSections(navSections);
          if (isDesktop.matches) {
            if (!navSection.classList.contains('nav-drop')) {
              overlay.classList.remove('show');
              return;
            }
            navSection.setAttribute('aria-expanded', 'true');
            overlay.classList.add('show');
          }
        });
      });
  }

  const navTools = nav.querySelector('.nav-tools');

  /** Cart Button — navigates directly to /cart */
  const excludeMiniCartFromPaths = ['/checkout'];

  const minicart = document.createRange().createContextualFragment(`
     <div class="minicart-wrapper nav-tools-wrapper">
       <a href="${rootLink('/cart')}" class="nav-cart-button" aria-label="Cart"></a>
     </div>
   `);

  navTools.append(minicart);

  const cartButton = navTools.querySelector('.nav-cart-button');

  if (excludeMiniCartFromPaths.includes(window.location.pathname)) {
    cartButton.style.display = 'none';
  }

  function togglePanel(panel, state) {
    const show = state ?? !panel.classList.contains('nav-tools-panel--show');
    panel.classList.toggle('nav-tools-panel--show', show);
  }

  // Cart Item Counter — uses Oro event bus
  events.on('oro/cart/data', (data) => {
    if (data?.totalQuantity) {
      cartButton.setAttribute('data-count', data.totalQuantity);
    } else {
      cartButton.removeAttribute('data-count');
    }
  }, { eager: true });

  /** Search — simple search input (replaces drop-in product-discovery) */
  const searchFragment = document.createRange().createContextualFragment(`
  <div class="search-wrapper nav-tools-wrapper">
    <button type="button" class="nav-search-button">Search</button>
    <div class="nav-search-input nav-search-panel nav-tools-panel">
      <form id="search-bar-form">
        <div class="dropin-input-container">
          <input type="search" name="search" placeholder="${labels.Global?.Search || 'Search'}" autocomplete="off" />
        </div>
      </form>
    </div>
  </div>
  `);

  navTools.append(searchFragment);

  const searchPanel = navTools.querySelector('.nav-search-panel');
  const searchButton = navTools.querySelector('.nav-search-button');
  const searchForm = searchPanel.querySelector('#search-bar-form');

  // --- Autocomplete dropdown ---
  const autocompleteDropdown = document.createElement('div');
  autocompleteDropdown.className = 'search-bar-result';
  autocompleteDropdown.setAttribute('role', 'listbox');
  autocompleteDropdown.setAttribute('aria-label', 'Search suggestions');
  autocompleteDropdown.hidden = true;
  searchForm.appendChild(autocompleteDropdown);

  const searchInput = searchForm.querySelector('input[type="search"]');
  const baseUrl = getConfig()?.baseUrl || '';

  function clearAutocomplete() {
    autocompleteDropdown.hidden = true;
    autocompleteDropdown.innerHTML = '';
  }

  function renderAutocompleteResults(data) {
    autocompleteDropdown.innerHTML = '';

    if (!data || !data.products || data.products.length === 0) {
      autocompleteDropdown.hidden = true;
      return;
    }

    const products = data.products.slice(0, 5);

    products.forEach((product) => {
      const card = document.createElement('a');
      card.href = rootLink(`/catalog/product?productid=${product.id}`);
      card.className = 'dropin-product-item-card';
      card.setAttribute('role', 'option');

      const imgWrap = document.createElement('div');
      imgWrap.className = 'dropin-product-item-card__image';
      const img = document.createElement('img');
      img.alt = product.name || '';
      img.loading = 'lazy';
      img.width = 60;
      img.height = 60;
      img.hidden = true;
      imgWrap.appendChild(img);

      const rawImageUrl = product.imageWebp || product.image || '';
      const imageUrl = resolveImageUrl(rawImageUrl, baseUrl);
      if (imageUrl) {
        fetchImageAsObjectUrl(imageUrl).then((blobUrl) => {
          img.src = blobUrl;
          img.hidden = false;
        }).catch(() => {
          img.src = imageUrl;
          img.hidden = false;
        });
      }

      const titleWrap = document.createElement('div');
      titleWrap.className = 'dropin-product-item-card__content';
      const title = document.createElement('span');
      title.className = 'dropin-product-item-card__title';
      title.textContent = product.name || '';
      titleWrap.appendChild(title);

      card.append(imgWrap, titleWrap);
      autocompleteDropdown.appendChild(card);
    });

    if (data.total_count != null) {
      const footer = document.createElement('div');
      footer.className = 'search-bar-result__footer';
      footer.setAttribute('role', 'status');
      footer.setAttribute('aria-live', 'polite');
      const count = Number(data.total_count);
      footer.textContent = `${count} result${count !== 1 ? 's' : ''} found`;
      autocompleteDropdown.appendChild(footer);
    }

    autocompleteDropdown.hidden = false;
  }

  let currentRequestId = 0;

  const handleSearchInput = debounce(async () => {
    const query = searchInput.value.trim();

    if (query.length < 2) {
      clearAutocomplete();
      return;
    }

    currentRequestId += 1;
    const thisRequestId = currentRequestId;

    try {
      const data = await autocomplete(query);
      if (thisRequestId === currentRequestId) {
        renderAutocompleteResults(data);
      }
    } catch (_err) {
      if (thisRequestId === currentRequestId) {
        clearAutocomplete();
      }
    }
  }, 300);

  searchInput.addEventListener('input', handleSearchInput);

  // Keyboard navigation for autocomplete
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearAutocomplete();
      return;
    }

    const items = autocompleteDropdown.querySelectorAll('a.dropin-product-item-card');
    if (!items.length || autocompleteDropdown.hidden) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[0]?.focus();
    }
  });

  autocompleteDropdown.addEventListener('keydown', (e) => {
    const items = [...autocompleteDropdown.querySelectorAll('a.dropin-product-item-card')];
    const idx = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[idx + 1];
      if (next) next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx <= 0) {
        searchInput.focus();
      } else {
        items[idx - 1].focus();
      }
    } else if (e.key === 'Escape') {
      clearAutocomplete();
      searchInput.focus();
    }
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchForm.search.value.trim();
    if (query.length) {
      clearAutocomplete();
      window.location.href = `${rootLink('/search')}?q=${encodeURIComponent(query)}`;
    }
  });

  function toggleSearch(state) {
    togglePanel(searchPanel, state);
    if (state) {
      searchInput.focus();
    } else {
      clearAutocomplete();
    }
  }

  searchButton.addEventListener('click', () => toggleSearch(!searchPanel.classList.contains('nav-tools-panel--show')));

  navTools.querySelector('.nav-search-button').addEventListener('click', () => {
    if (isDesktop.matches) {
      toggleAllNavSections(navSections);
      overlay.classList.remove('show');
    }
  });

  // Close panels when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchPanel.contains(e.target) && !searchButton.contains(e.target)) {
      toggleSearch(false);
    }
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);

  navWrapper.addEventListener('mouseout', (e) => {
    if (isDesktop.matches && !nav.contains(e.relatedTarget)) {
      toggleAllNavSections(navSections);
      overlay.classList.remove('show');
    }
  });

  window.addEventListener('resize', () => {
    navWrapper.classList.remove('active');
    overlay.classList.remove('show');
    toggleMenu(nav, navSections, false);
  });

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => {
    navWrapper.classList.toggle('active');
    overlay.classList.toggle('show');
    toggleMenu(nav, navSections);
  });
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  renderAuthCombine(
    navSections,
    () => !isDesktop.matches && toggleMenu(nav, navSections, false),
  );
  renderAuthButton(navTools);
}
