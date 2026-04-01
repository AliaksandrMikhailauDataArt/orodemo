/**
 * OroCommerce Storefront API client.
 * Handles OAuth2 token lifecycle and all REST endpoints.
 */

import { events } from './oro-events.js';
import {
  resolveRelationships,
  buildQueryString,
  findIncluded,
} from './oro-utils.js';

// --- Module state ---
let _config = null; // { baseUrl }
let _accessToken = null;
let _refreshToken = null;
let _tokenExpiry = 0; // epoch seconds
let _isGuest = true;
let _refreshPromise = null;
let _aemCloudMode = false;
let _mockMode = false;

const SESSION_KEYS = {
  accessToken: 'oro_access_token',
  refreshToken: 'oro_refresh_token',
  tokenExpiry: 'oro_token_expiry',
  isGuest: 'oro_is_guest',
};

// --- AEM Cloud detection ---

export function isAemCloud() {
  return window.location.hostname.includes('adobeaemcloud');
}

export function isMockMode() {
  return _mockMode;
}

// --- Configuration ---

export function configure(config) {
  _config = config;
  _aemCloudMode = isAemCloud();
  // Restore tokens from sessionStorage
  const stored = sessionStorage.getItem(SESSION_KEYS.accessToken);
  if (stored) {
    _accessToken = stored;
    _refreshToken = sessionStorage.getItem(SESSION_KEYS.refreshToken);
    _tokenExpiry = Number(sessionStorage.getItem(SESSION_KEYS.tokenExpiry)) || 0;
    _isGuest = sessionStorage.getItem(SESSION_KEYS.isGuest) !== 'false';
  }
}

export function getConfig() {
  return _config;
}

export function isGuest() {
  return _isGuest;
}

// --- Token storage helpers ---

function storeTokens(data, guest) {
  _accessToken = data.access_token;
  _refreshToken = data.refresh_token;
  _tokenExpiry = Math.floor(Date.now() / 1000) + data.expires_in;
  _isGuest = guest;

  sessionStorage.setItem(SESSION_KEYS.accessToken, _accessToken);
  sessionStorage.setItem(SESSION_KEYS.refreshToken, _refreshToken);
  sessionStorage.setItem(SESSION_KEYS.tokenExpiry, String(_tokenExpiry));
  sessionStorage.setItem(SESSION_KEYS.isGuest, String(_isGuest));

  if (!guest) {
    document.cookie = 'oro_user_token=1; path=/; SameSite=Lax';
  } else {
    document.cookie = 'oro_user_token=; path=/; max-age=0';
  }
}

function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  _tokenExpiry = 0;
  _isGuest = true;
  Object.values(SESSION_KEYS).forEach((k) => sessionStorage.removeItem(k));
  document.cookie = 'oro_user_token=; path=/; max-age=0';
}

// --- Auth helpers ---

function redirectToLogin() {
  clearTokens();
  if (_aemCloudMode) {
    _mockMode = true;
    return;
  }
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
}

export async function login(email, password) {
  const resp = await fetch(`${_config.baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error_description || err.message || 'Authentication failed');
  }

  const data = await resp.json();
  storeTokens(data, false);
  events.emit('oro/authenticated', { isGuest: false, token: _accessToken });

  // Preload default shopping list after login
  try {
    await getDefaultShoppingList(); // eslint-disable-line no-use-before-define
  } catch (_) { /* non-critical */ }

  return data;
}

export async function guestToken() {
  const resp = await fetch(`${_config.baseUrl}/guest-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!resp.ok) throw new Error('Guest token request failed');
  const data = await resp.json();
  storeTokens(data, true);
  events.emit('oro/authenticated', { isGuest: true, token: _accessToken });
  return data;
}

export function logout() {
  clearTokens();
  events.emit('oro/authenticated', null);
  window.location.href = '/';
}

async function refreshAccessToken() {
  if (!_refreshToken) {
    redirectToLogin();
    return;
  }
  try {
    const resp = await fetch(`${_config.baseUrl}/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: _refreshToken }),
    });
    if (!resp.ok) throw new Error('Token refresh failed');
    const data = await resp.json();
    storeTokens(data, false);
    events.emit('oro/authenticated', { isGuest: false, token: _accessToken });
  } catch (_) {
    redirectToLogin();
  }
}

async function ensureToken() {
  if (_mockMode) return;
  const now = Math.floor(Date.now() / 1000);
  if (_accessToken && _tokenExpiry - now > 60) return;

  if (!_refreshPromise) {
    _refreshPromise = refreshAccessToken().finally(() => {
      _refreshPromise = null;
    });
  }
  await _refreshPromise;
}

// --- Mock response for AEM Cloud fallback ---

function createMockResponse() {
  return new Response(JSON.stringify({ data: [], included: [] }), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'X-Include-Total-Count': '0',
    },
  });
}

export function enableMockMode() {
  _mockMode = true;
}

// --- Core fetch wrapper ---

const JSON_API_HEADERS = {
  'Content-Type': 'application/vnd.api+json',
  Accept: 'application/vnd.api+json',
  'X-Include': 'totalCount;noHateoas',
};

async function oroFetch(path, options = {}) {
  if (_mockMode) return createMockResponse();

  await ensureToken();
  if (_mockMode) return createMockResponse();

  const url = `${_config.baseUrl}${path}`;
  const headers = {
    ...JSON_API_HEADERS,
    Authorization: `Bearer ${_accessToken}`,
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers || {}),
  };

  try {
    const resp = await fetch(url, { ...options, headers });

    // On 401, try refresh and retry once
    if (resp.status === 401) {
      await refreshAccessToken();
      if (_mockMode) return createMockResponse();
      const retryHeaders = {
        ...JSON_API_HEADERS,
        Authorization: `Bearer ${_accessToken}`,
        'ngrok-skip-browser-warning': 'true',
        ...(options.headers || {}),
      };
      return fetch(url, { ...options, headers: retryHeaders });
    }

    if (!resp.ok && _aemCloudMode) {
      _mockMode = true;
      return createMockResponse();
    }

    return resp;
  } catch (e) {
    if (_aemCloudMode) {
      _mockMode = true;
      return createMockResponse();
    }
    throw e;
  }
}

async function oroGet(path) {
  const resp = await oroFetch(path);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail || `API error ${resp.status}`);
  }
  return resp;
}

async function oroPost(path, body) {
  return oroFetch(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function oroPatch(path, body) {
  return oroFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

async function oroDelete(path) {
  return oroFetch(path, { method: 'DELETE' });
}

// --- Products ---

export async function listProducts({
  page = 1, pageSize = 12, categoryId, search, sort,
} = {}) {
  const params = {
    page: { number: page, size: pageSize },
    include: 'images,category',
    fields: { products: 'name,sku,prices,lowPrice,images,category,featured,shortDescription,description,productAttributes' },
  };

  if (categoryId) {
    params.filter = { rootCategory: { gte: categoryId } };
  }

  if (search) {
    params.filter = params.filter || {};
    params.filter.searchQuery = search;
  }

  if (sort) {
    params.sort = sort;
  }

  const qs = buildQueryString(params);
  const resp = await oroGet(`/api/products?${qs}`);
  const json = await resp.json();
  const totalCount = Number(resp.headers.get('X-Include-Total-Count')) || 0;

  const products = (json.data || []).map(
    (p) => resolveRelationships(p, json.included),
  );

  return {
    products,
    included: json.included || [],
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    page,
    pageSize,
  };
}

export async function getProduct(productId) {
  if (_mockMode) {
    return {
      id: '',
      type: 'products',
      attributes: {
        name: '',
        names: { default: '' },
        sku: '',
        shortDescription: '',
        description: '',
        prices: [],
        lowPrice: null,
        featured: false,
        unitPrecisions: [],
      },
      relationships: {},
      _resolved: { images: [], category: null },
    };
  }
  const fields = 'name,names,sku,shortDescription,description,prices,lowPrice,featured,images,category,unitPrecisions,productAttributes';
  const resp = await oroGet(
    `/api/products/${productId}?include=images,category&fields[products]=${encodeURIComponent(fields)}`,
  );
  const json = await resp.json();
  return resolveRelationships(json.data, json.included);
}

export async function getCategoryTree() {
  const resp = await oroGet('/api/mastercatalogtree?include=category');
  const json = await resp.json();

  return (json.data || []).map((node) => {
    const cat = findIncluded(
      json.included,
      'mastercatalogcategories',
      node.relationships?.category?.data?.id,
    );
    return {
      ...node,
      _category: cat,
      _parentId: node.relationships?.parent?.data?.id,
    };
  });
}

// --- Shopping Lists (Cart) ---

let _defaultListId = null;

export async function getShoppingLists() {
  const resp = await oroGet('/api/shoppinglists?include=items.product,items.unit');
  const json = await resp.json();
  return {
    lists: (json.data || []).map((l) => resolveRelationships(l, json.included)),
    included: json.included || [],
  };
}

export async function getDefaultShoppingList() {
  const { lists, included } = await getShoppingLists();
  let defaultList = lists.find((l) => l.attributes?.default === true);
  if (!defaultList && lists.length > 0) {
    [defaultList] = lists;
  }

  if (!defaultList) {
    _defaultListId = null;
    const payload = {
      id: null, items: [], totalQuantity: 0, subtotal: 0, total: 0, currency: 'USD',
    };
    events.emit('oro/cart/data', payload);
    return payload;
  }

  _defaultListId = defaultList.id;

  // Resolve items with product data
  const items = (defaultList.relationships?.items?.data || []).map((ref) => {
    const item = findIncluded(included, 'shoppinglistitems', ref.id);
    if (!item) return null;
    const product = item.relationships?.product?.data
      ? findIncluded(included, 'products', item.relationships.product.data.id)
      : null;
    const unit = item.relationships?.unit?.data
      ? findIncluded(included, 'productunits', item.relationships.unit.data.id)
      : null;
    return { ...item, _product: product, _unit: unit };
  }).filter(Boolean);

  const totalQuantity = items.reduce((sum, i) => sum + (i.attributes?.quantity || 0), 0);

  const payload = {
    id: defaultList.id,
    name: defaultList.attributes?.name,
    items,
    totalQuantity,
    subtotal: defaultList.attributes?.subTotal || 0,
    discount: defaultList.attributes?.discount || 0,
    total: defaultList.attributes?.total || 0,
    currency: defaultList.attributes?.currencyId || defaultList.attributes?.currency || 'USD',
  };

  events.emit('oro/cart/data', payload);
  return payload;
}

export function getDefaultShoppingListId() {
  return _defaultListId;
}

export async function createShoppingList(name) {
  const resp = await oroPost('/api/shoppinglists', {
    data: { type: 'shoppinglists', attributes: { name } },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail || 'Failed to create shopping list');
  }
  return resp.json();
}

export async function addToShoppingList(productId, quantity, unitCode, shoppingListId) {
  const listId = shoppingListId || _defaultListId;

  // If no default list exists, create one
  if (!listId) {
    const created = await createShoppingList('Shopping List');
    const newId = created.data?.id;
    if (!newId) throw new Error('Failed to create shopping list');
    _defaultListId = newId;
    return addToShoppingList(productId, quantity, unitCode, newId);
  }

  const resp = await oroPost('/api/shoppinglistitems', {
    data: {
      type: 'shoppinglistitems',
      attributes: { quantity },
      relationships: {
        product: { data: { type: 'products', id: String(productId) } },
        shoppingList: { data: { type: 'shoppinglists', id: String(listId) } },
        unit: { data: { type: 'productunits', id: unitCode || 'item' } },
      },
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail || 'Failed to add item');
  }

  const result = await resp.json();
  events.emit('oro/cart/item/added', { item: result.data });

  // Re-fetch shopping list to update cart state
  await getDefaultShoppingList();
  return result;
}

export async function updateShoppingListItem(itemId, quantity) {
  const resp = await oroPatch(`/api/shoppinglistitems/${itemId}`, {
    data: {
      type: 'shoppinglistitems',
      id: String(itemId),
      attributes: { quantity },
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail || 'Failed to update item');
  }

  await getDefaultShoppingList();
  return resp.json();
}

export async function removeShoppingListItem(itemId) {
  const resp = await oroDelete(`/api/shoppinglistitems/${itemId}`);

  if (!resp.ok && resp.status !== 204) {
    throw new Error('Failed to remove item');
  }

  events.emit('oro/cart/item/removed', { itemId });
  await getDefaultShoppingList();
}

export async function clearShoppingList(shoppingListId) {
  const listId = shoppingListId || _defaultListId;
  if (!listId) return;
  const resp = await oroDelete(`/api/shoppinglistitems?filter[shoppingList]=${listId}`);
  if (!resp.ok && resp.status !== 204) {
    throw new Error('Failed to clear shopping list');
  }
  await getDefaultShoppingList();
}

// --- Checkout ---

export async function createCheckout(shoppingListId) {
  const listId = shoppingListId || _defaultListId;
  if (!listId) throw new Error('No shopping list to checkout');

  const resp = await oroPost(`/api/shoppinglists/${listId}/checkout`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail || 'Failed to create checkout');
  }
  return resp.json();
}

export async function getCheckouts() {
  const resp = await oroGet('/api/checkouts?include=lineItems.product');
  const json = await resp.json();
  return {
    checkouts: (json.data || []).map((c) => resolveRelationships(c, json.included)),
    included: json.included || [],
  };
}

export async function getCheckout(checkoutId) {
  const resp = await oroGet(`/api/checkouts/${checkoutId}?include=lineItems.product`);
  const json = await resp.json();
  return {
    checkout: resolveRelationships(json.data, json.included),
    included: json.included || [],
  };
}

export async function getAvailableAddresses(checkoutId, type) {
  const endpoint = type === 'billing'
    ? 'availableBillingAddresses'
    : 'availableShippingAddresses';
  const resp = await oroGet(`/api/checkouts/${checkoutId}/${endpoint}`);
  return resp.json();
}

export async function setCheckoutAddresses(checkoutId, data) {
  const resp = await oroPatch(`/api/checkouts/${checkoutId}`, {
    data: {
      type: 'checkouts',
      id: String(checkoutId),
      attributes: data,
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail || 'Failed to set addresses');
  }
  return resp.json();
}

export async function updateCheckout(checkoutId, attributes) {
  const resp = await oroPatch(`/api/checkouts/${checkoutId}`, {
    data: {
      type: 'checkouts',
      id: String(checkoutId),
      attributes,
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail || 'Failed to update checkout');
  }
  return resp.json();
}

export async function patchCheckout(checkoutId, body) {
  const resp = await oroPatch(`/api/checkouts/${checkoutId}`, body);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail || 'Failed to update checkout');
  }
  return resp.json();
}

export async function getShippingMethods(checkoutId) {
  const resp = await oroGet(`/api/checkouts/${checkoutId}/availableShippingMethods`);
  return resp.json();
}

export async function getPaymentMethods(checkoutId) {
  const resp = await oroGet(`/api/checkouts/${checkoutId}/availablePaymentMethods`);
  return resp.json();
}

export async function setShippingAndPayment(checkoutId, data) {
  const resp = await oroPatch(`/api/checkouts/${checkoutId}`, {
    data: {
      type: 'checkouts',
      id: String(checkoutId),
      attributes: data,
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail || 'Failed to set shipping/payment');
  }
  return resp.json();
}

export async function validateCheckout(checkoutId) {
  const resp = await oroGet(`/api/checkouts/${checkoutId}/payment`);
  return resp.json();
}

export async function placeOrder(paymentUrl) {
  const resp = await oroPost(paymentUrl);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.detail || 'Failed to place order');
  }
  const json = await resp.json();
  const orderId = json.data?.id;
  const identifier = json.data?.attributes?.identifier || orderId;
  return { orderId, identifier, data: json };
}

// --- Orders ---

export async function getOrder(orderId) {
  const resp = await oroGet(`/api/orders/${orderId}?include=lineItems`);
  const json = await resp.json();
  return resolveRelationships(json.data, json.included);
}

export async function listOrders({ page = 1, pageSize = 10 } = {}) {
  const qs = buildQueryString({
    include: 'lineItems',
    sort: '-createdAt',
    page: { number: page, size: pageSize },
  });
  const resp = await oroGet(`/api/orders?${qs}`);
  return resp.json();
}

export async function getRegions(countryCode) {
  const resp = await oroGet(`/api/countries/${countryCode}/regions?page[size]=10000`);
  return resp.json();
}

export async function autocomplete(search) {
  const encoded = encodeURIComponent(search);
  const resp = await oroGet(`/api/autocomplete?search=${encoded}`);
  return resp.json();
}
