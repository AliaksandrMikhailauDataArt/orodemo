import { events } from '../../scripts/oro-events.js';
import {
  CUSTOMER_LOGIN_PATH,
  CUSTOMER_ACCOUNT_PATH,
  rootLink,
  checkIsAuthenticated,
} from '../../scripts/commerce.js';

export default function renderAuthCombine(navSections, onMenuClose) {
  // Listen for auth state changes
  events.on('oro/authenticated', () => {
    // Redirect if on a protected page and logged out
    if (!checkIsAuthenticated()) {
      const protectedPaths = ['/customer/account', '/customer/orders', '/customer/address'];
      const isOnProtected = protectedPaths.some((p) => window.location.pathname.includes(p));
      if (isOnProtected) {
        window.location.href = rootLink(CUSTOMER_LOGIN_PATH);
      }
    }
  });
}
