# Pendientes

_Solo lo que sigue abierto (actualizado el 28/09/2026). Lo resuelto se borra de aquí: queda en `git log` y, si deja una lección, en `MEJORAS.md`. La versión larga anterior: `git show 19e5547:PENDIENTES.md`._

## 🔴 Seguridad y datos
- [ ] **Enlaces de socias VIEJOS con la sesión de admin dentro** (`?token=`, del modal de WhatsApp anterior al 27/09): siguen dando acceso de ADMIN hasta que se anulen: **Configuración → «Cerrar todas las sesiones y enlaces de socias»** (no cambia la clave; luego reenviar a las socias el enlace nuevo de solo lectura).
- [ ] **Otros endpoints públicos sin datos de acceso** (por diseño: el trabajador no tiene sesión): `GET /api/clock` (todos los fichajes, con tarifa), `GET /api/roster` (tarifa y nómina de cada persona), `POST /api/clock` (fichar) y `DELETE /api/clock/:id` (mandar a la papelera un fichaje de menos de 15 min). Desde el 03/10 llevan límite por IP y fichar exige que la persona esté en el equipo y una fecha de hasta 45 días atrás y 12 h adelante (el admin, sin límite de fecha); aun así, quien tenga la URL puede fichar por alguien del equipo. Se cierra con **Configuración → «Fichar solo con el enlace personal»** (03/10): cada fichaje dice si llegó con el enlace de esa persona y el interruptor enseña quién ficha aún sin él; activarlo cuando todos lo usen.
- [ ] **Tras limpiar el historial (04/10)**: GitHub aún sirve las versiones antiguas a quien tenga su enlace exacto hasta que las borre; pedirlo en support.github.com («remove cached views» del repo). No fusionar en `main` ramas locales anteriores al 04/10 (traen el historial viejo de vuelta): rehacerlas desde `origin/main`. La copia del historial antiguo está solo en el ordenador (`gula-logistics-COPIA-historial-antiguo-2026-10-04.git`, junto al proyecto); borrarla cuando no haga falta.
- [ ] **Variables del calendario en Render** (`CALENDARIO_PROJECT_ID`, `CALENDARIO_API_KEY`, `CALENDARIO_CODIGO`; mejor el código de solo lectura). Sin ellas no hay borradores automáticos. Comprobar con `GET /api/calendario/estado` (admin).

## 🟡 Funcional
- [ ] **Regla "base/checklist y jefe de logística no cargan":** el usuario quitó ese texto de las tarjetas de equipo (21/09) pero sigue en el generador y en el prompt de Gemini. ¿Sigue vigente?
- [ ] **Semana 3:** 62,5 h de jornada sin tarea van repartidas por estimación; si el usuario dice qué se hizo el domingo por la noche, se ajustan asignaciones/horas y el reparto cambia solo. Anotar los **pax** de cada evento (sin pax, reparto a partes iguales).
- [ ] **Enlaces de trabajador firmados** (30/09): ya existen (`&t=`, desde «Enlaces de WhatsApp» con sesión de admin) y con ellos cada uno ve sus horas y lo que tiene por cobrar. **El admin tiene que reenviar a cada persona su enlace nuevo** (los antiguos siguen valiendo, sin saldo). Falta: botón para anularlos todos (el servidor ya lo admite: `anularAnteriores`) y, cuando todos tengan el nuevo, exigirlo para fichar y cerrar los endpoints públicos de arriba.
- [ ] Revisión responsive sistemática 320–1920 px del resto de vistas.

## Asistente IA (27/09)
- [ ] Memoria del asistente hecha (grafo visual, reglas propuestas → aprobar, aprendizaje de fichajes). Pendiente: probarlo con sesión de admin en producción (pestaña Memoria IA), que el asistente diga «Usa la clave del servidor» (la clave ya está en Render, 28/09), que Gemini genere horarios razonables con el aprendizaje y el botón «Deshacer» tras aplicar. Solo mide tramos "limpios": se aprende más si la gente ficha cada tarea al cambiar.

## Planificador con disponibilidad (28/09)
- [ ] Probar con sesión de admin: el recuadro «Disponibilidad» del Cuadrante (escribir "X no puede el jueves" y aplicar el reajuste), la revisión automática de Gemini en el próximo borrador (cambios y tokens en su recuadro) y el asistente (cuánto gasta cada petición).
- [ ] **Rellenar en la ficha del equipo** (lo hace el admin, datos reales fuera del repo): quien solo puede a partir de las 15:00 y quien ayuda "solo si hace falta" cuando no está en cocina. El campo `team` antiguo de las semanas ya no se usa (queda en Mongo, sin efecto).

## Saldos y Resumen Financiero (28/09)
- [ ] **Apuntes antiguos con la fecha falsa 30/09** (migración del servidor del 03/10, ya quitada): la app la ignora en los que no llevan `tipo` (`conceptosSaldos.js`). Con permiso del usuario, borrar ese `date` en Atlas (47 apuntes sin `tipo` y la bolsa acumulada) y quitar la excepción del código.
- [ ] **`client/api_data.json` en la copia de `main`**: volcado de fichajes reales del 03/10 (ya en `.gitignore`, nunca al repo). Es la única copia de los 38 fichajes de la papelera vaciada ese día y de los 22 borrados para siempre esa noche (los 12 que sobraban, 6 que ya estaban en la papelera y 4 de dos jornadas de nómina del 15 y 16/09, borradas a propósito: de momento la nómina no se cuenta). Si no hace falta recuperar ninguno, borrarlo.
- [ ] Revisar en producción con sesión de admin: Saldos (dos grupos y el saldo subiendo con alguien en turno), "Ver sus horas por evento", el Resumen con lo apuntado a mano y lo previsto, copiar para WhatsApp y la papelera del Historial.

## Auditoría 28/09 — lo que queda
- [ ] **Tests** de `AdminClockEditModal` y del flujo completo de fichar en `ClockInModal` (abrir ya está cubierto, y `useClockings` en lo de la papelera).

## 🟢 Código
- [ ] ESLint del cliente: 21 errores (reglas nuevas de React: `setState` dentro de efectos en varios modales) y ~140 avisos, todos anteriores. No añadir nuevos.
- [ ] Archivos grandes: `AdminTaskEditorModal` (~1050 líneas), `WorkerView` (~1030; su historial ya va en `trabajador/HistorialFichajes`), `TeamBalancesTab` (~810). Siguientes piezas: la tarjeta de la tarea inmediata de `WorkerView`, `Boton`, `Chip` seleccionable, `PuntoEstado`.
- [ ] Normalizar las tareas a objeto al cargar la semana y quitar los `typeof task === 'object' ? task.text : task` repartidos.
- [ ] `npm audit` del cliente: `vite`/`esbuild` (solo afectan a `npm run dev`); arreglarlo es subir `vite` de versión mayor, en rama aparte.

## Visto una vez, sin reproducir
- Salto espontáneo de pestaña en el panel (probablemente un clic accidental).
