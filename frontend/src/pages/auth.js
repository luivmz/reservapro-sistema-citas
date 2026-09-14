import { api } from '../services/api.js';
import { setSession } from '../services/session.js';
import { fieldError, notify } from '../components/ui.js';

export function renderAuth(app, mode = 'login') {
  const register = mode === 'register';
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-copy">
        <a class="brand brand-light" href="#login"><span class="brand-mark">R</span><span>Reserva<span>Pro</span></span></a>
        <div>
          <p class="eyebrow">Agenda simple. Datos separados.</p>
          <h1>Tu operación diaria,<br />sin cruces ni confusión.</h1>
          <p>Clientes, profesionales y servicios coordinados en un calendario seguro para cada organización.</p>
        </div>
        <small>Proyecto académico · Ingeniería Web</small>
      </section>
      <section class="auth-panel">
        <div class="auth-card">
          <p class="eyebrow">${register ? 'Crea tu espacio' : 'Bienvenido de nuevo'}</p>
          <h2>${register ? 'Registrar organización' : 'Iniciar sesión'}</h2>
          <p>${register ? 'Se creará tu organización y la cuenta ADMIN inicial.' : 'Ingresa con el slug de tu organización.'}</p>
          <form id="auth-form" novalidate>
            ${register ? `
              <label>Organización<input name="organizationName" required minlength="2" maxlength="120" autocomplete="organization" /></label>
              <label>Nombre del administrador<input name="adminName" required minlength="2" maxlength="120" autocomplete="name" /></label>
            ` : ''}
            <label>Slug de organización<input name="tenantSlug" required minlength="3" maxlength="60" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="mi-organizacion" autocomplete="organization" /></label>
            <label>Email<input name="email" type="email" required autocomplete="email" /></label>
            <label>Contraseña<input name="password" type="password" required minlength="10" maxlength="128" autocomplete="${register ? 'new-password' : 'current-password'}" /></label>
            <p id="form-error" class="form-error" role="alert" hidden></p>
            <button class="button primary full" type="submit">${register ? 'Crear organización' : 'Entrar a ReservaPro'}</button>
          </form>
          <p class="auth-switch">${register ? '¿Ya tienes cuenta?' : '¿Primera vez?'}
            <a href="#${register ? 'login' : 'register'}">${register ? 'Inicia sesión' : 'Crea una organización'}</a>
          </p>
        </div>
      </section>
    </main>
  `;

  const form = document.querySelector('#auth-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.querySelector('#form-error');
    error.hidden = true;
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    if (register) data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima';
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Procesando…';
    try {
      const response = await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: data });
      setSession({ token: response.data.token, user: response.data.user });
      notify(register ? 'Organización creada.' : 'Sesión iniciada.');
      location.hash = response.data.user.role === 'CLIENT' ? 'appointments' : 'dashboard';
    } catch (requestError) {
      error.textContent = fieldError(requestError);
      error.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = register ? 'Crear organización' : 'Entrar a ReservaPro';
    }
  });
}
