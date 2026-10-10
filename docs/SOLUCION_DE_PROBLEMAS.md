# Solución de problemas comunes

### "El backend no está configurado. Ejecute setup() en Apps Script."
No se ha ejecutado `setup()` todavía, o se ejecutó en un proyecto de Apps Script distinto al
que está implementado como Web App. Vuelva a `Code.gs`, ejecute `setup` desde el editor y
confirme que la URL que está usando en **Configuración** corresponde a esa misma implementación.

### "Token de acceso inválido."
- Revise que copió el token completo, sin espacios al inicio o al final.
- Si regeneró los tokens (`rotateTokens`), los anteriores dejan de funcionar de inmediato:
  actualice el token guardado en **Configuración**.

### "Su rol es de solo lectura." al intentar guardar
Está usando el `VIEWER_TOKEN`. Pídale a quien administra la hoja el `ADMIN_TOKEN`
(menú "FET Seguimiento" → "Mostrar tokens de acceso").

### La URL no responde / error de red
- Confirme que la URL termina en `/exec` (no en `/dev`, que es solo para pruebas desde la
  propia cuenta de Google que hizo la implementación).
- Vuelva a implementar (**Implementar → Gestionar implementaciones → editar (lápiz) → Nueva
  versión**) después de cualquier cambio en `Code.gs`: los cambios no se aplican solos a una
  implementación ya publicada.
- Verifique que "Quién tiene acceso" esté configurado como **Cualquier usuario**.

### Los cambios en el código del backend no se reflejan
Cada edición de `Code.gs` requiere publicar una **nueva versión** de la implementación
existente (no basta con guardar el archivo). Vaya a **Implementar → Gestionar
implementaciones**, edite la implementación activa y seleccione "Nueva versión".

### No llegan los recordatorios por correo
- Confirme que creó el archivo `Reminders.gs`, guardó el código y ejecutó
  `setupActivityReminders()`. Debe existir el activador diario `sendActivityReminders` en
  **Activadores**.
- Ejecute manualmente `authorizeActivityReminders()` desde Apps Script y acepte el permiso
  de correo solicitado por Google.
- Revise **Ejecuciones** para ver si Apps Script informa de falta de autorización o de cuota.
- Los correos salen de la cuenta propietaria del script hacia
  `direccion_software@fet.edu.co`; esa cuenta debe autorizar el permiso de envío de correo.
- Sólo se avisa a actividades no completadas exactamente 3 días y 1 día antes de su fecha
  final, según la zona horaria del proyecto (se recomienda `America/Bogota`).
- Ejecutar de nuevo `setupActivityReminders()` no crea activadores duplicados. Un mismo aviso no
  se reenvía para la misma actividad, plazo y fecha final.

### "La hoja ya contiene actividades; no se cargaron datos de ejemplo."
`seedDemoData()` sólo funciona sobre una hoja "Actividades" vacía, para no mezclar datos
reales con datos de ejemplo. Si de verdad quiere reiniciar con los datos de ejemplo, borre a
mano las filas de la pestaña "Actividades" e "Informes" (dejando los encabezados) y vuelva a
ejecutar la función.

### El sitio publicado en GitHub Pages muestra una página en blanco
- Revise que en **Settings → Pages** el origen sea **GitHub Actions** (no "Deploy from a
  branch").
- Revise la pestaña **Actions** del repositorio: si el workflow falló, el sitio no se
  actualiza. La causa más común es que `npm test` falló durante el build.

### Quiero un enlace de "solo consulta" para compartir
Comparta el enlace del sitio junto con el `VIEWER_TOKEN`. Quien lo use podrá ver todo el plan
e indicadores, pero no podrá crear, editar ni eliminar nada.
