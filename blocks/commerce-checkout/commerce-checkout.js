import {
  getCheckout,
  getDefaultShoppingList,
  getAvailableAddresses,
  getShippingMethods,
  getPaymentMethods,
  updateCheckout,
  validateCheckout,
  placeOrder,
  getOrder,
  isGuest,
  getRegions,
} from '../../scripts/oro-api.js';
import { formatPrice, getProductPrice } from '../../scripts/oro-utils.js';
import {
  fetchPlaceholders,
  rootLink,
  checkIsAuthenticated,
  CUSTOMER_LOGIN_PATH,
  SUPPORT_PATH,
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
          <div class="checkout__shipping-form checkout__block">
            ${SPINNER_HTML}
          </div>
          <div class="checkout__bill-to-shipping checkout__block"></div>
          <div class="checkout__delivery checkout__block"></div>
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
  let selectedShippingMethod = null;
  let selectedShippingMethodType = null;
  let selectedPaymentMethod = null;
  let availableBillingAddresses = [];
  let shippingReady = false;
  let addressReady = false;

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
    <label>PO Number (optional)<input type="text" name="poNumber" /></label>
    <label>Order Notes (optional)<textarea name="customerNotes" rows="3"></textarea></label>
  `;
  $placeOrder.appendChild(extraFields);
  $placeOrder.appendChild(placeOrderBtn);

  function enablePlaceOrder() {
    placeOrderBtn.disabled = !(
      selectedPaymentMethod && shippingReady && addressReady
    );
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
      loadBillingAddresses();
      loadShippingMethods();
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

  // --- Load billing addresses independently ---
  async function loadBillingAddresses() {
    try {
      const billingResp = await getAvailableAddresses(checkoutId, 'billing');
      availableBillingAddresses = Array.isArray(billingResp)
        ? billingResp
        : (billingResp.data || []);

      if (availableBillingAddresses.length > 0) {
        renderAddressSelector($shippingForm, availableBillingAddresses);
      } else {
        renderManualAddressForm($shippingForm);
      }
      addressReady = true;
      enablePlaceOrder();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load billing addresses:', err);
      // Fall back to manual form
      renderManualAddressForm($shippingForm);
      addressReady = true;
      enablePlaceOrder();
    }
  }

  // --- Load shipping methods independently (auto-select, hidden) ---
  async function loadShippingMethods() {
    try {
      const shippingResp = await getShippingMethods(checkoutId);
      const shippingMethods = Array.isArray(shippingResp)
        ? shippingResp
        : (shippingResp.data || []);

      if (shippingMethods.length === 0) {
        showError(
          'No shipping methods are available for this order.'
          + ' Please contact support.',
        );
        block.querySelector('.checkout__content')
          .classList.add('checkout__content--error');
        return;
      }

      const firstShipping = shippingMethods[0];
      const firstType = firstShipping.attributes?.types?.[0];
      selectedShippingMethod = firstShipping.id;
      selectedShippingMethodType = firstType?.id || 'primary';
      shippingReady = true;
      enablePlaceOrder();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load shipping methods:', err);
      showError('Failed to load shipping methods. Please try again.');
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
          ${method.attributes?.label || method.id}
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
      // Determine billing address
      const selectedRadio = $shippingForm
        .querySelector('input[name="billingAddressSelection"]:checked');
      let billingAddress;

      if (!selectedRadio || selectedRadio.value === 'new') {
        const form = $shippingForm.querySelector('form');
        billingAddress = getAddressFromForm(form);
      } else {
        const addrId = selectedRadio.value;
        const addr = availableBillingAddresses
          .find((a) => String(a.id) === addrId);
        billingAddress = addr?.attributes || addr;
      }

      const poNumber = block
        .querySelector('input[name="poNumber"]')?.value || undefined;
      const customerNotes = block
        .querySelector('textarea[name="customerNotes"]')?.value || undefined;

      // Single PATCH with all checkout data
      await updateCheckout(checkoutId, {
        shippingMethod: selectedShippingMethod,
        shippingMethodType: selectedShippingMethodType,
        paymentMethod: selectedPaymentMethod,
        poNumber,
        customerNotes,
      });

      // Validate — get payment URL
      const validation = await validateCheckout(checkoutId);
      if (validation.errors && validation.errors.length > 0) {
        showError(
          validation.errors.map((e) => e.detail || e).join('<br>'),
        );
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = labels.Global?.PlaceOrder || 'Place Order';
        hideLoader();
        return;
      }

      // Place order
      const { paymentUrl } = validation;
      const orderResult = await placeOrder(paymentUrl);

      hideLoader();

      // Clear checkout cookie after successful order
      document.cookie = 'oro_checkout_id=; path=/; max-age=0';

      // Show order confirmation
      await displayOrderConfirmation(orderResult.orderId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Place order failed:', err);
      showError(err.message || 'Failed to place order. Please try again.');
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = labels.Global?.PlaceOrder || 'Place Order';
      hideLoader();
    }
  });

  // --- Order Confirmation ---
  async function displayOrderConfirmation(orderId) {
    window.scrollTo(0, 0);
    document.title = 'Order Confirmation';

    try {
      const order = await getOrder(orderId);
      const orderAttrs = order.attributes || {};
      const orderCurrency = orderCurrencyId || orderCurrency || 'USD';
      const lineItems = (order._resolved?.lineItems || [])
        .map((li) => li.attributes);

      block.innerHTML = `
        <div class="order-confirmation">
          <div class="order-confirmation__main">
            <div class="order-confirmation__header">
              <div class="dropin-card">
                <h1>Thank you for your order!</h1>
                <p>Order number: <strong>${orderAttrs.identifier || orderId}</strong></p>
              </div>
            </div>
            <div class="order-confirmation__order-status">
              <div class="dropin-card">
                <h3>Order Status</h3>
                <p>${orderAttrs.status || 'Processing'}</p>
              </div>
            </div>
            <div class="order-confirmation__customer-details">
              <div class="dropin-card">
                <h3>Billing Address</h3>
                ${formatAddress(orderAttrs.billingAddress)}
              </div>
            </div>
          </div>
          <div class="order-confirmation__aside">
            <div class="order-confirmation__order-cost-summary">
              <div class="dropin-card">
                <h3>Order Total</h3>
                <div class="order-summary__line">
                  <span>Subtotal</span>
                  <span>${formatPrice(orderAttrs.subtotalValue, orderCurrency)}</span>
                </div>
                <div class="order-summary__line">
                  <span>Shipping</span>
                  <span>${formatPrice(orderAttrs.shippingCostAmount, orderCurrency)}</span>
                </div>
                <div class="order-summary__line order-summary__total">
                  <span><strong>Total</strong></span>
                  <span><strong>${formatPrice(orderAttrs.total, orderCurrency)}</strong></span>
                </div>
              </div>
            </div>
            <div class="order-confirmation__order-product-list">
              <div class="dropin-card">
                <h3>Items Ordered</h3>
                ${lineItems.map((li) => `
                  <div class="order-item">
                    <span>${li.productName || li.productSku}</span>
                    <span>Qty: ${li.quantity}</span>
                    <span>${formatPrice(
    li.rowTotalValue || li.price,
    li.currencyId || li.currency || orderCurrency,
  )}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="order-confirmation__footer">
              <a href="${rootLink('/')}"
                class="dropin-button dropin-button--primary">
                Continue Shopping
              </a>
              <p>Need help? <a href="${rootLink(SUPPORT_PATH)}">Contact us</a></p>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load order details:', err);
      block.innerHTML = `
        <div class="order-confirmation">
          <div class="order-confirmation__main">
            <div class="dropin-card">
              <h1>Order Placed Successfully!</h1>
              <p>Order ID: ${orderId}</p>
              <a href="${rootLink('/')}"
                class="dropin-button dropin-button--primary">
                Continue Shopping
              </a>
            </div>
          </div>
        </div>
      `;
    }
  }
}

// --- Country/Region constants ---
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
];

const DEFAULT_COUNTRY = 'US';

// --- Helper: Build address form HTML ---
function buildAddressFormHTML() {
  const countryOptions = COUNTRIES.map(
    (c) => `<option value="${c.code}"${c.code === DEFAULT_COUNTRY ? ' selected' : ''}>${c.name}</option>`,
  ).join('');

  return `
    <form name="billingAddress" class="checkout__address-form">
      <div class="form-row">
        <label>First Name *<input type="text" name="firstName" required /></label>
        <label>Last Name *<input type="text" name="lastName" required /></label>
      </div>
      <label>Organization<input type="text" name="organization" /></label>
      <label>Street Address *<input type="text" name="street" required /></label>
      <label>Apt / Suite<input type="text" name="street2" /></label>
      <div class="form-row">
        <label>City *<input type="text" name="city" required /></label>
        <label>Region *
          <select name="region" required>
            <option value="">Loading...</option>
          </select>
        </label>
      </div>
      <div class="form-row">
        <label>Postal Code *<input type="text" name="postalCode" required /></label>
        <label>Country *
          <select name="country" required>
            ${countryOptions}
          </select>
        </label>
      </div>
      <label>Phone<input type="tel" name="phone" /></label>
    </form>
  `;
}

// --- Helper: Load regions into a select element ---
async function loadRegions(form) {
  const countrySelect = form.querySelector('select[name="country"]');
  const regionSelect = form.querySelector('select[name="region"]');
  if (!countrySelect || !regionSelect) return;

  const countryCode = countrySelect.value;
  regionSelect.innerHTML = '<option value="">Loading...</option>';
  regionSelect.disabled = true;

  try {
    const regions = await getRegions(countryCode);
    const list = regions.data || [];

    if (list.length === 0) {
      regionSelect.innerHTML = '<option value="">No regions available</option>';
    } else {
      regionSelect.innerHTML = `<option value="">Select a region</option>${list.map(
        (r) => `<option value="${r.id}">${r.attributes.name}</option>`,
      ).join('')}`;
    }
  } catch (_) {
    regionSelect.innerHTML = '<option value="">Failed to load regions</option>';
  }
  regionSelect.disabled = false;
}

// --- Helper: Initialize address form (country change listener + initial regions) ---
function initAddressForm(form) {
  if (!form) return;
  const countrySelect = form.querySelector('select[name="country"]');
  if (!countrySelect) return;

  countrySelect.addEventListener('change', () => loadRegions(form));
  loadRegions(form);
}

// --- Helper: Render address selector with saved addresses ---
function renderAddressSelector(container, addresses) {
  container.innerHTML = `
    <div class="dropin-header-container">
      <div class="account-address-form-wrapper__title dropin-header-container__title">Billing Address</div>
    </div>
    <div class="checkout__address-selector"></div>
  `;
  const $selector = container.querySelector('.checkout__address-selector');

  addresses.forEach((addr, index) => {
    const a = addr.attributes || addr;
    const label = document.createElement('label');
    label.className = 'checkout__shipping-option';
    label.innerHTML = `
      <input type="radio" name="billingAddressSelection"
        value="${addr.id || index}" ${index === 0 ? 'checked' : ''} />
      <div>
        <strong>${a.firstName || ''} ${a.lastName || ''}</strong><br>
        ${a.organization ? `${a.organization}<br>` : ''}
        ${a.street || ''}${a.street2 ? `, ${a.street2}` : ''}<br>
        ${a.city || ''}, ${a.region || ''} ${a.postalCode || ''}<br>
        ${a.country || ''}
      </div>
    `;
    $selector.appendChild(label);
  });

  // "Enter a new address" option
  const newAddrLabel = document.createElement('label');
  newAddrLabel.className = 'checkout__shipping-option';
  newAddrLabel.innerHTML = `
    <input type="radio" name="billingAddressSelection" value="new" />
    <span>Enter a new address</span>
  `;
  $selector.appendChild(newAddrLabel);

  // Manual form (hidden initially)
  const formWrapper = document.createElement('div');
  formWrapper.className = 'checkout__manual-address-form';
  formWrapper.hidden = true;
  formWrapper.innerHTML = buildAddressFormHTML();
  container.appendChild(formWrapper);

  // Toggle form visibility and init form when shown
  $selector.addEventListener('change', (e) => {
    const isNew = e.target.value === 'new';
    formWrapper.hidden = !isNew;
    if (isNew && !formWrapper.dataset.initialized) {
      initAddressForm(formWrapper.querySelector('form'));
      formWrapper.dataset.initialized = 'true';
    }
  });
}

// --- Helper: Render manual address form directly ---
function renderManualAddressForm(container) {
  container.innerHTML = `
    <div class="dropin-header-container">
      <div class="account-address-form-wrapper__title dropin-header-container__title">Billing Address</div>
    </div>
    ${buildAddressFormHTML()}
  `;
  initAddressForm(container.querySelector('form'));
}

// --- Helper: Get address from form ---
function getAddressFromForm(form) {
  if (!form) return {};
  return {
    firstName: form.firstName?.value || '',
    lastName: form.lastName?.value || '',
    organization: form.organization?.value || '',
    street: form.street?.value || '',
    street2: form.street2?.value || '',
    city: form.city?.value || '',
    region: form.region?.value || '',
    postalCode: form.postalCode?.value || '',
    country: form.country?.value || 'US',
    phone: form.phone?.value || '',
  };
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
  const total = parseFloat(attrs.totalValue) || attrs.total || 0;

  $orderSummary.innerHTML = `
    <div class="dropin-card">
      <h3>Order Summary</h3>
      <div class="order-summary__line">
        <span>Subtotal</span>
        <span>${formatPrice(subtotal, currency)}</span>
      </div>
      <div class="dropin-divider"></div>
      <div class="order-summary__line order-summary__total">
        <span><strong>Total</strong></span>
        <span><strong>${formatPrice(total, currency)}</strong></span>
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
    const lineTotal = priceInfo ? priceInfo.price * quantity : 0;
    const lineCurrency = priceInfo?.currency || currency;
    return `<div class="checkout__line-item">
            <span>${productName}</span>
            <span>${formatPrice(lineTotal, lineCurrency)}</span>
          </div>`;
  }).join('')}
      </div>
    `;
  }
}

// --- Helper: Format address ---
function formatAddress(addr) {
  if (!addr) return '<p>N/A</p>';
  return `<p>${addr.firstName || ''} ${addr.lastName || ''}<br>
    ${addr.organization ? `${addr.organization}<br>` : ''}
    ${addr.street || ''}${addr.street2 ? `, ${addr.street2}` : ''}<br>
    ${addr.city || ''}, ${addr.region || ''} ${addr.postalCode || ''}<br>
    ${addr.country || ''}</p>`;
}
