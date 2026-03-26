import { listProducts, addToShoppingList, isGuest } from '../../scripts/oro-api.js';
import { events } from '../../scripts/oro-events.js';
import {
  formatPrice,
  getProductImageUrl,
  getProductPrice,
} from '../../scripts/oro-utils.js';
import { readBlockConfig } from '../../scripts/aem.js';
import {
  fetchPlaceholders,
  getProductLink,
  rootLink,
  CUSTOMER_LOGIN_PATH,
} from '../../scripts/commerce.js';

export default async function decorate(block) {
  const labels = await fetchPlaceholders();
  const config = readBlockConfig(block);

  // Build DOM skeleton (same structure as original)
  const fragment = document.createRange().createContextualFragment(`
    <div class="search__wrapper">
      <div class="search__result-info"></div>
      <div class="search__view-facets"></div>
      <div class="search__facets"></div>
      <div class="search__product-sort"></div>
      <div class="search__product-list"></div>
      <div class="search__pagination"></div>
    </div>
  `);

  const $resultInfo = fragment.querySelector('.search__result-info');
  const $viewFacets = fragment.querySelector('.search__view-facets');
  const $facets = fragment.querySelector('.search__facets');
  const $productSort = fragment.querySelector('.search__product-sort');
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

  const pageSize = 8;
  const { baseUrl } = await getOroConfig();

  // Render filter toggle button
  const filterBtn = document.createElement('button');
  filterBtn.className = 'dropin-button dropin-button--secondary';
  filterBtn.textContent = labels.Global?.Filters || 'Filters';
  filterBtn.addEventListener('click', () => {
    $facets.classList.toggle('search__facets--visible');
  });
  $viewFacets.appendChild(filterBtn);

  // Render sort dropdown
  const sortSelect = document.createElement('select');
  sortSelect.className = 'search__sort-select';
  sortSelect.innerHTML = `
    <option value="">Relevance</option>
    <option value="name">Name A-Z</option>
    <option value="-name">Name Z-A</option>
    <option value="minimalPrice">Price Low-High</option>
    <option value="-minimalPrice">Price High-Low</option>
  `;
  if (currentSort) sortSelect.value = currentSort;
  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    currentPage = 1;
    loadAndRender(); // eslint-disable-line no-use-before-define
  });
  $productSort.appendChild(sortSelect);

  async function loadAndRender() {
    $productList.innerHTML = '<div class="search__loading">Loading...</div>';

    try {
      const result = await listProducts({
        page: currentPage,
        pageSize,
        categoryId: config.urlpath || undefined,
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

    // Result info
    $resultInfo.innerHTML = q
      ? `${totalCount} results found for <strong>"${q}"</strong>.`
      : `${totalCount} results found.`;

    // Product grid
    $productList.innerHTML = '';

    if (totalCount === 0) {
      $productList.innerHTML = '<p class="search__no-results">No products found.</p>';
      return;
    }

    products.forEach((product) => {
      const { attributes } = product;
      const name = attributes.name || attributes.names?.default || '';
      const { sku } = attributes;
      const priceData = getProductPrice(product);
      const imageUrl = getProductImageUrl(product, baseUrl);
      const productUrl = getProductLink(sku, sku);

      const card = document.createElement('div');
      card.className = 'search__product-card';

      const imgHtml = imageUrl
        ? `<a href="${productUrl}"><img src="${imageUrl}" alt="${name}" loading="lazy" width="300" height="300" /></a>`
        : `<a href="${productUrl}"><div class="search__product-card-placeholder"></div></a>`;

      card.innerHTML = `
        ${imgHtml}
        <h3><a href="${productUrl}">${name}</a></h3>
        <span class="search__product-price">${priceData ? formatPrice(priceData.price, priceData.currency) : ''}</span>
        <div class="product-discovery-product-actions">
          <div class="product-discovery-product-actions__add-to-cart">
            <button class="dropin-button dropin-button--primary">${labels.Global?.AddProductToCart || 'Add to Cart'}</button>
          </div>
        </div>
      `;

      const addBtn = card.querySelector('.product-discovery-product-actions__add-to-cart button');
      addBtn.addEventListener('click', async () => {
        if (isGuest()) {
          window.location.href = rootLink(`${CUSTOMER_LOGIN_PATH}?returnUrl=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        addBtn.disabled = true;
        addBtn.textContent = 'Adding...';
        try {
          const units = attributes.unitPrecisions;
          const unitCode = units?.[0]?.unit?.id || 'item';
          await addToShoppingList(product.id, 1, unitCode);
          addBtn.textContent = 'Added!';
          setTimeout(() => {
            addBtn.textContent = labels.Global?.AddProductToCart || 'Add to Cart';
            addBtn.disabled = false;
          }, 2000);
        } catch (err) {
          console.error('Add to cart failed:', err);
          addBtn.textContent = labels.Global?.AddProductToCart || 'Add to Cart';
          addBtn.disabled = false;
        }
      });

      $productList.appendChild(card);
    });
  }

  function renderPagination(result) {
    const { totalPages, page: activePage } = result;
    $pagination.innerHTML = '';

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i += 1) {
      const btn = document.createElement('button');
      btn.className = `search__page-btn${i === activePage ? ' search__page-btn--active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => {
        currentPage = i;
        loadAndRender();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
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
    window.history.pushState({}, '', url.toString());
  }

  // Initial load
  await loadAndRender();
}

async function getOroConfig() {
  const { getConfig } = await import('../../scripts/oro-api.js');
  const cfg = getConfig();
  return { baseUrl: cfg?.baseUrl || '' };
}
