import {
  getProduct,
  addToShoppingList,
  isGuest,
  getConfig,
} from '../../scripts/oro-api.js';
import { events } from '../../scripts/oro-events.js';
import {
  getProductImageUrl,
  getProductPrice,
  fetchImageAsObjectUrl,
} from '../../scripts/oro-utils.js';
import {
  rootLink,
  setJsonLd,
  fetchPlaceholders,
  CUSTOMER_LOGIN_PATH,
} from '../../scripts/commerce.js';

export default async function decorate(block) {
  const labels = await fetchPlaceholders();

  const fragment = document.createRange().createContextualFragment(`
    <div class="product-details__alert"></div>
    <div class="product-details__loading"><div class="product-details__spinner"></div></div>
    <div class="product-details__wrapper" style="display:none">
      <div class="product-details__image"></div>
      <div class="product-details__info">
        <h1 class="product-details__title"></h1>
        <div class="product-details__price"></div>
        <div class="product-details__short-description"></div>
        <div class="product-details__actions"></div>
      </div>
    </div>
  `);

  const $alert = fragment.querySelector('.product-details__alert');
  const $loading = fragment.querySelector('.product-details__loading');
  const $wrapper = fragment.querySelector('.product-details__wrapper');
  const $image = fragment.querySelector('.product-details__image');
  const $title = fragment.querySelector('.product-details__title');
  const $price = fragment.querySelector('.product-details__price');
  const $shortDescription = fragment.querySelector('.product-details__short-description');
  const $actions = fragment.querySelector('.product-details__actions');

  block.replaceChildren(fragment);

  // Get product ID from query parameter
  const params = new URLSearchParams(window.location.search);
  const productIdParam = params.get('productid');
  const productId = Number(productIdParam);
  if (!productIdParam || !Number.isInteger(productId) || productId <= 0) {
    $loading.remove();
    showAlert($alert, 'Invalid or missing product ID.');
    return;
  }

  // Fetch product without blocking page render
  loadProduct(productId, labels, {
    $alert, $loading, $wrapper, $image, $title, $price, $shortDescription, $actions,
  });
}

async function loadProduct(productId, labels, els) {
  const {
    $alert, $loading, $wrapper, $image, $title, $price, $shortDescription, $actions,
  } = els;

  let product;
  try {
    product = await getProduct(String(productId));
  } catch (err) {
    console.error('Failed to load product:', err);
    $loading.remove();
    showAlert($alert, 'Failed to load product details.');
    return;
  }

  const { attributes } = product;
  const config = getConfig();
  const baseUrl = config?.baseUrl || '';
  const imageUrl = getProductImageUrl(product, baseUrl);
  const priceData = getProductPrice(product);
  const name = attributes.name || attributes.names?.default || '';

  // Emit product data for other blocks
  events.emit('oro/pdp/data', product);

  // --- Image (first only, fetched with ngrok headers) ---
  if (imageUrl) {
    const img = document.createElement('img');
    img.alt = name;
    img.width = 600;
    img.height = 600;
    img.loading = 'eager';
    $image.appendChild(img);
    fetchImageAsObjectUrl(imageUrl).then((blobUrl) => {
      img.src = blobUrl;
    }).catch(() => {
      img.src = imageUrl;
    });
  } else {
    $image.innerHTML = '<div class="product-details__image-placeholder">No image available</div>';
  }

  // --- Title ---
  $title.textContent = name;

  // --- Price (rounded to full dollars) ---
  if (priceData) {
    const rounded = Math.round(priceData.price);
    $price.textContent = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: priceData.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rounded);
  }

  // --- Short Description ---
  if (attributes.shortDescription) {
    $shortDescription.innerHTML = attributes.shortDescription;
  }

  // --- Add to Cart Button (styled like PLP) ---
  const prices = attributes.prices || [];
  const selectedUnit = prices.length > 0 ? (prices[0].unit || 'item') : 'item';

  const addBtn = document.createElement('button');
  addBtn.className = 'product-details__add-to-cart';

  function updateCartButton() {
    const cartData = events.lastPayload('oro/cart/data');
    const inCart = cartData?.items?.some((item) => {
      const pid = item._product?.id || item.relationships?.product?.data?.id;
      return String(pid) === String(product.id);
    });
    if (inCart) {
      addBtn.textContent = 'GO TO CART';
      addBtn.disabled = false;
      addBtn.dataset.inCart = 'true';
    } else {
      addBtn.textContent = labels.Global?.AddProductToCart || 'ADD TO CART';
      addBtn.disabled = false;
      delete addBtn.dataset.inCart;
    }
  }

  updateCartButton();
  events.on('oro/cart/data', updateCartButton);

  addBtn.addEventListener('click', async () => {
    if (addBtn.dataset.inCart) {
      window.location.href = rootLink('/cart');
      return;
    }
    if (isGuest()) {
      window.location.href = rootLink(`${CUSTOMER_LOGIN_PATH}?returnUrl=${encodeURIComponent(window.location.href)}`);
      return;
    }
    addBtn.disabled = true;
    addBtn.textContent = labels.Global?.AddingToCart || 'ADDING...';
    try {
      await addToShoppingList(product.id, 1, selectedUnit);
    } catch (err) {
      console.error('Add to cart failed:', err);
      showAlert($alert, err.message || 'Failed to add product to cart.');
      updateCartButton();
    }
  });
  $actions.appendChild(addBtn);

  // Show content, hide spinner
  $loading.remove();
  $wrapper.style.display = '';

  // --- JSON-LD ---
  setJsonLdProduct(product, baseUrl, imageUrl);

  // --- Meta tags ---
  setMetaTags(product, imageUrl);
}

function showAlert(container, message) {
  container.innerHTML = `<div class="product-details__alert-message">${message}</div>`;
  setTimeout(() => { container.innerHTML = ''; }, 5000);
}

function setJsonLdProduct(product, baseUrl, imageUrl) {
  const { attributes } = product;
  const priceData = getProductPrice(product);
  const name = attributes.name || attributes.names?.default || '';

  const ldJson = {
    '@context': 'http://schema.org',
    '@type': 'Product',
    name,
    description: attributes.description || attributes.shortDescription || '',
    image: imageUrl || '',
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

function setMetaTags(product, imageUrl) {
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
  if (imageUrl) {
    setMeta('og:image', 'property', imageUrl);
  }
  if (priceData) {
    setMeta('product:price:amount', 'property', String(priceData.price));
    setMeta('product:price:currency', 'property', priceData.currency);
  }
}
