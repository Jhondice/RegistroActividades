// Store central de la aplicación: un único lugar con la conexión activa (local o remota),
// los datos cargados y un mecanismo simple de publicación/suscripción para que las vistas
// se vuelvan a pintar cuando algo cambia. No se usa ningún framework: es intencionalmente
// pequeño y fácil de auditar.
import { createLocalClient } from '../api/localClient.js';
import { createRemoteClient } from '../api/remoteClient.js';
import { ApiError } from '../api/errors.js';

const CONN_KEY = 'fet.seguimiento.conexion.v1';
const THEME_KEY = 'fet.seguimiento.theme.v1';
const DEFAULT_REMOTE_URL = 'https://script.google.com/macros/s/AKfycbwhPFpARBKKgFqJ3oWuYSSTUXMPzDgXT8BdJKBxD8mqxODa5ycFbjT-jndKPDctsnu-/exec';

function loadSavedConnection() {
  try {
    const raw = localStorage.getItem(CONN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data.url === 'string' ? data : null;
  } catch { return null; }
}

function saveConnection(conn) {
  try {
    if (conn) localStorage.setItem(CONN_KEY, JSON.stringify(conn));
    else localStorage.removeItem(CONN_KEY);
  } catch { /* almacenamiento no disponible: la sesión sigue en memoria */ }
}

const listeners = new Set();

export const state = {
  status: 'connecting', // connecting | disconnected | connected | error
  mode: null, // 'local' | 'remote'
  role: 'viewer',
  errorMessage: '',
  activities: [],
  reports: [],
  catalogs: { periodo: [], tipo: [], linea: [], responsable: [] },
  serverTime: null,
  ui: { tab: 'dashboard', period: null, calendarDate: new Date() },
};

function loadSavedTheme() {
  try { return localStorage.getItem(THEME_KEY) || null; } catch { return null; }
}

function saveTheme(theme) {
  try { if (theme) localStorage.setItem(THEME_KEY, theme); else localStorage.removeItem(THEME_KEY); } catch { /* ignore */ }
}

function applyTheme(theme) {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  } catch { /* ignore in non-browser env */ }
}

let client = null;
let token = null;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

function setState(patch) {
  Object.assign(state, patch);
  notify();
}

/** Se llama una vez, al arrancar la aplicación. */
export async function init() {
  const saved = loadSavedConnection();
  // Inicializar tema antes de cargar vistas
  const savedTheme = loadSavedTheme();
  if (savedTheme) {
    setState({ ui: { ...state.ui, theme: savedTheme } });
    applyTheme(savedTheme);
  } else {
    // por defecto 'light'
    setState({ ui: { ...state.ui, theme: 'light' } });
    applyTheme('light');
  }
  if (saved) {
    try {
      await connectRemote(saved.url, saved.token);
      return;
    } catch {
      saveConnection(null); // credenciales u URL ya no válidas: se limpia y se cae a demo
    }
  }
  await connectLocal();
}

export function setTheme(theme) {
  setState({ ui: { ...state.ui, theme } });
  saveTheme(theme);
  applyTheme(theme);
}

export function toggleTheme() {
  const next = state.ui && state.ui.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

export async function connectLocal() {
  client = createLocalClient();
  token = null;
  setState({ status: 'connecting', mode: 'local', errorMessage: '' });
  await loadBootstrap();
}

export async function connectRemote(url, userToken) {
  const trimmed = String(url || '').trim();
  const normalizedToken = String(userToken || '').trim();
  if (!/^https:\/\/script\.google(?:usercontent)?\.com\/.*\/exec$/.test(trimmed)) {
    throw new ApiError('VALIDATION', 'La URL debe ser la de una implementación de Apps Script terminada en /exec.');
  }
  if (!normalizedToken) {
    throw new ApiError('VALIDATION', 'Ingrese un token de acceso.');
  }
  const candidate = createRemoteClient(trimmed);
  // No se notifica el estado global mientras se intenta conectar: así un intento fallido
  // no borra lo que la persona ya escribió en el formulario (ver views/configuracion.js).
  await candidate.call('ping', {}, normalizedToken);
  client = candidate;
  token = normalizedToken;
  setState({ mode: 'remote' });
  saveConnection({ url: trimmed, token: normalizedToken });
  await loadBootstrap();
}

export function disconnect() {
  saveConnection(null);
  client = null;
  token = null;
  setState({ status: 'connecting', mode: null, role: 'viewer', activities: [], reports: [] });
  connectLocal();
}

async function loadBootstrap() {
  try {
    const data = await call('bootstrap', {});
    setState({
      status: 'connected',
      role: data.role || 'viewer',
      activities: data.activities || [],
      reports: data.reports || [],
      catalogs: data.catalogs || state.catalogs,
      serverTime: data.serverTime || null,
      errorMessage: '',
      ui: { ...state.ui, period: state.ui.period || latestPeriod(data.catalogs) },
    });
  } catch (err) {
    setState({ status: 'error', errorMessage: describeError(err) });
    throw err;
  }
}

function latestPeriod(catalogs) {
  const list = catalogs && catalogs.periodo;
  return Array.isArray(list) && list.length ? list[0] : null;
}

export function defaultApiUrl() {
  try { return (import.meta.env && import.meta.env.VITE_API_URL) || DEFAULT_REMOTE_URL; } catch { return DEFAULT_REMOTE_URL; }
}

export function describeError(err) {
  if (err instanceof ApiError) return err.message;
  return 'Ocurrió un error inesperado. Intente nuevamente.';
}

/** Llamada de bajo nivel: úsela para acciones que no necesitan recargar todo el estado. */
export async function call(action, payload = {}) {
  if (!client) throw new ApiError('NOT_SETUP', 'No hay conexión activa.');
  return client.call(action, payload, token);
}

export function isReadOnly() {
  return state.role === 'viewer';
}

export function setTab(tab) {
  setState({ ui: { ...state.ui, tab } });
}

export function setPeriodFilter(period) {
  setState({ ui: { ...state.ui, period } });
}

export function setCalendarDate(date) {
  setState({ ui: { ...state.ui, calendarDate: date } });
}

// ───────────────────────────── Mutaciones (CRUD) ─────────────────────────────
// Todas actualizan el estado local de inmediato con lo que confirma el servidor,
// para no depender de una recarga completa tras cada acción.

export async function createActivity(payload) {
  const { activity } = await call('createActivity', payload);
  setState({ activities: [...state.activities, activity] });
  return activity;
}

export async function updateActivity(id, payload) {
  const { activity } = await call('updateActivity', { id, ...payload });
  setState({ activities: state.activities.map((a) => (a.id === activity.id ? activity : a)) });
  return activity;
}

export async function deleteActivity(id) {
  await call('deleteActivity', { id });
  setState({
    activities: state.activities.filter((a) => a.id !== id),
    reports: state.reports.filter((r) => r.actividad_id !== id),
  });
}

export async function saveReport(payload) {
  const { report, activity } = await call('saveReport', payload);
  setState({
    reports: [...state.reports, report],
    activities: state.activities.map((a) => (a.id === activity.id ? activity : a)),
  });
  return { report, activity };
}

export async function deleteReport(id) {
  await call('deleteReport', { id });
  setState({ reports: state.reports.filter((r) => r.id !== id) });
}

export async function addCatalogItem(catalogo, valor) {
  const { catalogs } = await call('addCatalogItem', { catalogo, valor });
  setState({ catalogs });
}

export async function deleteCatalogItem(catalogo, valor) {
  const { catalogs } = await call('deleteCatalogItem', { catalogo, valor });
  setState({ catalogs });
}
