/**
 * =====================================================================
 *  Gestion de actividades — FET
 *  Backend: Google Apps Script (Web App) + Google Sheets como base de datos
 * =====================================================================
 *
 *  Contrato de la API (todas las llamadas son POST con cuerpo JSON,
 *  enviado como text/plain para evitar el preflight CORS):
 *
 *    { "action": "bootstrap", "token": "<TOKEN>", "payload": { ... } }
 *
 *  Respuesta:
 *    { "ok": true,  "data": { ... } }
 *    { "ok": false, "error": { "code": "VALIDATION", "message": "...", "fields": { ... } } }
 *
 *  Acciones:
 *    ping · bootstrap
 *    createActivity · updateActivity · deleteActivity
 *    saveReport · deleteReport
 *    addCatalogItem · deleteCatalogItem
 *
 *  Seguridad:
 *    - ADMIN_TOKEN  (Propiedades del script): lectura + escritura.
 *    - VIEWER_TOKEN (Propiedades del script): solo lectura.
 *    - Las hojas NO se publican: solo este script las lee/escribe.
 *    - Escrituras serializadas con LockService (sin condiciones de carrera).
 *    - Validación completa en servidor (no se confía en el navegador).
 *    - Celdas guardadas como texto plano: neutraliza inyección de fórmulas.
 */

const APP_VERSION = '1.0.0';

const SHEET = { ACT: 'Actividades', REP: 'Informes', CAT: 'Catalogos', LOG: 'Bitacora' };

const COLS = {
  ACT: ['id', 'periodo', 'numero', 'nombre', 'tipo', 'linea', 'responsable', 'fecha_inicio', 'fecha_fin', 'avance', 'estado', 'observaciones', 'creado', 'actualizado'],
  REP: ['id', 'actividad_id', 'fecha_reporte', 'avance_realizado', 'dificultades', 'resultados', 'acciones_siguientes', 'porcentaje', 'estado', 'proxima_revision', 'autor', 'creado'],
  CAT: ['catalogo', 'valor'],
  LOG: ['fecha', 'rol', 'accion', 'entidad', 'entidad_id', 'detalle'],
};
const NUMERIC = {
  ACT: ['id', 'numero', 'avance'],
  REP: ['id', 'actividad_id', 'porcentaje'],
  CAT: [],
  LOG: [],
};
const DATE_KEYS = ['fecha_inicio', 'fecha_fin', 'fecha_reporte', 'proxima_revision'];

const ESTADOS = ['Programada', 'Pendiente', 'En desarrollo', 'Completada', 'Atrasada'];
const CATALOG_KEYS = ['periodo', 'tipo', 'linea', 'responsable'];
const EDITABLE_ACT = ['periodo', 'nombre', 'tipo', 'linea', 'responsable', 'fecha_inicio', 'fecha_fin', 'avance', 'estado', 'observaciones'];
const LIMITS = { nombre: 200, corto: 80, texto: 2000, obs: 1000, payload: 100000 };

const DEFAULT_CATALOGS = {
  periodo: ['2026-2', '2026-1', '2025-2'],
  tipo: ['Académica', 'Investigación', 'Administrativa', 'Proyección social', 'Capacitación'],
  linea: ['Docencia', 'Investigación', 'Extensión', 'Gestión académica', 'Desarrollo profesoral'],
  responsable: ['Docente', 'Coordinación', 'Dirección de Programa'],
};

let CURRENT_ROLE_ = '';

/* ===================================================================
 *  Puntos de entrada del Web App
 * =================================================================== */

/** GET: solo un "health check" público (no expone datos). */
function doGet() {
  return json_({ ok: true, data: { service: 'fet-seguimiento', version: APP_VERSION } });
}

/** POST: enrutador de la API. */
function doPost(e) {
  let req;
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw) throw new AppError_('BAD_REQUEST', 'Solicitud vacía.');
    if (raw.length > LIMITS.payload) throw new AppError_('PAYLOAD_TOO_LARGE', 'La solicitud es demasiado grande.');
    try { req = JSON.parse(raw); } catch (err) { throw new AppError_('BAD_REQUEST', 'JSON inválido.'); }
  } catch (err) {
    return json_(fail_(err));
  }
  return json_(route_(req));
}

const ACTIONS_ = {
  ping: { write: false, fn: function (p, ctx) { return { pong: true, version: APP_VERSION, role: ctx.role }; } },
  bootstrap: { write: false, fn: bootstrap_ },
  createActivity: { write: true, fn: createActivity_ },
  updateActivity: { write: true, fn: updateActivity_ },
  deleteActivity: { write: true, fn: deleteActivity_ },
  saveReport: { write: true, fn: saveReport_ },
  deleteReport: { write: true, fn: deleteReport_ },
  addCatalogItem: { write: true, fn: addCatalogItem_ },
  deleteCatalogItem: { write: true, fn: deleteCatalogItem_ },
};

function route_(req) {
  try {
    const def = req && ACTIONS_.hasOwnProperty(req.action) ? ACTIONS_[req.action] : null;
    if (!def) throw new AppError_('BAD_REQUEST', 'Acción desconocida.');

    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('ADMIN_TOKEN')) {
      throw new AppError_('NOT_SETUP', 'El backend no está configurado. Ejecute setup() en Apps Script.');
    }
    const role = authenticate_(req.token);
    if (!role) throw new AppError_('UNAUTHORIZED', 'Token de acceso inválido.');
    if (def.write && role !== 'admin') throw new AppError_('FORBIDDEN', 'Su rol es de solo lectura.');
    CURRENT_ROLE_ = role;

    const ctx = { role: role };
    const payload = req.payload && typeof req.payload === 'object' ? req.payload : {};
    let data;
    if (def.write) {
      const lock = LockService.getScriptLock();
      try { lock.waitLock(20000); } catch (err) { throw new AppError_('BUSY', 'El servidor está ocupado. Intente de nuevo.'); }
      try { data = def.fn(payload, ctx); } finally { lock.releaseLock(); }
    } else {
      data = def.fn(payload, ctx);
    }
    return { ok: true, data: data };
  } catch (err) {
    return fail_(err);
  }
}

/* ===================================================================
 *  Acciones
 * =================================================================== */

function bootstrap_(p, ctx) {
  return {
    role: ctx.role,
    version: APP_VERSION,
    serverTime: nowIso_(),
    activities: readAll_('ACT'),
    reports: readAll_('REP'),
    catalogs: readCatalogs_(),
  };
}

function createActivity_(p) {
  const cats = readCatalogs_();
  const v = validateActivity_(p, cats);
  const acts = readAll_('ACT');
  const ts = nowIso_();
  const rec = Object.assign({
    id: nextId_(acts),
    numero: nextNumero_(acts, v.periodo),
    creado: ts,
    actualizado: ts,
  }, v);
  appendRecord_('ACT', rec);
  ensureCatalogValue_('responsable', v.responsable, cats);
  audit_('crear', 'actividad', rec.id, v.nombre);
  return { activity: rec };
}

function updateActivity_(p) {
  const found = findRecord_('ACT', Number(p.id));
  if (!found) throw new AppError_('NOT_FOUND', 'La actividad no existe (¿fue eliminada?).');
  const merged = {};
  EDITABLE_ACT.forEach(function (k) { merged[k] = Object.prototype.hasOwnProperty.call(p, k) ? p[k] : found.rec[k]; });
  const cats = readCatalogs_();
  const v = validateActivity_(merged, cats);
  const rec = Object.assign({}, found.rec, v, { actualizado: nowIso_() });
  if (v.periodo !== found.rec.periodo) rec.numero = nextNumero_(readAll_('ACT'), v.periodo);
  writeRow_('ACT', found.row, rec);
  ensureCatalogValue_('responsable', v.responsable, cats);
  audit_('editar', 'actividad', rec.id, v.nombre);
  return { activity: rec };
}

function deleteActivity_(p) {
  const id = Number(p.id);
  const found = findRecord_('ACT', id);
  if (!found) throw new AppError_('NOT_FOUND', 'La actividad no existe (¿ya fue eliminada?).');
  getSheet_('ACT').deleteRow(found.row);
  // Eliminación en cascada de sus informes (de abajo hacia arriba para no desplazar filas).
  const reps = readRows_('REP').filter(function (r) { return r.rec.actividad_id === id; });
  reps.sort(function (a, b) { return b.row - a.row; });
  const repSheet = getSheet_('REP');
  reps.forEach(function (r) { repSheet.deleteRow(r.row); });
  audit_('eliminar', 'actividad', id, found.rec.nombre + ' (+' + reps.length + ' informes)');
  return { id: id, deletedReports: reps.length };
}

function saveReport_(p) {
  const v = validateReport_(p);
  const found = findRecord_('ACT', v.actividad_id);
  if (!found) throw new AppError_('NOT_FOUND', 'La actividad del informe no existe.');
  const ts = nowIso_();
  const report = Object.assign({ id: nextId_(readAll_('REP')), creado: ts }, v);
  appendRecord_('REP', report);
  // El informe actualiza el avance y el estado vigentes de la actividad (misma transacción/lock).
  const activity = Object.assign({}, found.rec, { avance: v.porcentaje, estado: v.estado, actualizado: ts });
  writeRow_('ACT', found.row, activity);
  audit_('crear', 'informe', report.id, 'Actividad ' + v.actividad_id + ' · ' + v.porcentaje + '%');
  return { report: report, activity: activity };
}

function deleteReport_(p) {
  const id = Number(p.id);
  const found = findRecord_('REP', id);
  if (!found) throw new AppError_('NOT_FOUND', 'El informe no existe (¿ya fue eliminado?).');
  getSheet_('REP').deleteRow(found.row);
  audit_('eliminar', 'informe', id, 'Actividad ' + found.rec.actividad_id);
  return { id: id };
}

function addCatalogItem_(p) {
  const key = str_(p.catalogo);
  const value = str_(p.valor);
  if (CATALOG_KEYS.indexOf(key) === -1) throw new AppError_('VALIDATION', 'Catálogo no válido.');
  if (!value || value.length > LIMITS.corto) throw new AppError_('VALIDATION', 'El valor es obligatorio (máx. ' + LIMITS.corto + ' caracteres).');
  const cats = readCatalogs_();
  if (hasValue_(cats[key], value)) throw new AppError_('CONFLICT', '"' + value + '" ya existe en este catálogo.');
  appendRecord_('CAT', { catalogo: key, valor: value });
  audit_('crear', 'catalogo', key, value);
  return { catalogs: readCatalogs_() };
}

function deleteCatalogItem_(p) {
  const key = str_(p.catalogo);
  const value = str_(p.valor);
  if (CATALOG_KEYS.indexOf(key) === -1) throw new AppError_('VALIDATION', 'Catálogo no válido.');
  const inUse = readAll_('ACT').filter(function (a) { return a[key] === value; }).length;
  if (inUse > 0) {
    throw new AppError_('CONFLICT', '"' + value + '" está en uso por ' + inUse + ' actividad(es). Reasígnelas antes de eliminarlo.');
  }
  const rows = readRows_('CAT').filter(function (r) { return r.rec.catalogo === key && r.rec.valor === value; });
  if (!rows.length) throw new AppError_('NOT_FOUND', 'El valor no existe.');
  rows.sort(function (a, b) { return b.row - a.row; });
  rows.forEach(function (r) { getSheet_('CAT').deleteRow(r.row); });
  audit_('eliminar', 'catalogo', key, value);
  return { catalogs: readCatalogs_() };
}

/* ===================================================================
 *  Validación (espejo de src/domain/validation.js)
 * =================================================================== */

function validateActivity_(input, cats) {
  const v = {
    periodo: str_(input.periodo),
    nombre: str_(input.nombre),
    tipo: str_(input.tipo),
    linea: str_(input.linea),
    responsable: str_(input.responsable),
    fecha_inicio: str_(input.fecha_inicio),
    fecha_fin: str_(input.fecha_fin),
    avance: percent_(input.avance),
    estado: str_(input.estado),
    observaciones: str_(input.observaciones),
  };
  if (v.estado === 'Completada') v.avance = 100;
  const errors = {};
  if (!v.periodo) errors.periodo = 'Seleccione el periodo.';
  if (!v.nombre) errors.nombre = 'El nombre es obligatorio.';
  else if (v.nombre.length > LIMITS.nombre) errors.nombre = 'Máximo ' + LIMITS.nombre + ' caracteres.';
  if (!v.tipo) errors.tipo = 'Seleccione el tipo.';
  if (!v.linea) errors.linea = 'Seleccione la línea estratégica.';
  if (!v.responsable) errors.responsable = 'El responsable es obligatorio.';
  else if (v.responsable.length > LIMITS.corto) errors.responsable = 'Máximo ' + LIMITS.corto + ' caracteres.';
  if (!isISODate_(v.fecha_inicio)) errors.fecha_inicio = 'Fecha inválida.';
  if (!isISODate_(v.fecha_fin)) errors.fecha_fin = 'Fecha inválida.';
  if (!errors.fecha_inicio && !errors.fecha_fin && v.fecha_fin < v.fecha_inicio) errors.fecha_fin = 'La fecha fin no puede ser anterior al inicio.';
  if (isNaN(v.avance)) errors.avance = 'Ingrese un número entre 0 y 100.';
  if (ESTADOS.indexOf(v.estado) === -1) errors.estado = 'Estado no válido.';
  if (v.observaciones.length > LIMITS.obs) errors.observaciones = 'Máximo ' + LIMITS.obs + ' caracteres.';
  ['periodo', 'tipo', 'linea'].forEach(function (k) {
    if (!errors[k] && !hasValue_(cats[k], v[k])) errors[k] = '"' + v[k] + '" no existe en el catálogo.';
  });
  throwIfErrors_(errors);
  return v;
}

function validateReport_(input) {
  const v = {
    actividad_id: Number(input.actividad_id),
    fecha_reporte: str_(input.fecha_reporte),
    avance_realizado: str_(input.avance_realizado),
    dificultades: str_(input.dificultades),
    resultados: str_(input.resultados),
    acciones_siguientes: str_(input.acciones_siguientes),
    porcentaje: percent_(input.porcentaje),
    estado: str_(input.estado),
    proxima_revision: str_(input.proxima_revision),
    autor: str_(input.autor),
  };
  if (v.estado === 'Completada') v.porcentaje = 100;
  const errors = {};
  if (!(v.actividad_id > 0 && Math.floor(v.actividad_id) === v.actividad_id)) errors.actividad_id = 'Seleccione una actividad.';
  if (!isISODate_(v.fecha_reporte)) errors.fecha_reporte = 'Fecha de reporte inválida.';
  if (!v.avance_realizado) errors.avance_realizado = 'Describa el avance realizado.';
  ['avance_realizado', 'dificultades', 'resultados', 'acciones_siguientes'].forEach(function (k) {
    if (v[k].length > LIMITS.texto) errors[k] = 'Máximo ' + LIMITS.texto + ' caracteres.';
  });
  if (isNaN(v.porcentaje)) errors.porcentaje = 'Ingrese un número entre 0 y 100.';
  if (ESTADOS.indexOf(v.estado) === -1) errors.estado = 'Estado no válido.';
  if (v.proxima_revision && !isISODate_(v.proxima_revision)) errors.proxima_revision = 'Fecha inválida.';
  if (v.autor.length > LIMITS.corto) errors.autor = 'Máximo ' + LIMITS.corto + ' caracteres.';
  throwIfErrors_(errors);
  return v;
}

function throwIfErrors_(errors) {
  const keys = Object.keys(errors);
  if (keys.length) {
    const e = new AppError_('VALIDATION', 'Datos inválidos: ' + keys.map(function (k) { return errors[k]; }).join(' '));
    e.fields = errors;
    throw e;
  }
}

/* ===================================================================
 *  Acceso a datos (Google Sheets)
 * =================================================================== */

function getSS_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new AppError_('NOT_SETUP', 'No hay hoja vinculada. Cree el script desde Extensiones > Apps Script o defina la propiedad SHEET_ID.');
  return ss;
}

function getSheet_(key) {
  const sh = getSS_().getSheetByName(SHEET[key]);
  if (!sh) throw new AppError_('NOT_SETUP', 'Falta la hoja "' + SHEET[key] + '". Ejecute setup() en Apps Script.');
  return sh;
}

function normalizeCell_(v, key, col, tz) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, tz, DATE_KEYS.indexOf(col) !== -1 ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ss");
  }
  if (NUMERIC[key].indexOf(col) !== -1) {
    const n = Number(v);
    return v === '' || isNaN(n) ? 0 : n;
  }
  return v === null || v === undefined ? '' : String(v);
}

/** Devuelve [{row, rec}] donde row es el nº de fila real en la hoja. */
function readRows_(key) {
  const sh = getSheet_(key);
  const cols = COLS[key];
  const last = sh.getLastRow();
  if (last < 2) return [];
  const tz = getSS_().getSpreadsheetTimeZone();
  const values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  const out = [];
  values.forEach(function (row, i) {
    if (row[0] === '' || row[0] === null) return; // fila vacía / sin clave
    const rec = {};
    cols.forEach(function (c, j) { rec[c] = normalizeCell_(row[j], key, c, tz); });
    out.push({ row: i + 2, rec: rec });
  });
  return out;
}

function readAll_(key) {
  return readRows_(key).map(function (r) { return r.rec; });
}

function findRecord_(key, id) {
  if (!(id > 0)) return null;
  const hit = readRows_(key).filter(function (r) { return r.rec.id === id; })[0];
  return hit || null;
}

function writeRow_(key, row, rec) {
  const cols = COLS[key];
  const range = getSheet_(key).getRange(row, 1, 1, cols.length);
  // Formato antes de escribir: '@' = texto plano (evita fórmulas y conversión automática de fechas).
  range.setNumberFormats([cols.map(function (c) { return NUMERIC[key].indexOf(c) !== -1 ? '0' : '@'; })]);
  range.setValues([cols.map(function (c) { return rec[c] === undefined || rec[c] === null ? '' : rec[c]; })]);
}

function appendRecord_(key, rec) {
  writeRow_(key, getSheet_(key).getLastRow() + 1, rec);
}

function nextId_(list) {
  return list.reduce(function (m, r) { return Math.max(m, r.id); }, 0) + 1;
}

function nextNumero_(acts, periodo) {
  return acts.filter(function (a) { return a.periodo === periodo; }).reduce(function (m, a) { return Math.max(m, a.numero); }, 0) + 1;
}

function readCatalogs_() {
  const out = {};
  CATALOG_KEYS.forEach(function (k) { out[k] = []; });
  readAll_('CAT').forEach(function (r) {
    if (out[r.catalogo] && r.valor !== '') out[r.catalogo].push(r.valor);
  });
  return out;
}

function ensureCatalogValue_(key, value, cats) {
  if (!hasValue_(cats[key], value)) {
    appendRecord_('CAT', { catalogo: key, valor: value });
    cats[key].push(value);
  }
}

function hasValue_(list, value) {
  const needle = String(value).toLowerCase();
  return (list || []).some(function (x) { return String(x).toLowerCase() === needle; });
}

function audit_(accion, entidad, entidadId, detalle) {
  try {
    appendRecord_('LOG', { fecha: nowIso_(), rol: CURRENT_ROLE_ || 'sistema', accion: accion, entidad: entidad, entidad_id: String(entidadId), detalle: String(detalle || '').slice(0, 300) });
  } catch (err) {
    console.error('audit_: ' + err);
  }
}

/* ===================================================================
 *  Utilidades
 * =================================================================== */

class AppError_ extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail_(err) {
  if (err instanceof AppError_) {
    const e = { code: err.code, message: err.message };
    if (err.fields) e.fields = err.fields;
    return { ok: false, error: e };
  }
  console.error(err && err.stack ? err.stack : String(err));
  return { ok: false, error: { code: 'INTERNAL', message: 'Error interno del servidor.' } };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

function percent_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Math.round(Number(v));
  return isFinite(n) ? Math.min(100, Math.max(0, n)) : NaN;
}

function isISODate_(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function nowIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function authenticate_(token) {
  if (typeof token !== 'string' || token.length < 16) return null;
  const p = PropertiesService.getScriptProperties();
  const admin = p.getProperty('ADMIN_TOKEN');
  const viewer = p.getProperty('VIEWER_TOKEN');
  if (admin && safeEq_(token, admin)) return 'admin';
  if (viewer && safeEq_(token, viewer)) return 'viewer';
  return null;
}

/** Comparación en tiempo constante (evita ataques de temporización). */
function safeEq_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function newToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

/* ===================================================================
 *  Instalación y administración (se ejecutan desde el editor o el menú de la hoja)
 * =================================================================== */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('FET Seguimiento')
      .addItem('1. Configurar hojas y tokens (setup)', 'setup')
      .addItem('Mostrar tokens de acceso', 'showTokens')
      .addItem('Regenerar tokens', 'rotateTokens')
      .addItem('Configurar recordatorios diarios', 'setupActivityReminders')
      .addItem('Autorizar recordatorios por correo', 'authorizeActivityReminders')
      .addSeparator()
      .addItem('Cargar datos de ejemplo', 'seedDemoData')
      .addToUi();
  } catch (err) { /* no hay UI disponible (ejecución desde el editor) */ }
}

/** Crea las hojas con sus encabezados, catálogos por defecto y los tokens. Es idempotente. */
function setup() {
  Object.keys(SHEET).forEach(ensureSheet_);

  if (readAll_('CAT').length === 0) {
    CATALOG_KEYS.forEach(function (k) {
      DEFAULT_CATALOGS[k].forEach(function (v) { appendRecord_('CAT', { catalogo: k, valor: v }); });
    });
  }

  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('ADMIN_TOKEN')) p.setProperty('ADMIN_TOKEN', newToken_());
  if (!p.getProperty('VIEWER_TOKEN')) p.setProperty('VIEWER_TOKEN', newToken_());

  // Elimina la hoja vacía por defecto ("Hoja 1" / "Sheet1") si existe.
  try {
    const ss = getSS_();
    ['Hoja 1', 'Sheet1'].forEach(function (name) {
      const sh = ss.getSheetByName(name);
      if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
    });
  } catch (err) { /* opcional */ }

  return showTokens();
}

function ensureSheet_(key) {
  const ss = getSS_();
  const cols = COLS[key];
  const sh = ss.getSheetByName(SHEET[key]) || ss.insertSheet(SHEET[key]);
  sh.getRange(1, 1, 1, cols.length).setNumberFormats([cols.map(function () { return '@'; })]);
  sh.getRange(1, 1, 1, cols.length).setValues([cols]);
  try {
    sh.getRange(1, 1, 1, cols.length).setFontWeight('bold').setFontColor('#ffffff').setBackground('#005C29');
    sh.setFrozenRows(1);
    const rows = Math.max(sh.getMaxRows() - 1, 1);
    cols.forEach(function (c, i) {
      sh.getRange(2, i + 1, rows, 1).setNumberFormat(NUMERIC[key].indexOf(c) !== -1 ? '0' : '@');
    });
    if (COLS[key].indexOf('estado') !== -1) {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build();
      sh.getRange(2, cols.indexOf('estado') + 1, rows, 1).setDataValidation(rule);
    }
  } catch (err) { /* cosmético: no debe bloquear la instalación */ }
  return sh;
}

/** Muestra (y registra en el log) los tokens vigentes. */
function showTokens() {
  const p = PropertiesService.getScriptProperties();
  const msg =
    'ADMIN_TOKEN (ver y editar):\n' + p.getProperty('ADMIN_TOKEN') +
    '\n\nVIEWER_TOKEN (solo lectura):\n' + p.getProperty('VIEWER_TOKEN') +
    '\n\nGuárdelos en un lugar seguro. No los publique en GitHub.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('Tokens de acceso', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (err) { /* sin UI */ }
  return msg;
}

/** Invalida los tokens actuales y genera nuevos. */
function rotateTokens() {
  const p = PropertiesService.getScriptProperties();
  p.setProperty('ADMIN_TOKEN', newToken_());
  p.setProperty('VIEWER_TOKEN', newToken_());
  return showTokens();
}

/** Carga actividades e informes de ejemplo (solo si no hay actividades). Requiere Seed.gs. */
function seedDemoData() {
  if (typeof SEED_ === 'undefined') throw new Error('Falta el archivo Seed.gs en el proyecto de Apps Script.');
  if (readAll_('ACT').length > 0) {
    const msg = 'La hoja ya contiene actividades; no se cargaron datos de ejemplo.';
    Logger.log(msg);
    try { SpreadsheetApp.getUi().alert(msg); } catch (err) { /* sin UI */ }
    return msg;
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    CURRENT_ROLE_ = 'sistema';
    SEED_.activities.forEach(function (a) { appendRecord_('ACT', a); });
    SEED_.reports.forEach(function (r) { appendRecord_('REP', r); });
    audit_('seed', 'sistema', '-', SEED_.activities.length + ' actividades / ' + SEED_.reports.length + ' informes');
  } finally {
    lock.releaseLock();
  }
  const done = 'Se cargaron ' + SEED_.activities.length + ' actividades y ' + SEED_.reports.length + ' informes de ejemplo.';
  Logger.log(done);
  try { SpreadsheetApp.getUi().alert(done); } catch (err) { /* sin UI */ }
  return done;
}
