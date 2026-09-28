# Mejoras — decisiones y lecciones

_Resumen de lo que ya está hecho y por qué es así. El detalle de cada cambio está en `git log` (antes de 27/09/2026 este archivo era un diario largo: `git show 19e5547:MEJORAS.md`)._

## Seguridad y datos
- **Sin secretos en el cliente ni en el repo.** Semillas (`balancesData.js`, `logisticsData.js`) son plantillas vacías; los datos reales solo en Mongo (`POST /balances/seed` acepta el cuerpo para migrar sin commitear). Hubo saldos reales, una clave VAPID privada y contraseñas en commits antiguos: siguen en el historial (ver `PENDIENTES.md`).
- **Un solo `requireAdmin`** (JWT firmado + revocación por versión al cambiar la clave). Hubo un middleware casero con secreto de reserva escrito en el código: eliminado.
- **Login:** 10 intentos fallidos por IP cada 15 min, comprobado antes de `bcrypt`. `trust proxy` = `1` (con `true`, `X-Forwarded-For` falsificado esquivaba el límite).
- **Socias con enlace propio de SOLO LECTURA** (27/09): token firmado `rol: socias` que genera el servidor para el admin, caduca a los 90 días y se anula con "Anular anteriores" (`sociasVersion`) o al cambiar la clave. `requireLectura` (admin o socias) protege `GET /api/balances`, que antes era público; el panel ya no se abre con `?socias` solo. Nunca meter la sesión de admin en un enlace para otra persona.
- **Token de admin fuera de la URL visible** (se quita con `replaceState`) y `<meta name="referrer" content="no-referrer">`.
- **Endpoints públicos acotados:** `PATCH /weeks/:id/tasks` solo escribe `completed`/`reopened`/`completedAt` (validados) de una tarea; `POST /api/clock` descarta importes calculados y limita la tarifa a 0–100 €/h; `DELETE /weeks/:id` solo borradores; recuerdos de IA de 1–300 caracteres.
- **Vista pública por defecto:** sin sesión de admin ni trabajador reconocido se ve `PublicView` (el icono de la PWA pierde los parámetros de la URL). El Grafo de un trabajador solo enseña lo suyo.
- **Clave de Gemini en el servidor** (28/09): `POST /api/ia/gemini` (solo admin) llama a Google con `GEMINI_API_KEY` de Render; una clave pegada en el navegador sigue valiendo y va primero. Nunca en variables `VITE_`, que acaban en el bundle.
- **Texto del navegador en una `RegExp`, siempre escapado** (`GET /api/clock?worker=` lo metía tal cual).

## Planning y fechas
- **Toda la lógica de "¿qué día es / ya pasó?" vive en `taskPlanning.js`** y sale de la fecha real (`meta.dateRange`), nunca del día de la semana suelto (un "martes" existe en todas las semanas). Hubo cuatro copias que se arreglaban por separado.
- **Ante la duda, no escribir.** El auto-marcado por hora guardaba en Mongo tareas "hechas" que nadie hizo; tras varios arreglos se quitó del todo (25–27/09): solo marca un clic o la salida de un fichaje.
- **Una semana nueva no debe cambiar los números de las anteriores:** los borradores no cuentan para pax, costes ni enlaces; clonar o generar con IA resetea `completed`.
- **No reescribir el texto de tareas ya fichadas** (el fichaje guarda ese texto y se desliga): el evento va en el campo `event`.
- **Guardado de semanas:** `POST /weeks` reemplaza el documento completo con control optimista por `updatedAt` (409). Un `PATCH` que no cambia nada no escribe (cada escritura sube `updatedAt` y provocaba conflictos falsos).
- **Memoria del asistente (27/09):** las reglas que saca Gemini de lo que se le pide quedan *propuesta* hasta que el admin las aprueba; solo las activas entran en el prompt (también al crear semana). Aprende duraciones reales y "quién hace qué" de los fichajes (`aprendizajeFichajes.js`), contando solo tramos limpios: un turno que abarca otras tareas de esa persona no mide la primera (en datos reales, cargas de 1 h 40 salían de 6 h). Grafo visual en Memoria IA (`grafoMemoria.js`, SVG propio).
- **IA:** ante un fallo, error claro y ninguna acción siguiente (hubo una "demo" que se aplicaba como si fuera real). Los modelos caducan: lista de candidatos (`GEMINI_MODELS`). Los recuerdos se extraen aparte y se filtran.

## Fichajes y dinero
- **Saldos y Resumen Financiero cuentan igual** (28/09): la bolsa de horas se paga con la misma regla en los dos (`bolsaHoras.js`); Saldos separa "turnos fichados" de "apuntado a mano"; el Resumen enseña lo apuntado a mano y, al pie, extras fichados + a mano (lo que se paga), lo previsto por el planning y el texto para WhatsApp. Se quitó el informe de Nóminas: su papelera salía siempre vacía y su "Reset Admin" borraba TODOS los fichajes con un clic (el servidor ya no tiene `DELETE /api/clock` sin id).
- `GET /api/clock` devuelve lo más reciente primero: para saber quién está en turno, ordenar antes (`sortEntriesByTimestamp`, `getActiveShiftForWorker`, `pairShiftsFromEntries`).
- Horas redondeadas a la **media hora** (`Math.round(h*2)/2`), tope 14 h facturables por turno; turno abierto > 16 h = "REVISAR" (no se cierra solo).
- Fichajes sin cobertura: cola persistente + reintento cada 20 s y al volver la red; el servidor es idempotente por `id`.
- La ventana de fichajes de una semana es martes 00:00 → martes siguiente (incluye domingo y lunes de cola) y conserva los turnos abiertos (`fichajesDeLaSemana`).
- Nómina fija se decide por `isPayroll` del dato, nunca por nombre.

## Rendimiento (28/09)
- **Carga por partes:** el panel de admin y sus editores van con `React.lazy` (App.jsx); lo que descarga un trabajador pasó de 985 KB a 356 KB. Si tras un despliegue falta un trozo, `main.jsx` recarga una vez.
- **Nada se redibuja entero cada segundo:** lo que cambia cada segundo (cronómetros, dinero en directo) va en `<EnVivo>`; las pantallas se recalculan cada 15–30 s.
- **Dinero en tiempo real** (`costeEnVivo.js`): solo en vistas con sesión (monitor en vivo, Saldos y Resumen Financiero) y en la del propio trabajador, nunca en la pública; con bolsa, como en Saldos. En Saldos el saldo grande incluye el turno abierto (con "Cerrado: X" debajo); al fichar la salida se redondea a la media hora. Un turno abierto más de 16 h (salida olvidada) no se suma, y la nómina fija no enseña euros. Las cifras animadas (`useCountUp`) no animan cambios de menos del 1 %: si no, se repintaban sin parar mientras alguien está en turno.
- **Gemini, revisar antes de aplicar** (`diffSemana.js`): qué cambia por día y avisos de gente o camiones inventados y de solapes de horario. Tras aplicar, **Deshacer** devuelve la semana anterior (avisa si desde entonces tuvo otros cambios).

## Forma de trabajar
- **Build verde ≠ funciona.** Tras un refactor grande, barrido de ESLint (`no-undef`) — hubo pantallas en negro por referencias colgando — y mirar la app desplegada.
- Los efectos con `[]` congelan las funciones de la primera render: quien las llame desde un `setInterval` lo hace por `ref`.
- El service worker no cachea el bundle a propósito (evita servir versiones viejas).
- Render (plan gratuito) se duerme a los 15 min: la primera petición tarda 30–50 s. Sus despliegues tardan y no avisan.
- `npm run dev` apunta a la API de producción: en local solo mirar.
- Varias sesiones (Claude, Gemini) trabajan a la vez: traer `origin/main` antes de fusionar y revisar lo que entró (el 27/09 un commit ajeno rompió el marcado de bodas en la vista de trabajador).

## Escala (notas)
- **Fichajes por cambios** (28/09): el histórico entero solo al abrir y cada 10 min; entre medias `GET /api/clock?desde=` (por `updatedAt`, con 30 s de margen). Borrar es marcar, así que la papelera también llega por cambios.
- **Guardar semanas manda solo las que cambiaron**: con todas, hacia la semana 10 se pasaba del límite de 100 KB de Express (ahora 2 MB de margen).
- El bootstrap de Mongo solo crea `week_3` si la base está vacía.
