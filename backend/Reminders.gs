const REMINDER_EMAIL = 'direccion_software@fet.edu.co';
const REMINDER_DAYS = [3, 1];
const REMINDER_HOUR = 8;

/** Instala un único activador diario para enviar recordatorios de actividades. */
function setupActivityReminders() {
  const handler = 'sendActivityReminders';
  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  triggers.forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyDays(1)
    .atHour(REMINDER_HOUR)
    .inTimezone(Session.getScriptTimeZone())
    .create();
  const msg = 'Activador diario de recordatorios configurado para las ' + REMINDER_HOUR + ':00.';
  Logger.log(msg);
  return msg;
}

/** Fuerza la autorización del servicio de correo sin enviar mensajes. */
function authorizeActivityReminders() {
  const quota = MailApp.getRemainingDailyQuota();
  const msg = 'Autorización de correo verificada. Destinatarios disponibles hoy: ' + quota;
  Logger.log(msg);
  return msg;
}

/** Función invocada diariamente por Apps Script; también puede ejecutarse manualmente. */
function sendActivityReminders() {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return sendActivityRemindersForDate_(today);
}

function sendActivityRemindersForDate_(today) {
  if (!isISODate_(today)) throw new Error('La fecha de ejecución debe tener formato AAAA-MM-DD.');

  const props = PropertiesService.getScriptProperties();
  let sent = 0;
  readAll_('ACT').forEach(function (activity) {
    if (activity.estado === 'Completada' || !isISODate_(activity.fecha_fin)) return;

    const daysRemaining = Math.round((new Date(activity.fecha_fin + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000);
    if (REMINDER_DAYS.indexOf(daysRemaining) === -1) return;

    const created = String(activity.creado || '').replace(/\D/g, '');
    const marker = 'REMINDER_SENT_' + activity.id + '_' + created + '_' + daysRemaining + '_' + activity.fecha_fin;
    if (props.getProperty(marker)) return;

    const subject = 'Recordatorio: actividad #' + activity.numero + ' finaliza en ' + daysRemaining + (daysRemaining === 1 ? ' día' : ' días');
    const body = [
      'La siguiente actividad está próxima a finalizar:',
      '',
      'Actividad: ' + activity.nombre,
      'Número: ' + activity.numero,
      'Periodo: ' + activity.periodo,
      'Responsable: ' + activity.responsable,
      'Fecha de finalización: ' + activity.fecha_fin,
      'Días restantes: ' + daysRemaining,
      'Estado: ' + activity.estado,
      'Avance: ' + activity.avance + '%',
      '',
      'Consulte el plan en: https://jhondice.github.io/OrganizadorFET/',
    ].join('\n');

    MailApp.sendEmail(REMINDER_EMAIL, subject, body);
    props.setProperty(marker, nowIso_());
    sent++;
  });
  Logger.log('Recordatorios enviados: ' + sent);
  return sent;
}
