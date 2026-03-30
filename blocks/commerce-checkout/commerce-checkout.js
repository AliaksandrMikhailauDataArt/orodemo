import { events } from '../../scripts/oro-events.js';
import {
  createCheckout,
  getCheckout,
  getAvailableAddresses,
  setCheckoutAddresses,
  getShippingMethods,
  getPaymentMethods,
  setShippingAndPayment,
  validateCheckout,
  placeOrder,
  getOrder,
  getDefaultShoppingListId,
  isGuest,
} from '../../scripts/oro-api.js';
import { formatPrice, findIncluded } from '../../scripts/oro-utils.js';
import {
  fetchPlaceholders,
  rootLink,
  checkIsAuthenticated,
  CUSTOMER_LOGIN_PATH,
  SUPPORT_PATH,
} from '../../scripts/commerce.js';

export default async function decorate(block) {
  document.title = 'Checkout';

  // Auth guard
  if (!checkIsAuthenticated() || isGuest()) {
    window.location.href = rootLink(`${CUSTOMER_LOGIN_PATH}?returnUrl=${encodeURIComponent(window.location.pathname)}`);
    return;
  }

  const labels = await fetchPlaceholders();

  // Build checkout DOM skeleton — matches original fragment structure
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
          <div class="checkout__shipping-form checkout__block"></div>
          <div class="checkout__bill-to-shipping checkout__block"></div>
          <div class="checkout__delivery checkout__block"></div>
          <div class="checkout__payment-methods checkout__block"></div>
          <div class="checkout__billing-form checkout__block" hidden></div>
          <div class="checkout__place-order checkout__block"></div>
        </div>
        <div class="checkout__aside">
          <div class="checkout__order-summary checkout__block"></div>
          <div class="checkout__cart-summary checkout__block"></div>
        </div>
      </div>
    </div>
  `;

  const $loader = block.querySelector('.checkout__loader');
  const $serverError = block.querySelector('.checkout__server-error');
  const $shippingForm = block.querySelector('.checkout__shipping-form');
  const $billToShipping = block.querySelector('.checkout__bill-to-shipping');
  const $delivery = block.querySelector('.checkout__delivery');
  const $paymentMethods = block.querySelector('.checkout__payment-methods');
  const $billingForm = block.querySelector('.checkout__billing-form');
  const $placeOrder = block.querySelector('.checkout__place-order');
  const $orderSummary = block.querySelector('.checkout__order-summary');
  const $cartSummary = block.querySelector('.checkout__cart-summary');

  let checkoutId = null;
  let checkoutData = null;
  let selectedShippingMethod = null;
  let selectedShippingMethodType = null;
  let selectedPaymentMethod = null;

  function showLoader() { $loader.hidden = false; }
  function hideLoader() { $loader.hidden = true; }

  function showError(msg) {
    $serverError.hidden = false;
    $serverError.innerHTML = `<div class="dropin-illustrated-message">${msg}</div>`;
  }

  // --- Step 1: Create checkout from shopping list ---
  showLoader();
  try {
    const shoppingListId = getDefaultShoppingListId();
    if (!shoppingListId) {
      block.querySelector('.checkout__content').classList.add('checkout__content--empty');
      block.querySelector('.checkout__main').innerHTML = `
        <div class="checkout__empty-cart">
          <p>Your cart is empty.</p>
          <a href="${rootLink('/')}" class="dropin-button dropin-button--primary">Continue Shopping</a>
        </div>`;
      hideLoader();
      return;
    }

    const checkoutResponse = await createCheckout(shoppingListId);
    checkoutId = checkoutResponse.data?.id;
    if (!checkoutId) throw new Error('Failed to create checkout session');

    const checkoutState = await getCheckout(checkoutId);
    checkoutData = checkoutState.checkout;
  } catch (err) {
    console.error('Checkout init failed:', err);
    showError(err.message || 'Failed to initialize checkout.');
    hideLoader();
    return;
  }
  hideLoader();

  // --- Render Order Summary (sidebar) ---
  renderOrderSummary(checkoutData, $orderSummary, $cartSummary);

  // --- Step 2: Shipping Address ---
  renderShippingAddressForm($shippingForm, checkoutId);

  // --- Bill to Shipping toggle ---
  let shipToBilling = true;
  $billToShipping.innerHTML = `
    <label class="checkout__ship-to-billing-label">
      <input type="checkbox" name="shipToBillingAddress" checked />
      My billing and shipping address are the same
    </label>
  `;
  const shipToBillingCheckbox = $billToShipping.querySelector('input[name="shipToBillingAddress"]');
  shipToBillingCheckbox.addEventListener('change', () => {
    shipToBilling = shipToBillingCheckbox.checked;
    $billingForm.hidden = shipToBilling;
  });

  // --- Billing Address (hidden by default) ---
  renderBillingAddressForm($billingForm);

  // --- Step 3: Shipping Methods ---
  $delivery.innerHTML = `
    <div class="dropin-header-container">
      <div class="dropin-header-container__title">Shipping Method</div>
    </div>
    <div class="checkout__shipping-methods-list">Loading shipping methods...</div>
  `;

  // --- Step 4: Payment Methods ---
  $paymentMethods.innerHTML = `
    <div class="dropin-header-container">
      <div class="dropin-header-container__title">Payment Method</div>
    </div>
    <div class="checkout__payment-methods-list">Loading payment methods...</div>
  `;

  // --- Place Order Button ---
  const placeOrderBtn = document.createElement('button');
  placeOrderBtn.className = 'dropin-button dropin-button--primary checkout__place-order-btn';
  placeOrderBtn.textContent = labels.Global?.PlaceOrder || 'Place Order';
  placeOrderBtn.disabled = true;
  $placeOrder.appendChild(placeOrderBtn);

  // PO number + notes
  const extraFields = document.createElement('div');
  extraFields.className = 'checkout__extra-fields';
  extraFields.innerHTML = `
    <label>PO Number (optional)<input type="text" name="poNumber" /></label>
    <label>Order Notes (optional)<textarea name="customerNotes" rows="3"></textarea></label>
  `;
  $placeOrder.insertBefore(extraFields, placeOrderBtn);

  // --- Load shipping & payment methods after address is set ---
  async function loadShippingMethods() {
    try {
      const methods = await getShippingMethods(checkoutId);
      const $list = $delivery.querySelector('.checkout__shipping-methods-list');
      $list.innerHTML = '';

      const methodsArr = Array.isArray(methods) ? methods : (methods.data || []);
      if (methodsArr.length === 0) {
        $list.textContent = 'No shipping methods available.';
        return;
      }

      methodsArr.forEach((method) => {
        const types = method.attributes?.types || [];
        types.forEach((type) => {
          const label = document.createElement('label');
          label.className = 'checkout__shipping-option';
          const price = type.price != null ? ` - ${formatPrice(type.price, type.currency || 'USD')}` : '';
          label.innerHTML = `
            <input type="radio" name="shippingMethod" value="${method.id}|${type.id}" />
            ${type.label || method.attributes?.label || 'Shipping'}${price}
          `;
          label.querySelector('input').addEventListener('change', () => {
            selectedShippingMethod = method.id;
            selectedShippingMethodType = type.id;
            enablePlaceOrder();
          });
          $list.appendChild(label);
        });
      });
    } catch (err) {
      console.error('Failed to load shipping methods:', err);
      $delivery.querySelector('.checkout__shipping-methods-list').textContent = 'Failed to load shipping methods.';
    }
  }

  async function loadPaymentMethods() {
    try {
      const methods = await getPaymentMethods(checkoutId);
      const $list = $paymentMethods.querySelector('.checkout__payment-methods-list');
      $list.innerHTML = '';

      const methodsArr = Array.isArray(methods) ? methods : (methods.data || []);
      if (methodsArr.length === 0) {
        $list.textContent = 'No payment methods available.';
        return;
      }

      methodsArr.forEach((method) => {
        const label = document.createElement('label');
        label.className = 'checkout__payment-option';
        label.innerHTML = `
          <input type="radio" name="paymentMethod" value="${method.id}" />
          ${method.attributes?.label || method.id}
        `;
        label.querySelector('input').addEventListener('change', () => {
          selectedPaymentMethod = method.id;
          enablePlaceOrder();
        });
        $list.appendChild(label);
      });
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      $paymentMethods.querySelector('.checkout__payment-methods-list').textContent = 'Failed to load payment methods.';
    }
  }

  function enablePlaceOrder() {
    placeOrderBtn.disabled = !(selectedShippingMethod && selectedPaymentMethod);
  }

  // Load methods
  await Promise.all([loadShippingMethods(), loadPaymentMethods()]);

  // --- Place Order handler ---
  placeOrderBtn.addEventListener('click', async () => {
    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = 'Placing order...';
    showLoader();

    try {
      // Set addresses
      const shippingAddress = getAddressFromForm($shippingForm.querySelector('form'));
      const addressData = {
        shippingAddress,
        shipToBillingAddress: shipToBilling,
      };
      if (!shipToBilling) {
        addressData.billingAddress = getAddressFromForm($billingForm.querySelector('form'));
      } else {
        addressData.billingAddress = shippingAddress;
      }
      await setCheckoutAddresses(checkoutId, addressData);

      // Set shipping + payment
      const poNumber = block.querySelector('input[name="poNumber"]')?.value || undefined;
      const customerNotes = block.querySelector('textarea[name="customerNotes"]')?.value || undefined;

      await setShippingAndPayment(checkoutId, {
        shippingMethod: selectedShippingMethod,
        shippingMethodType: selectedShippingMethodType,
        paymentMethod: selectedPaymentMethod,
        poNumber,
        customerNotes,
      });

      // Validate
      const validation = await validateCheckout(checkoutId);
      if (validation.errors && validation.errors.length > 0) {
        showError(validation.errors.map((e) => e.detail || e).join('<br>'));
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = labels.Global?.PlaceOrder || 'Place Order';
        hideLoader();
        return;
      }

      // Place order
      const { paymentUrl } = validation;
      const orderResult = await placeOrder(paymentUrl);

      hideLoader();

      // Show order confirmation
      await displayOrderConfirmation(orderResult.orderId);
    } catch (err) {
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

      const lineItems = (order._resolved?.lineItems || []).map((li) => li.attributes);

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
                <h3>Shipping Address</h3>
                ${formatAddress(orderAttrs.shippingAddress)}
                <h3>Billing Address</h3>
                ${formatAddress(orderAttrs.billingAddress)}
              </div>
            </div>
          </div>
          <div class="order-confirmation__aside">
            <div class="order-confirmation__order-cost-summary">
              <div class="dropin-card">
                <h3>Order Total</h3>
                <div class="order-summary__line"><span>Subtotal</span><span>${formatPrice(orderAttrs.subtotalValue, orderAttrs.currency)}</span></div>
                <div class="order-summary__line"><span>Shipping</span><span>${formatPrice(orderAttrs.shippingCostAmount, orderAttrs.currency)}</span></div>
                <div class="order-summary__line order-summary__total"><span><strong>Total</strong></span><span><strong>${formatPrice(orderAttrs.total, orderAttrs.currency)}</strong></span></div>
              </div>
            </div>
            <div class="order-confirmation__order-product-list">
              <div class="dropin-card">
                <h3>Items Ordered</h3>
                ${lineItems.map((li) => `
                  <div class="order-item">
                    <span>${li.productName || li.productSku}</span>
                    <span>Qty: ${li.quantity}</span>
                    <span>${formatPrice(li.rowTotalValue || li.price, li.currency || orderAttrs.currency)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="order-confirmation__footer">
              <a href="${rootLink('/')}" class="dropin-button dropin-button--primary">Continue Shopping</a>
              <p>Need help? <a href="${rootLink(SUPPORT_PATH)}">Contact us</a></p>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Failed to load order details:', err);
      block.innerHTML = `
        <div class="order-confirmation">
          <div class="order-confirmation__main">
            <div class="dropin-card">
              <h1>Order Placed Successfully!</h1>
              <p>Order ID: ${orderId}</p>
              <a href="${rootLink('/')}" class="dropin-button dropin-button--primary">Continue Shopping</a>
            </div>
          </div>
        </div>
      `;
    }
  }
}

// --- Helper: Render shipping address form ---
function renderShippingAddressForm(container, checkoutId) {
  container.innerHTML = `
    <div class="dropin-header-container">
      <div class="account-address-form-wrapper__title dropin-header-container__title">Shipping Address</div>
    </div>
    <form name="shippingAddress" class="checkout__address-form">
      <div class="form-row">
        <label>First Name *<input type="text" name="firstName" required /></label>
        <label>Last Name *<input type="text" name="lastName" required /></label>
      </div>
      <label>Organization<input type="text" name="organization" /></label>
      <label>Street Address *<input type="text" name="street" required /></label>
      <label>Apt / Suite<input type="text" name="street2" /></label>
      <div class="form-row">
        <label>City *<input type="text" name="city" required /></label>
        <label>Region *<input type="text" name="region" required placeholder="e.g. US-CA" /></label>
      </div>
      <div class="form-row">
        <label>Postal Code *<input type="text" name="postalCode" required /></label>
        <label>Country *<input type="text" name="country" required value="US" /></label>
      </div>
      <label>Phone<input type="tel" name="phone" /></label>
    </form>
  `;
}

// --- Helper: Render billing address form ---
function renderBillingAddressForm(container) {
  container.innerHTML = `
    <div class="dropin-header-container">
      <div class="account-address-form-wrapper__title dropin-header-container__title">Billing Address</div>
    </div>
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
        <label>Region *<input type="text" name="region" required placeholder="e.g. US-CA" /></label>
      </div>
      <div class="form-row">
        <label>Postal Code *<input type="text" name="postalCode" required /></label>
        <label>Country *<input type="text" name="country" required value="US" /></label>
      </div>
      <label>Phone<input type="tel" name="phone" /></label>
    </form>
  `;
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
function renderOrderSummary(checkout, $orderSummary, $cartSummary) {
  const attrs = checkout?.attributes || {};
  const currency = attrs.currency || 'USD';

  $orderSummary.innerHTML = `
    <div class="dropin-card">
      <h3>Order Summary</h3>
      <div class="order-summary__line"><span>Subtotal</span><span>${formatPrice(attrs.subtotals?.subtotal || 0, currency)}</span></div>
      <div class="order-summary__line"><span>Shipping</span><span>${formatPrice(attrs.subtotals?.shipping || 0, currency)}</span></div>
      <div class="dropin-divider"></div>
      <div class="order-summary__line order-summary__total"><span><strong>Total</strong></span><span><strong>${formatPrice(attrs.total || 0, currency)}</strong></span></div>
    </div>
  `;

  // Cart summary — line items
  const lineItems = checkout?._resolved?.lineItems || [];
  if (lineItems.length > 0) {
    $cartSummary.innerHTML = `
      <div class="cart-cart-summary-list">
        <div class="cart-cart-summary-list__heading">
          <span class="cart-cart-summary-list__heading-text">Items (${lineItems.length})</span>
        </div>
        ${lineItems.map((li) => {
    const liAttrs = li.attributes || {};
    return `<div class="checkout__line-item">
            <span>${liAttrs.productName || 'Item'}</span>
            <span>Qty: ${liAttrs.quantity || 1}</span>
            <span>${formatPrice(liAttrs.subtotal || liAttrs.price || 0, liAttrs.currency || currency)}</span>
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
