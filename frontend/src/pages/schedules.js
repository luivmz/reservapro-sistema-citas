import { api } from '../services/api.js';
import { confirmAction, empty, errorState, fieldError, loading, notify } from '../components/ui.js';
import { escapeHtml } from '../utils/format.js';

const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export async function renderSchedules(page, user) {
  const canEdit = user.role === 'ADMIN';
  let employees = [];
  let services = [];
  let selected = null;

  try {
    page.innerHTML = loading();
    [employees, services] = (await Promise.all([
      api('/employees', { query: { active: true, limit: 100 } }),
      api('/services', { query: { active: true, limit: 100 } }),
    ])).map((response) => response.data);
    selected = employees[0]?.id ?? null;
    await draw();
  } catch (error) { page.innerHTML = errorState(error); }

  async function draw() {
    if (!selected) {
      page.innerHTML = `<div class="page-head"><div><p class="eyebrow">Configuración</p><h1>Horarios</h1></div></div>${empty('Primero crea un profesional activo.')}`;
      return;
    }
    page.innerHTML = loading();
    try {
      const [scheduleResponse, offeringResponse] = await Promise.all([
        api(`/employees/${selected}/schedules`),
        api(`/employees/${selected}/services`),
      ]);
      const schedules = scheduleResponse.data;
      const selectedServices = new Set(offeringResponse.data.map(({ id }) => id));
      page.innerHTML = `
        <div class="page-head"><div><p class="eyebrow">Configuración</p><h1>Horarios y servicios</h1><p>Jornada semanal explícita por profesional.</p></div></div>
        <section class="panel selector-panel"><label>Profesional<select id="employee-selector">${employees.map((employee) => `<option value="${employee.id}" ${employee.id === selected ? 'selected' : ''}>${escapeHtml(employee.name)}</option>`).join('')}</select></label></section>
        <div class="dashboard-grid">
          <section class="panel"><div class="panel-head"><div><h2>Servicios que presta</h2><p>Solo asociaciones dentro del tenant.</p></div></div>
            ${services.length ? `<form id="offering-form" class="check-grid">${services.map((service) => `<label><input type="checkbox" name="serviceIds" value="${service.id}" ${selectedServices.has(service.id) ? 'checked' : ''} ${canEdit ? '' : 'disabled'} /><span>${escapeHtml(service.name)}<small>${service.durationMinutes} min</small></span></label>`).join('')}${canEdit ? '<button class="button primary" type="submit">Guardar servicios</button>' : ''}</form>` : empty('No hay servicios activos.')}
          </section>
          <section class="panel"><div class="panel-head"><div><h2>Semana laboral</h2><p>Los bloques adyacentes son válidos; los cruces se rechazan.</p></div></div>
            ${canEdit ? `<form id="schedule-form" class="schedule-form"><label>Día<select name="dayOfWeek">${days.slice(1).map((day, index) => `<option value="${index + 1}">${day}</option>`).join('')}</select></label><label>Inicio<input type="time" name="startTime" required /></label><label>Fin<input type="time" name="endTime" required /></label><button class="button secondary" type="submit">Agregar bloque</button><p class="form-error span-all" id="schedule-error" hidden></p></form>` : ''}
            ${schedules.length ? `<ul class="schedule-list">${schedules.map((schedule) => `<li><div><strong>${days[schedule.dayOfWeek]}</strong><span>${schedule.startTime} — ${schedule.endTime}</span></div>${canEdit ? `<button class="icon-button danger" data-remove="${schedule.id}" aria-label="Eliminar bloque de ${days[schedule.dayOfWeek]}">×</button>` : ''}</li>`).join('')}</ul>` : empty('Este profesional aún no tiene jornada configurada.')}
          </section>
        </div>
      `;
      document.querySelector('#employee-selector').addEventListener('change', async (event) => { selected = event.target.value; await draw(); });
      document.querySelector('#offering-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const serviceIds = new FormData(event.currentTarget).getAll('serviceIds');
        try { await api(`/employees/${selected}/services`, { method: 'PUT', body: { serviceIds } }); notify('Servicios actualizados.'); await draw(); } catch (error) { notify(error.message, 'error'); }
      });
      document.querySelector('#schedule-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = Object.fromEntries(new FormData(event.currentTarget));
        body.dayOfWeek = Number(body.dayOfWeek);
        try { await api(`/employees/${selected}/schedules`, { method: 'POST', body }); notify('Bloque agregado.'); await draw(); } catch (error) { const target = document.querySelector('#schedule-error'); target.textContent = fieldError(error); target.hidden = false; }
      });
      document.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', async () => {
        if (!await confirmAction({ title: 'Eliminar bloque', text: 'Las citas existentes no se eliminarán.', confirmText: 'Eliminar' })) return;
        try { await api(`/employees/${selected}/schedules/${button.dataset.remove}`, { method: 'DELETE' }); notify('Bloque eliminado.'); await draw(); } catch (error) { notify(error.message, 'error'); }
      }));
    } catch (error) { page.innerHTML = errorState(error); }
  }
}
