import { icon } from '../ui/icons.js';
import { esc, statusBadge, progressBar, emptyState } from '../ui/render-helpers.js';
import { decorate } from '../domain/stats.js';
import { STATUSES } from '../domain/constants.js';
import { formatDate, todayISO } from '../utils/dates.js';
import { toCsv, downloadFile } from '../utils/csv.js';
import { state, isReadOnly } from '../state/store.js';
import { openActivityModal, openActivityViewModal } from '../ui/activityModal.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { ApiError } from '../api/errors.js';

// Esta vista está pensada para "Plan de Especialización" — sin registros iniciales
// y con la tabla más ancha para que los iconos/quededen desplazados a la derecha.
const filter = { q: '', tipo: 'TODOS', estado: 'ACTIVAS', periodo: 'TODOS' };

function filtered() {
  // se mantiene la misma lógica por si se reutiliza, pero no se mostrarán filas por defecto
  const acts = decorate(state.activities, todayISO());
  const q = filter.q.trim().toLowerCase();
  return acts
    .filter((a) => !q || a.nombre.toLowerCase().includes(q) || a.responsable.toLowerCase().includes(q))
    .filter((a) => filter.tipo === 'TODOS' || a.tipo === filter.tipo)
    .filter((a) => filter.estado === 'TODOS'
      || (filter.estado === 'ACTIVAS' ? a.estado_efectivo !== 'Completada' : a.estado_efectivo === filter.estado))
    .filter((a) => filter.periodo === 'TODOS' || a.periodo === filter.periodo)
    .sort((a, b) => a.periodo.localeCompare(b.periodo) || a.numero - b.numero);
}

function rowHtml(a, readOnly) {
  return `
    <tr class="border-b border-slate-100 hover:bg-slate-50" data-row="${a.id}">
      <td class="border-r border-slate-100 px-3 py-2.5 text-center font-bold text-slate-600">${a.numero}</td>
      <td class="border-r border-slate-100 px-3 py-2.5 font-semibold text-slate-800">${esc(a.nombre)}</td>
      <td class="border-r border-slate-100 px-3 py-2.5 text-slate-600">${esc(a.linea)}</td>
      <td class="border-r border-slate-100 px-3 py-2.5 text-slate-600">${esc(a.tipo)}</td>
      <td class="border-r border-slate-100 px-3 py-2.5 text-slate-600">${esc(a.responsable)}</td>
      <td class="border-r border-slate-100 px-3 py-2.5 text-slate-500">${formatDate(a.fecha_inicio)}</td>
      <td class="border-r border-slate-100 px-3 py-2.5 text-slate-500">${formatDate(a.fecha_fin)}</td>
      <td class="border-r border-slate-100 px-3 py-2.5 text-center">${progressBar(a.avance)}</td>
      <td class="border-r border-slate-100 px-3 py-2.5 text-center">${statusBadge(a.estado_efectivo)}</td>
      <td class="border-r border-slate-100 max-w-xs truncate px-3 py-2.5 italic text-slate-500">${esc(a.observaciones) || '-'}</td>
      <td class="px-3 py-2.5 text-center">
        <div class="flex items-center justify-center gap-1">
          <button data-view="${a.id}" title="Ver detalles" class="rounded p-1 text-slate-600 hover:bg-slate-100">${icon('eye', 'w-4 h-4')}</button>
          ${readOnly ? '' : `
          <button data-edit="${a.id}" title="Editar" class="rounded p-1 text-blue-600 hover:bg-blue-50">${icon('edit-3', 'w-4 h-4')}</button>
          <button data-delete="${a.id}" title="Eliminar" class="rounded p-1 text-rose-600 hover:bg-rose-50">${icon('trash-2', 'w-4 h-4')}</button>`}
        </div>
      </td>
    </tr>`;
}

export function render() {
  const cat = state.catalogs;
  const readOnly = isReadOnly();
  return `
    <div class="space-y-4">
      <div class="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-violet-50 p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="grid h-11 w-11 place-items-center rounded-xl bg-violet-600 text-white shadow-sm">
              ${icon('list-checks', 'w-5 h-5')}
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600">Especialización</p>
              <h2 class="text-base font-bold text-slate-800">Plan de Especialización</h2>
            </div>
          </div>
          <span class="inline-flex items-center rounded-full border border-violet-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">Plantilla en blanco</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-grow flex-wrap items-center gap-2">
          <div class="relative min-w-[200px] flex-grow sm:flex-grow-0">
            <span class="pointer-events-none absolute left-2.5 top-2.5 text-slate-400">${icon('search', 'w-4 h-4')}</span>
            <input data-role="q" type="text" placeholder="Buscar actividad o responsable..." class="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-fet-green">
          </div>
          <select data-role="periodo" class="rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-fet-green">
            <option value="TODOS">Todos los periodos</option>${cat.periodo.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
          </select>
          <select data-role="tipo" class="rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-fet-green">
            <option value="TODOS">Todos los tipos</option>${cat.tipo.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
          </select>
          <select data-role="estado" class="rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-fet-green">
            <option value="ACTIVAS" ${filter.estado === 'ACTIVAS' ? 'selected' : ''}>Activas (sin completadas)</option>
            <option value="TODOS" ${filter.estado === 'TODOS' ? 'selected' : ''}>Todos los estados</option>${STATUSES.map((s) => `<option value="${esc(s)}" ${filter.estado === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-center gap-2">
          <button data-role="export" class="flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">${icon('download', 'w-3.5 h-3.5')} Exportar CSV</button>
          ${readOnly ? '' : `<button data-role="new" class="flex items-center gap-1.5 rounded-lg bg-fet-green px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-fet-darkgreen">${icon('plus-circle', 'w-4 h-4')} Nueva actividad</button>`}
        </div>
      </div>

      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="min-w-[1600px] border-collapse text-left text-xs">
            <thead><tr class="bg-violet-600 text-[11px] font-semibold uppercase tracking-wider text-white">
              <th class="w-12 border-r border-violet-500 px-3 py-3 text-center">N°</th>
              <th class="min-w-[200px] border-r border-violet-500 px-3 py-3">Actividad</th>
              <th class="border-r border-violet-500 px-3 py-3">Línea estratégica</th>
              <th class="border-r border-violet-500 px-3 py-3">Tipo</th>
              <th class="border-r border-violet-500 px-3 py-3">Responsable</th>
              <th class="border-r border-violet-500 px-3 py-3">Fecha inicio</th>
              <th class="border-r border-violet-500 px-3 py-3">Fecha fin</th>
              <th class="w-32 border-r border-violet-500 px-3 py-3 text-center">% Avance</th>
              <th class="border-r border-violet-500 px-3 py-3 text-center">Estado</th>
              <th class="border-r border-violet-500 px-3 py-3">Observaciones</th>
              <th class="px-3 py-3 text-center">Acciones</th>
            </tr></thead>
            <tbody data-role="tbody" class="divide-y divide-slate-200"></tbody>
          </table>
        </div>
      </div>
    </div>`;
}

export function mount(root) {
  const readOnly = isReadOnly();
  const tbody = root.querySelector('[data-role="tbody"]');
  root.querySelector('[data-role="estado"]').value = filter.estado;

  function paint() {
    const rows = [];
    tbody.innerHTML = rows.length
      ? rows.map((a) => rowHtml(a, readOnly)).join('')
      : `
        <tr>
          <td colspan="11" class="p-0">
            <div class="flex flex-col items-center justify-center gap-3 bg-slate-50 px-6 py-14 text-center">
              <div class="grid h-14 w-14 place-items-center rounded-2xl border border-violet-200 bg-violet-100 text-violet-600 shadow-sm">
                ${icon('inbox', 'w-7 h-7')}
              </div>
              <div>
                <p class="text-base font-bold text-slate-800">Sin registros aún</p>
                <p class="mt-1 max-w-md text-xs leading-relaxed text-slate-500">Esta vista está reservada para actividades de especialización. Cuando se agreguen registros, aparecerán aquí con el mismo formato del plan base.</p>
              </div>
              ${readOnly ? '' : `
                <button data-role="empty-new" class="inline-flex items-center gap-2 rounded-lg bg-fet-green px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-fet-darkgreen">
                  ${icon('plus-circle', 'w-4 h-4')} Crear primera actividad
                </button>`}
            </div>
          </td>
        </tr>`;
  }

  root.querySelector('[data-role="q"]').addEventListener('input', (e) => { filter.q = e.target.value; paint(); });
  root.querySelector('[data-role="tipo"]').addEventListener('change', (e) => { filter.tipo = e.target.value; paint(); });
  root.querySelector('[data-role="estado"]').addEventListener('change', (e) => { filter.estado = e.target.value; paint(); });
  root.querySelector('[data-role="periodo"]').addEventListener('change', (e) => { filter.periodo = e.target.value; paint(); });

  root.querySelector('[data-role="export"]').addEventListener('click', () => {
    const csv = toCsv([], [
      { label: 'N°', key: 'numero' }, { label: 'Actividad', key: 'nombre' }, { label: 'Línea estratégica', key: 'linea' },
      { label: 'Tipo', key: 'tipo' }, { label: 'Responsable', key: 'responsable' },
      { label: 'Fecha inicio', value: (a) => formatDate(a.fecha_inicio) }, { label: 'Fecha fin', value: (a) => formatDate(a.fecha_fin) },
      { label: '% Avance', key: 'avance' }, { label: 'Estado', key: 'estado_efectivo' }, { label: 'Observaciones', key: 'observaciones' },
    ]);
    downloadFile(`Plan_de_Especializacion_${filter.periodo === 'TODOS' ? 'todos' : filter.periodo}.csv`, csv);
    toast('Archivo CSV generado (vacío).', 'success');
  });

  const newBtn = root.querySelector('[data-role="new"]');
  if (newBtn) newBtn.addEventListener('click', () => openActivityModal({ catalogs: state.catalogs }));

  const emptyNewBtn = root.querySelector('[data-role="empty-new"]');
  if (emptyNewBtn) emptyNewBtn.addEventListener('click', () => openActivityModal({ catalogs: state.catalogs }));

  tbody.addEventListener('click', async (e) => {
    const viewId = e.target.closest('[data-view]')?.dataset.view;
    if (viewId) {
      const activity = state.activities.find((a) => a.id === Number(viewId));
      if (activity) openActivityViewModal({ activity });
    }
  });

  paint();
}
