import './styles.css';
import { icon } from './ui/icons.js';
import { state, subscribe, init, setTab, setPeriodFilter, describeError, toggleTheme } from './state/store.js';
import { destroyAllCharts } from './services/charts.js';
import * as dashboard from './views/dashboard.js';
import * as plan from './views/plan.js';
import * as planEspecializacion from './views/plan-especializacion.js';
import * as informe from './views/informe.js';
import * as calendario from './views/calendario.js';
import * as indicadores from './views/indicadores.js';
import * as reportes from './views/reportes.js';
import * as configuracion from './views/configuracion.js';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', view: dashboard },
  { id: 'plan', label: 'Plan de actividades', icon: 'list-checks', view: plan },
  { id: 'plan-especializacion', label: 'Plan de Especialización', icon: 'list-checks', view: planEspecializacion, accent: 'violet' },
  { id: 'informe', label: 'Informes', icon: 'file-text', view: informe },
  { id: 'calendario', label: 'Calendario', icon: 'calendar', view: calendario },
  { id: 'indicadores', label: 'Indicadores', icon: 'line-chart', view: indicadores },
  { id: 'reportes', label: 'Reportes', icon: 'printer', view: reportes },
  { id: 'configuracion', label: 'Configuración', icon: 'sliders', view: configuracion },
];

const app = document.getElementById('app');

function shellHtml() {
  const isLocal = state.mode === 'local';
  return `
    <header class="border-b border-slate-200 bg-white shadow-sm">
      <div class="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div class="flex items-center gap-3">
          <div class="grid h-11 w-11 place-items-center rounded-xl bg-fet-green text-sm font-black text-white shadow">FET</div>
          <div>
            <h1 class="text-sm font-bold leading-tight text-slate-800 sm:text-base">Gestión de actividades</h1>
            <p class="text-[11px] leading-tight text-slate-500">Plan de trabajo docente — Fundación Escuela Tecnológica de Neiva</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <select data-role="period-select" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-fet-green">
            ${state.catalogs.periodo.map((p) => `<option value="${p}" ${p === state.ui.period ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          <span title="${isLocal ? 'Modo demostración (datos locales)' : `Conectado · rol ${state.role}`}" class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${isLocal ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}">
            ${icon(isLocal ? 'cloud-off' : 'cloud', 'w-3.5 h-3.5')} ${isLocal ? 'Demostración' : 'Google Sheets'}
          </span>
        </div>
      </div>
      <nav class="scrollbar-none mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 sm:px-6" data-role="nav">
        ${TABS.map((t) => {
          const isActive = state.ui.tab === t.id;
          const activeClass = t.accent === 'violet'
            ? (isActive ? 'border-violet-500 text-violet-700 bg-violet-50' : 'border-transparent text-slate-500 hover:text-violet-700 hover:bg-violet-50')
            : (isActive ? 'border-fet-green text-fet-green' : 'border-transparent text-slate-500 hover:text-slate-700');
          return `
          <button data-tab="${t.id}" class="flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-bold transition-colors ${activeClass}">
            ${icon(t.icon, 'w-4 h-4')} ${t.label}
          </button>`;
        }).join('')}
        <div class="flex ml-auto">
          <button data-role="theme-toggle" title="Alternar tema" class="rounded-full border px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-50">
            ${state.ui.theme === 'dark' ? `${icon('moon', 'w-4 h-4 inline-block align-middle mr-1')}Oscuro` : `${icon('sun', 'w-4 h-4 inline-block align-middle mr-1')}Claro`}
          </button>
        </div>
      </nav>
    </header>
    <main class="mx-auto max-w-[1400px] px-4 py-6 sm:px-6" id="view-root"></main>
    <footer class="mx-auto max-w-[1400px] px-4 pb-8 pt-2 text-center text-[11px] text-slate-400 sm:px-6">
      Fundación Escuela Tecnológica de Neiva "Jesús Oviedo Pérez" · Código abierto en GitHub
      · Datos ${isLocal ? 'almacenados localmente (modo demostración)' : 'sincronizados con Google Sheets'}
    </footer>`;
}

function splashHtml(kind) {
  if (kind === 'connecting') {
    return `<div class="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-500">
      ${icon('loader-circle', 'w-8 h-8 animate-spin text-fet-green')}
      <p class="text-sm font-semibold">Cargando información del plan de trabajo…</p>
    </div>`;
  }
  return `<div class="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center text-slate-600">
    <span class="text-rose-500">${icon('triangle-alert', 'w-10 h-10')}</span>
    <p class="max-w-sm text-sm font-semibold">${state.errorMessage || 'No fue posible cargar la información.'}</p>
    <button data-role="retry" class="mt-2 rounded-lg bg-fet-green px-4 py-2 text-xs font-bold text-white shadow hover:bg-fet-darkgreen">Reintentar</button>
  </div>`;
}

let currentTab = null;

function paint() {
  if (state.status !== 'connected') {
    app.innerHTML = splashHtml(state.status);
    const retry = app.querySelector('[data-role="retry"]');
    if (retry) retry.addEventListener('click', () => location.reload());
    currentTab = null;
    return;
  }

  const tabChanged = currentTab !== state.ui.tab;
  if (tabChanged || !document.getElementById('view-root')) {
    app.innerHTML = shellHtml();
    wireShell();
    currentTab = state.ui.tab;
  } else {
    // Sólo se refresca la barra de periodo/estado cuando cambian los datos, sin recrear toda la cabecera.
    const periodSelect = document.querySelector('[data-role="period-select"]');
    if (periodSelect) periodSelect.innerHTML = state.catalogs.periodo.map((p) => `<option value="${p}" ${p === state.ui.period ? 'selected' : ''}>${p}</option>`).join('');
    const themeBtn = document.querySelector('[data-role="theme-toggle"]');
    if (themeBtn) themeBtn.innerHTML = state.ui.theme === 'dark' ? `${icon('moon', 'w-4 h-4 inline-block align-middle mr-1')}Oscuro` : `${icon('sun', 'w-4 h-4 inline-block align-middle mr-1')}Claro`;
  }

  const tab = TABS.find((t) => t.id === state.ui.tab) || TABS[0];
  const root = document.getElementById('view-root');
  destroyAllCharts();
  root.innerHTML = tab.view.render();
  tab.view.mount(root);
}

function wireShell() {
  document.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  const periodSelect = document.querySelector('[data-role="period-select"]');
  if (periodSelect) periodSelect.addEventListener('change', (e) => setPeriodFilter(e.target.value));
  const themeBtn = document.querySelector('[data-role="theme-toggle"]');
  if (themeBtn) themeBtn.addEventListener('click', () => toggleTheme());
}

subscribe(paint);
paint();
init().catch((err) => console.error('Error al iniciar la aplicación:', describeError(err)));
