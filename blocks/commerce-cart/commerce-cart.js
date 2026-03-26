import { events } from '../../scripts/oro-events.js';
import {
  getDefaultShoppingList,
  updateShoppingListItem,
  removeShoppingListItem,
  isGuest,
  getConfig,
} from '../../scripts/oro-api.js';
import {
  formatPrice,
  resolveImageUrl,
} from '../../scripts/oro-utils.js';
import { readBlockConfig } from '../../scripts/aem.js';
import {
  fetchPlaceholders,
  rootLink,
  checkIsAuthenticated,
  CUSTOMER_LOGIN_PATH,
} from '../../scripts/commerce.js';

export default async function decorate(block) {
  const {
    'start-shopping-url': startShoppingURL = '',
    'checkout-url': checkoutURL = '',
  } = readBlockConfig(block);

  const placeholders = await fetchPlaceholders();
  const config = getConfig();
  const baseUrl = config?.baseUrl || '';

  // Layout — same DOM skeleton as original
  const fragment = document.createRange().createContextualFragment(`
    <div class="cart__notification"></div>
    <div class="cart__wrapper">
      <div class="cart__left-column">
        <div class="cart__list"></div>
      </div>
      <div class="cart__right-column">
        <div class="cart__order-summary"></div>
        <div class="cart__gift-options"></div>
      </div>
    </div>
    <div class="cart__empty-cart"></div>
  `);

  const $wrapper = fragment.querySelector('.cart__wrapper');
  const $notification = fragment.querySelector('.cart__notification');
  const $list = fragment.querySelector('.cart__list');
  const $summary = fragment.querySelector('.cart__order-summary');
  const $emptyCart = fragment.querySelector('.cart__empty-cart');
  const $rightColumn = fragment.querySelector('.cart__right-column');

  block.innerHTML = '';
  block.appendChild(fragment);

  // Debounce for quantity updates
  const debounceTimers = {};

  function showNotification(message, type = 'success') {
    $notification.innerHTML = `
      <div class="dropin-in-line-alert dropin-in-line-alert--${type}">
        <div class="dropin-in-line-alert__content">${message}</div>
        <button class="dropin-in-line-alert__close" aria-label="Dismiss">\u00d7</button>
      </div>`;
    const closeBtn = $notification.querySelector('.dropin-in-line-alert__close');
    if (closeBtn) closeBtn.addEventListener('click', () => { $notification.innerHTML = ''; });
    setTimeout(() => { $notification.innerHTML = ''; }, 5000);
  }

  function renderCartItems(cartData) {
    const isEmpty = !cartData || !cartData.items || cartData.items.length === 0;

    if (isEmpty) {
      $wrapper.setAttribute('hidden', '');
      $emptyCart.removeAttribute('hidden');
      $emptyCart.innerHTML = `
        <p>Your cart is empty.</p>
        <a href="${startShoppingURL ? rootLink(startShoppingURL) : rootLink('/')}" class="dropin-button dropin-button--primary">
          ${placeholders.Global?.StartShopping || 'Start Shopping'}
        </a>`;
      return;
    }

    $wrapper.removeAttribute('hidden');
    $emptyCart.setAttribute('hidden', '');
    $rightColumn.style.display = '';

    $list.innerHTML = '';

    cartData.items.forEach((item) => {
      const product = item._product;
      const unit = item._unit;
      const productName = product?.attributes?.name || 'Product';
      const productSku = product?.attributes?.sku || '';
      const qty = item.attributes?.quantity || 1;
      const linePrice = item.attributes?.value || 0;
      const currency = item.attributes?.currency || cartData.currency || 'USD';
      const unitLabel = unit?.attributes?.label || unit?.id || '';

      // Get image
      let imageUrl = '';
      if (product?.relationships?.images?.data?.length > 0) {
        // Image would need to be resolved from included data
        // For simplicity, use a placeholder approach
        imageUrl = '';
      }

      const itemEl = document.createElement('div');
      itemEl.className = 'cart__item';
      itemEl.dataset.itemId = item.id;

      itemEl.innerHTML = `
        <div class="cart__item-image">
          ${imageUrl ? `<img src="${imageUrl}" alt="${productName}" width="100" height="100" loading="lazy" />` : '<div class="cart__item-image-placeholder"></div>'}
        </div>
        <div class="cart__item-info">
          <h3 class="cart__item-name">${productName}</h3>
          <span class="cart__item-sku">SKU: ${productSku}</span>
          ${unitLabel ? `<span class="cart__item-unit">Unit: ${unitLabel}</span>` : ''}
        </div>
        <div class="dropin-cart-item__quantity">
          <button class="qty-minus dropin-button" aria-label="Decrease quantity">-</button>
          <input type="number" class="qty-input" min="1" value="${qty}" />
          <button class="qty-plus dropin-button" aria-label="Increase quantity">+</button>
        </div>
        <div class="cart__item-price">${formatPrice(linePrice, currency)}</div>
        <div class="dropin-cart-item__footer">
          <button class="cart__item-remove dropin-button" aria-label="Remove item">\u00d7 Remove</button>
        </div>
      `;

      // Quantity controls
      const qtyInput = itemEl.querySelector('.qty-input');
      const minusBtn = itemEl.querySelector('.qty-minus');
      const plusBtn = itemEl.querySelector('.qty-plus');
      const removeBtn = itemEl.querySelector('.cart__item-remove');

      function updateQty(newQty) {
        if (newQty < 1) return;
        qtyInput.value = newQty;
        // Debounce API call
        if (debounceTimers[item.id]) clearTimeout(debounceTimers[item.id]);
        debounceTimers[item.id] = setTimeout(async () => {
          try {
            await updateShoppingListItem(item.id, newQty);
          } catch (err) {
            console.error('Failed to update quantity:', err);
            showNotification('Failed to update quantity.', 'error');
          }
        }, 500);
      }

      minusBtn.addEventListener('click', () => {
        const current = parseInt(qtyInput.value, 10) || 1;
        updateQty(current - 1);
      });

      plusBtn.addEventListener('click', () => {
        const current = parseInt(qtyInput.value, 10) || 1;
        updateQty(current + 1);
      });

      qtyInput.addEventListener('change', () => {
        const val = parseInt(qtyInput.value, 10);
        if (val > 0) updateQty(val);
      });

      removeBtn.addEventListener('click', async () => {
        try {
          await removeShoppingListItem(item.id);
          showNotification(`${productName} removed from cart.`);
        } catch (err) {
          console.error('Failed to remove item:', err);
          showNotification('Failed to remove item.', 'error');
        }
      });

      $list.appendChild(itemEl);
    });
  }

  function renderSummary(cartData) {
    if (!cartData || !cartData.items || cartData.items.length === 0) {
      $summary.innerHTML = '';
      return;
    }

    const currency = cartData.currency || 'USD';
    const checkoutHref = checkoutURL ? rootLink(checkoutURL) : rootLink('/checkout');

    $summary.innerHTML = `
      <div class="cart-cart-summary-list">
        <div class="cart-cart-summary-list__heading">
          <span class="cart-cart-summary-list__heading-text">Order Summary</span>
        </div>
        <div class="cart__summary-line">
          <span>Subtotal</span>
          <span>${formatPrice(cartData.subtotal, currency)}</span>
        </div>
        <div class="cart__summary-total dropin-divider">
          <span><strong>Estimated Total</strong></span>
          <span><strong>${formatPrice(cartData.subtotal, currency)}</strong></span>
        </div>
        <a href="${checkoutHref}" class="dropin-button dropin-button--primary cart__checkout-btn">
          ${placeholders.Global?.Checkout || 'Proceed to Checkout'}
        </a>
      </div>
    `;
  }

  // Initial load
  if (checkIsAuthenticated()) {
    try {
      const cartData = await getDefaultShoppingList();
      renderCartItems(cartData);
      renderSummary(cartData);
    } catch (err) {
      console.error('Failed to load cart:', err);
    }
  } else {
    // Guest — show empty cart
    renderCartItems(null);
    renderSummary(null);
  }

  // Listen for cart updates
  events.on('oro/cart/data', (cartData) => {
    renderCartItems(cartData);
    renderSummary(cartData);
  });
}
