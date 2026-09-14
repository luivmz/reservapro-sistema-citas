import { Calendar } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import Swal from 'sweetalert2';
import { api } from '../services/api.js';
import { notify } from '../components/ui.js';
import { appointmentToEvent } from '../utils/calendar.js';
import { dateTime, escapeHtml } from '../utils/format.js';

export async function renderCalendar(page, user) {
  const canReschedule = ['ADMIN', 'RECEPTIONIST', 'CLIENT'].includes(user.role);
  page.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">Vista visual</p><h1>${user.role === 'PROFESSIONAL' ? 'Mi agenda' : user.role === 'CLIENT' ? 'Mis citas' : 'Calendario'}</h1><p>Mes, semana y día con datos servidos por la API.</p></div><a class="button primary" href="#appointments">Nueva cita</a></div>
    <section class="panel calendar-panel"><div id="calendar" aria-label="Calendario de citas"></div></section>
  `;
  const calendar = new Calendar(document.querySelector('#calendar'), {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    locale: esLocale,
    initialView: 'timeGridWeek',
    firstDay: 1,
    nowIndicator: true,
    selectable: canReschedule,
    editable: canReschedule,
    eventStartEditable: canReschedule,
    height: 'auto',
    slotMinTime: '07:00:00',
    slotMaxTime: '21:00:00',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
    buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' },
    events: async (info, success, failure) => {
      try {
        const response = await api('/appointments', { query: { from: info.start.toISOString(), to: info.end.toISOString(), limit: 100 } });
        success(response.data.map(appointmentToEvent));
      } catch (error) { notify(error.message, 'error'); failure(error); }
    },
    select(info) {
      sessionStorage.setItem('reservapro.prefillStart', info.start.toISOString());
      location.hash = 'appointments';
    },
    async eventClick(info) {
      const item = info.event.extendedProps.appointment;
      await Swal.fire({ title: escapeHtml(item.serviceName), html: `<dl class="detail-list"><dt>Cliente</dt><dd>${escapeHtml(item.clientName)}</dd><dt>Profesional</dt><dd>${escapeHtml(item.employeeName)}</dd><dt>Inicio</dt><dd>${dateTime(item.startAt)}</dd><dt>Estado</dt><dd>${item.status}</dd></dl>`, confirmButtonText: 'Cerrar' });
    },
    async eventDrop(info) {
      try {
        await api(`/appointments/${info.event.id}/reschedule`, { method: 'PATCH', body: { startAt: info.event.start.toISOString() } });
        notify('Cita reprogramada.');
        info.event.setExtendedProp('appointment', {
          ...info.event.extendedProps.appointment,
          startAt: info.event.start.toISOString(),
          endAt: info.event.end?.toISOString(),
        });
      } catch (error) {
        info.revert();
        notify(error.message, 'error');
      }
    },
  });
  calendar.render();
}
