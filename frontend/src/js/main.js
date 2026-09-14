import 'toastify-js/src/toastify.css';
import '../css/main.css';
import { renderLayout } from '../components/layout.js';
import { api } from '../services/api.js';
import { clearSession, getSession } from '../services/session.js';
import { defaultRoute, navigationForRole } from '../utils/permissions.js';
import { renderAppointments } from '../pages/appointments.js';
import { renderAuth } from '../pages/auth.js';
import { renderCalendar } from '../pages/calendar.js';
import { renderDashboard } from '../pages/dashboard.js';
import { renderResources } from '../pages/resources.js';
import { renderSchedules } from '../pages/schedules.js';

const app = document.querySelector('#app');
let rendering = false;

async function render() {
  if (rendering) return;
  rendering = true;
  try {
    const route = location.hash.slice(1) || 'login';
    let session = getSession();

    if (!session) {
      renderAuth(app, route === 'register' ? 'register' : 'login');
      return;
    }

    try {
      const response = await api('/auth/me');
      session = { ...session, user: response.data };
      sessionStorage.setItem('reservapro.session', JSON.stringify(session));
    } catch {
      clearSession();
      renderAuth(app, 'login');
      return;
    }

    const allowed = navigationForRole(session.user.role).map(({ route: itemRoute }) => itemRoute);
    const target = allowed.includes(route) ? route : defaultRoute(session.user.role);
    if (target !== route) location.hash = target;
    renderLayout(app, session.user);
    const page = document.querySelector('#page');

    if (target === 'dashboard') await renderDashboard(page);
    else if (target === 'calendar') await renderCalendar(page, session.user);
    else if (target === 'appointments') await renderAppointments(page, session.user);
    else if (target === 'schedules') await renderSchedules(page, session.user);
    else if (['clients', 'employees', 'services', 'users'].includes(target)) {
      await renderResources(page, target, session.user);
    }
    page.focus({ preventScroll: true });
  } finally {
    rendering = false;
  }
}

window.addEventListener('hashchange', render);
render();
