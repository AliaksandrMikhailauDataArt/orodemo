import {
  listProducts, addToShoppingList, isGuest, getCategoryTree,
} from '../../scripts/oro-api.js';
import { events } from '../../scripts/oro-events.js';
import {
  getProductImageUrl,
  getProductPrice,
} from '../../scripts/oro-utils.js';
import { readBlockConfig } from '../../scripts/aem.js';
import {
  fetchPlaceholders,
  rootLink,
  CUSTOMER_LOGIN_PATH,
} from '../../scripts/commerce.js';

function createFilterOption(groupName, value, label, checked) {
  const lbl = document.createElement('label');
  lbl.className = `filter-panel__option${checked ? ' filter-panel__option--selected' : ''}`;
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = groupName;
  input.value = value;
  input.checked = checked;
  const tick = document.createElement('span');
  tick.className = 'filter-panel__tick';
  const span = document.createElement('span');
  span.textContent = label;
  lbl.append(input, tick, span);
  return lbl;
}

function updateAccordionLabel(accordion, label) {
  const valSpan = accordion.querySelector('.filter-panel__accordion-value');
  if (valSpan) valSpan.textContent = ` : ${label}`;
}

function createFilterAccordion(title, contentEl, selectedLabel = '') {
  const details = document.createElement('details');
  details.className = 'filter-panel__accordion';

  const summary = document.createElement('summary');
  summary.className = 'filter-panel__accordion-summary';
  const titleWrap = document.createElement('span');
  titleWrap.className = 'filter-panel__accordion-title';
  const boldSpan = document.createElement('span');
  boldSpan.className = 'filter-panel__accordion-name';
  boldSpan.textContent = title;
  const valSpan = document.createElement('span');
  valSpan.className = 'filter-panel__accordion-value';
  valSpan.textContent = selectedLabel ? ` : ${selectedLabel}` : '';
  titleWrap.append(boldSpan, valSpan);
  const chevron = document.createElement('span');
  chevron.className = 'filter-panel__chevron';
  summary.append(titleWrap, chevron);

  const body = document.createElement('div');
  body.className = 'filter-panel__accordion-body';
  body.appendChild(contentEl);

  details.append(summary, body);
  return details;
}

function setupViewDetailsToggle(card) {
  const descText = card.querySelector('.deal-card__description-text');
  const toggleBtn = card.querySelector('.deal-card__view-details');
  if (!toggleBtn) return;
  if (!descText || !descText.textContent.trim()) {
    toggleBtn.style.display = 'none';
    return;
  }
  requestAnimationFrame(() => {
    if (descText.scrollHeight <= descText.clientHeight) {
      toggleBtn.style.display = 'none';
      return;
    }
    toggleBtn.addEventListener('click', () => {
      const expanded = descText.classList.toggle('deal-card__description-text--expanded');
      toggleBtn.textContent = expanded ? 'Hide Details' : 'View Details';
      toggleBtn.setAttribute('aria-expanded', String(expanded));
    });
  });
}

export default async function decorate(block) {
  const labels = await fetchPlaceholders();
  const config = readBlockConfig(block);

  const fragment = document.createRange().createContextualFragment(`
    <div class="search__wrapper">
      <div class="search__result-bar"></div>
      <div class="search__view-facets"></div>
      <div class="search__filter-panel"></div>
      <div class="search__product-list"></div>
      <div class="search__pagination"></div>
    </div>
  `);

  const $resultBar = fragment.querySelector('.search__result-bar');
  const $viewFacets = fragment.querySelector('.search__view-facets');
  const $filterPanel = fragment.querySelector('.search__filter-panel');
  const $productList = fragment.querySelector('.search__product-list');
  const $pagination = fragment.querySelector('.search__pagination');

  block.innerHTML = '';
  block.appendChild(fragment);

  if (config.urlpath) {
    block.dataset.category = config.urlpath;
  }

  // Parse URL params
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get('q') || '';
  let currentPage = Number(urlParams.get('page')) || 1;
  let currentSort = urlParams.get('sort') || '';
  let currentCategory = urlParams.get('category') || '';

  const pageSize = 8;
  const { baseUrl } = await getOroConfig();

  // --- Filter Panel ---
  const panelHeader = document.createElement('div');
  panelHeader.className = 'filter-panel__header';

  const panelTitle = document.createElement('h3');
  panelTitle.className = 'filter-panel__title';
  panelTitle.textContent = 'Filters';

  const clearAllBtn = document.createElement('button');
  clearAllBtn.className = 'filter-panel__clear';
  clearAllBtn.textContent = 'Clear all';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'filter-panel__close';
  closeBtn.textContent = '\u00D7';
  closeBtn.setAttribute('aria-label', 'Close filters');
  closeBtn.addEventListener('click', () => {
    $filterPanel.classList.remove('search__filter-panel--visible');
  });

  panelHeader.append(panelTitle, clearAllBtn, closeBtn);
  $filterPanel.appendChild(panelHeader);

  // Sort By accordion
  const sortItems = [
    { value: '', label: 'Recommended' },
    { value: 'minimalPrice', label: 'Price Low to High' },
    { value: '-minimalPrice', label: 'Price High to Low' },
  ];
  const sortOptions = document.createElement('div');
  sortOptions.className = 'filter-panel__options';
  sortItems.forEach(({ value, label }) => {
    sortOptions.appendChild(
      createFilterOption('filter-sort', value, label, currentSort === value),
    );
  });
  const currentSortLabel = sortItems.find((s) => s.value === currentSort)?.label || 'Recommended';
  const sortAccordion = createFilterAccordion('Sort By', sortOptions, currentSortLabel);
  sortOptions.addEventListener('change', (e) => {
    currentSort = e.target.value;
    const label = sortItems.find((s) => s.value === currentSort)?.label || 'Recommended';
    updateAccordionLabel(sortAccordion, label);
    currentPage = 1;
    loadAndRender(); // eslint-disable-line no-use-before-define
  });
  $filterPanel.appendChild(sortAccordion);

  // Category accordion
  const categoryOptions = document.createElement('div');
  categoryOptions.className = 'filter-panel__options';
  categoryOptions.appendChild(
    createFilterOption('filter-category', '', 'All', !currentCategory),
  );
  const categoryMap = new Map([['', 'All']]);
  const categoryAccordion = createFilterAccordion('Category', categoryOptions, 'All');
  categoryOptions.addEventListener('change', (e) => {
    currentCategory = e.target.value;
    const label = categoryMap.get(currentCategory) || 'All';
    updateAccordionLabel(categoryAccordion, label);
    currentPage = 1;
    loadAndRender(); // eslint-disable-line no-use-before-define
  });
  $filterPanel.appendChild(categoryAccordion);

  // Ship accordion (placeholder)
  const shipOptions = document.createElement('div');
  shipOptions.className = 'filter-panel__options';
  shipOptions.appendChild(createFilterOption('filter-ship', '', 'All', true));
  const shipAccordion = createFilterAccordion('Ship', shipOptions, 'All');
  $filterPanel.appendChild(shipAccordion);

  // Clear all handler
  clearAllBtn.addEventListener('click', () => {
    currentSort = '';
    currentCategory = '';
    currentPage = 1;
    sortOptions.querySelector('input[value=""]').checked = true;
    categoryOptions.querySelector('input[value=""]').checked = true;
    shipOptions.querySelector('input[value=""]').checked = true;
    // Reset accordion titles
    updateAccordionLabel(sortAccordion, 'Recommended');
    updateAccordionLabel(categoryAccordion, 'All');
    updateAccordionLabel(shipAccordion, 'All');
    loadAndRender(); // eslint-disable-line no-use-before-define
  });

  // Mobile filter toggle
  const filterBtn = document.createElement('button');
  filterBtn.className = 'search__filter-toggle';
  filterBtn.textContent = labels.Global?.Filters || 'Filters';
  filterBtn.addEventListener('click', () => {
    $filterPanel.classList.toggle('search__filter-panel--visible');
  });
  $viewFacets.appendChild(filterBtn);

  // --- Load & Render ---
  async function loadAndRender() {
    $productList.innerHTML = '<div class="search__loading"><div class="search__spinner"></div></div>';

    try {
      const result = await listProducts({
        page: currentPage,
        pageSize,
        categoryId: currentCategory || config.urlpath || undefined,
        search: q || undefined,
        sort: currentSort || undefined,
      });

      renderResults(result);
      renderPagination(result);
      updateUrl();
    } catch (err) {
      console.error('Error loading products:', err);
      $productList.innerHTML = '<p>Error loading products. Please try again.</p>';
    }
  }

  function renderResults(result) {
    const { products, totalCount } = result;

    block.classList.toggle('product-list-page--empty', totalCount === 0);

    // Results bar
    $resultBar.innerHTML = '';
    const countEl = document.createElement('h2');
    countEl.className = 'search__result-count';
    countEl.textContent = q
      ? `${totalCount} results for "${q}"`
      : `${totalCount} Products`;
    const authorableText = document.createElement('span');
    authorableText.className = 'search__result-note';
    if (config.note) authorableText.textContent = config.note;
    $resultBar.append(countEl, authorableText);

    // Product list
    $productList.innerHTML = '';

    if (totalCount === 0) {
      $productList.innerHTML = '<p class="search__no-results">No products found.</p>';
      return;
    }

    products.forEach((product) => {
      const { attributes } = product;
      const name = attributes.name || attributes.names?.default || '';
      const shortDesc = attributes.shortDescription || '';
      const priceData = getProductPrice(product);
      const imageUrl = getProductImageUrl(product, baseUrl);
      const productUrl = rootLink(`/catalog/product?productid=${product.id}`);

      const card = document.createElement('div');
      card.className = 'search__deal-card';

      // Image section
      const imageDiv = document.createElement('div');
      imageDiv.className = 'deal-card__image';
      if (imageUrl) {
        imageDiv.innerHTML = `<a href="${productUrl}"><img src="${imageUrl}" alt="${name}" loading="lazy" width="300" height="200" /></a>`;
      } else {
        imageDiv.innerHTML = `<a href="${productUrl}"><div class="deal-card__image-placeholder"></div></a>`;
      }

      // Content section
      const contentDiv = document.createElement('div');
      contentDiv.className = 'deal-card__content';

      const heading = document.createElement('h3');
      heading.innerHTML = `<a href="${productUrl}">${name}</a>`;

      const descDiv = document.createElement('div');
      descDiv.className = 'deal-card__description';
      const descText = document.createElement('div');
      descText.className = 'deal-card__description-text';
      descText.innerHTML = shortDesc;
      descDiv.appendChild(descText);

      const viewDetailsBtn = document.createElement('button');
      viewDetailsBtn.className = 'deal-card__view-details';
      viewDetailsBtn.textContent = 'View Details';
      viewDetailsBtn.setAttribute('aria-expanded', 'false');

      contentDiv.append(heading, descDiv, viewDetailsBtn);

      // Price + CTA section
      const priceCta = document.createElement('div');
      priceCta.className = 'deal-card__price-cta';

      const priceSpan = document.createElement('span');
      priceSpan.className = 'deal-card__price';
      if (priceData) {
        const rounded = Math.round(priceData.price);
        priceSpan.textContent = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: priceData.currency || 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(rounded);
      }

      const shopBtn = document.createElement('button');
      shopBtn.className = 'deal-card__shop-btn';

      function updateShopBtn() {
        const cartData = events.lastPayload('oro/cart/data');
        const inCart = cartData?.items?.some((item) => {
          const pid = item._product?.id || item.relationships?.product?.data?.id;
          return String(pid) === String(product.id);
        });
        if (inCart) {
          shopBtn.textContent = 'GO TO CART';
          shopBtn.disabled = false;
          shopBtn.dataset.inCart = 'true';
        } else {
          shopBtn.textContent = 'ADD TO CART';
          shopBtn.disabled = false;
          delete shopBtn.dataset.inCart;
        }
      }

      updateShopBtn();
      events.on('oro/cart/data', updateShopBtn);

      shopBtn.addEventListener('click', async () => {
        if (shopBtn.dataset.inCart) {
          window.location.href = rootLink('/cart');
          return;
        }
        if (isGuest()) {
          window.location.href = rootLink(`${CUSTOMER_LOGIN_PATH}?returnUrl=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        shopBtn.disabled = true;
        shopBtn.textContent = 'ADDING...';
        try {
          const { prices } = attributes;
          const unitCode = prices?.[0]?.unit || 'item';
          await addToShoppingList(product.id, 1, unitCode);
        } catch (err) {
          console.error('Add to cart failed:', err);
          updateShopBtn();
        }
      });

      priceCta.append(priceSpan, shopBtn);

      card.append(imageDiv, contentDiv, priceCta);
      $productList.appendChild(card);

      setupViewDetailsToggle(card);
    });
  }

  function renderPagination(result) {
    const { totalPages, page: activePage } = result;
    $pagination.innerHTML = '';

    if (totalPages <= 1) return;

    const handlePageClick = (page) => {
      currentPage = page;
      loadAndRender();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    for (let i = 1; i <= totalPages; i += 1) {
      const btn = document.createElement('button');
      btn.className = `search__page-btn${i === activePage ? ' search__page-btn--active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => handlePageClick(i));
      $pagination.appendChild(btn);
    }
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    if (q) url.searchParams.set('q', q);
    if (currentPage > 1) {
      url.searchParams.set('page', currentPage);
    } else {
      url.searchParams.delete('page');
    }
    if (currentSort) {
      url.searchParams.set('sort', currentSort);
    } else {
      url.searchParams.delete('sort');
    }
    if (currentCategory) {
      url.searchParams.set('category', currentCategory);
    } else {
      url.searchParams.delete('category');
    }
    window.history.pushState({}, '', url.toString());
  }

  // Show spinner immediately, fire API calls without blocking page render
  $productList.innerHTML = '<div class="search__loading"><div class="search__spinner"></div></div>';

  Promise.all([
    getCategoryTree().then((tree) => {
      tree.forEach((node) => {
        const cat = node._category;
        if (!cat) return;
        const title = cat.attributes?.title || cat.attributes?.name || `Category ${cat.id}`;
        categoryMap.set(cat.id, title);
        categoryOptions.appendChild(
          createFilterOption('filter-category', cat.id, title, currentCategory === cat.id),
        );
      });
      const catLabel = categoryMap.get(currentCategory) || 'All';
      updateAccordionLabel(categoryAccordion, catLabel);
    }).catch((err) => {
      console.warn('Failed to load categories:', err);
    }),
    loadAndRender(),
  ]);
}

async function getOroConfig() {
  const { getConfig } = await import('../../scripts/oro-api.js');
  const cfg = getConfig();
  return { baseUrl: cfg?.baseUrl || '' };
}
