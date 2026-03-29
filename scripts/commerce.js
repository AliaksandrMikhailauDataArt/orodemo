import { events } from './oro-events.js';
import { getMetadata } from './aem.js';
import initializeDropins from './initializers/index.js';

/**
 * Config state — replaces @dropins/tools/lib/aem/configs.js
 */
let _configData = null;
let _rootPath = '';
let _rootPaths = [];

function initializeConfig(config, options) {
  _configData = config;
  const publicConfig = config?.public || {};
  const keys = Object.keys(publicConfig).filter((k) => k !== 'default');
  keys.forEach((key) => {
    if (!_rootPath && options.match(key)) {
      _rootPath = key;
    }
  });
  _rootPaths = keys;
}

export function getConfigValue(key) {
  const publicConfig = _configData?.public || {};
  const matched = publicConfig[_rootPath] || {};
  const defaults = publicConfig.default || {};
  const parts = key.split('.');
  let val = parts.reduce((obj, k) => obj?.[k], matched);
  if (val === undefined) {
    val = parts.reduce((obj, k) => obj?.[k], defaults);
  }
  return val;
}

export function getRootPath() {
  return _rootPath || '/';
}

function getListOfRootPaths() {
  return _rootPaths;
}

export function isMultistore() {
  return _rootPaths.length >= 1;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Constants
 */

// PATHS
export const SUPPORT_PATH = '/support';
export const PRIVACY_POLICY_PATH = '/privacy-policy';

// GUEST PATHS
export const ORDER_STATUS_PATH = '/order-status';
export const ORDER_DETAILS_PATH = '/order-details';
export const RETURN_DETAILS_PATH = '/return-details';
export const CREATE_RETURN_PATH = '/create-return';
export const SALES_GUEST_VIEW_PATH = '/sales/guest/view/';

// CUSTOMER PATHS
export const CUSTOMER_PATH = '/customer';
export const CUSTOMER_ORDER_DETAILS_PATH = `${CUSTOMER_PATH}${ORDER_DETAILS_PATH}`;
export const CUSTOMER_RETURN_DETAILS_PATH = `${CUSTOMER_PATH}${RETURN_DETAILS_PATH}`;
export const CUSTOMER_CREATE_RETURN_PATH = `${CUSTOMER_PATH}${CREATE_RETURN_PATH}`;
export const CUSTOMER_ORDERS_PATH = `${CUSTOMER_PATH}/orders`;
export const CUSTOMER_RETURNS_PATH = `${CUSTOMER_PATH}/returns`;
export const CUSTOMER_ADDRESS_PATH = `${CUSTOMER_PATH}/address`;
export const CUSTOMER_LOGIN_PATH = '/';
export const CUSTOMER_ACCOUNT_PATH = `${CUSTOMER_PATH}/account`;
export const CUSTOMER_FORGOTPASSWORD_PATH = `${CUSTOMER_PATH}/forgotpassword`;
export const SALES_ORDER_VIEW_PATH = '/sales/order/view/';

// TRACKING URL
export const UPS_TRACKING_URL = 'https://www.ups.com/track';

/**
 * Auth Privacy Policy Consent Slot
 * @param {Object} ctx - The context object
 * @param {Object} ctx.appendChild - The appendChild function
 * @returns {void}
 */
export const authPrivacyPolicyConsentSlot = {
  PrivacyPolicyConsent: async (ctx) => {
    const wrapper = document.createElement('span');
    Object.assign(wrapper.style, {
      color: 'var(--color-neutral-700)',
      font: 'var(--type-details-caption-2-font)',
      display: 'block',
      marginBottom: 'var(--spacing-medium)',
    });

    const link = document.createElement('a');
    link.href = PRIVACY_POLICY_PATH;
    link.target = '_blank';
    link.textContent = 'Privacy Policy';

    wrapper.append(
      'By creating an account, you acknowledge that you have read and agree to our ',
      link,
      ', which outlines how we collect, use, and protect your personal data.',
    );

    ctx.appendChild(wrapper);
  },
};

/**
 * Preloads a file with specified attributes
 * @param {string} href - The URL to preload
 * @param {string} as - The type of resource being preloaded
 */
export function preloadFile(href, as) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.crossOrigin = 'anonymous';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Detects the page type based on DOM elements
 * @returns {string} The detected page type
 */
function detectPageType() {
  if (document.body.querySelector('main .product-details')) {
    return 'Product';
  } if (document.body.querySelector('main .product-list-page')) {
    return 'Category';
  } if (document.body.querySelector('main .commerce-cart')) {
    return 'Cart';
  } if (document.body.querySelector('main .commerce-checkout')) {
    return 'Checkout';
  }
  return 'CMS';
}

/**
 * Fetches and merges index data from multiple sources with intelligent caching.
 * @param {string} indexFile - The index file to fetch
 * @param {number} pageSize - The page size for pagination
 * @returns {Promise<Object>} A promise that resolves the index object
 */
export async function fetchIndex(indexFile, pageSize = 500) {
  const handleIndex = async (offset) => {
    const resp = await fetch(`/${indexFile}.json?limit=${pageSize}&offset=${offset}`);
    const json = await resp.json();

    const newIndex = {
      complete: (json.limit + json.offset) === json.total,
      offset: json.offset + pageSize,
      promise: null,
      data: [...window.index[indexFile].data, ...json.data],
    };

    return newIndex;
  };

  window.index = window.index || {};
  window.index[indexFile] = window.index[indexFile] || {
    data: [],
    offset: 0,
    complete: false,
    promise: null,
  };

  // Return index if already loaded
  if (window.index[indexFile].complete) {
    return window.index[indexFile];
  }

  // Return promise if index is currently loading
  if (window.index[indexFile].promise) {
    return window.index[indexFile].promise;
  }

  window.index[indexFile].promise = handleIndex(window.index[indexFile].offset);
  const newIndex = await (window.index[indexFile].promise);
  window.index[indexFile] = newIndex;

  return newIndex;
}

/**
 * Loads commerce-specific eager content
 */
export async function loadCommerceEager() {
  detectPageType();
  events.emit('oro/lcp');
}

/**
 * Decorates links in the main element.
 * @param {Element} main - The main element
 */
export function decorateLinks(main) {
  const root = getRootPath();
  const roots = getListOfRootPaths();

  main.querySelectorAll('a').forEach((a) => {
    // If we are in the root, do nothing
    if (roots.length === 0) return;

    try {
      const url = new URL(a.href);
      const {
        origin,
        pathname,
        search,
        hash,
      } = url;

      // Skip localization if #nolocal flag is present
      if (hash === '#nolocal') {
        url.hash = '';
        a.href = url.toString();
        return;
      }

      // if the links belongs to another store, do nothing
      if (roots.some((r) => r !== root && pathname.startsWith(r))) return;

      // If the link is already localized, do nothing
      if (origin !== window.location.origin || pathname.startsWith(root)) return;
      a.href = new URL(`${origin}${root}${pathname.replace(/^\//, '')}${search}${hash}`);
    } catch {
      console.warn('Could not make localized link');
    }
  });
}

/**
 * Loads commerce-specific lazy content
 */
export async function loadCommerceLazy() {
  // Initialize modal functionality
  autolinkModals(document);
}

/**
 * Initializes commerce configuration
 */
export async function initializeCommerce() {
  const config = await getConfigFromSession();
  initializeConfig(config, {
    match: (key) => window.location.pathname.match(`^(/content/.*)?${key}`),
  });
  return initializeDropins();
}

/**
 * Decorates links.
 * @param {string} [link] url to be localized
 * @returns {string} - The localized link
 */
export function rootLink(link) {
  // XWALK: we need to add the site path if set
  const aemContentRoot = window.hlx.codeBasePath.split('.')[0];
  const root = `${aemContentRoot}${getRootPath().replace(/\/$/, '')}`;

  // If it's an absolute URL, extract the pathname
  /* eslint-disable no-param-reassign */
  if (link.startsWith('http://') || link.startsWith('https://')) {
    const url = new URL(link);
    link = url.pathname;
  }
  // append the site path to link
  link = link.startsWith(aemContentRoot) ? link : `${aemContentRoot}${link}`;
  // append the .html extension to link if we are in the author environment
  link = window.xwalk?.isAuthorEnv && !link.endsWith('.html') ? `${link}.html` : link;
  /* eslint-enable no-param-reassign */
  // If the link is already localized, do nothing
  if (link.startsWith(root)) return link;
  return `${root}${link}`;
}

/**
 * Decorates Columns Template to the main element.
 * @param {Element} doc The document element
 */
function buildTemplateColumns(doc) {
  const columns = doc.querySelectorAll('main > div.section[data-column-width]');

  columns.forEach((column) => {
    const columnWidth = column.getAttribute('data-column-width');
    const gap = column.getAttribute('data-gap');

    if (columnWidth) {
      column.style.setProperty('--column-width', columnWidth);
      column.removeAttribute('data-column-width');
    }

    if (gap) {
      column.style.setProperty('--gap', `var(--spacing-${gap.toLocaleLowerCase()})`);
      column.removeAttribute('data-gap');
    }
  });
}

/**
 * Applies templates to the document.
 * @param {Element} doc The document element
 */
export function applyTemplates(doc) {
  // Xwalk: use templates to apply columns to the document
  const templates = ['account', 'orders', 'address', 'returns', 'account-order-details'];
  templates.forEach((template) => {
    if (doc.body.classList.contains(template)) {
      buildTemplateColumns(doc);
      doc.body.classList.add('columns');
    }
  });
}

/**
 * Fetches and merges placeholder data from multiple sources with intelligent caching.
 *
 * @param {string} [path] - Optional path to a specific placeholders file to include in the merge.
 * @returns {Promise<Object>} A promise that resolves the merged placeholders object.
 */
export async function fetchPlaceholders(path) {
  const rootPath = getRootPath();
  const fallback = getMetadata('placeholders');
  window.placeholders = window.placeholders || {};

  // Track pending requests to prevent duplicate fetches
  window.placeholders._pending = window.placeholders._pending || {};

  // Initialize merged results storage as a single merged object
  window.placeholders._merged = window.placeholders._merged || {};

  // If no path is provided, return the merged placeholders
  if (!path) {
    return Promise.resolve(window.placeholders._merged || {});
  }

  // Create cache key for this specific combination
  const cacheKey = [path, fallback].filter(Boolean).join('|');

  // Prevent empty cache keys
  if (!cacheKey) {
    return Promise.resolve({});
  }

  // Check if there's already a pending request for this combination
  if (window.placeholders._pending[cacheKey]) {
    return window.placeholders._pending[cacheKey];
  }

  // fetch placeholders
  const fetchPromise = new Promise((resolve) => {
    const promises = [];

    // Helper function to get or create fetch promise for a single resource
    const getOrCreateFetch = (url, resourceCacheKey) => {
      // Check if already cached
      if (window.placeholders[resourceCacheKey]) {
        return Promise.resolve(window.placeholders[resourceCacheKey]);
      }

      // Check if already pending
      if (window.placeholders._pending[resourceCacheKey]) {
        return window.placeholders._pending[resourceCacheKey];
      }

      // Create new fetch promise
      // XWALK: no sheet parameter
      const resourceFetchPromise = fetch(`${url}`).then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          // Cache the response
          window.placeholders[resourceCacheKey] = data;
          return data;
        }
        console.warn(`Failed to fetch placeholders from ${url}: HTTP ${response.status} ${response.statusText}`);
        return {};
      }).catch((error) => {
        console.error(`Error fetching placeholders from ${url}:`, error);
        return {};
      }).finally(() => {
        // Remove from pending
        delete window.placeholders._pending[resourceCacheKey];
      });

      // Store pending promise
      window.placeholders._pending[resourceCacheKey] = resourceFetchPromise;
      return resourceFetchPromise;
    };

    // path
    if (path) {
      const pathUrl = rootPath.replace(/\/$/, `/${path}`);
      promises.push(getOrCreateFetch(pathUrl, path));
    }

    // fallback - only if it exists from overrides
    if (fallback) {
      promises.push(getOrCreateFetch(fallback, fallback));
    }

    Promise.all(promises)
      // process json from sources and combine them
      .then((jsons) => {
        // Early return if no data
        const hasData = jsons.some((json) => json.data?.length > 0);
        if (!hasData) {
          console.warn(`No placeholder data found for path: ${path}${fallback ? ` and fallback: ${fallback}` : ''}`);
          resolve({});
          return;
        }

        // Create data object where later values override earlier ones
        const data = {};

        // Process all JSONs in one pass
        jsons.forEach((json) => {
          if (json.data?.length) {
            json.data.forEach(({ Key, Value }) => {
              if (Key && Value !== undefined) {
                data[Key] = Value;
              }
            });
          }
        });

        // Early return if no valid data
        if (Object.keys(data).length === 0) {
          console.warn(`No valid placeholder data found after processing for path: ${path}${fallback ? ` and fallback: ${fallback}` : ''}`);
          resolve({});
          return;
        }

        // Convert data object to placeholders object with nested structure
        const placeholders = {};

        Object.entries(data).forEach(([Key, Value]) => {
          const keys = Key.split('.');
          const lastKey = keys.pop();
          let target = placeholders;

          // Navigate/create nested structure
          keys.forEach((key) => {
            target[key] = target[key] || {};
            target = target[key];
          });

          // Set the final value
          target[lastKey] = Value;
        });

        // Merge the new placeholders into the global merged object
        const merged = Object.assign(window.placeholders._merged, placeholders);

        resolve(merged);
      })
      .catch((error) => {
        console.error(`Error loading placeholders for path: ${path}${fallback ? ` and fallback: ${fallback}` : ''}`, error);
        // error loading placeholders
        resolve({});
      });
  });

  // Store the pending promise for this combination
  window.placeholders._pending[cacheKey] = fetchPromise;

  // Clean up pending promise when resolved
  fetchPromise.finally(() => {
    delete window.placeholders._pending[cacheKey];
  });

  return fetchPromise;
}

/**
 * Fetches config from remote and saves in session, then returns it, otherwise
 * returns if it already exists.
 *
 * @returns {Promise<Object>} - The config JSON from session storage
 */
export async function getConfigFromSession() {
  try {
    const configJSON = window.sessionStorage.getItem('config');
    if (!configJSON) {
      throw new Error('No config in session storage');
    }

    const parsedConfig = JSON.parse(configJSON);
    if (
      !parsedConfig[':expiry']
      || parsedConfig[':expiry'] < Math.round(Date.now() / 1000)
    ) {
      throw new Error('Config expired');
    }
    return parsedConfig;
  } catch (e) {
    const resp = await fetch('config.json');
    if (!resp.ok) throw new Error('Failed to fetch config');
    const config = await resp.json();

    // Convert flat data array ({ key, value }) to nested public.default structure
    const defaults = {};
    (config.data || []).forEach((row) => {
      const key = row.Key || row.key;
      const value = row.Value ?? row.value;
      if (key) {
        defaults[key] = value;
      }
    });

    const configJSON = { public: { default: defaults } };
    configJSON[':expiry'] = Math.round(Date.now() / 1000) + 7200;
    window.sessionStorage.setItem('config', JSON.stringify(configJSON));
    return configJSON;
  }
}

export function getProductLink(urlKey, sku) {
  return rootLink(`/products/${urlKey}/${sku}`.toLowerCase());
}

/**
 * Gets the product SKU from metadata or URL fallback.
 * @returns {string|null} The SKU from metadata or URL, or null if not found
 */
export function getProductSku() {
  const sku = getMetadata('sku');
  if (sku) return sku;
  const path = window.location.pathname;
  const result = path.match(/\/products\/[\w|-]+\/([\w|-]+)(\.html)?$/);
  let urlSku = result?.[1];
  if (!urlSku && window.xwalk?.previewSku) {
    urlSku = window.xwalk.previewSku;
  }
  return urlSku;
}

/**
 * Sets JSON-LD structured data in the document head.
 * @param {Object} data - The JSON-LD data object
 * @param {string} name - The name identifier for the script element
 */
export function setJsonLd(data, name) {
  const existingScript = document.head.querySelector(`script[data-name="${name}"]`);
  if (existingScript) {
    existingScript.innerHTML = JSON.stringify(data);
    return;
  }

  const script = document.createElement('script');
  script.type = 'application/ld+json';

  script.innerHTML = JSON.stringify(data);
  script.dataset.name = name;
  document.head.appendChild(script);
}

/**
 * Loads and displays an error page (e.g., 404) by replacing the current page content.
 * @param {number} [code=404] - The HTTP error code for the error page
 */
export async function loadErrorPage(code = 404) {
  const htmlText = await fetch(`/${code}.html`).then((response) => {
    if (response.ok) {
      return response.text();
    }
    throw new Error(`Error getting ${code} page`);
  });
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  document.body.innerHTML = doc.body.innerHTML;
  document.head.innerHTML = doc.head.innerHTML;

  // https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript
  // Point 2. prevent soft 404 errors
  if (code === 404) {
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex';
    document.head.appendChild(metaRobots);
  }

  // When moving script tags via innerHTML, they are not executed. They need to be re-created.
  const notImportMap = (c) => c.textContent && c.type !== 'importmap';
  Array.from(document.head.querySelectorAll('script'))
    .filter(notImportMap)
    .forEach((c) => c.remove());
  Array.from(doc.head.querySelectorAll('script'))
    .filter(notImportMap)
    .forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(({ name, value }) => {
        newScript.setAttribute(name, value);
      });
      const scriptText = document.createTextNode(oldScript.innerHTML);
      newScript.appendChild(scriptText);
      document.head.appendChild(newScript);
    });
}

/**
 * Checks if the user is authenticated
 * @returns {boolean} - true if the user is authenticated
 */
export function checkIsAuthenticated() {
  return !!getCookie('oro_user_token');
}

/**
 * Automatically links modal functionality to elements
 * @param {Element} element - The element to attach modal functionality to
 */
function autolinkModals(element) {
  element.addEventListener('click', async (e) => {
    const origin = e.target.closest('a');

    if (origin && origin.href && origin.href.includes('/modals/')) {
      e.preventDefault();
      const { openModal } = await import(`${window.hlx.codeBasePath}/blocks/modal/modal.js`);
      openModal(origin.href);
    }
  });
}
