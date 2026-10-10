import { icon } from '../ui/icons.js';
import { esc, statusBadge, progressBar, emptyState } from '../ui/render-helpers.js';
import { decorate, computeKpis, upcoming } from '../domain/stats.js';
import { formatDate, todayISO } from '../utils/dates.js';
import { renderChart } from '../services/charts.js';
import { state, setTab } from '../state/store.js';

const KPI_CARDS = [
  { key: 'total', label: 'Programadas', icon: 'list-checks', accent: 'border-slate-500 text-slate-700 bg-slate-100', hint: 'Total planificado' },
  { key: 'enDesarrollo', label: 'En desarrollo', icon: 'cog', accent: 'border-blue-500 text-blue-600 bg-blue-50', hint: 'Ejecución activa' },
  { key: 'completadas', label: 'Completadas', icon: 'check-circle-2', accent: 'border-emerald-500 text-emerald-600 bg-emerald-50', hint: 'Finalizadas 100%' },
  { key: 'pendientes', label: 'Pendientes', icon: 'clock', accent: 'border-amber-500 text-amber-600 bg-amber-50', hint: 'Por iniciar' },
  { key: 'atrasadas', label: 'Atrasadas', icon: 'triangle-alert', accent: 'border-rose-500 text-rose-600 bg-rose-50', hint: 'Fuera de fecha' },
];

function byPeriod() {
  const acts = decorate(state.activities, todayISO());
  return state.ui.period ? acts.filter((a) => a.periodo === state.ui.period) : acts;
}

export function render() {
  const acts = byPeriod();
  const kpis = computeKpis(acts);
  const next = upcoming(acts, 5);

  return `
    <div class="space-y-6">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        ${KPI_CARDS.map((c) => `
          <div class="flex items-center justify-between rounded-xl border-l-4 bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${c.accent.split(' ')[0]}" data-filter-estado="${c.key === 'total' ? 'TODOS' : c.key === 'enDesarrollo' ? 'En desarrollo' : c.key === 'completadas' ? 'Completada' : c.key === 'pendientes' ? 'Pendiente' : 'Atrasada'}" title="Haz clic para filtrar en el plan">
            <div>
              <p class="text-[11px] font-semibold uppercase text-slate-500">${c.label}</p>
              <h3 class="text-2xl font-black text-slate-800">${kpis[c.key]}</h3>
              <p class="text-[10px] text-slate-400">${c.hint}</p>
            </div>
            <div class="rounded-lg p-2.5 ${c.accent.split(' ').slice(1).join(' ')}">${icon(c.icon, 'w-6 h-6')}</div>
          </div>`).join('')}
        <div class="relative flex flex-col items-center justify-center rounded-xl border border-emerald-100 bg-white p-3">
          <p class="mb-1 text-center text-[11px] font-bold uppercase leading-tight text-slate-600">Avance general del plan</p>
          <div class="relative flex h-16 w-16 items-center justify-center">
            <canvas id="chart-gauge"></canvas>
            <span class="absolute text-sm font-extrabold text-fet-darkgreen">${kpis.avanceGeneral}%</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 class="mb-3 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Estado de las actividades</h4>
          <div class="relative h-48"><canvas id="chart-estado"></canvas></div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 class="mb-3 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Distribución por tipo</h4>
          <div class="relative h-48"><canvas id="chart-tipo"></canvas></div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 class="mb-3 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Avance por línea estratégica</h4>
          <div class="relative h-48"><canvas id="chart-linea"></canvas></div>
        </div>
        <div class="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h4 class="mb-3 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Próximas actividades</h4>
            ${next.length === 0 ? emptyState('No hay actividades pendientes.', icon('inbox', 'w-8 h-8 mb-1')) : `
            <table class="w-full text-left text-xs">
              <thead><tr class="bg-fet-green text-[10px] uppercase text-white"><th class="rounded-l p-1.5">Fecha fin</th><th class="p-1.5">Actividad</th><th class="rounded-r p-1.5 text-center">Estado</th></tr></thead>
              <tbody class="divide-y divide-slate-100">
                ${next.map((a) => `<tr class="hover:bg-slate-50"><td class="p-1.5 font-medium text-slate-600">${formatDate(a.fecha_fin)}</td><td class="p-1.5 font-semibold text-slate-800">${esc(a.nombre)}</td><td class="p-1.5 text-center">${statusBadge(a.estado_efectivo)}</td></tr>`).join('')}
              </tbody>
            </table>`}
          </div>
          <button data-goto="calendario" class="mt-2 flex w-full items-center justify-center gap-1 py-1 text-center text-xs font-semibold text-fet-green hover:underline">Ver calendario completo ${icon('arrow-right', 'w-3 h-3')}</button>
        </div>
      </div>

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div class="flex items-center gap-2"><span class="text-fet-green">${icon('table', 'w-5 h-5')}</span><h3 class="text-sm font-bold uppercase text-slate-800">Plan de actividades ${esc(state.ui.period || '')}</h3></div>
          <button data-goto="plan" class="flex items-center gap-1 rounded-lg bg-fet-green px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-fet-darkgreen">${icon('external-link', 'w-3.5 h-3.5')} Gestionar plan completo</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left text-xs">
            <thead><tr class="bg-fet-green text-[11px] font-semibold uppercase tracking-wider text-white">
              <th class="border-r border-emerald-700 px-3 py-2.5 text-center w-12">N°</th><th class="border-r border-emerald-700 px-3 py-2.5">Actividad</th>
              <th class="border-r border-emerald-700 px-3 py-2.5">Tipo</th><th class="border-r border-emerald-700 px-3 py-2.5">Responsable</th>
              <th class="border-r border-emerald-700 px-3 py-2.5 text-center w-32">% Avance</th><th class="px-3 py-2.5 text-center">Estado</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-100">
              ${acts.length === 0 ? `<tr><td colspan="6">${emptyState('No hay actividades registradas en este periodo.', icon('inbox', 'w-8 h-8 mb-1'))}</td></tr>` :
                acts.slice(0, 6).map((a) => `
                <tr class="border-b border-slate-100 hover:bg-slate-50">
                  <td class="border-r border-slate-100 px-3 py-2 text-center font-bold text-slate-600">${a.numero}</td>
                  <td class="border-r border-slate-100 px-3 py-2 font-semibold text-slate-800">${esc(a.nombre)}</td>
                  <td class="border-r border-slate-100 px-3 py-2 text-slate-600">${esc(a.tipo)}</td>
                  <td class="border-r border-slate-100 px-3 py-2 text-slate-600">${esc(a.responsable)}</td>
                  <td class="border-r border-slate-100 px-3 py-2">${progressBar(a.avance)}</td>
                  <td class="px-3 py-2 text-center">${statusBadge(a.estado_efectivo)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

export function mount(root) {
  root.querySelectorAll('[data-goto]').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.goto)));

  // Agregar listeners para los filtros de KPI
  root.querySelectorAll('[data-filter-estado]').forEach((card) => {
    card.addEventListener('click', () => {
      const estado = card.dataset.filterEstado;
      if (estado) {
        state.ui.filterEstado = estado;
        setTab('plan');
      }
    });
  });

  const acts = byPeriod();
  const kpis = computeKpis(acts);

  renderChart('chart-gauge', {
    type: 'doughnut',
    data: { datasets: [{ data: [kpis.avanceGeneral, 100 - kpis.avanceGeneral], backgroundColor: ['#005C29', '#e2e8f0'], borderWidth: 0 }] },
    options: { cutout: '78%', responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false }, legend: { display: false } } },
  });

  renderChart('chart-estado', {
    type: 'bar',
    data: {
      labels: ['Completadas', 'En desarrollo', 'Pendientes', 'Atrasadas'],
      datasets: [{ data: [kpis.completadas, kpis.enDesarrollo, kpis.pendientes, kpis.atrasadas], backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#f43f5e'], borderRadius: 6 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });

  const tipoCount = new Map();
  acts.forEach((a) => tipoCount.set(a.tipo, (tipoCount.get(a.tipo) || 0) + 1));
  renderChart('chart-tipo', {
    type: 'doughnut',
    data: { labels: [...tipoCount.keys()], datasets: [{ data: [...tipoCount.values()], backgroundColor: ['#005C29', '#0284c7', '#84cc16', '#eab308', '#64748b', '#a855f7'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } },
  });

  const lineaAvg = new Map();
  acts.forEach((a) => { const l = lineaAvg.get(a.linea) || { s: 0, n: 0 }; l.s += Number(a.avance); l.n += 1; lineaAvg.set(a.linea, l); });
  const lineaLabels = [...lineaAvg.keys()];
  renderChart('chart-linea', {
    type: 'bar',
    data: { labels: lineaLabels, datasets: [{ data: lineaLabels.map((l) => Math.round(lineaAvg.get(l).s / lineaAvg.get(l).n)), backgroundColor: '#005C29', borderRadius: 4 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { max: 100, ticks: { callback: (v) => v + '%' } } } },
  });
}
