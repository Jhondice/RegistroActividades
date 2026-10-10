import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createGasEnv } from './helpers/gas-mock.mjs';

function setup(opts) {
  const env = createGasEnv(opts);
  env.run('setup()');
  return env;
}

describe('backend/Code.gs — instalación y autenticación', () => {
  test('setup() crea las hojas y genera tokens', () => {
    const env = setup();
    assert.ok(env.ss.getSheetByName('Actividades'));
    assert.ok(env.ss.getSheetByName('Informes'));
    assert.ok(env.ss.getSheetByName('Catalogos'));
    assert.ok(env.props.get('ADMIN_TOKEN').length >= 16);
    assert.ok(env.props.get('VIEWER_TOKEN').length >= 16);
    assert.notEqual(env.props.get('ADMIN_TOKEN'), env.props.get('VIEWER_TOKEN'));
    env.run('setup()');
  });

  test('rechaza un token inválido', () => {
    const env = setup();
    const res = env.call('bootstrap', {}, 'token-invalido-cualquiera');
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'UNAUTHORIZED');
  });

  test('el rol viewer no puede escribir', () => {
    const env = setup();
    const res = env.call('createActivity', { periodo: '2026-2', nombre: 'X', tipo: 'Académica', linea: 'Docencia', responsable: 'Docente', fecha_inicio: '2026-08-01', fecha_fin: '2026-08-02', avance: 0, estado: 'Programada' }, env.props.get('VIEWER_TOKEN'));
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'FORBIDDEN');
  });

  test('el rol viewer sí puede leer', () => {
    const env = setup();
    const res = env.call('bootstrap', {}, env.props.get('VIEWER_TOKEN'));
    assert.equal(res.ok, true);
    assert.equal(res.data.role, 'viewer');
  });

  test('sin setup(), responde NOT_SETUP', () => {
    const env = createGasEnv();
    const res = env.call('ping', {}, 'x'.repeat(20));
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'NOT_SETUP');
  });
});

describe('backend/Code.gs — recordatorios por correo', () => {
  test('instala un único activador diario a las 8:00 y se puede repetir sin duplicados', () => {
    const env = setup();
    env.run('setupActivityReminders()');
    env.run('setupActivityReminders()');

    assert.equal(env.triggers.length, 1);
    assert.equal(env.triggers[0].handler, 'sendActivityReminders');
    assert.equal(env.triggers[0].days, 1);
    assert.equal(env.triggers[0].hour, 8);
    assert.equal(env.triggers[0].timeZone, 'America/Bogota');
  });

  test('envía alertas a 3 y 1 día, excluye completadas y no duplica envíos', () => {
    const env = setup();
    const create = (nombre, fecha_fin, estado = 'En desarrollo') => env.call('createActivity', {
      periodo: '2026-2',
      nombre,
      tipo: 'Académica',
      linea: 'Docencia',
      responsable: 'Docente',
      fecha_inicio: '2026-09-01',
      fecha_fin,
      avance: estado === 'Completada' ? 100 : 50,
      estado,
      observaciones: '',
    }).data.activity;

    create('Finaliza en tres días', '2026-09-30');
    create('Finaliza mañana', '2026-09-28');
    create('Ya completada', '2026-09-30', 'Completada');

    assert.equal(env.run("sendActivityRemindersForDate_('2026-09-27')"), 2);
    assert.equal(env.sentEmails.length, 2);
    assert.ok(env.sentEmails.every((email) => email.to === 'direccion_software@fet.edu.co'));
    assert.ok(env.sentEmails.some((email) => email.subject.includes('3 días')));
    assert.ok(env.sentEmails.some((email) => email.subject.includes('1 día')));
    assert.ok(env.sentEmails.every((email) => !email.body.includes('Ya completada')));

    assert.equal(env.run("sendActivityRemindersForDate_('2026-09-27')"), 0);
    assert.equal(env.sentEmails.length, 2);

    const activity = env.call('bootstrap').data.activities.find((item) => item.nombre === 'Finaliza en tres días');
    const marker = 'REMINDER_SENT_' + activity.id + '_' + activity.creado.replace(/\D/g, '') + '_3_2026-09-30';
    assert.ok(env.props.has(marker));
    env.call('updateActivity', { id: activity.id, fecha_fin: '2026-10-01' });
    assert.ok(env.props.has(marker));
  });

  test('no envía aviso fuera de los plazos de 3 y 1 días', () => {
    const env = setup();
    env.call('createActivity', {
      periodo: '2026-2',
      nombre: 'Más adelante',
      tipo: 'Académica',
      linea: 'Docencia',
      responsable: 'Docente',
      fecha_inicio: '2026-09-01',
      fecha_fin: '2026-09-29',
      avance: 50,
      estado: 'En desarrollo',
      observaciones: '',
    });

    assert.equal(env.run("sendActivityRemindersForDate_('2026-09-27')"), 0);
    assert.equal(env.sentEmails.length, 0);
  });

  test('rechaza la fecha de ejecución con formato inválido', () => {
    const env = setup();
    assert.throws(() => env.run("sendActivityRemindersForDate_('27-09-2026')"), /AAAA-MM-DD/);
  });

  test('la autorización manual comprueba el servicio de correo sin enviar mensajes', () => {
    const env = setup();
    assert.match(env.run('authorizeActivityReminders()'), /verificada/);
    assert.equal(env.sentEmails.length, 0);
  });
});

describe('backend/Code.gs — CRUD de actividades', () => {
  const activity = () => ({ periodo: '2026-2', nombre: 'Actividad de prueba', tipo: 'Académica', linea: 'Docencia', responsable: 'Docente', fecha_inicio: '2026-08-01', fecha_fin: '2026-08-10', avance: 20, estado: 'En desarrollo', observaciones: 'obs' });

  test('crea, edita y elimina una actividad', () => {
    const env = setup();
    const created = env.call('createActivity', activity());
    assert.equal(created.ok, true);
    assert.equal(created.data.activity.numero, 1);
    const id = created.data.activity.id;

    const updated = env.call('updateActivity', { id, avance: 55, estado: 'En desarrollo' });
    assert.equal(updated.ok, true);
    assert.equal(updated.data.activity.avance, 55);

    const del = env.call('deleteActivity', { id });
    assert.equal(del.ok, true);

    const boot = env.call('bootstrap');
    assert.equal(boot.data.activities.length, 0);
  });

  test('rechaza datos inválidos con VALIDATION y detalle por campo', () => {
    const env = setup();
    const res = env.call('createActivity', { ...activity(), nombre: '' });
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'VALIDATION');
    assert.ok(res.error.fields.nombre);
  });

  test('rechaza un tipo que no existe en el catálogo', () => {
    const env = setup();
    const res = env.call('createActivity', { ...activity(), tipo: 'Inexistente' });
    assert.equal(res.ok, false);
    assert.ok(res.error.fields.tipo);
  });

  test('numera correlativamente por periodo', () => {
    const env = setup();
    env.call('createActivity', { ...activity(), periodo: '2026-2' });
    const b = env.call('createActivity', { ...activity(), periodo: '2026-2' });
    const c = env.call('createActivity', { ...activity(), periodo: '2026-1' });
    assert.equal(b.data.activity.numero, 2);
    assert.equal(c.data.activity.numero, 1); // otro periodo, reinicia
  });

  test('el estado Completada fuerza el avance a 100 (regla del servidor)', () => {
    const env = setup();
    const created = env.call('createActivity', { ...activity(), avance: 40, estado: 'Completada' });
    assert.equal(created.data.activity.avance, 100);
  });

  test('eliminar una actividad elimina también sus informes', () => {
    const env = setup();
    const created = env.call('createActivity', activity());
    const id = created.data.activity.id;
    env.call('saveReport', { actividad_id: id, fecha_reporte: '2026-08-05', avance_realizado: 'Avance parcial', porcentaje: 30, estado: 'En desarrollo' });
    const del = env.call('deleteActivity', { id });
    assert.equal(del.data.deletedReports, 1);
    const boot = env.call('bootstrap');
    assert.equal(boot.data.reports.length, 0);
  });

  test('un responsable nuevo se agrega automáticamente al catálogo', () => {
    const env = setup();
    env.call('createActivity', { ...activity(), responsable: 'Nuevo Responsable' });
    const cats = env.call('bootstrap').data.catalogs;
    assert.ok(cats.responsable.includes('Nuevo Responsable'));
  });
});

describe('backend/Code.gs — informes', () => {
  test('guardar un informe actualiza el avance y estado de la actividad', () => {
    const env = setup();
    const id = env.call('createActivity', { periodo: '2026-2', nombre: 'A', tipo: 'Académica', linea: 'Docencia', responsable: 'Docente', fecha_inicio: '2026-08-01', fecha_fin: '2026-08-20', avance: 0, estado: 'Programada' }).data.activity.id;
    const res = env.call('saveReport', { actividad_id: id, fecha_reporte: '2026-08-10', avance_realizado: 'Se avanzó bien', porcentaje: 65, estado: 'En desarrollo' });
    assert.equal(res.ok, true);
    assert.equal(res.data.activity.avance, 65);
    assert.equal(res.data.activity.estado, 'En desarrollo');
  });

  test('rechaza un informe para una actividad inexistente', () => {
    const env = setup();
    const res = env.call('saveReport', { actividad_id: 9999, fecha_reporte: '2026-08-10', avance_realizado: 'x', porcentaje: 10, estado: 'Pendiente' });
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'NOT_FOUND');
  });
});

describe('backend/Code.gs — catálogos', () => {
  test('agrega y elimina un valor de catálogo', () => {
    const env = setup();
    const add = env.call('addCatalogItem', { catalogo: 'tipo', valor: 'Extensión cultural' });
    assert.ok(add.data.catalogs.tipo.includes('Extensión cultural'));
    const del = env.call('deleteCatalogItem', { catalogo: 'tipo', valor: 'Extensión cultural' });
    assert.equal(del.ok, true);
  });

  test('no permite eliminar un valor de catálogo en uso', () => {
    const env = setup();
    env.call('createActivity', { periodo: '2026-2', nombre: 'A', tipo: 'Académica', linea: 'Docencia', responsable: 'Docente', fecha_inicio: '2026-08-01', fecha_fin: '2026-08-02', avance: 0, estado: 'Programada' });
    const del = env.call('deleteCatalogItem', { catalogo: 'tipo', valor: 'Académica' });
    assert.equal(del.ok, false);
    assert.equal(del.error.code, 'CONFLICT');
  });
});

describe('backend/Code.gs — datos de ejemplo', () => {
  test('seedDemoData() carga el mismo conjunto que src/data/seed.js', () => {
    const env = setup({ withSeed: true });
    env.run('seedDemoData()');
    const boot = env.call('bootstrap');
    assert.equal(boot.data.activities.length, 10);
    assert.equal(boot.data.reports.length, 10);
  });

  test('celdas guardadas como texto neutralizan una fórmula maliciosa', () => {
    const env = setup();
    env.call('createActivity', { periodo: '2026-2', nombre: '=HYPERLINK("http://x")', tipo: 'Académica', linea: 'Docencia', responsable: 'Docente', fecha_inicio: '2026-08-01', fecha_fin: '2026-08-02', avance: 0, estado: 'Programada' });
    const cellValue = env.ss.getSheetByName('Actividades').getRange(2, 4).getValues()[0][0];
    assert.equal(cellValue, '=HYPERLINK("http://x")'); // se guarda como texto literal, no se evalúa
  });
});
