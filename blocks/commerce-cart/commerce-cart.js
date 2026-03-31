import { events } from '../../scripts/oro-events.js';
import {
  removeShoppingListItem,
  createCheckout,
  getDefaultShoppingListId,
} from '../../scripts/oro-api.js';
import {
  formatPrice,
} from '../../scripts/oro-utils.js';
import { readBlockConfig } from '../../scripts/aem.js';
import {
  fetchPlaceholders,
  rootLink,
} from '../../scripts/commerce.js';

export default async function decorate(block) {
  const {
    'start-shopping-url': startShoppingURL = '',
    'checkout-url': checkoutURL = '',
  } = readBlockConfig(block);

  const placeholders = await fetchPlaceholders();

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
    <div class="cart__empty-cart" hidden></div>
  `);

  const $wrapper = fragment.querySelector('.cart__wrapper');
  const $notification = fragment.querySelector('.cart__notification');
  const $list = fragment.querySelector('.cart__list');
  const $summary = fragment.querySelector('.cart__order-summary');
  const $emptyCart = fragment.querySelector('.cart__empty-cart');
  const $rightColumn = fragment.querySelector('.cart__right-column');

  block.innerHTML = '';
  block.appendChild(fragment);

  // Show spinner while waiting for cart data
  $list.innerHTML = '<div class="cart__loading"><div class="cart__spinner"></div></div>';

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

  function setupViewDetailsToggle(card) {
    const descText = card.querySelector('.cart__item-description-text');
    const toggleBtn = card.querySelector('.cart__item-view-details');
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
        const expanded = descText.classList.toggle('cart__item-description-text--expanded');
        toggleBtn.textContent = expanded ? 'Hide Details' : 'View Details';
        toggleBtn.setAttribute('aria-expanded', String(expanded));
      });
    });
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
      const productName = product?.attributes?.name || 'Product';
      const shortDesc = product?.attributes?.shortDescription || '';
      const linePrice = item.attributes?.value || 0;
      const currency = item.attributes?.currency || cartData.currency || 'USD';
      const productUrl = rootLink(`/catalog/product?productid=${product?.id || ''}`);

      const itemEl = document.createElement('div');
      itemEl.className = 'cart__item';
      itemEl.dataset.itemId = item.id;

      // Header row: title (left) + price & remove (right)
      const headerRow = document.createElement('div');
      headerRow.className = 'cart__item-header';

      const heading = document.createElement('h3');
      heading.className = 'cart__item-name';
      heading.innerHTML = `<a href="${productUrl}">${productName}</a>`;

      const actions = document.createElement('div');
      actions.className = 'cart__item-actions';

      const priceDiv = document.createElement('div');
      priceDiv.className = 'cart__item-price';
      priceDiv.textContent = formatPrice(linePrice, currency);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'cart__item-remove';
      removeBtn.setAttribute('aria-label', 'Remove item');
      removeBtn.textContent = 'Remove';

      removeBtn.addEventListener('click', async () => {
        removeBtn.disabled = true;
        removeBtn.textContent = 'REMOVING...';
        try {
          await removeShoppingListItem(item.id);
        } catch (err) {
          console.error('Failed to remove item:', err);
          showNotification('Failed to remove item.', 'error');
          removeBtn.disabled = false;
          removeBtn.textContent = 'Remove';
        }
      });

      actions.append(priceDiv, removeBtn);
      headerRow.append(heading, actions);

      // Description
      const descDiv = document.createElement('div');
      descDiv.className = 'cart__item-description';
      const descText = document.createElement('div');
      descText.className = 'cart__item-description-text';
      descText.innerHTML = shortDesc;
      descDiv.appendChild(descText);

      const viewDetailsBtn = document.createElement('button');
      viewDetailsBtn.className = 'cart__item-view-details';
      viewDetailsBtn.textContent = 'View Details';
      viewDetailsBtn.setAttribute('aria-expanded', 'false');

      itemEl.append(headerRow, descDiv, viewDetailsBtn);
      $list.appendChild(itemEl);

      setupViewDetailsToggle(itemEl);
    });
  }

  function renderSummary(cartData) {
    if (!cartData || !cartData.items || cartData.items.length === 0) {
      $summary.innerHTML = '';
      return;
    }

    const currency = cartData.currency || 'USD';
    const checkoutHref = checkoutURL ? rootLink(checkoutURL) : rootLink('/checkout');

    const checkoutLabel = placeholders.Global?.Checkout || 'Proceed to Checkout';

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
        <button class="dropin-button dropin-button--primary cart__checkout-btn">
          ${checkoutLabel}
        </button>
      </div>
    `;

    const checkoutBtn = $summary.querySelector('.cart__checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', async () => {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Creating checkout...';
        try {
          const shoppingListId = getDefaultShoppingListId();
          if (!shoppingListId) {
            showNotification('Your cart is empty.', 'error');
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = checkoutLabel;
            return;
          }
          await createCheckout(shoppingListId);
          window.location.href = checkoutHref;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to create checkout:', err);
          showNotification('Failed to start checkout. Please try again.', 'error');
          checkoutBtn.disabled = false;
          checkoutBtn.textContent = checkoutLabel;
        }
      });
    }
  }

  // Listen for cart data (eager: true fires immediately if initializer already loaded it)
  events.on('oro/cart/data', (cartData) => {
    renderCartItems(cartData);
    renderSummary(cartData);
  }, { eager: true });
}
