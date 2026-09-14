import { api } from '../services/api.js';
import { confirmAction, empty, errorState, fieldError, loading, notify } from '../components/ui.js';
import { escapeHtml, money } from '../utils/format.js';
import { canManage } from '../utils/permissions.js';

const definitions = {
  clients: {
    title: 'Clientes', singular: 'cliente', path: '/clients',
    fields: [
      ['name', 'Nombre', 'text', true], ['email', 'Email', 'email'], ['phone', 'Teléfono', 'tel'], ['notes', 'Notas', 'textarea'],
    ],
    columns: [['name', 'Cliente'], ['email', 'Email'], ['phone', 'Teléfono'], ['active', 'Estado']],
  },
  employees: {
    title: 'Profesionales', singular: 'profesional', path: '/employees',
    fields: [['name', 'Nombre', 'text', true], ['email', 'Email', 'email'], ['phone', 'Teléfono', 'tel']],
    columns: [['name', 'Profesional'], ['email', 'Email'], ['phone', 'Teléfono'], ['active', 'Estado']],
  },
  services: {
    title: 'Servicios', singular: 'servicio', path: '/services',
    fields: [
      ['name', 'Nombre', 'text', true], ['description', 'Descripción', 'textarea'],
      ['durationMinutes', 'Duración (min)', 'number', true], ['price', 'Precio (S/)', 'number', true],
    ],
    columns: [['name', 'Servicio'], ['durationMinutes', 'Duración'], ['priceCents', 'Precio'], ['active', 'Estado']],
  },
  users: {
    title: 'Usuarios', singular: 'usuario', path: '/users',
    fields: [
      ['name', 'Nombre', 'text', true], ['email', 'Email', 'email', true], ['password', 'Contraseña', 'password', true],
      ['role', 'Rol', 'role', true],
    ],
    columns: [['name', 'Usuario'], ['email', 'Email'], ['role', 'Rol'], ['active', 'Estado']],
  },
};

function display(value, key) {
  if (key === 'active') return `<span class="badge ${value ? 'success' : 'muted'}">${value ? 'Activo' : 'Inactivo'}</span>`;
  if (key === 'priceCents') return money(value);
  if (key === 'durationMinutes') return `${value} min`;
  return escapeHtml(value ?? '—');
}

function field([name, label, type, required], item = {}) {
  const value = name === 'price' ? (item.priceCents ?? 0) / 100 : item[name] ?? '';
  const effectiveRequired = required && !(name === 'password' && item.id);
  if (type === 'textarea') return `<label>${label}<textarea name="${name}" ${required ? 'required' : ''}>${escapeHtml(value)}</textarea></label>`;
  if (type === 'role') return `<label>${label}<select name="role" required>${['ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'].map((role) => `<option ${value === role ? 'selected' : ''}>${role}</option>`).join('')}</select></label>`;
  const attributes = name === 'durationMinutes' ? 'min="5" max="480" step="1"' : type === 'number' ? 'min="0" step="0.01"' : '';
  return `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${attributes} ${effectiveRequired ? 'required' : ''} /></label>`;
}

export async function renderResources(page, resource, user) {
  const definition = definitions[resource];
  const manageable = canManage(user.role, resource) || resource === 'users' && user.role === 'ADMIN';
  let items = [];
  let editing = null;

  async function load() {
    page.innerHTML = loading();
    try {
      const response = await api(definition.path, { query: { limit: 100 } });
      items = response.data;
      draw();
    } catch (error) {
      page.innerHTML = errorState(error);
    }
  }

  function draw() {
    const rows = items.map((item) => `
      <tr>${definition.columns.map(([key]) => `<td data-label="${key}">${display(item[key], key)}</td>`).join('')}
        ${manageable ? `<td class="actions"><button class="link-button" data-edit="${item.id}">Editar</button><button class="link-button danger" data-delete="${item.id}">Desactivar</button></td>` : ''}
      </tr>
    `).join('');
    page.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Directorio</p><h1>${definition.title}</h1><p>Datos limitados a tu organización y permisos.</p></div>${manageable ? '<button class="button primary" id="new-resource">Nuevo</button>' : ''}</div>
      ${manageable ? `<section class="panel form-panel ${editing ? '' : 'collapsed'}" id="resource-panel"><div class="panel-head"><h2>${editing ? `Editar ${definition.singular}` : `Nuevo ${definition.singular}`}</h2><button class="icon-button" id="close-form" aria-label="Cerrar formulario">×</button></div><form id="resource-form" class="form-grid">${definition.fields.map((f) => field(f, editing ?? {})).join('')}<p class="form-error span-all" id="resource-error" hidden></p><div class="form-actions span-all"><button class="button ghost" type="button" id="cancel-form">Cancelar</button><button class="button primary" type="submit">Guardar</button></div></form></section>` : ''}
      <section class="panel"><div class="panel-head"><div><h2>Listado</h2><p>${items.length} registro${items.length === 1 ? '' : 's'}</p></div></div>${items.length ? `<div class="table-wrap"><table><thead><tr>${definition.columns.map(([, label]) => `<th>${label}</th>`).join('')}${manageable ? '<th>Acciones</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>` : empty(`No hay ${definition.title.toLowerCase()} todavía.`)}</section>
    `;
    bind();
  }

  function open(item = null) {
    editing = item;
    draw();
    document.querySelector('#resource-panel').classList.remove('collapsed');
    document.querySelector('#resource-form input, #resource-form select')?.focus();
  }

  function bind() {
    document.querySelector('#new-resource')?.addEventListener('click', () => open());
    document.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => open(items.find(({ id }) => id === button.dataset.edit))));
    const close = () => { editing = null; draw(); };
    document.querySelector('#close-form')?.addEventListener('click', close);
    document.querySelector('#cancel-form')?.addEventListener('click', close);
    document.querySelector('#resource-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(event.currentTarget));
      if (resource === 'services') {
        body.durationMinutes = Number(body.durationMinutes);
        body.priceCents = Math.round(Number(body.price) * 100);
        delete body.price;
      }
      if (resource === 'users' && editing && !body.password) delete body.password;
      try {
        await api(editing ? `${definition.path}/${editing.id}` : definition.path, { method: editing ? 'PUT' : 'POST', body });
        notify(`${definition.singular[0].toUpperCase()}${definition.singular.slice(1)} guardado.`);
        editing = null;
        await load();
      } catch (error) {
        const target = document.querySelector('#resource-error');
        target.textContent = fieldError(error);
        target.hidden = false;
      }
    });
    document.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
      if (!await confirmAction({ title: `Desactivar ${definition.singular}`, text: 'El registro se conservará para el histórico.', confirmText: 'Desactivar' })) return;
      try {
        await api(`${definition.path}/${button.dataset.delete}`, { method: 'DELETE' });
        notify('Registro desactivado.');
        await load();
      } catch (error) { notify(error.message, 'error'); }
    }));
  }

  await load();
}
