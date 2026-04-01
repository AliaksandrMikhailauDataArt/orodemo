import {
  listProducts, addToShoppingList, isGuest, getCategoryTree,
} from '../../scripts/oro-api.js';
import { events } from '../../scripts/oro-events.js';
import {
  getProductImageUrl,
  getProductPrice,
  fetchImageAsObjectUrl,
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

  const shortDesc = card.dataset.shortDescription || '';
  const fullDesc = card.dataset.description || '';

  if (!shortDesc.trim() && !fullDesc.trim()) {
    toggleBtn.style.display = 'none';
    return;
  }

  if (!fullDesc.trim()) {
    toggleBtn.style.display = 'none';
    return;
  }

  toggleBtn.addEventListener('click', () => {
    const expanded = descText.classList.toggle('deal-card__description-text--expanded');
    if (expanded) {
      descText.innerHTML = fullDesc;
    } else {
      descText.innerHTML = shortDesc;
    }
    toggleBtn.textContent = expanded ? 'Hide Details' : 'View Details';
    toggleBtn.setAttribute('aria-expanded', String(expanded));
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
    { value: 'id', label: 'Price Low to High' },
    { value: '-id', label: 'Price High to Low' },
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
      const fullDesc = attributes.description || '';
      const priceData = getProductPrice(product);
      const imageUrl = getProductImageUrl(product, baseUrl);
      const productUrl = rootLink(`/catalog/product?productid=${product.id}`);

      const card = document.createElement('div');
      card.className = 'search__deal-card';
      card.dataset.shortDescription = shortDesc;
      card.dataset.description = fullDesc;

      // Image section (fetched with ngrok headers)
      const imageDiv = document.createElement('div');
      imageDiv.className = 'deal-card__image';
      if (imageUrl) {
        const link = document.createElement('a');
        link.href = productUrl;
        imageDiv.appendChild(link);
        const img = document.createElement('img');
        img.alt = name;
        img.loading = 'lazy';
        img.width = 300;
        img.height = 200;
        img.onload = () => { imageDiv.style.background = 'none'; };
        fetchImageAsObjectUrl(imageUrl).then((blobUrl) => {
          img.src = blobUrl;
          link.appendChild(img);
        }).catch(() => {
          img.src = imageUrl;
          link.appendChild(img);
        });
      } else {
        imageDiv.innerHTML = `<a href="${productUrl}"><div class="deal-card__image-placeholder"></div></a>`;
      }

      // Content section
      const contentDiv = document.createElement('div');
      contentDiv.className = 'deal-card__content';

      const heading = document.createElement('h3');
      heading.innerHTML = `<a href="${productUrl}">${name}</a>`;

      // Ships info
      const ships = attributes.productAttributes?.ships || [];
      let shipsEl = null;
      if (ships.length > 0) {
        shipsEl = document.createElement('div');
        shipsEl.className = 'deal-card__ships';
        const shipSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor"><path d="M272 64C245.5 64 224 85.5 224 112L224 128L208 128C163.8 128 128 163.8 128 208L128 316.8L106.4 325.4C91.6 331.3 83.9 347.8 89 362.9C99.4 394.2 115.8 422.2 136.7 446C156.8 436.8 178.4 432.1 200 432C233.1 431.8 266.3 442.2 294.4 463.4L296 464.6L296 249.6L192 291.2L192 208C192 199.2 199.2 192 208 192L432 192C440.8 192 448 199.2 448 208L448 291.2L344 249.6L344 464.6L345.6 463.4C373.1 442.7 405.5 432.2 438 432C460.3 431.9 482.6 436.5 503.3 446C524.2 422.3 540.6 394.2 551 362.9C556 347.7 548.4 331.3 533.6 325.4L512 316.8L512 208C512 163.8 476.2 128 432 128L416 128L416 112C416 85.5 394.5 64 368 64L272 64zM403.4 540.1C424.7 524 453.3 524 474.6 540.1C493.6 554.5 516.5 568.3 541.8 573.4C568.3 578.8 596.1 574.2 622.5 554.3C633.1 546.3 635.2 531.3 627.2 520.7C619.2 510.1 604.2 508 593.6 516C578.7 527.2 565 529.1 551.3 526.3C536.4 523.3 520.4 514.4 503.5 501.7C465.1 472.7 413 472.7 374.5 501.7C350.5 519.8 333.8 528 320 528C306.2 528 289.5 519.8 265.5 501.7C227.1 472.7 175 472.7 136.5 501.7C114.9 518 95.2 527.5 77.6 527.4C68 527.3 57.7 524.4 46.4 515.9C35.8 507.9 20.8 510 12.8 520.6C4.8 531.2 7 546.3 17.6 554.3C36.7 568.7 57 575.3 77.4 575.4C111.3 575.6 141.7 558 165.5 540.1C186.8 524 215.4 524 236.7 540.1C260.9 558.4 289 576 320.1 576C351.2 576 379.2 558.3 403.5 540.1z"/></svg>';
        shipsEl.innerHTML = `${shipSvg}<span>${ships.map((s) => s.targetValue).join(', ')}</span>`;
      }

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

      contentDiv.append(heading);
      if (shipsEl) contentDiv.append(shipsEl);
      contentDiv.append(descDiv, viewDetailsBtn);

      // Price + CTA section
      const priceCta = document.createElement('div');
      priceCta.className = 'deal-card__price-cta';

      const priceSpan = document.createElement('span');
      priceSpan.className = 'deal-card__price';
      if (priceData) {
        const rounded = Math.round(priceData.price);
        priceSpan.textContent = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: priceData.currency,
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
