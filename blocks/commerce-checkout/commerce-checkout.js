import {
  getCheckout,
  getDefaultShoppingList,
  getAvailableAddresses,
  getPaymentMethods,
  patchCheckout,
  validateCheckout,
  placeOrder,
  clearShoppingList,
  isGuest,
} from '../../scripts/oro-api.js';
import {
  formatPrice, formatPriceSmart, getProductPrice, convertCurrency,
} from '../../scripts/oro-utils.js';
import {
  fetchPlaceholders,
  rootLink,
  checkIsAuthenticated,
  CUSTOMER_LOGIN_PATH,
} from '../../scripts/commerce.js';

const SPINNER_HTML = '<div class="checkout__loading"><div class="checkout__spinner"></div></div>';

export default async function decorate(block) {
  document.title = 'Checkout';

  // Auth guard
  if (!checkIsAuthenticated() || isGuest()) {
    window.location.href = rootLink(
      `${CUSTOMER_LOGIN_PATH}?returnUrl=${encodeURIComponent(window.location.pathname)}`,
    );
    return;
  }

  const labels = await fetchPlaceholders();

  // Build checkout DOM skeleton — renders immediately, sections load async
  block.innerHTML = `
    <div class="checkout__wrapper">
      <div class="checkout__loader" hidden></div>
      <div class="checkout__content">
        <div class="checkout__merged-cart-banner"></div>
        <div class="checkout__main">
          <div class="checkout__heading checkout__block">
            <div class="dropin-header-container">
              <div class="dropin-header-container__title">Checkout</div>
            </div>
            <div class="dropin-divider"></div>
          </div>
          <div class="checkout__server-error checkout__block" hidden></div>
          <div class="checkout__shipping-form checkout__block" hidden></div>
          <div class="checkout__bill-to-shipping checkout__block" hidden></div>
          <div class="checkout__delivery checkout__block" hidden></div>
          <div class="checkout__payment-methods checkout__block">
            ${SPINNER_HTML}
          </div>
          <div class="checkout__billing-form checkout__block" hidden></div>
          <div class="checkout__place-order checkout__block"></div>
        </div>
        <div class="checkout__aside">
          <div class="checkout__order-summary checkout__block">
            ${SPINNER_HTML}
          </div>
          <div class="checkout__cart-summary checkout__block"></div>
        </div>
      </div>
    </div>
  `;

  const $loader = block.querySelector('.checkout__loader');
  const $serverError = block.querySelector('.checkout__server-error');
  const $shippingForm = block.querySelector('.checkout__shipping-form');
  const $paymentMethods = block.querySelector('.checkout__payment-methods');
  const $placeOrder = block.querySelector('.checkout__place-order');
  const $orderSummary = block.querySelector('.checkout__order-summary');
  const $cartSummary = block.querySelector('.checkout__cart-summary');

  let checkoutId = null;
  let checkoutData = null;
  let selectedPaymentMethod = null;
  let savedAddressId = null;

  // Full-page loader only used for place-order action
  function showLoader() { $loader.hidden = false; }
  function hideLoader() { $loader.hidden = true; }

  function showError(msg) {
    $serverError.hidden = false;
    $serverError.innerHTML = `<div class="dropin-illustrated-message">
      <svg class="checkout__error-icon" xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      ${msg}
    </div>`;
  }

  // --- Place Order Button (rendered immediately, disabled until ready) ---
  const placeOrderBtn = document.createElement('button');
  placeOrderBtn.className = 'dropin-button dropin-button--primary checkout__place-order-btn';
  placeOrderBtn.textContent = labels.Global?.PlaceOrder || 'Place Order';
  placeOrderBtn.disabled = true;

  const extraFields = document.createElement('div');
  extraFields.className = 'checkout__extra-fields';
  extraFields.innerHTML = `
    <label>Order Notes (optional)<textarea name="customerNotes" rows="3"></textarea></label>
  `;
  $placeOrder.appendChild(extraFields);
  $placeOrder.appendChild(placeOrderBtn);

  function enablePlaceOrder() {
    placeOrderBtn.disabled = !(selectedPaymentMethod && savedAddressId);
  }

  // --- Helper: Read checkout ID from session cookie ---
  function getCheckoutIdFromCookie() {
    const match = document.cookie.match(/(?:^|;\s*)oro_checkout_id=([^;]+)/);
    return match ? match[1] : null;
  }

  // --- Step 1: Load checkout by ID from session cookie ---
  const cookieCheckoutId = getCheckoutIdFromCookie();

  if (!cookieCheckoutId) {
    block.querySelector('.checkout__content')
      .classList.add('checkout__content--empty');
    block.querySelector('.checkout__main').innerHTML = `
      <div class="checkout__empty-cart">
        <p>No active checkout found.</p>
        <a href="${rootLink('/')}"
          class="dropin-button dropin-button--primary">
          Continue Shopping
        </a>
      </div>`;
  } else {
    Promise.all([
      getCheckout(cookieCheckoutId),
      getDefaultShoppingList(),
    ]).then(([{ checkout }, shoppingList]) => {
      if (!checkout) {
        block.querySelector('.checkout__content')
          .classList.add('checkout__content--empty');
        block.querySelector('.checkout__main').innerHTML = `
          <div class="checkout__empty-cart">
            <p>No active checkout found.</p>
            <a href="${rootLink('/')}"
              class="dropin-button dropin-button--primary">
              Continue Shopping
            </a>
          </div>`;
        return;
      }

      checkoutData = checkout;
      checkoutId = checkoutData.id;

      // If checkout is already completed, show "all done" screen
      const status = checkoutData.attributes?.completed
        || checkoutData.attributes?.state === 'completed';
      if (status) {
        document.cookie = 'oro_checkout_id=; path=/; max-age=0';
        block.innerHTML = `
          <div class="checkout__wrapper">
            <div class="checkout__content">
              <div class="checkout__main">
                <div class="checkout__empty-cart">
                  <h2>You are all done!</h2>
                  <p>Your order has been placed successfully.</p>
                  <a href="${rootLink('/')}"
                    class="dropin-button dropin-button--primary">
                    Go Shopping
                  </a>
                </div>
              </div>
            </div>
          </div>`;
        return;
      }

      // Render order summary using checkout totals + shopping list items for line details
      renderOrderSummary(checkoutData, shoppingList, $orderSummary, $cartSummary);

      // Fire parallel fetches — each populates its own section
      loadAvailableShippingAddresses();
      loadPaymentMethods();
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Checkout init failed:', err);
      showError(err.message || 'Failed to load checkout.');
      $shippingForm.innerHTML = '';
      $paymentMethods.innerHTML = '';
      $orderSummary.innerHTML = '';
    });
  }

  // --- Load available shipping addresses and pick first as billing ---
  async function loadAvailableShippingAddresses() {
    try {
      const resp = await getAvailableAddresses(checkoutId, 'shipping');
      const addresses = Array.isArray(resp) ? resp : (resp.data || []);
      if (addresses.length > 0) {
        savedAddressId = addresses[0].relationships?.address?.data?.id;
      }
      enablePlaceOrder();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load shipping addresses:', err);
    }
  }

  // --- Load payment methods independently ---
  async function loadPaymentMethods() {
    try {
      const paymentResp = await getPaymentMethods(checkoutId);
      const paymentMethodsList = Array.isArray(paymentResp)
        ? paymentResp
        : (paymentResp.data || []);

      if (paymentMethodsList.length === 0) {
        showError(
          'No payment methods are available for this order.'
          + ' Please contact support.',
        );
        block.querySelector('.checkout__content')
          .classList.add('checkout__content--error');
        return;
      }

      $paymentMethods.innerHTML = `
        <div class="dropin-header-container">
          <div class="dropin-header-container__title">Payment Method</div>
        </div>
        <div class="checkout__payment-methods-list"></div>
      `;
      const $paymentList = $paymentMethods
        .querySelector('.checkout__payment-methods-list');

      paymentMethodsList.forEach((method) => {
        const label = document.createElement('label');
        label.className = 'checkout__payment-option';
        label.innerHTML = `
          <input type="radio" name="paymentMethod"
            value="${method.id}" />
          ${[method.attributes?.options?.paymentTerm, method.attributes?.label].filter(Boolean).join(' ') || method.id}
        `;
        label.querySelector('input').addEventListener('change', () => {
          selectedPaymentMethod = method.id;
          enablePlaceOrder();
        });
        $paymentList.appendChild(label);
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load payment methods:', err);
      $paymentMethods.innerHTML = '';
      showError('Failed to load payment methods. Please try again.');
    }
  }

  // --- Place Order handler ---
  placeOrderBtn.addEventListener('click', async () => {
    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = 'Placing order...';
    showLoader();

    try {
      const customerNotes = block
        .querySelector('textarea[name="customerNotes"]')?.value || undefined;

      // Single PATCH with billing address + payment
      await patchCheckout(checkoutId, {
        data: {
          type: 'checkouts',
          id: String(checkoutId),
          attributes: {
            paymentMethod: selectedPaymentMethod,
            ...(customerNotes ? { customerNotes } : {}),
          },
          relationships: {
            shippingAddress: {
              data: { type: 'checkoutaddresses', id: 'shipping_address' },
            },
            billingAddress: {
              data: { type: 'checkoutaddresses', id: 'billing_address' },
            },
          },
        },
        included: [
          {
            type: 'checkoutaddresses',
            id: 'shipping_address',
            relationships: {
              customerUserAddress: {
                data: { type: 'customeruseraddresses', id: savedAddressId },
              },
            },
          },
          {
            type: 'checkoutaddresses',
            id: 'billing_address',
            relationships: {
              customerUserAddress: {
                data: { type: 'customeruseraddresses', id: savedAddressId },
              },
            },
          },
        ],
      });

      // Get payment URL
      const validation = await validateCheckout(checkoutId);
      const fullPaymentUrl = validation.meta?.paymentUrl;
      if (!fullPaymentUrl) {
        showError('Unable to process payment. Please try again or contact support.');
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = labels.Global?.PlaceOrder || 'Place Order';
        hideLoader();
        return;
      }

      // Extract path only — host in the URL may be invalid
      const paymentPath = new URL(fullPaymentUrl).pathname;

      // Place order
      const orderResult = await placeOrder(paymentPath);

      hideLoader();

      // Clear checkout cookie and shopping list after successful order
      document.cookie = 'oro_checkout_id=; path=/; max-age=0';
      clearShoppingList().catch((err) => console.warn('Failed to clear shopping list:', err));

      // Show order confirmation
      const orderIdentifier = orderResult.identifier || orderResult.orderId;
      window.scrollTo(0, 0);
      document.title = 'Order Confirmation';
      block.innerHTML = `
        <div class="checkout__wrapper">
          <div class="checkout__content">
            <div class="checkout__main">
              <div class="checkout__empty-cart">
                <h2>Your order #${orderIdentifier} has been successfully placed!</h2>
                <a href="${rootLink('/')}"
                  class="dropin-button dropin-button--primary">
                  OK
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Place order failed:', err);
      showError(err.message || 'Failed to place order. Please try again.');
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = labels.Global?.PlaceOrder || 'Place Order';
      hideLoader();
    }
  });
}

// --- Helper: Render order summary sidebar ---
function renderOrderSummary(checkout, shoppingList, $orderSummary, $cartSummary) {
  const attrs = checkout?.attributes || {};
  const currency = attrs.currencyId || attrs.currency || 'USD';

  const subtotalEntry = (attrs.totals || [])
    .find((t) => t.subtotalType === 'subtotal');
  const subtotal = subtotalEntry
    ? parseFloat(subtotalEntry.amount)
    : (attrs.subtotals?.subtotal || 0);
  const discountEntry = (attrs.totals || [])
    .find((t) => t.subtotalType === 'discount');
  const discount = discountEntry ? Math.abs(parseFloat(discountEntry.amount)) : 0;
  const total = parseFloat(attrs.totalValue) || attrs.total || 0;

  const discountLine = discount > 0
    ? `<div class="order-summary__line">
        <span>Discount</span>
        <span>-${formatPriceSmart(discount, currency)}</span>
      </div>`
    : '';

  $orderSummary.innerHTML = `
    <div class="dropin-card">
      <h3>Order Summary</h3>
      <div class="order-summary__line">
        <span>Subtotal</span>
        <span>${formatPriceSmart(subtotal, currency)}</span>
      </div>
      ${discountLine}
      <div class="dropin-divider"></div>
      <div class="order-summary__line order-summary__total">
        <span><strong>Total</strong></span>
        <span><strong>${formatPriceSmart(total, currency)}</strong></span>
      </div>
    </div>
  `;

  // Cart summary — use shopping list items for full product details
  const items = shoppingList?.items || [];
  if (items.length > 0) {
    $cartSummary.innerHTML = `
      <div class="cart-cart-summary-list">
        <div class="cart-cart-summary-list__heading">
          <span class="cart-cart-summary-list__heading-text">Items (${items.length})</span>
        </div>
        ${items.map((item) => {
    const product = item._product;
    const productName = product?.attributes?.name
      || product?.attributes?.sku
      || 'Item';
    const quantity = item.attributes?.quantity || 1;
    const priceInfo = product ? getProductPrice(product) : null;
    const rawLineTotal = priceInfo ? priceInfo.price * quantity : 0;
    const lineCurrency = priceInfo?.currency || currency;
    const lineTotal = convertCurrency(rawLineTotal, lineCurrency, currency);
    return `<div class="checkout__line-item">
            <span>${productName}</span>
            <span>${formatPrice(lineTotal, currency)}</span>
          </div>`;
  }).join('')}
      </div>
    `;
  }
}
