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
        <div class="product-details__ships"></div>
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
  const $ships = fragment.querySelector('.product-details__ships');
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
    $alert, $loading, $wrapper, $image, $title, $ships, $price, $shortDescription, $actions,
  });
}

async function loadProduct(productId, labels, els) {
  const {
    $alert, $loading, $wrapper, $image, $title, $ships, $price, $shortDescription, $actions,
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
    fetchImageAsObjectUrl(imageUrl).then((blobUrl) => {
      img.src = blobUrl;
      $image.appendChild(img);
    }).catch(() => {
      img.src = imageUrl;
      $image.appendChild(img);
    });
  } else {
    $image.innerHTML = '<div class="product-details__image-placeholder">No image available</div>';
  }

  // --- Title ---
  $title.textContent = name;

  // --- Ships info ---
  const ships = attributes.productAttributes?.ships || [];
  if (ships.length > 0) {
    const shipSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor"><path d="M272 64C245.5 64 224 85.5 224 112L224 128L208 128C163.8 128 128 163.8 128 208L128 316.8L106.4 325.4C91.6 331.3 83.9 347.8 89 362.9C99.4 394.2 115.8 422.2 136.7 446C156.8 436.8 178.4 432.1 200 432C233.1 431.8 266.3 442.2 294.4 463.4L296 464.6L296 249.6L192 291.2L192 208C192 199.2 199.2 192 208 192L432 192C440.8 192 448 199.2 448 208L448 291.2L344 249.6L344 464.6L345.6 463.4C373.1 442.7 405.5 432.2 438 432C460.3 431.9 482.6 436.5 503.3 446C524.2 422.3 540.6 394.2 551 362.9C556 347.7 548.4 331.3 533.6 325.4L512 316.8L512 208C512 163.8 476.2 128 432 128L416 128L416 112C416 85.5 394.5 64 368 64L272 64zM403.4 540.1C424.7 524 453.3 524 474.6 540.1C493.6 554.5 516.5 568.3 541.8 573.4C568.3 578.8 596.1 574.2 622.5 554.3C633.1 546.3 635.2 531.3 627.2 520.7C619.2 510.1 604.2 508 593.6 516C578.7 527.2 565 529.1 551.3 526.3C536.4 523.3 520.4 514.4 503.5 501.7C465.1 472.7 413 472.7 374.5 501.7C350.5 519.8 333.8 528 320 528C306.2 528 289.5 519.8 265.5 501.7C227.1 472.7 175 472.7 136.5 501.7C114.9 518 95.2 527.5 77.6 527.4C68 527.3 57.7 524.4 46.4 515.9C35.8 507.9 20.8 510 12.8 520.6C4.8 531.2 7 546.3 17.6 554.3C36.7 568.7 57 575.3 77.4 575.4C111.3 575.6 141.7 558 165.5 540.1C186.8 524 215.4 524 236.7 540.1C260.9 558.4 289 576 320.1 576C351.2 576 379.2 558.3 403.5 540.1z"/></svg>';
    $ships.innerHTML = `${shipSvg}<span>${ships.map((s) => s.targetValue).join(', ')}</span>`;
  }

  // --- Price (rounded to full dollars) ---
  if (priceData) {
    const rounded = Math.round(priceData.price);
    $price.textContent = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: priceData.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rounded);
  }

  // --- Description ---
  if (attributes.description) {
    $shortDescription.innerHTML = attributes.description;
  } else if (attributes.shortDescription) {
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
