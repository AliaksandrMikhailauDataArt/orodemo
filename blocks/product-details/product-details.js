import {
  getProduct,
  addToShoppingList,
  isGuest,
  getConfig,
} from '../../scripts/oro-api.js';
import { events } from '../../scripts/oro-events.js';
import {
  getAllProductImageUrls,
  getProductPrice,
  formatPrice,
} from '../../scripts/oro-utils.js';
import {
  rootLink,
  setJsonLd,
  fetchPlaceholders,
  getProductSku,
  CUSTOMER_LOGIN_PATH,
} from '../../scripts/commerce.js';

export default async function decorate(block) {
  const labels = await fetchPlaceholders();

  // Layout — same DOM skeleton as original
  const fragment = document.createRange().createContextualFragment(`
    <div class="product-details__alert"></div>
    <div class="product-details__wrapper">
      <div class="product-details__left-column">
        <div class="product-details__gallery"></div>
      </div>
      <div class="product-details__right-column">
        <div class="product-details__header"></div>
        <div class="product-details__price"></div>
        <div class="product-details__gallery"></div>
        <div class="product-details__short-description"></div>
        <div class="product-details__gift-card-options"></div>
        <div class="product-details__configuration">
          <div class="product-details__options"></div>
          <div class="product-details__quantity"></div>
          <div class="product-details__buttons">
            <div class="product-details__buttons__add-to-cart"></div>
            <div class="product-details__buttons__add-to-wishlist"></div>
          </div>
        </div>
        <div class="product-details__description"></div>
        <div class="product-details__attributes"></div>
      </div>
    </div>
  `);

  const $alert = fragment.querySelector('.product-details__alert');
  const $gallery = fragment.querySelector('.product-details__left-column .product-details__gallery');
  const $header = fragment.querySelector('.product-details__header');
  const $price = fragment.querySelector('.product-details__price');
  const $galleryMobile = fragment.querySelector('.product-details__right-column .product-details__gallery');
  const $shortDescription = fragment.querySelector('.product-details__short-description');
  const $options = fragment.querySelector('.product-details__options');
  const $quantity = fragment.querySelector('.product-details__quantity');
  const $addToCart = fragment.querySelector('.product-details__buttons__add-to-cart');
  const $description = fragment.querySelector('.product-details__description');
  const $attributes = fragment.querySelector('.product-details__attributes');

  block.replaceChildren(fragment);

  // Get product ID from query parameter
  const params = new URLSearchParams(window.location.search);
  const productIdParam = params.get('productid');
  const productId = Number(productIdParam);
  if (!productIdParam || !Number.isInteger(productId) || productId <= 0) {
    showAlert($alert, 'Invalid or missing product ID.');
    return;
  }

  // Fetch product
  let product;
  try {
    product = await getProduct(String(productId));
  } catch (err) {
    console.error('Failed to load product:', err);
    showAlert($alert, 'Failed to load product details.');
    return;
  }

  const { attributes } = product;
  const config = getConfig();
  const baseUrl = config?.baseUrl || '';
  const imageUrls = getAllProductImageUrls(product, baseUrl);
  const priceData = getProductPrice(product);
  const name = attributes.name || attributes.names?.default || '';

  // Emit product data for other blocks
  events.emit('oro/pdp/data', product);

  // --- Render Gallery (Desktop) ---
  renderGallery($gallery, imageUrls, name, 'thumbnailsColumn');

  // --- Render Gallery (Mobile) ---
  renderGallery($galleryMobile, imageUrls, name, 'dots');

  // --- Header ---
  $header.innerHTML = `<h1>${name}</h1><span class="product-details__sku">SKU: ${attributes.sku || ''}</span>`;

  // --- Price ---
  if (priceData) {
    $price.innerHTML = `<span class="product-details__price-value">${formatPrice(priceData.price, priceData.currency)}</span>`;
  }

  // --- Short Description ---
  if (attributes.shortDescription) {
    $shortDescription.innerHTML = attributes.shortDescription;
  }

  // --- Unit selector (Oro-specific: unitPrecisions) ---
  const units = attributes.unitPrecisions || [];
  let selectedUnit = units.length > 0 ? (units[0].unit?.id || units[0].code || 'item') : 'item';

  if (units.length > 1) {
    const unitSelect = document.createElement('select');
    unitSelect.className = 'product-details__unit-select';
    units.forEach((u) => {
      const opt = document.createElement('option');
      const unitId = u.unit?.id || u.code || 'item';
      opt.value = unitId;
      opt.textContent = u.unit?.attributes?.label || unitId;
      unitSelect.appendChild(opt);
    });
    unitSelect.value = selectedUnit;
    unitSelect.addEventListener('change', () => {
      selectedUnit = unitSelect.value;
    });
    $options.appendChild(unitSelect);
  }

  // --- Quantity ---
  let quantity = 1;
  const qtyContainer = document.createElement('div');
  qtyContainer.className = 'product-details__qty-controls';
  qtyContainer.innerHTML = `
    <button class="qty-btn qty-minus" aria-label="Decrease quantity">-</button>
    <input type="number" class="qty-input" min="1" value="1" />
    <button class="qty-btn qty-plus" aria-label="Increase quantity">+</button>
  `;
  const qtyInput = qtyContainer.querySelector('.qty-input');
  qtyContainer.querySelector('.qty-minus').addEventListener('click', () => {
    if (quantity > 1) {
      quantity -= 1;
      qtyInput.value = quantity;
    }
  });
  qtyContainer.querySelector('.qty-plus').addEventListener('click', () => {
    quantity += 1;
    qtyInput.value = quantity;
  });
  qtyInput.addEventListener('change', () => {
    const val = parseInt(qtyInput.value, 10);
    quantity = val > 0 ? val : 1;
    qtyInput.value = quantity;
  });
  $quantity.appendChild(qtyContainer);

  // --- Add to Cart Button ---
  const addBtn = document.createElement('button');
  addBtn.className = 'dropin-button dropin-button--primary';
  addBtn.textContent = labels.Global?.AddProductToCart || 'Add to Cart';
  addBtn.addEventListener('click', async () => {
    if (isGuest()) {
      window.location.href = rootLink(`${CUSTOMER_LOGIN_PATH}?returnUrl=${encodeURIComponent(window.location.href)}`);
      return;
    }
    addBtn.disabled = true;
    addBtn.textContent = labels.Global?.AddingToCart || 'Adding...';
    try {
      await addToShoppingList(product.id, quantity, selectedUnit);
      addBtn.textContent = 'Added!';
      setTimeout(() => {
        addBtn.textContent = labels.Global?.AddProductToCart || 'Add to Cart';
        addBtn.disabled = false;
      }, 2000);
    } catch (err) {
      console.error('Add to cart failed:', err);
      showAlert($alert, err.message || 'Failed to add product to cart.');
      addBtn.textContent = labels.Global?.AddProductToCart || 'Add to Cart';
      addBtn.disabled = false;
    }
  });
  $addToCart.appendChild(addBtn);

  // --- Description ---
  if (attributes.description) {
    $description.innerHTML = `<h2>Description</h2><div>${attributes.description}</div>`;
  }

  // --- Attributes table ---
  if (attributes.unitPrecisions?.length > 0) {
    const rows = attributes.unitPrecisions.map((u) => {
      const unitLabel = u.unit?.attributes?.label || u.unit?.id || u.code || '';
      return `<tr><td>Unit</td><td>${unitLabel}</td></tr>`;
    }).join('');
    $attributes.innerHTML = `<h2>Specifications</h2><table>${rows}</table>`;
  }

  // --- JSON-LD ---
  setJsonLdProduct(product, baseUrl, imageUrls);

  // --- Meta tags ---
  setMetaTags(product, imageUrls);
}

function renderGallery(container, imageUrls, altText, mode) {
  if (!imageUrls || imageUrls.length === 0) {
    container.innerHTML = '<div class="pdp-carousel"><div class="pdp-carousel__placeholder">No image available</div></div>';
    return;
  }

  const carouselClass = mode === 'thumbnailsColumn'
    ? 'pdp-carousel pdp-carousel--thumbnailsRow'
    : 'pdp-carousel';

  let currentIndex = 0;

  const carousel = document.createElement('div');
  carousel.className = carouselClass;

  // Main image
  const mainImgContainer = document.createElement('div');
  mainImgContainer.className = 'pdp-carousel__main';
  const mainImg = document.createElement('img');
  mainImg.src = imageUrls[0];
  mainImg.alt = altText;
  mainImg.loading = 'eager';
  mainImg.width = 960;
  mainImg.height = 1191;
  mainImgContainer.appendChild(mainImg);
  carousel.appendChild(mainImgContainer);

  function setActiveImage(index) {
    currentIndex = index;
    mainImg.src = imageUrls[index];
  }

  // Thumbnails (desktop) or dots (mobile)
  if (mode === 'thumbnailsColumn' && imageUrls.length > 1) {
    const thumbs = document.createElement('div');
    thumbs.className = 'pdp-carousel__thumbnails';
    imageUrls.forEach((url, i) => {
      const btn = document.createElement('button');
      btn.className = `pdp-carousel__thumb${i === 0 ? ' pdp-carousel__thumb--active' : ''}`;
      btn.innerHTML = `<img src="${url}" alt="${altText} thumbnail ${i + 1}" width="80" height="80" loading="lazy" />`;
      btn.addEventListener('click', () => {
        setActiveImage(i);
        thumbs.querySelectorAll('.pdp-carousel__thumb').forEach((t) => t.classList.remove('pdp-carousel__thumb--active'));
        btn.classList.add('pdp-carousel__thumb--active');
      });
      thumbs.appendChild(btn);
    });
    carousel.appendChild(thumbs);
  } else if (mode === 'dots' && imageUrls.length > 1) {
    const dots = document.createElement('div');
    dots.className = 'pdp-carousel__dots';
    imageUrls.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = `pdp-carousel__dot${i === 0 ? ' pdp-carousel__dot--active' : ''}`;
      dot.setAttribute('aria-label', `Image ${i + 1}`);
      dot.addEventListener('click', () => {
        setActiveImage(i);
        dots.querySelectorAll('.pdp-carousel__dot').forEach((d) => d.classList.remove('pdp-carousel__dot--active'));
        dot.classList.add('pdp-carousel__dot--active');
      });
      dots.appendChild(dot);
    });
    carousel.appendChild(dots);
  }

  // Arrow buttons
  if (imageUrls.length > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pdp-carousel__arrow pdp-carousel__arrow--prev';
    prevBtn.setAttribute('aria-label', 'Previous image');
    prevBtn.textContent = '\u2039';
    prevBtn.addEventListener('click', () => {
      const newIdx = (currentIndex - 1 + imageUrls.length) % imageUrls.length;
      setActiveImage(newIdx);
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'pdp-carousel__arrow pdp-carousel__arrow--next';
    nextBtn.setAttribute('aria-label', 'Next image');
    nextBtn.textContent = '\u203A';
    nextBtn.addEventListener('click', () => {
      const newIdx = (currentIndex + 1) % imageUrls.length;
      setActiveImage(newIdx);
    });

    carousel.appendChild(prevBtn);
    carousel.appendChild(nextBtn);
  }

  container.appendChild(carousel);
}

function showAlert(container, message) {
  container.innerHTML = `<div class="dropin-in-line-alert dropin-in-line-alert--error">
    <div class="dropin-in-line-alert__content">${message}</div>
    <button class="dropin-in-line-alert__close" aria-label="Dismiss">\u00d7</button>
  </div>`;
  const closeBtn = container.querySelector('.dropin-in-line-alert__close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => { container.innerHTML = ''; });
  }
  setTimeout(() => { container.innerHTML = ''; }, 5000);
}

function setJsonLdProduct(product, baseUrl, imageUrls) {
  const { attributes } = product;
  const priceData = getProductPrice(product);
  const name = attributes.name || attributes.names?.default || '';

  const ldJson = {
    '@context': 'http://schema.org',
    '@type': 'Product',
    name,
    description: attributes.description || attributes.shortDescription || '',
    image: imageUrls[0] || '',
    sku: attributes.sku || '',
    productID: attributes.sku || product.id,
    url: window.location.href,
    '@id': window.location.href,
    offers: [],
  };

  if (priceData) {
    ldJson.offers.push({
      '@type': 'Offer',
      price: priceData.price,
      priceCurrency: priceData.currency,
      availability: 'http://schema.org/InStock',
    });
  }

  setJsonLd(ldJson, 'product');
}

function setMetaTags(product, imageUrls) {
  const { attributes } = product;
  const name = attributes.name || attributes.names?.default || '';
  const priceData = getProductPrice(product);

  document.title = name;

  const setMeta = (attr, attrType, content) => {
    if (!content) return;
    let meta = document.head.querySelector(`meta[${attrType}="${attr}"]`);
    if (meta) {
      meta.setAttribute('content', content);
    } else {
      meta = document.createElement('meta');
      meta.setAttribute(attrType, attr);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    }
  };

  setMeta('description', 'name', attributes.shortDescription || '');
  setMeta('og:type', 'property', 'product');
  setMeta('og:title', 'property', name);
  setMeta('og:description', 'property', attributes.shortDescription || '');
  setMeta('og:url', 'property', window.location.href);
  if (imageUrls[0]) {
    setMeta('og:image', 'property', imageUrls[0]);
  }
  if (priceData) {
    setMeta('product:price:amount', 'property', String(priceData.price));
    setMeta('product:price:currency', 'property', priceData.currency);
  }
}
