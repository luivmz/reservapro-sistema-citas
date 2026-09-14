import Swal from 'sweetalert2';
import { api } from '../services/api.js';
import { confirmAction, empty, errorState, fieldError, loading, notify } from '../components/ui.js';
import { dateTime, escapeHtml, localInputToIso, toLocalInput } from '../utils/format.js';

const transitions = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  COMPLETED: [], CANCELLED: [], NO_SHOW: [],
};

export async function renderAppointments(page, user) {
  const canCreate = ['ADMIN', 'RECEPTIONIST', 'CLIENT'].includes(user.role);
  const canOperate = ['ADMIN', 'RECEPTIONIST'].includes(user.role);
  let appointments = [];
  let clients = [];
  let employees = [];
  let services = [];

  async function load(query = {}) {
    page.innerHTML = loading();
    try {
      const requests = [
        api('/appointments', { query: { limit: 100, ...query } }),
        api('/employees', { query: { active: true, limit: 100 } }),
        api('/services', { query: { active: true, limit: 100 } }),
      ];
      if (canOperate) requests.push(api('/clients', { query: { active: true, limit: 100 } }));
      const [appointmentResponse, employeeResponse, serviceResponse, clientResponse] = await Promise.all(requests);
      appointments = appointmentResponse.data;
      employees = employeeResponse.data;
      services = serviceResponse.data;
      clients = clientResponse?.data ?? [];
      draw(query);
    } catch (error) {
      page.innerHTML = errorState(error);
    }
  }

  const options = (items, placeholder) => `<option value="">${placeholder}</option>${items.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;

  function draw(query) {
    const rows = appointments.map((item) => {
      const next = transitions[item.status] ?? [];
      return `<tr>
        <td><strong>${dateTime(item.startAt)}</strong><small>${escapeHtml(item.serviceName)}</small></td>
        <td>${escapeHtml(item.clientName)}</td><td>${escapeHtml(item.employeeName)}</td>
        <td><span class="badge status-${item.status.toLowerCase().replace('_', '-')}">${item.status}</span></td>
        <td class="actions">
          <button class="link-button" data-detail="${item.id}">Ver</button>
          ${['SCHEDULED', 'CONFIRMED'].includes(item.status) && user.role !== 'PROFESSIONAL' ? `<button class="link-button" data-reschedule="${item.id}">Reprogramar</button><button class="link-button danger" data-cancel="${item.id}">Cancelar</button>` : ''}
          ${['ADMIN', 'RECEPTIONIST', 'PROFESSIONAL'].includes(user.role) && next.filter((status) => status !== 'CANCELLED').length ? `<select class="status-select" data-status="${item.id}" aria-label="Cambiar estado de ${escapeHtml(item.clientName)}"><option value="">Cambiar estado</option>${next.filter((status) => status !== 'CANCELLED').map((status) => `<option>${status}</option>`).join('')}</select>` : ''}
        </td>
      </tr>`;
    }).join('');

    page.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Agenda</p><h1>${user.role === 'CLIENT' ? 'Mis citas' : user.role === 'PROFESSIONAL' ? 'Mi agenda' : 'Citas'}</h1><p>Filtra, consulta y opera sin salir del contexto autorizado.</p></div>${canCreate ? '<button class="button primary" id="new-appointment">Nueva cita</button>' : ''}</div>
      <section class="panel filters"><form id="filters" class="filter-grid">
        ${canOperate ? `<label>Cliente<select name="clientId">${options(clients, 'Todos')}</select></label>` : ''}
        ${user.role !== 'PROFESSIONAL' ? `<label>Profesional<select name="employeeId">${options(employees, 'Todos')}</select></label>` : ''}
        <label>Servicio<select name="serviceId">${options(services, 'Todos')}</select></label>
        <label>Estado<select name="status"><option value="">Todos</option>${Object.keys(transitions).map((status) => `<option>${status}</option>`).join('')}</select></label>
        <button class="button secondary" type="submit">Aplicar filtros</button><button class="link-button" type="button" id="clear-filters">Limpiar</button>
      </form></section>
      ${canCreate ? `<section id="appointment-panel" class="panel form-panel collapsed"><div class="panel-head"><h2>Nueva cita</h2><button class="icon-button" id="close-appointment" aria-label="Cerrar formulario">×</button></div><form id="appointment-form" class="form-grid">
        ${canOperate ? `<label>Cliente<select name="clientId" required>${options(clients, 'Selecciona cliente')}</select></label>` : ''}
        <label>Profesional<select name="employeeId" required>${options(employees, 'Selecciona profesional')}</select></label>
        <label>Servicio<select name="serviceId" required>${options(services, 'Selecciona servicio')}</select></label>
        <label>Inicio<input type="datetime-local" name="start" required /></label>
        <label class="span-all">Notas<textarea name="notes" maxlength="2000"></textarea></label>
        <div class="span-all"><button class="button secondary" id="check-availability" type="button">Consultar slots del día</button><div id="slot-list" class="slot-list" aria-live="polite"></div></div>
        <p id="appointment-error" class="form-error span-all" hidden></p>
        <div class="form-actions span-all"><button class="button ghost" type="button" id="cancel-appointment-form">Cancelar</button><button class="button primary" type="submit">Reservar cita</button></div>
      </form></section>` : ''}
      <section class="panel"><div class="panel-head"><div><h2>Agenda</h2><p>${appointments.length} resultado${appointments.length === 1 ? '' : 's'}</p></div><a class="link-button" href="#calendar">Ver calendario</a></div>${appointments.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha / servicio</th><th>Cliente</th><th>Profesional</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('No hay citas con estos filtros.')}</section>
    `;
    bind(query);
  }

  function bind(query) {
    const panel = document.querySelector('#appointment-panel');
    const open = () => {
      panel?.classList.remove('collapsed');
      const prefill = sessionStorage.getItem('reservapro.prefillStart');
      if (prefill) {
        panel.querySelector('[name="start"]').value = toLocalInput(prefill);
        sessionStorage.removeItem('reservapro.prefillStart');
      }
      panel?.querySelector('select, input')?.focus();
    };
    const close = () => panel?.classList.add('collapsed');
    document.querySelector('#new-appointment')?.addEventListener('click', open);
    document.querySelector('#close-appointment')?.addEventListener('click', close);
    document.querySelector('#cancel-appointment-form')?.addEventListener('click', close);
    if (sessionStorage.getItem('reservapro.prefillStart')) open();

    const filterForm = document.querySelector('#filters');
    for (const [key, value] of Object.entries(query)) filterForm.elements[key] && (filterForm.elements[key].value = value);
    filterForm.addEventListener('submit', (event) => { event.preventDefault(); load(Object.fromEntries(new FormData(filterForm))); });
    document.querySelector('#clear-filters').addEventListener('click', () => load());

    document.querySelector('#check-availability')?.addEventListener('click', async () => {
      const form = document.querySelector('#appointment-form');
      const data = Object.fromEntries(new FormData(form));
      const target = document.querySelector('#slot-list');
      if (!data.employeeId || !data.serviceId || !data.start) {
        target.textContent = 'Selecciona profesional, servicio y fecha.';
        return;
      }
      try {
        const response = await api('/availability', { query: { employeeId: data.employeeId, serviceId: data.serviceId, date: data.start.slice(0, 10) } });
        target.innerHTML = response.data.slots.length ? response.data.slots.slice(0, 12).map((slot) => `<button type="button" class="slot" data-slot="${slot.startAt}">${new Date(slot.startAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</button>`).join('') : '<span>No hay slots libres.</span>';
        target.querySelectorAll('[data-slot]').forEach((button) => button.addEventListener('click', () => { form.elements.start.value = toLocalInput(button.dataset.slot); }));
      } catch (error) { target.textContent = error.message; }
    });

    document.querySelector('#appointment-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const raw = Object.fromEntries(new FormData(event.currentTarget));
      const startAt = localInputToIso(raw.start);
      try {
        await api('/appointments', { method: 'POST', body: { clientId: raw.clientId || undefined, employeeId: raw.employeeId, serviceId: raw.serviceId, startAt, notes: raw.notes } });
        notify('Cita reservada.');
        await load();
      } catch (error) {
        const target = document.querySelector('#appointment-error');
        target.textContent = fieldError(error);
        target.hidden = false;
      }
    });

    document.querySelectorAll('[data-detail]').forEach((button) => button.addEventListener('click', async () => {
      const item = appointments.find(({ id }) => id === button.dataset.detail);
      await Swal.fire({ title: item.serviceName, html: `<dl class="detail-list"><dt>Cliente</dt><dd>${escapeHtml(item.clientName)}</dd><dt>Profesional</dt><dd>${escapeHtml(item.employeeName)}</dd><dt>Inicio</dt><dd>${dateTime(item.startAt)}</dd><dt>Estado</dt><dd>${item.status}</dd><dt>Notas</dt><dd>${escapeHtml(item.notes || 'Sin notas')}</dd></dl>`, confirmButtonText: 'Cerrar' });
    }));
    document.querySelectorAll('[data-cancel]').forEach((button) => button.addEventListener('click', async () => {
      if (!await confirmAction({ title: 'Cancelar cita', text: 'La cita quedará en el histórico como CANCELLED.', confirmText: 'Cancelar cita' })) return;
      try { await api(`/appointments/${button.dataset.cancel}/cancel`, { method: 'PATCH' }); notify('Cita cancelada.'); await load(query); } catch (error) { notify(error.message, 'error'); }
    }));
    document.querySelectorAll('[data-reschedule]').forEach((button) => button.addEventListener('click', async () => {
      const item = appointments.find(({ id }) => id === button.dataset.reschedule);
      const result = await Swal.fire({ title: 'Reprogramar cita', input: 'datetime-local', inputValue: toLocalInput(item.startAt), showCancelButton: true, confirmButtonText: 'Reprogramar', cancelButtonText: 'Volver', inputValidator: (value) => !value && 'Selecciona fecha y hora.' });
      if (!result.isConfirmed) return;
      try { await api(`/appointments/${item.id}/reschedule`, { method: 'PATCH', body: { startAt: localInputToIso(result.value) } }); notify('Cita reprogramada.'); await load(query); } catch (error) { notify(error.message, 'error'); }
    }));
    document.querySelectorAll('[data-status]').forEach((select) => select.addEventListener('change', async () => {
      if (!select.value) return;
      try { await api(`/appointments/${select.dataset.status}/status`, { method: 'PATCH', body: { status: select.value } }); notify('Estado actualizado.'); await load(query); } catch (error) { notify(error.message, 'error'); select.value = ''; }
    }));
  }

  await load();
}
