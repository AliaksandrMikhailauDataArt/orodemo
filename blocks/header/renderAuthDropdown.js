import { events } from '../../scripts/oro-events.js';
import { logout } from '../../scripts/oro-api.js';
import {
  rootLink,
  checkIsAuthenticated,
  CUSTOMER_LOGIN_PATH,
} from '../../scripts/commerce.js';

function checkAndRedirect(redirections) {
  Object.entries(redirections).some(([currentPath, redirectPath]) => {
    if (window.location.pathname.includes(currentPath)) {
      window.location.href = redirectPath;
      return true;
    }
    return false;
  });
}

export function renderAuthButton(navTools) {
  const buttonElement = document.createRange().createContextualFragment(`
    <div class="signout-wrapper nav-tools-wrapper">
      <button type="button" class="nav-signout-button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <g stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="6" r="4"></circle>
            <path d="M20 17.5c0 2.485 0 4.5-8 4.5s-8-2.015-8-4.5S7.582 13 12 13s8 2.015 8 4.5Z"></path>
          </g>
        </svg>
        <span>Sign out</span>
      </button>
      <a href="${rootLink('/')}" class="nav-signin-button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <g stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="6" r="4"></circle>
            <path d="M20 17.5c0 2.485 0 4.5-8 4.5s-8-2.015-8-4.5S7.582 13 12 13s8 2.015 8 4.5Z"></path>
          </g>
        </svg>
        <span>Sign in</span>
      </a>
    </div>
  `);

  navTools.append(buttonElement);

  const signoutButton = navTools.querySelector('.nav-signout-button');
  const signinButton = navTools.querySelector('.nav-signin-button');
  const cartWrapper = navTools.querySelector('.minicart-wrapper');
  const searchWrapper = navTools.querySelector('.search-wrapper');

  signoutButton.addEventListener('click', async () => {
    await logout();
    checkAndRedirect({
      '/customer': rootLink(CUSTOMER_LOGIN_PATH),
      '/order-details': rootLink('/'),
    });
  });

  const updateUI = (authState) => {
    const isAuthenticated = authState ? !authState.isGuest : checkIsAuthenticated();
    signoutButton.style.display = isAuthenticated ? 'inline-flex' : 'none';
    signinButton.style.display = isAuthenticated ? 'none' : 'inline-flex';
    if (cartWrapper) cartWrapper.style.display = isAuthenticated ? '' : 'none';
    if (searchWrapper) searchWrapper.style.display = isAuthenticated ? '' : 'none';
  };

  events.on('oro/authenticated', (authState) => {
    updateUI(authState);
  });

  updateUI(null);
}
