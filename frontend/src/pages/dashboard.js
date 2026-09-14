import { api } from '../services/api.js';
import { escapeHtml } from '../utils/format.js';
import { empty, errorState, loading } from '../components/ui.js';

function ranking(items) {
  if (!items.length) return empty('Aún no hay citas para calcular este ranking.');
  const max = Math.max(...items.map(({ appointmentCount }) => appointmentCount));
  return `<ol class="ranking">${items.map((item) => `
    <li>
      <div><strong>${escapeHtml(item.name)}</strong><span>${item.appointmentCount} cita${item.appointmentCount === 1 ? '' : 's'}</span></div>
      <span class="bar"><i style="width:${Math.max(10, item.appointmentCount / max * 100)}%"></i></span>
    </li>
  `).join('')}</ol>`;
}

export async function renderDashboard(page) {
  page.innerHTML = `<div class="page-head"><div><p class="eyebrow">Operación</p><h1>Resumen</h1><p>Una lectura rápida de tu agenda.</p></div><a class="button primary" href="#appointments">Nueva cita</a></div>${loading()}`;
  try {
    const { data } = await api('/dashboard');
    page.innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Operación</p><h1>Resumen</h1><p>${data.scope === 'PROFESSIONAL' ? 'Tu agenda profesional.' : 'Actividad de toda la organización.'}</p></div><a class="button primary" href="#appointments">Ver citas</a></div>
      <section class="metric-grid" aria-label="Métricas de citas">
        <article class="metric accent"><span>Programadas</span><strong>${data.counts.scheduled}</strong><small>pendientes de atención</small></article>
        <article class="metric"><span>Hoy</span><strong>${data.counts.today}</strong><small>sin canceladas</small></article>
        <article class="metric"><span>Confirmadas</span><strong>${data.counts.confirmed}</strong><small>listas para atender</small></article>
        <article class="metric"><span>Completadas</span><strong>${data.counts.completed}</strong><small>histórico del tenant</small></article>
      </section>
      <section class="dashboard-grid">
        <article class="panel"><div class="panel-head"><div><p class="eyebrow">Demanda</p><h2>Servicios más solicitados</h2></div></div>${ranking(data.topServices)}</article>
        <article class="panel"><div class="panel-head"><div><p class="eyebrow">Relación</p><h2>Clientes frecuentes</h2></div></div>${ranking(data.frequentClients)}</article>
      </section>
    `;
  } catch (error) {
    page.innerHTML += errorState(error);
  }
}
