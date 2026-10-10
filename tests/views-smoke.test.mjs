// Prueba de humo end-to-end del lado del cliente: arranca el store en modo demostración
// (localStorage, sin red) y verifica que cada vista genera HTML y se monta sin lanzar
// excepciones. No hay navegador real disponible en este entorno, así que se usa jsdom
// únicamente para tener `document`/`localStorage`; no se valida la parte visual (eso se
// prueba manualmente con `npm run dev`).
import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

before(() => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.Blob = dom.window.Blob;
  // El store crea "toast-root"/"modal-root" al usarlos; los añadimos de una vez.
  document.body.innerHTML = '<div id="toast-root"></div><div id="modal-root"></div>';
});

describe('vistas (sin gráficos de Chart.js, que requieren canvas real)', () => {
  test('el store arranca en modo demostración con datos de ejemplo', async () => {
    const store = await import('../src/state/store.js');
    await store.init();
    assert.equal(store.state.status, 'connected');
    assert.equal(store.state.mode, 'local');
    assert.equal(store.state.activities.length, 10);
    assert.ok(store.state.ui.period);
  });

  test('plan.js renderiza la tabla y permite filtrar sin errores', async () => {
    const store = await import('../src/state/store.js');
    const plan = await import('../src/views/plan.js');
    const div = document.createElement('div');
    div.innerHTML = plan.render();
    document.body.appendChild(div);
    assert.doesNotThrow(() => plan.mount(div));
    assert.ok(div.querySelectorAll('[data-row]').length >= 1);
    assert.ok(div.querySelector('[data-view]'));
    div.querySelector('[data-view]').click();
    const details = document.querySelector('#modal-root [role="dialog"]');
    assert.ok(details);
    assert.ok(details.textContent.includes('Información de la actividad'));
    assert.ok(details.textContent.includes('Informes de avance'));
    details.querySelector('[data-role="close"]').click();
    assert.equal(div.querySelector('[data-role="estado"]').value, 'ACTIVAS');
    assert.ok([...div.querySelectorAll('[data-row]')].every((row) => store.state.activities.find((activity) => String(activity.id) === row.dataset.row)?.estado !== 'Completada'));
    div.querySelector('[data-role="q"]').dispatchEvent(new window.Event('input', { bubbles: true }));
    const statusFilter = div.querySelector('[data-role="estado"]');
    statusFilter.value = 'TODOS';
    statusFilter.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(div.querySelectorAll('[data-row]').length, store.state.activities.length);
    statusFilter.value = 'Completada';
    statusFilter.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(div.querySelectorAll('[data-row]').length, store.state.activities.filter((activity) => activity.estado === 'Completada').length);
    div.remove();
    void store;
  });

  test('informe.js renderiza el historial de una actividad', async () => {
    const informe = await import('../src/views/informe.js');
    const div = document.createElement('div');
    div.innerHTML = informe.render();
    document.body.appendChild(div);
    assert.doesNotThrow(() => informe.mount(div));
    assert.ok(div.textContent.includes('Informes de avance'));
    div.remove();
  });

  test('calendario.js renderiza la grilla del mes sin errores', async () => {
    const calendario = await import('../src/views/calendario.js');
    const div = document.createElement('div');
    div.innerHTML = calendario.render();
    document.body.appendChild(div);
    assert.doesNotThrow(() => calendario.mount(div));
    div.remove();
  });

  test('reportes.js renderiza y filtra el consolidado sin errores', async () => {
    const reportes = await import('../src/views/reportes.js');
    const div = document.createElement('div');
    div.innerHTML = reportes.render();
    document.body.appendChild(div);
    assert.doesNotThrow(() => reportes.mount(div));
    div.remove();
  });

  test('configuracion.js muestra el formulario de conexión en modo demo', async () => {
    const configuracion = await import('../src/views/configuracion.js');
    const div = document.createElement('div');
    div.innerHTML = configuracion.render();
    document.body.appendChild(div);
    assert.doesNotThrow(() => configuracion.mount(div));
    assert.ok(div.querySelector('[data-role="connect-form"]'));
    div.remove();
  });

  test('dashboard.js e indicadores.js al menos generan HTML no vacío (los gráficos no se prueban aquí)', async () => {
    const dashboard = await import('../src/views/dashboard.js');
    const indicadores = await import('../src/views/indicadores.js');
    assert.ok(dashboard.render().includes('Avance general del plan'));
    assert.ok(indicadores.render().includes('Índice de cumplimiento global'));
  });
});
