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

export function renderAuthDropdown(navTools) {
  const dropdownElement = document.createRange().createContextualFragment(`
 <div class="dropdown-wrapper nav-tools-wrapper">
    <button type="button" class="nav-dropdown-button" aria-haspopup="dialog" aria-expanded="false" aria-controls="login-modal"></button>
    <div class="nav-auth-menu-panel nav-tools-panel">
      <div id="auth-dropin-container"></div>
      <ul class="authenticated-user-menu">
         <li><a href="${rootLink('/customer/account')}">My Account</a></li>
          <li><button>Logout</button></li>
      </ul>
    </div>
 </div>`);

  navTools.append(dropdownElement);

  const authDropDownPanel = navTools.querySelector('.nav-auth-menu-panel');
  const authDropDownMenuList = navTools.querySelector(
    '.authenticated-user-menu',
  );
  const authDropinContainer = navTools.querySelector('#auth-dropin-container');
  const loginButton = navTools.querySelector('.nav-dropdown-button');
  const logoutButtonElement = navTools.querySelector(
    '.authenticated-user-menu > li > button',
  );

  authDropDownPanel.addEventListener('click', (e) => e.stopPropagation());

  function toggleDropDownAuthMenu(state) {
    const show = state ?? !authDropDownPanel.classList.contains('nav-tools-panel--show');
    authDropDownPanel.classList.toggle('nav-tools-panel--show', show);
    authDropDownPanel.setAttribute('role', 'dialog');
    authDropDownPanel.setAttribute('aria-hidden', String(!show));
  }

  loginButton.addEventListener('click', () => toggleDropDownAuthMenu());
  document.addEventListener('click', (e) => {
    const clickOnDropDownPanel = authDropDownPanel.contains(e.target);
    const clickOnLoginButton = loginButton.contains(e.target);

    if (!clickOnDropDownPanel && !clickOnLoginButton) {
      toggleDropDownAuthMenu(false);
    }
  });

  logoutButtonElement.addEventListener('click', async () => {
    await logout();
    checkAndRedirect({
      '/customer': rootLink(CUSTOMER_LOGIN_PATH),
      '/order-details': rootLink('/'),
    });
  });

  // Render a simple login link for guests instead of drop-in SignIn
  function renderGuestAuth() {
    authDropinContainer.innerHTML = `
      <div class="oro-auth-guest">
        <a href="${rootLink(CUSTOMER_LOGIN_PATH)}" class="dropin-button dropin-button--primary">Sign In</a>
      </div>
    `;
  }

  const updateDropDownUI = (authState) => {
    const isAuthenticated = authState ? !authState.isGuest : checkIsAuthenticated();

    if (isAuthenticated) {
      authDropDownMenuList.style.display = 'block';
      authDropinContainer.style.display = 'none';
      loginButton.textContent = 'My Account';
    } else {
      authDropDownMenuList.style.display = 'none';
      authDropinContainer.style.display = 'block';
      renderGuestAuth();
      loginButton.innerHTML = `
      <svg
          width="25"
          height="25"
          viewBox="0 0 24 24"
          aria-label="My Account"
          >
          <g fill="none" stroke="#000000" stroke-width="1.5">
          <circle cx="12" cy="6" r="4"></circle>
          <path d="M20 17.5c0 2.485 0 4.5-8 4.5s-8-2.015-8-4.5S7.582 13 12 13s8 2.015 8 4.5Z"></path></g></svg>
        `;
    }
  };

  events.on('oro/authenticated', (authState) => {
    updateDropDownUI(authState);
  });

  updateDropDownUI(null);
}
