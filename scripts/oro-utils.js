/**
 * JSON:API parsing and rendering utilities for OroCommerce integration.
 */

/**
 * Find an included resource by type and id in a JSON:API response.
 * @param {Array} included - The `included` array from a JSON:API response
 * @param {string} type - Resource type (e.g. 'productimages')
 * @param {string} id - Resource id
 * @returns {Object|undefined}
 */
export function findIncluded(included, type, id) {
  if (!included) return undefined;
  return included.find((r) => r.type === type && String(r.id) === String(id));
}

/**
 * Resolve all relationships on a JSON:API resource, attaching included data.
 * @param {Object} resource - A single JSON:API resource object (from `data`)
 * @param {Array} included - The `included` array from the response
 * @returns {Object} The resource with `_resolved` map of relationship data
 */
export function resolveRelationships(resource, included) {
  if (!resource?.relationships || !included) return resource;
  const resolved = {};
  Object.entries(resource.relationships).forEach(([key, rel]) => {
    const { data } = rel;
    if (!data) {
      resolved[key] = null;
    } else if (Array.isArray(data)) {
      resolved[key] = data
        .map((ref) => findIncluded(included, ref.type, ref.id))
        .filter(Boolean);
    } else {
      resolved[key] = findIncluded(included, data.type, data.id) || null;
    }
  });
  return { ...resource, _resolved: resolved };
}

/**
 * Resolve a relative Oro image URL to an absolute URL.
 * @param {string} relativePath - e.g. '/media/cache/attachment/filter/product_large/abc.jpg'
 * @param {string} baseUrl - The Oro instance base URL
 * @returns {string} Fully qualified image URL
 */
export function resolveImageUrl(relativePath, baseUrl) {
  if (!relativePath) return '';
  if (relativePath.startsWith('http')) return relativePath;
  const base = baseUrl.replace(/\/$/, '');
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${base}${path}`;
}

/**
 * Format a price for display using Intl.NumberFormat.
 * @param {number} amount
 * @param {string} [currency='USD']
 * @returns {string} Formatted price string
 */
export function formatPrice(amount, currency = 'USD') {
  if (amount == null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Build a query string from an object supporting nested JSON:API params.
 * Handles keys like page[number], filter[rootCategory][gte], fields[products].
 * @param {Object} params - Flat or nested param object
 * @returns {string} Query string without leading '?'
 */
export function buildQueryString(params) {
  const parts = [];

  function encode(key, value) {
    if (value == null) return;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }

  function flatten(obj, prefix) {
    Object.entries(obj).forEach(([k, v]) => {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        flatten(v, key);
      } else {
        encode(key, v);
      }
    });
  }

  flatten(params, '');
  return parts.join('&');
}

/**
 * Extract the first image URL from a product's resolved images.
 * @param {Object} product - Resolved product resource
 * @param {string} baseUrl - Oro base URL
 * @returns {string} Absolute image URL or empty string
 */
export function getProductImageUrl(product, baseUrl) {
  const images = product._resolved?.images;
  if (!images || images.length === 0) return '';
  const files = images[0]?.attributes?.files;
  if (!files || files.length === 0) return '';
  return resolveImageUrl(files[0].url, baseUrl);
}

/**
 * Extract all image URLs from a product's resolved images.
 * @param {Object} product - Resolved product resource
 * @param {string} baseUrl - Oro base URL
 * @returns {string[]} Array of absolute image URLs
 */
export function getAllProductImageUrls(product, baseUrl) {
  const images = product._resolved?.images;
  if (!images) return [];
  const urls = [];
  images.forEach((img) => {
    const files = img?.attributes?.files;
    if (files) {
      files.forEach((f) => {
        if (f.url) urls.push(resolveImageUrl(f.url, baseUrl));
      });
    }
  });
  return urls;
}

/**
 * Fetch an image via fetch() with custom headers (e.g. ngrok-skip-browser-warning)
 * and return an object URL suitable for use as an img src.
 * @param {string} url - The image URL to fetch
 * @returns {Promise<string>} Object URL for the fetched image blob
 */
export async function fetchImageAsObjectUrl(url) {
  const resp = await fetch(url, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}

/**
 * Get the product price from a product resource.
 * @param {Object} product - Product resource
 * @returns {{ price: number, currency: string }|null}
 */
export function getProductPrice(product) {
  const { attributes } = product;
  if (attributes?.lowPrice?.price != null) {
    return {
      price: attributes.lowPrice.price,
      currency: attributes.lowPrice.currencyId || attributes.lowPrice.currency || 'USD',
    };
  }
  if (attributes?.prices?.length > 0) {
    return {
      price: attributes.prices[0].price,
      currency: attributes.prices[0].currencyId || attributes.prices[0].currency || 'USD',
    };
  }
  return null;
}
