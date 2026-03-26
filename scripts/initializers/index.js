import { configure, getGuestToken, getDefaultShoppingList } from '../oro-api.js';
import { events } from '../oro-events.js';
import { getConfigValue, fetchPlaceholders } from '../commerce.js';

export const getUserTokenCookie = () => {
  const match = document.cookie.match(/(?:^|;\s*)oro_user_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export default async function initializeDropins() {
  const init = async () => {
    // Configure Oro API client
    configure({
      baseUrl: getConfigValue('oro-base-url'),
      clientId: getConfigValue('oro-client-id'),
      clientSecret: getConfigValue('oro-client-secret'),
    });

    // Acquire guest token (or restore session)
    const hasUserToken = getUserTokenCookie();
    if (!hasUserToken) {
      await getGuestToken();
    }

    // Fetch global placeholders
    await fetchPlaceholders('placeholders/global.json');

    // If authenticated user, preload shopping list for cart badge
    if (hasUserToken) {
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
