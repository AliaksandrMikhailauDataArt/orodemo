import {
  configure, getDefaultShoppingList, isAemCloud, guestToken, enableMockMode,
} from '../oro-api.js';
import { fetchPlaceholders } from '../commerce.js';

export const getUserTokenCookie = () => {
  const match = document.cookie.match(/(?:^|;\s*)oro_user_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export default async function initializeDropins() {
  const init = async () => {
    // Configure Oro API client — on localhost, route through the proxy server
    configure({
      baseUrl: 'http://localhost:3001',
    });

    const hasUserToken = getUserTokenCookie();
    const aemCloud = isAemCloud();

    if (aemCloud && !hasUserToken) {
      // On AEM Cloud without user token: try guest token, fall back to mock mode
      try {
        await guestToken();
      } catch (_) {
        enableMockMode();
      }
    } else if (!hasUserToken && window.location.pathname !== '/') {
      // Standard flow: redirect unauthenticated users to login (index page)
      window.location.href = '/';
      return;
    }

    // Fetch global placeholders
    await fetchPlaceholders('placeholders/global.json');

    // If authenticated user, preload shopping list for cart badge
    if (hasUserToken || aemCloud) {
      getDefaultShoppingList().catch(() => { /* non-critical */ });
    }
  };

  // re-initialize on prerendering changes
  document.addEventListener('prerenderingchange', () => init(), { once: true });

  return init();
}

export function initializeDropin(cb) {
  let initialized = false;

  const doInit = async (force = false) => {
    if (initialized && !force) return;
    await cb();
    initialized = true;
  };

  document.addEventListener('prerenderingchange', () => doInit(true), { once: true });

  return doInit;
}
