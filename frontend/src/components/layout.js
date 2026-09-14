import { clearSession } from '../services/session.js';
import { escapeHtml } from '../utils/format.js';
import { defaultRoute, navigationForRole } from '../utils/permissions.js';

export function renderLayout(app, user) {
  const active = location.hash.slice(1) || defaultRoute(user.role);
  const nav = navigationForRole(user.role).map((item) => `
    <a href="#${item.route}" class="nav-link ${active === item.route ? 'active' : ''}">
      <span aria-hidden="true">${item.icon}</span><span>${item.label}</span>
    </a>
  `).join('');

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Navegación principal">
        <a href="#${defaultRoute(user.role)}" class="brand" aria-label="ReservaPro inicio">
          <span class="brand-mark">R</span><span>Reserva<span>Pro</span></span>
        </a>
        <nav>${nav}</nav>
        <div class="sidebar-profile">
          <span class="avatar">${escapeHtml(user.name.slice(0, 1).toUpperCase())}</span>
          <div><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.role)}</small></div>
          <button class="icon-button" id="logout" aria-label="Cerrar sesión" title="Cerrar sesión">↪</button>
        </div>
      </aside>
      <section class="workspace">
        <header class="mobile-header">
          <a href="#${defaultRoute(user.role)}" class="brand"><span class="brand-mark">R</span><span>ReservaPro</span></a>
          <button id="menu-toggle" class="icon-button" aria-label="Abrir menú">☰</button>
        </header>
        <main id="page" tabindex="-1"></main>
      </section>
    </div>
  `;

  document.querySelector('#logout').addEventListener('click', () => {
    clearSession();
    location.hash = 'login';
  });
  document.querySelector('#menu-toggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
  });
}
