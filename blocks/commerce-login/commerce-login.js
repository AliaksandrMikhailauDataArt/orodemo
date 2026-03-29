import { login } from '../../scripts/oro-api.js';
import {
  CUSTOMER_ACCOUNT_PATH,
  CUSTOMER_FORGOTPASSWORD_PATH,
  checkIsAuthenticated,
  rootLink,
} from '../../scripts/commerce.js';

export default async function decorate(block) {
  if (checkIsAuthenticated()) {
    window.location.href = rootLink('/catalog');
    return;
  }

  block.innerHTML = '';

  const form = document.createElement('form');
  form.className = 'oro-login-form';
  form.innerHTML = `
    <h2 class="oro-login-form__title">Sign In</h2>
    <div class="oro-login-form__error" hidden></div>
    <label class="oro-login-form__label">
      <span>Email</span>
      <input type="email" name="email" required autocomplete="email" />
    </label>
    <label class="oro-login-form__label">
      <span>Password</span>
      <input type="password" name="password" required autocomplete="current-password" />
    </label>
    <button type="submit" class="oro-login-form__submit">Sign In</button>
    <a href="${rootLink(CUSTOMER_FORGOTPASSWORD_PATH)}" class="oro-login-form__forgot">Forgot Password?</a>
  `;

  const errorDiv = form.querySelector('.oro-login-form__error');
  const submitBtn = form.querySelector('.oro-login-form__submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const email = form.email.value;
      const password = form.password.value;
      await login(email, password);
      window.location.href = rootLink('/catalog');
    } catch (err) {
      errorDiv.textContent = err.message || 'Invalid credentials. Please try again.';
      errorDiv.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  block.appendChild(form);
}
