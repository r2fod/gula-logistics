# Pendientes

_Solo lo que sigue abierto (actualizado el 28/09/2026). Lo resuelto se borra de aquí: queda en `git log` y, si deja una lección, en `MEJORAS.md`. La versión larga anterior: `git show 19e5547:PENDIENTES.md`._

## 🔴 Seguridad y datos
- [ ] **Enlaces de socias VIEJOS con la sesión de admin dentro** (`?token=`, del modal de WhatsApp anterior al 27/09): siguen dando acceso de ADMIN hasta que se cambie la clave de admin (eso los anula). Cambiar la clave y reenviar a las socias el enlace nuevo de solo lectura.
- [ ] **Otros endpoints públicos sin datos de acceso** (por diseño: el trabajador no tiene sesión): `GET /api/clock` (todos los fichajes, con tarifa), `GET /api/roster` (tarifa y nómina de cada persona) y `DELETE /api/clock/:id` (cualquiera puede mandar a la papelera un fichaje de menos de 15 min; se restaura desde admin). Se cerrarían con un token por trabajador, como el de socias (ver "Enlaces firmados").
- [ ] **El historial público de git conserva datos sensibles** (saldos reales de 14–15/09, una clave VAPID privada ya sin uso, contraseñas de componentes antiguos). Opciones: purgar el historial (`git filter-repo` + force-push, destructivo) o repo privado (Pages privado es de pago). Mientras tanto: **cambiar la clave de admin** desde "Clave".
- [ ] **Variables del calendario en Render** (`CALENDARIO_PROJECT_ID`, `CALENDARIO_API_KEY`, `CALENDARIO_CODIGO`; mejor el código de solo lectura). Sin ellas no hay borradores automáticos. Comprobar con `GET /api/calendario/estado` (admin).

## 🟡 Funcional
- [ ] **`taskRef` apunta a la tarea por índice**: si el admin reordena un día con alguien fichado en él, la salida marcaría otra tarea. Pasar a `id` exige antes dar id a las tareas que no lo tienen (manual, ver `CLAUDE.md`).
- [ ] **`LiveMonitorPanel` mira las tareas de HOY de la semana activa**: con otra semana elegida enseñaría las suyas como si fueran de hoy. Filtrar por fecha real.
- [ ] **Regla "base/checklist y jefe de logística no cargan":** el usuario quitó ese texto de las tarjetas de equipo (21/09) pero sigue en el generador y en el prompt de Gemini. ¿Sigue vigente?
- [ ] **Ficha de Saldos con el nombre mal escrito** (una letra de más): corregir `name` en Atlas → `workerbalances` (no el `id`). La app lo puentea mientras tanto.
- [ ] **Semana 3:** 62,5 h de jornada sin tarea van repartidas por estimación; si el usuario dice qué se hizo el domingo por la noche, se ajustan asignaciones/horas y el reparto cambia solo. Anotar los **pax** de cada evento (sin pax, reparto a partes iguales).
- [ ] **27/09: dos entradas duplicadas de un trabajador a las 11:07** (se creó una tercera al no verse en turno por el fallo del domingo, ya arreglado). Borrar solo con permiso del usuario.
- [ ] **Bloque `team` de la Vista Pública sin pantalla de edición** (solo `POST /weeks` o Atlas).
- [ ] **Enlaces de trabajador firmados y revocables** (hoy `?worker=Nombre` sin token; quitar del roster ya revoca). Rompe los enlaces actuales al desplegar: coordinar con el usuario.
- [ ] Revisión responsive sistemática 320–1920 px del resto de vistas.

## Asistente IA (27/09)
- [ ] Memoria del asistente hecha (grafo visual, reglas propuestas → aprobar, aprendizaje de fichajes). Pendiente: probarlo con sesión de admin en producción (pestaña Memoria IA) y ver que Gemini genera horarios razonables con el aprendizaje. Solo mide tramos "limpios": se aprende más si la gente ficha cada tarea al cambiar.

## Saldos y Resumen Financiero (28/09)
- [ ] Los conceptos a mano ANTERIORES al 28/09 no llevan fecha ni tipo (los nuevos sí): los pagos antiguos se reconocen por el texto ("pago", "efectivo", "Bizum", "adelanto"…) y los que no tienen fecha (bolsa, roturas, pagos) solo se suman en «Todo».
- [ ] Revisar en producción con sesión de admin: Saldos (dos grupos), "Ver sus horas por evento", el Resumen con lo apuntado a mano y lo previsto, copiar para WhatsApp y la papelera del Historial.

## Auditoría 28/09 — lo que queda
- [ ] **Poner `GEMINI_API_KEY` en Render** (Environment del servicio; la pega el usuario, nunca en el chat ni en el repo). Mientras no esté, el asistente pide la clave en el navegador como antes.
- [ ] **Tests** de `ClockInModal`, `useClockings` y `AdminClockEditModal` (fichar y editar fichajes aún sin cubrir).

## 🟢 Código
- [ ] ESLint del cliente: 21 errores (reglas nuevas de React: `setState` dentro de efectos en varios modales) y ~130 avisos, todos anteriores. No añadir nuevos.
- [ ] Archivos grandes: `AdminTaskEditorModal` (~1050 líneas), `WorkerView` (~1090), `TeamBalancesTab` (~780). Siguientes piezas: fila de tarea/tarjeta de boda de `WorkerView`, `Boton`, `Chip` seleccionable, `PuntoEstado`.
- [ ] Normalizar las tareas a objeto al cargar la semana y quitar los `typeof task === 'object' ? task.text : task` repartidos.
- [ ] `npm audit` del cliente: `vite`/`esbuild` (solo afectan a `npm run dev`); arreglarlo es subir `vite` de versión mayor, en rama aparte.

## Visto una vez, sin reproducir
- Salto espontáneo de pestaña en el panel (probablemente un clic accidental).
