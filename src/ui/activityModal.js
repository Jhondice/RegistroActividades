import { icon } from './icons.js';
import { validateActivity } from '../domain/validation.js';
import { STATUSES } from '../domain/constants.js';
import { ApiError } from '../api/errors.js';
import { toast } from './toast.js';

function opts(list, current) {
  return list.map((v) => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(v)}</option>`).join('');
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/**
 * @param {{activity?: object, catalogs: object, onSubmit: (payload:object)=>Promise<any>}} opts
 */
export function openActivityModal({ activity, catalogs, onSubmit }) {
  const root = document.getElementById('modal-root');
  const isEdit = !!activity;
  const v = activity || { periodo: catalogs.periodo[0] || '', nombre: '', tipo: '', linea: '', responsable: '', fecha_inicio: '', fecha_fin: '', avance: 0, estado: 'Programada', observaciones: '' };

  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto" data-role="backdrop">
      <div class="w-full max-w-lg rounded-2xl bg-white shadow-2xl my-8">
        <div class="flex items-center justify-between rounded-t-2xl bg-fet-green px-6 py-4 text-white">
          <h3 class="flex items-center gap-2 text-base font-bold">${icon(isEdit ? 'edit-3' : 'plus-circle', 'w-5 h-5')} ${isEdit ? `Editar actividad #${activity.numero}` : 'Registrar nueva actividad'}</h3>
          <button type="button" data-role="cancel" class="text-white/80 hover:text-white">${icon('x', 'w-5 h-5')}</button>
        </div>
        <form data-role="form" novalidate class="space-y-4 p-6 text-xs">
          <div>
            <label class="mb-1 block font-bold text-slate-700">Nombre / descripción de la actividad *</label>
            <input name="nombre" value="${esc(v.nombre)}" placeholder="Ej. Preparación de sílabos por asignatura" class="w-full rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-fet-green">
            <p data-err="nombre" class="mt-1 hidden text-[11px] font-semibold text-rose-600"></p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block font-bold text-slate-700">Periodo *</label>
              <select name="periodo" class="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-fet-green">${opts(catalogs.periodo, v.periodo)}</select>
              <p data-err="periodo" class="mt-1 hidden text-[11px] font-semibold text-rose-600"></p>
            </div>
            <div>
              <label class="mb-1 block font-bold text-slate-700">Tipo *</label>
              <select name="tipo" class="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-fet-green">${opts(catalogs.tipo, v.tipo)}</select>
              <p data-err="tipo" class="mt-1 hidden text-[11px] font-semibold text-rose-600"></p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block font-bold text-slate-700">Línea estratégica *</label>
              <select name="linea" class="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-fet-green">${opts(catalogs.linea, v.linea)}</select>
              <p data-err="linea" class="mt-1 hidden text-[11px] font-semibold text-rose-600"></p>
            </div>
            <div>
              <label class="mb-1 block font-bold text-slate-700">Responsable *</label>
              <input name="responsable" list="responsables-list" value="${esc(v.responsable)}" placeholder="Ej. Docente" class="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-fet-green">
              <datalist id="responsables-list">${catalogs.responsable.map((r) => `<option value="${esc(r)}">`).join('')}</datalist>
              <p data-err="responsable" class="mt-1 hidden text-[11px] font-semibold text-rose-600"></p>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="mb-1 block font-bold text-slate-700">Fecha inicio *</label>
              <input type="date" name="fecha_inicio" value="${esc(v.fecha_inicio)}" class="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-fet-green">
              <p data-err="fecha_inicio" class="mt-1 hidden text-[11px] font-semibold text-rose-600"></p>
            </div>
            <div>
              <label class="mb-1 block font-bold text-slate-700">Fecha fin *</label>
              <input type="date" name="fecha_fin" value="${esc(v.fecha_fin)}" class="w-full rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-fet-green">
              <p data-err="fecha_fin" class="mt-1 hidden text-[11px] font-semibold text-rose-600"></p>
            </div>
            <div>
              <label class="mb-1 block font-bold text-slate-700">% Avance</label>
              <input type="number" min="0" max="100" name="avance" value="${esc(v.avance)}" class="w-full rounded-lg border border-slate-300 p-2 text-center font-bold focus:ring-2 focus:ring-fet-green">
              <p data-err="avance" class="mt-1 hidden text-[11px] font-semibold text-rose-600"></p>
            </div>
          </div>
          <div>
            <label class="mb-1 block font-bold text-slate-700">Estado *</label>
            <select name="estado" class="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-fet-green">${opts(STATUSES, v.estado)}</select>
          </div>
          <div>
            <label class="mb-1 block font-bold text-slate-700">Observaciones</label>
            <textarea name="observaciones" rows="2" placeholder="Comentarios adicionales..." class="w-full rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-fet-green">${esc(v.observaciones)}</textarea>
          </div>
          <div class="flex items-center justify-end gap-2 border-t pt-4">
            <button type="button" data-role="cancel" class="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button type="submit" data-role="submit" class="rounded-lg bg-fet-green px-5 py-2 font-bold text-white shadow-md hover:bg-fet-darkgreen">Guardar actividad</button>
          </div>
        </form>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ''; };
  root.querySelector('[data-role="cancel"]').addEventListener('click', close);
  root.querySelector('[data-role="backdrop"]').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });

  const form = root.querySelector('[data-role="form"]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    clearErrors(form);
    const local = validateActivity(payload, catalogs);
    if (!local.ok) { showErrors(form, local.errors); return; }

    const btn = form.querySelector('[data-role="submit"]');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      await onSubmit(local.value);
      toast(isEdit ? 'Actividad actualizada correctamente.' : 'Actividad registrada correctamente.', 'success');
      close();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION' && err.fields) showErrors(form, err.fields);
      else toast(err instanceof ApiError ? err.message : 'No fue posible guardar la actividad.', 'error');
      btn.disabled = false;
      btn.textContent = 'Guardar actividad';
    }
  });
}

/**
 * Abre un modal de solo lectura para ver los detalles de una actividad
 * @param {{activity: object}} opts
 */
export function openActivityViewModal({ activity }) {
  const root = document.getElementById('modal-root');

  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto" data-role="backdrop">
      <div class="w-full max-w-lg rounded-2xl bg-white shadow-2xl my-8">
        <div class="flex items-center justify-between rounded-t-2xl bg-fet-green px-6 py-4 text-white">
          <h3 class="flex items-center gap-2 text-base font-bold">${icon('eye', 'w-5 h-5')} Actividad #${activity.numero}</h3>
          <button type="button" data-role="close" class="text-white/80 hover:text-white">${icon('x', 'w-5 h-5')}</button>
        </div>
        <div class="space-y-4 p-6 text-xs">
          <div>
            <label class="mb-1 block font-bold text-slate-700">Nombre / descripción</label>
            <p class="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-800">${esc(activity.nombre)}</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block font-bold text-slate-700">Periodo</label>
              <p class="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-600">${esc(activity.periodo)}</p>
            </div>
            <div>
              <label class="mb-1 block font-bold text-slate-700">Tipo</label>
              <p class="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-600">${esc(activity.tipo)}</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block font-bold text-slate-700">Línea estratégica</label>
              <p class="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-600">${esc(activity.linea)}</p>
            </div>
            <div>
              <label class="mb-1 block font-bold text-slate-700">Responsable</label>
              <p class="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-600">${esc(activity.responsable)}</p>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="mb-1 block font-bold text-slate-700">Fecha inicio</label>
              <p class="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-600">${activity.fecha_inicio}</p>
            </div>
            <div>
              <label class="mb-1 block font-bold text-slate-700">Fecha fin</label>
              <p class="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-600">${activity.fecha_fin}</p>
            </div>
            <div>
              <label class="mb-1 block font-bold text-slate-700">% Avance</label>
              <p class="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center font-bold text-slate-600">${activity.avance}%</p>
            </div>
          </div>
          <div>
            <label class="mb-1 block font-bold text-slate-700">Estado</label>
            <p class="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-600">${esc(activity.estado_efectivo || activity.estado)}</p>
          </div>
          <div>
            <label class="mb-1 block font-bold text-slate-700">Observaciones</label>
            <p class="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-slate-600 min-h-[60px]">${esc(activity.observaciones) || '<span class="italic text-slate-400">Sin observaciones</span>'}</p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t pt-4">
            <button type="button" data-role="close" class="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100">Cerrar</button>
          </div>
        </div>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ''; };
  root.querySelector('[data-role="close"]').addEventListener('click', close);
  root.querySelector('[data-role="backdrop"]').addEventListener('click', (e) => { if (e.target === e.currentTarget) close(); });
}

function clearErrors(form) {
  form.querySelectorAll('[data-err]').forEach((el) => { el.textContent = ''; el.classList.add('hidden'); });
}
function showErrors(form, errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const el = form.querySelector(`[data-err="${field}"]`);
    if (el) { el.textContent = message; el.classList.remove('hidden'); }
  });
}
