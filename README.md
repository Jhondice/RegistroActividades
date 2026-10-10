# Gestión de actividades — FET

Aplicación web para planificar, dar seguimiento y reportar el cumplimiento del plan de
trabajo docente: dashboard con indicadores, plan de actividades (crear/editar/eliminar),
historial de informes de avance, calendario institucional, indicadores de gestión y
generador de reportes exportables a Excel/CSV.

Es un **frontend estático** (HTML/CSS/JS, sin servidor propio) que se publica **gratis en
GitHub Pages** y que puede funcionar de dos maneras:

| Modo | Dónde viven los datos | Para quién |
|---|---|---|
| **Demostración** (por defecto) | `localStorage` del navegador | Probar la aplicación, hacer una demo, uso personal en un solo equipo |
| **Google Sheets** (recomendado) | Una hoja de cálculo de Google, vía un backend en Google Apps Script | Uso real en la institución, con varias personas editando desde cualquier lugar |

No hace falta programar nada para pasar de un modo a otro: se configura desde la pestaña
**Configuración** de la propia aplicación.

## Tabla de contenido

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Probarlo ahora mismo (modo demostración)](#probarlo-ahora-mismo-modo-demostración)
- [Puesta en marcha completa](#puesta-en-marcha-completa)
  - [1. Crear el backend en Google Sheets](#1-crear-el-backend-en-google-sheets)
  - [2. Publicar el sitio en GitHub Pages](#2-publicar-el-sitio-en-github-pages)
  - [3. Conectar el sitio con la hoja de cálculo](#3-conectar-el-sitio-con-la-hoja-de-cálculo)
- [Desarrollo local](#desarrollo-local)
- [Pruebas automatizadas](#pruebas-automatizadas)
- [Seguridad](#seguridad)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Preguntas frecuentes](#preguntas-frecuentes)
- [Licencia](#licencia)

## Características

- **Dashboard** con indicadores clave (programadas, en desarrollo, completadas, pendientes,
  atrasadas, avance general) y gráficos de estado, tipo y línea estratégica.
- **Plan de actividades**: tabla con búsqueda y filtros, crear/editar/eliminar, exportación a CSV.
- **Informes de avance**: historial completo por actividad (no se sobrescribe el informe
  anterior); cada informe actualiza automáticamente el % de avance y el estado de la actividad.
- **Calendario institucional** mensual con las actividades vigentes cada día, coloreadas por estado.
- **Indicadores de gestión**: cumplimiento global, efectividad de cierre, nivel de riesgo por
  atrasos, carga de trabajo por responsable y tendencia planificado-vs-real.
- **Generador de reportes** filtrable por tipo/responsable/estado, exportable e imprimible.
- **Catálogos configurables** (periodos, tipos, líneas estratégicas, responsables) sin tocar código.
- **Control de acceso por roles**: administrador (lectura y escritura) y consulta (solo lectura).
- **Bitácora de auditoría** en el propio Google Sheet: quién hizo qué y cuándo.
- Diseño responsivo, imprimible (informes y reportes) y sin dependencias de pago.

## Arquitectura

```
┌─────────────────────────┐        HTTPS (JSON, POST)        ┌──────────────────────────┐
│   GitHub Pages           │  ───────────────────────────▶   │  Google Apps Script       │
│   (HTML + CSS + JS)      │  ◀───────────────────────────   │  (Web App, gratis)        │
│   Vite + Tailwind        │                                  │  backend/Code.gs          │
└─────────────────────────┘                                  └────────────┬─────────────┘
        │                                                                  │
        │ modo demostración (sin backend)                                  ▼
        ▼                                                        ┌──────────────────┐
┌─────────────────┐                                              │  Google Sheets     │
│  localStorage     │                                             │  (base de datos)  │
└─────────────────┘                                              └──────────────────┘
```

- El **frontend** nunca escribe directamente en Google Sheets: todo pasa por el Web App de
  Apps Script, que valida cada solicitud (autenticación por token, validación de datos,
  bloqueo de escrituras concurrentes) antes de tocar la hoja.
- Sin ninguna configuración adicional, el sitio funciona igual pero guardando todo en el
  propio navegador (modo demostración).
- No hay ninguna base de datos ni servidor de pago involucrado: Google Sheets, Apps Script
  y GitHub Pages son gratuitos dentro de los límites normales de uso individual/institucional.

## Probarlo ahora mismo (modo demostración)

Basta con abrir `index.html` con cualquier servidor estático, o visitar el sitio ya publicado
en GitHub Pages (`https://<tu-usuario>.github.io/<tu-repositorio>/`). La aplicación arranca en
modo demostración con datos de ejemplo y todas las funciones (crear, editar, eliminar,
informes, catálogos) están activas; sólo que los cambios se guardan exclusivamente en ese
navegador. Puede restablecer los datos de ejemplo en cualquier momento desde **Configuración**.

## Puesta en marcha completa

### 1. Crear el backend en Google Sheets

1. Cree una hoja de cálculo nueva en [Google Sheets](https://sheets.google.com).
2. Menú **Extensiones → Apps Script**.
3. Borre el contenido de `Code.gs` que aparece por defecto y pegue el contenido de
   [`backend/Code.gs`](backend/Code.gs) de este repositorio.
4. Cree un segundo archivo (ícono `+` → "Script") llamado `Seed` y pegue el contenido de
   [`backend/Seed.gs`](backend/Seed.gs) (opcional: sólo si quiere cargar datos de ejemplo).
5. Cree otro archivo de secuencia de comandos llamado `Reminders` y pegue el contenido de
   [`backend/Reminders.gs`](backend/Reminders.gs).
6. Configure la zona horaria del proyecto como `America/Bogota`. Ejecute `setup` para preparar
   las hojas y los tokens; después ejecute `setupActivityReminders` para instalar el activador
   diario y `authorizeActivityReminders` para autorizar el envío de correo. Google solicitará
   los permisos necesarios la primera vez.
7. Aparecerá un cuadro con dos tokens (`ADMIN_TOKEN` y `VIEWER_TOKEN`). **Cópielos y guárdelos
   en un lugar seguro** — no los suba nunca al repositorio de GitHub.
   - `ADMIN_TOKEN`: acceso completo (crear, editar, eliminar).
   - `VIEWER_TOKEN`: solo lectura (útil para compartir un enlace de "solo consulta").
8. (Opcional) Recargue la hoja de cálculo: aparecerá un menú **"FET Seguimiento"** con
   accesos directos a `setup`, mostrar/regenerar tokens y cargar datos de ejemplo
   (`Cargar datos de ejemplo`, si copió `Seed.gs`).
9. Menú **Implementar → Nueva implementación**:
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo** (su cuenta).
   - Quién tiene acceso: **Cualquier usuario**.
   - Presione **Implementar** y copie la **URL del Web App** (termina en `/exec`).

Puede volver a ejecutar `setup()` cuando quiera sin riesgo: es idempotente (no borra datos
existentes). `setupActivityReminders()` también es idempotente y deja un solo activador diario.
Si necesita invalidar los tokens actuales, use `rotateTokens` desde el menú.

El activador revisa las actividades todos los días alrededor de las 8:00 a. m. y envía un
correo a `direccion_software@fet.edu.co` cuando una actividad no completada vence en 3 días
y, si aún no se ha completado, nuevamente cuando vence en 1 día. Cada aviso se envía una sola
vez por actividad, plazo y fecha de finalización. La primera ejecución puede pedir autorización
para enviar correos desde la cuenta propietaria del script.

### 2. Publicar el sitio en GitHub Pages

1. Cree un repositorio en GitHub y suba el contenido de este proyecto (o use directamente
   este repositorio si ya lo clonó/hizo fork).
2. En **Settings → Pages**, en "Build and deployment" seleccione **GitHub Actions** como
   origen (el workflow ya incluido en `.github/workflows/deploy.yml` se encarga del resto).
3. (Opcional pero recomendado) En **Settings → Secrets and variables → Actions → pestaña
   "Variables"**, cree una variable `VITE_API_URL` con la URL del Web App obtenida en el
   paso anterior. Esto sólo *precarga* el campo "URL" en la pantalla de Configuración del
   sitio; **el token nunca se sube al repositorio ni al sitio publicado**, cada persona lo
   escribe una sola vez en su propio navegador.
4. Haga `push` a la rama `main` (o ejecute el workflow manualmente desde la pestaña
   **Actions → Publicar en GitHub Pages → Run workflow**). En 1–2 minutos el sitio queda
   disponible en `https://<usuario>.github.io/<repositorio>/`.

### 3. Conectar el sitio con la hoja de cálculo

1. Abra el sitio publicado y vaya a la pestaña **Configuración**.
2. Pegue la **URL del Web App** (si configuró `VITE_API_URL` ya aparecerá) y el **token**
   (`ADMIN_TOKEN` para editar, `VIEWER_TOKEN` para solo consulta).
3. Presione **Conectar**. A partir de ese momento, todos los cambios se guardan en la hoja de
   cálculo y el sitio recuerda la conexión en ese navegador para la próxima visita.

## Desarrollo local

Requiere [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install       # instala dependencias
npm run dev       # servidor de desarrollo con recarga en caliente
npm run build     # genera el sitio final en dist/
npm run preview   # sirve dist/ para revisar el build de producción
npm test          # ejecuta toda la batería de pruebas
npm run seed:gs   # regenera backend/Seed.gs a partir de src/data/seed.js
```

## Pruebas automatizadas

El proyecto incluye pruebas con el corredor nativo de Node (`node --test`), sin frameworks
externos:

- **Dominio** (`tests/validation.test.mjs`, `tests/dates-stats-csv.test.mjs`): reglas de
  negocio, fechas sin errores de zona horaria, generación de CSV segura, indicadores.
- **Backend** (`tests/backend.test.mjs`): se ejecuta `backend/Code.gs` de verdad dentro de un
  simulador ligero de Google Apps Script/Sheets (`tests/helpers/gas-mock.mjs`), sin necesidad
  de desplegarlo en Google. Cubre autenticación por token y roles, CRUD completo, cascada de
  eliminación, catálogos y la neutralización de fórmulas maliciosas en las celdas.
- **Vistas** (`tests/views-smoke.test.mjs`): cada vista del frontend se renderiza y monta con
  datos reales de demostración (vía jsdom) para detectar errores de integración.

El workflow de GitHub Actions ejecuta `npm test` en cada despliegue: si algo se rompe, el
sitio no se publica.

## Seguridad

- El navegador **nunca** tiene acceso directo a Google Sheets: todo pasa por Apps Script,
  que revalida cada dato (aunque el frontend también valide, por experiencia de usuario).
- Los tokens se comparan con un algoritmo de tiempo constante (evita ataques de temporización)
  y sólo viven en el `localStorage` de quien los escribe — nunca en el código publicado.
- Las celdas se guardan siempre en formato de texto plano (`@`), de modo que un nombre de
  actividad como `=HYPERLINK(...)` nunca se interpreta como fórmula.
- Las escrituras están serializadas con `LockService`, así que dos personas guardando al
  mismo tiempo no corrompen datos.
- Cada acción de escritura queda registrada en la pestaña **Bitacora** de la hoja (rol, acción,
  entidad y detalle), con fines de trazabilidad.
- Si sospecha que un token fue expuesto, use **Regenerar tokens** en el menú "FET Seguimiento"
  de la hoja: los tokens antiguos dejan de funcionar de inmediato.

## Estructura del repositorio

```
backend/                 Backend (Google Apps Script)
  Code.gs                 API completa: autenticación, validación, CRUD, catálogos, auditoría
  Seed.gs                 Datos de ejemplo (generado desde src/data/seed.js)
  appsscript.json          Configuración del proyecto de Apps Script
src/
  api/                     Clientes de datos: local (demo) y remoto (Apps Script)
  domain/                  Reglas de negocio puras: validación, estadísticas, constantes
  utils/                   Fechas y CSV, sin dependencias externas
  data/seed.js             Datos de ejemplo (fuente única, compartida con el backend)
  state/store.js           Estado central de la aplicación (conexión, datos, mutaciones)
  ui/                      Componentes reutilizables: iconos, modales, notificaciones
  views/                   Una vista por pestaña (dashboard, plan, informes, ...)
  main.js, styles.css      Punto de entrada y estilos (Tailwind v4)
tests/                     Pruebas de dominio, backend (simulado) y vistas
.github/workflows/          Despliegue automático a GitHub Pages
```

## Preguntas frecuentes

**¿Tiene algún costo?** No. Google Sheets, Apps Script y GitHub Pages son gratuitos para este
uso. Apps Script tiene límites generosos de cuota diaria (más que suficientes para el uso
normal de una institución educativa); si algún día se superan, Google simplemente rechaza
temporalmente nuevas solicitudes hasta el día siguiente.

**¿Varias personas pueden usarlo a la vez?** Sí. Las escrituras están serializadas
(`LockService`), así que no hay condiciones de carrera ni datos corruptos.

**¿Puedo usarlo sin Google?** Sí, en modo demostración, aunque los datos sólo viven en el
navegador de cada persona y no se comparten.

**¿Cómo agrego más periodos, tipos o líneas estratégicas?** Desde la pestaña
**Configuración → Catálogos**, sin tocar código ni la hoja de cálculo directamente.

**Perdí el `ADMIN_TOKEN`, ¿qué hago?** Abra la hoja de cálculo → menú "FET Seguimiento" →
**Mostrar tokens de acceso** (o **Regenerar tokens** si además quiere invalidar el anterior).

¿Algo no funciona como se espera? Revise [docs/SOLUCION_DE_PROBLEMAS.md](docs/SOLUCION_DE_PROBLEMAS.md).

## Licencia

MIT — vea [LICENSE](LICENSE). Libre para usar, adaptar y redistribuir, incluso con fines
comerciales, manteniendo el aviso de copyright.
