/**
 * Simulador mínimo de Google Apps Script + Google Sheets para ejecutar
 * backend/Code.gs, Reminders.gs y Seed.gs en Node sin desplegarlos en Google.
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Objeto "cadena": cualquier método desconocido es un no-op encadenable (setFontWeight, setBackground, ...). */
const chainable = (target) =>
  new Proxy(target, {
    get(t, prop, receiver) {
      if (prop in t) return Reflect.get(t, prop, receiver);
      if (typeof prop === 'symbol') return undefined;
      return () => receiver;
    },
  });

class Sheet {
  constructor(name) {
    this.name = name;
    this.rows = []; // matriz 2D
    this.formats = new Map(); // "r,c" -> formato
    this.maxRows = 1000;
  }
  getLastRow() {
    for (let i = this.rows.length - 1; i >= 0; i--) if ((this.rows[i] || []).some((v) => v !== '' && v != null)) return i + 1;
    return 0;
  }
  getMaxRows() { return this.maxRows; }
  getRange(row, col, nr = 1, nc = 1) {
    const sheet = this;
    return chainable({
      getValues() {
        const out = [];
        for (let r = 0; r < nr; r++) {
          const line = [];
          for (let c = 0; c < nc; c++) line.push((sheet.rows[row - 1 + r] || [])[col - 1 + c] ?? '');
          out.push(line);
        }
        return out;
      },
      setValues(vals) {
        vals.forEach((line, r) => {
          const ri = row - 1 + r;
          sheet.rows[ri] = sheet.rows[ri] || [];
          line.forEach((v, c) => {
            const fmt = sheet.formats.get(`${row + r},${col + c}`);
            // Simula la conversión automática de Sheets: sin formato '@', "=..." se evalúa como fórmula.
            sheet.rows[ri][col - 1 + c] = fmt !== '@' && typeof v === 'string' && v.startsWith('=') ? '#FORMULA!' : v;
          });
        });
        return this;
      },
      setNumberFormats(f) {
        f.forEach((line, r) => line.forEach((fmt, c) => sheet.formats.set(`${row + r},${col + c}`, fmt)));
        return this;
      },
      setNumberFormat(fmt) {
        for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) sheet.formats.set(`${row + r},${col + c}`, fmt);
        return this;
      },
    });
  }
  deleteRow(n) { this.rows.splice(n - 1, 1); }
  setFrozenRows() {}
  getSheetName() { return this.name; }
}

class Spreadsheet {
  constructor() { this.sheets = [new Sheet('Hoja 1')]; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
  getSheets() { return this.sheets; }
  getSpreadsheetTimeZone() { return 'America/Bogota'; }
}

export function createGasEnv({ withSeed = false } = {}) {
  const ss = new Spreadsheet();
  const props = new Map();
  const logs = [];
  const sentEmails = [];
  const triggers = [];

  const ctx = vm.createContext({
    console: { log() {}, error: (...a) => logs.push(a.join(' ')), warn() {} },
    Logger: { log: (m) => logs.push(String(m)) },
    Date, JSON, Math, Object, Number, String, isNaN, isFinite, Array, RegExp, Error,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: () => ss,
      getUi: () => { throw new Error('Sin UI'); },
      newDataValidation: () => chainable({ build: () => ({}) }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => props.set(k, v),
        deleteProperty: (k) => props.delete(k),
        getProperties: () => Object.fromEntries(props),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: {
      sendEmail: (to, subject, body) => sentEmails.push({ to, subject, body }),
      getRemainingDailyQuota: () => 100,
    },
    ScriptApp: {
      getProjectTriggers: () => [...triggers],
      deleteTrigger: (trigger) => {
        const index = triggers.indexOf(trigger);
        if (index !== -1) triggers.splice(index, 1);
      },
      newTrigger: (handler) => {
        const config = { handler };
        const builder = {
          timeBased() { return this; },
          everyDays(days) { config.days = days; return this; },
          atHour(hour) { config.hour = hour; return this; },
          inTimezone(timeZone) { config.timeZone = timeZone; return this; },
          create() {
            const trigger = {
              ...config,
              getHandlerFunction() { return this.handler; },
            };
            triggers.push(trigger);
            return trigger;
          },
        };
        return builder;
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (s) => ({ s, setMimeType() { return this; }, getContent() { return s; } }),
    },
    Utilities: {
      getUuid: () => randomUUID(),
      formatDate: (d, tz, fmt) => {
        const p = (n) => String(n).padStart(2, '0');
        const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        return fmt.includes('HH') ? `${date}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` : date;
      },
    },
    Session: { getScriptTimeZone: () => 'America/Bogota' },
  });

  vm.runInContext(readFileSync(resolve(root, 'backend/Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  vm.runInContext(readFileSync(resolve(root, 'backend/Reminders.gs'), 'utf8'), ctx, { filename: 'Reminders.gs' });
  if (withSeed) vm.runInContext(readFileSync(resolve(root, 'backend/Seed.gs'), 'utf8'), ctx, { filename: 'Seed.gs' });

  const run = (code) => vm.runInContext(code, ctx);

  /** Llama al Web App como lo haría el navegador y devuelve el JSON. */
  const call = (action, payload = {}, token = props.get('ADMIN_TOKEN')) => {
    ctx.__req = JSON.stringify({ action, token, payload });
    return JSON.parse(run('doPost({ postData: { contents: __req } }).getContent()'));
  };

  return { ctx, ss, props, logs, sentEmails, triggers, run, call };
}
