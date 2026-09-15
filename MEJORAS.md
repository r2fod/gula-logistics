# Mejoras — hechas hoy y candidatas futuras

## "Contigo en esta tarea" en la vista del trabajador (corregido)

Pedido por el usuario: en el link de cada trabajador, saber quién más va a la misma tarea/sede — para poder preguntar por compartir coche a cargar o descargar, etc.

**Primer intento (incorrecto):** mostraba quién estaba fichado en ese momento en general, calculado con `pairShiftsFromEntries(clockEntries).activeShifts`. El usuario lo probó con Jaime (camino a la boda de María y Joaquín en La Vila Joiosa) y salían Irene y Johan — Irene no tiene nada que ver, estaba fichada haciendo preparación de material en el almacén, una tarea sin relación. Fichado ahora ≠ va al mismo sitio.

**Corregido:** ahora se saca de `assigned` de la tarea actual/próxima del propio trabajador (`immediateTask.rawTask.assigned`, o si ya está fichado con `taskRef`, de la tarea real a la que apunta ese `taskRef`) — es decir, compañeros de la MISMA tarea, no cualquiera fichado en paralelo. Cada uno muestra además si ya ha fichado o no (🟢 Ya ha fichado / Aún no ha fichado), cruzando esa lista con `pairShiftsFromEntries` solo para ese estado, no para elegir a quién mostrar.

Verificado con el caso real que reportó el usuario: la vista de Jaime (tarea: Boda María y Joaquín) ahora muestra Ricardo, Johan y Raúl — los 3 compañeros reales de esa tarea — con Johan marcado como ya fichado.

## Selector de hora en el Editor de Planning (antes texto libre)

Pedido por el usuario tras ver que el horario de las tareas se escribía a mano como texto libre ("9:30 - 10:30", "10:00-14:00", "13:00-16:00"...) — de ahí salían la mayoría de las horas mal formateadas y los solapes de camión que costó tanto detectar en esta sesión (un simple espacio o cero de menos ya rompía el parseo en otros sitios de la app).

`AdminTaskEditorModal.jsx` tiene ahora un componente `TimeRangeEditor` (dos `<input type="time">`, entrada y salida) que sustituye el campo de texto libre en los tres sitios donde existía: tareas normales de cada día, bodas del sábado y tareas de domingo/lunes. Lee y escribe el mismo campo `timeFrame` de siempre (string `"HH:MM - HH:MM"`), así que nada más en la app tiene que cambiar. Para tareas sin hora todavía (ej. "Recoger Fulanita", horario "pendiente") hay una casilla aparte "Sin horario fijo (pendiente)" que desactiva los selectores y guarda ese texto — no se pierde esa posibilidad.

Verificado en el navegador contra el planning real: la tarea de Martes "Recoger Sillas Carvillo" (guardada como "9:30 - 10:30") se parsea correctamente a los selectores 09:30/10:30, y "Recoger Fulanita" (guardada como "pendiente") marca la casilla en vez de forzar una hora.

## Fichar salida de una tarea la marca como hecha sola

Pedido por el usuario: al fichar la salida de una tarea concreta (botones "Fichar Esta Tarea" / "Fichar Entrada Ahora (1 Toque)" en `WorkerView.jsx`), la tarea del planning se marca como completada automáticamente — antes había que ir aparte a tildarla a mano en el Cuadrante.

Mecanismo: cuando se pulsa "Fichar Esta Tarea"/"Fichar Entrada Ahora", `WorkerView.jsx` resuelve el índice real de esa tarea dentro de `schedule[día].tasks` (mismo criterio de coincidencia por `text` que ya usaba el checkbox manual — `dayGroup.tasks` viene filtrado por trabajador, así que el índice mostrado en pantalla no es el real) y lo guarda como `taskRef: { dayKey, taskIndex }`. `ClockInModal.jsx` adjunta ese `taskRef` al fichaje de **entrada**. Al fichar la **salida** correspondiente (desde cualquier sitio: el modal, el botón directo de Actividad en Tiempo Real, etc.), `App.jsx` busca cuál era el turno activo que se está cerrando (`getActiveShiftForWorker`) y, si su entrada traía `taskRef`, marca esa tarea como `completed: true` (nunca la desmarca si ya lo estaba).

Las bodas del sábado ("Fichar Boda Sábado") quedan fuera de este mecanismo a propósito — no tienen campo `completed` en ningún sitio de la UI todavía, así que no había nada que marcar.

Cambio de esquema necesario: `taskRef` no existía en `ClockEntry.model.js` — sin añadirlo, Mongoose lo habría descartado en silencio al guardar la entrada, y la marca de completado habría dejado de funcionar en cuanto el poll de 20s trajera de vuelta el fichaje sin ese campo (aunque en el momento sí pareciera funcionar, por el estado optimista local).

## Cifras reales de la bolsa de Jefferson sacadas del código (auditoría)

La auditoría completa pedida por el usuario encontró que las cifras reales del acuerdo de bolsa mensual de Jefferson (700€ base, 200€ alojamiento, 500€ neto, 8,75€/h, 10€/h extra tras 80h) estaban escritas dos veces en el código, no solo en Mongo: como `default` de cada campo en `PurseInfoSchema` (`server/src/models/WorkerBalance.model.js`) y hardcodeadas en la tarjeta "Bolsa Mensual" de `PartnerDashboardView.jsx` (`80h (700€ - 200€ Aloj.) = 500€ Neto`, en vez de leer `worker.purseInfo.*` como ya hacía correctamente `handleSendWhatsApp`). El repo se trata como público — es la misma clase de fuga que ya se corrigió una vez en `balancesData.js`.

Arreglado: los `default` de `PurseInfoSchema` pasan a `0` (nunca se usan en la práctica — el documento real de Jefferson en Mongo ya tiene sus propios valores explícitos; los defaults solo aplicarían a un trabajador nuevo con `isSpecialPurse` que hoy en día solo se puede crear a mano por API, nunca desde la UI, así que quien lo cree ya debe rellenar sus cifras reales). La tarjeta de `PartnerDashboardView.jsx` ahora lee `worker.purseInfo.totalHours/grossBase/housingDeduction/netFixedAt80h` en vez de las cifras fijas. Verificado en el navegador contra los datos reales de Jefferson en producción — la tarjeta se ve exactamente igual (mismos números), solo que ahora vienen de Mongo, no del código.

## Bug crítico de fichajes — "no desficha" (corregido)

Reportado por el usuario: algunos trabajadores no podían fichar salida ("no desficha"). Causa raíz encontrada: `GET /api/clock` (`server/src/routes/clock.routes.js`) devuelve los fichajes con `.sort({ createdAt: -1 })` — el más reciente primero, pensado para que el historial se vea así en la UI — pero **todo el código cliente que decide "¿está este trabajador fichado ahora?" asumía justo lo contrario** (`array[array.length - 1]` = el más reciente). Con esa combinación, en cuanto un trabajador acumulaba 2+ fichajes históricos, `[length-1]` pasaba a devolver su **primerísima entrada de siempre** (casi siempre `tipo: 'entrada'`, porque nadie puede fichar salida antes que entrada) — así que la app lo daba por "en turno" permanentemente, sin importar su estado real. El botón "Fichar Salida" seguía créandose fichajes de salida reales al pulsarlo, pero la UI (y `LiveMonitorPanel`) volvían a mostrar "en turno" en el siguiente refresco, dando la sensación de que nunca desfichaba. Reproducido y confirmado en producción con los fichajes reales de Gonzalo (entrada 08:58 → salida 10:03 → entrada 10:07: el cálculo viejo cogía la entrada de las 08:58 en vez de la de las 10:07).

Arreglado añadiendo dos helpers compartidos en `client/src/data/shiftCalculations.js` (`sortEntriesByTimestamp`, `getActiveShiftForWorker`) que ordenan cronológicamente antes de decidir "quién está fichado ahora", y usándolos en los 3 sitios que hacían este cálculo cada uno por su cuenta: `WorkerView.jsx` (turno propio del trabajador), `ClockInModal.jsx` (que además leía su propia copia obsoleta de `localStorage` en vez del prop `clockEntries` real — corregido también, podía desincronizarse si el fichaje de entrada se hizo desde otro móvil/dispositivo) y `LiveMonitorPanel.jsx` (mapa de "quién está en turno" del panel en vivo). `pairShiftsFromEntries` también ordena ahora internamente antes de emparejar entrada/salida — sin esto, con fichajes en orden más-reciente-primero, algunos turnos podían quedar mal emparejados o perdidos silenciosamente en el Informe de Fichajes y en Saldos & Acuerdos.

Verificado end-to-end contra producción: con el fichaje real y abierto de Gonzalo (entrada 10:07), el modal ahora muestra correctamente "En Turno" desde las 10:07 (antes habría usado las 08:58) y permite fichar salida; se probó el ciclo completo (fichar salida → pasa a "Descanso" → reabrir modal muestra "Actualmente fuera de turno" con Entrada habilitada) y se revirtió el fichaje de prueba creado durante la verificación para no alterar sus datos reales de nómina.

## Editar/añadir horas manualmente en Control de Saldos & Acuerdos

Pedido por el usuario — antes esa pestaña era de solo visualización. Cada trabajador tiene ahora, en modo Admin, un botón "Añadir concepto / horas manual" con **dos modos**:
- **🕒 Turno (calcula solo)**: fecha + hora entrada + hora salida → calcula horas y precio solo (tarifa del trabajador, `hourlyRate` o 10€/h Extra · 14€/h Nómina), con vista previa en vivo, y construye el texto del concepto en el mismo formato que ya usan las entradas reales (`🕒 15/09 (17:00 a 20:30 - 3.5h a 10€/h)`). Soporta turnos que cruzan medianoche.
- **✏️ Ajuste manual**: concepto libre + importe directo (admite negativo), para cosas que no son horas trabajadas — roturas, saldos iniciales, etc.

Además, icono de papelera en cada línea del desglose para eliminarla. Al guardar/borrar se recalcula `currentBalance` como la suma del `breakdown` y se persiste vía `PUT /api/balances/:id` (endpoint ya existía, protegido con `requireAdmin`, pero no estaba conectado a ninguna UI). El estado local se actualiza al instante (optimista) sin esperar a un refetch. Verificado end-to-end contra el backend real de producción — probados ambos modos (turno de 3.5h calculado correctamente a 35,00€, y el borrado), confirmado el recálculo correcto y la restauración limpia. Para una "socia" sin desbloquear Admin, la pestaña sigue siendo de solo lectura.

## Limpieza — Datos Sensibles & Código (plan de 4 fases, Fases 1-2 hechas)

**Fase 1 — Datos sensibles:** `client/src/data/balancesData.js`, `server/src/data/balancesData.js`, `client/src/data/logisticsData.js` y `server/src/data/logisticsData.js` tenían datos reales de personal (nombres, saldos, desgloses de horas con importes) y del planning real (bodas, clientes, ubicaciones) horneados como seed/fallback. Confirmado que son solo fallback — `PartnerDashboardView` y `App.jsx` siempre sobrescriben con `fetchBalancesFromAPI()`/`fetchWeeksFromAPI()` al montar, y el bootstrap de Mongo (`POST /seed`, `GET /weeks`) solo se dispara si la base de datos está vacía (ya no lo está). Sustituidos por plantillas esqueleto genéricas (`workers: []`, tareas de ejemplo sin nombres de clientes reales). **A partir de ahora estos 4 ficheros ya no se sincronizan con el planning real real** — los datos reales viven solo en Mongo.

**No hecho todavía, a propósito:** `DEFAULT_WORKERS_LIST` en `App.jsx` (roster con nombres reales: Gonzalo, Ricardo...) se dejó sin tocar. A diferencia de saldos/planning, el roster de trabajadores **no tiene ningún fetch que lo sobrescriba** — solo vive en `localStorage` de cada navegador (ver el pendiente de "migrar roster a Mongo"). Genericizarlo ahora mismo rompería la app en cualquier dispositivo/navegador nuevo (sin ese localStorage ya guardado), mostrando nombres falsos "Trabajador 1/2/3" de forma permanente, sin autocorregirse. Hacerlo requiere primero esa migración a Mongo.

**Fase 2 — Limpieza de código:**
- Quitados ~20 imports de iconos de `lucide-react` sin usar en `App.jsx` (quedó reducido a ~700 líneas tras la unificación de paneles, pero los imports viejos no se habían limpiado).
- Eliminado el state `showFullTeamView` en `App.jsx` — declarado pero nunca leído ni usado en ningún sitio.
- Eliminado un bloque muerto `const params = new URLSearchParams(...)` + `workerParam` en `App.jsx` que se calculaba pero nunca se usaba después.
- Eliminado el hack `window.handleUpdateClockEntryInternal`/`window.handleDeleteClockEntryInternal` en `WorkerView.jsx` — las funciones `onUpdateClockEntry`/`onDeleteClockEntry` ya estaban disponibles como props por closure directo, no hacía falta pasarlas por `window`.
- Corregidas 3 clases Tailwind inválidas (`w-4.5 h-4.5`, `w-5.5 h-5.5`) en `PartnerDashboardView.jsx` — esos valores no existen en la escala por defecto de Tailwind, así que no generaban ningún CSS y los iconos quedaban sin el tamaño esperado. Redondeados a los tamaños válidos más cercanos (`w-4 h-4`, `w-5 h-5`) que ya se usan en iconos de cabecera equivalentes en el mismo archivo.

Verificado con build limpio + prueba real en el navegador (no solo build — en la extracción de `shiftCalculations.js` de más abajo el build no detectó una regresión real que sí apareció al probarlo).

**Fase 3 (Animaciones — fondo animado, micro-animaciones) queda fuera de esta pasada a petición del usuario**, por ser una función nueva decorativa y no limpieza. Ver `PENDIENTES.md`.

## Hechas en esta sesión (revisión de "Informe de Fichajes, Horas & Nóminas")

Revisión visual + funcional pedida por el usuario sobre `PayrollReportModal.jsx`. Verificado end-to-end (fichaje público, login admin, fichaje/edición/borrado admin, cálculo de horas y coste, WhatsApp) contra un backend local en memoria (sin tocar Mongo Atlas de producción). Se confirmó primero contra la API real de Render que el estado "0 activos / sin fichajes" que vio el usuario es real (no hay ningún fichaje en la base de datos ahora mismo) — no es un bug de sincronización.

Bugs encontrados y corregidos:

- **`App.jsx`**: el segundo `<PayrollReportModal>` (el que se abre desde el botón "Nóminas" del panel principal, fuera de "Panel Socias") pasaba `isAdmin={isPartnerMode}` en vez de `isAdmin={isAdmin}`. Como en esa rama `isPartnerMode` siempre es `false`, un Admin ya autenticado que entrara por esa ruta (p. ej. tras usar "Vista Pública" y volver) veía el informe en modo solo-lectura, sin "+ Fichaje Admin" ni botones de edición, sin ningún aviso de por qué. Cambiado a `isAdmin={isAdmin}` (igual que las otras dos instancias del modal en el archivo).
- **`PayrollReportModal.jsx`**: la tarjeta "Horas Extras Totales" sumaba las horas de **todos** los turnos, incluidos los de trabajadores con Nómina Fija (Irene, Raúl a 14€/h) — igual que ya hacía correctamente "Gasto Total Extras", que sí excluye esas horas. Resultado: si Irene o Raúl fichaban, sus horas de supervisión se contaban como si fueran "extras a 10€/h", inflando esa cifra. Corregido para excluir los turnos de Nómina Fija, igual que el cálculo del coste.
- **`AdminClockEditModal.jsx`**: al pulsar "Eliminar Fichaje" y entrar en el estado de confirmación, se renderizaban a la vez el grupo de botones de confirmación ("Sí, Eliminar" / "Cancelar") **y** el grupo normal ("Cancelar" / "Guardar Cambios Admin") en la misma fila sin que cupieran, provocando que los dos botones "Cancelar" se solaparan visualmente (reproducible en escritorio, no solo en móvil). Corregido ocultando el grupo de guardar/cancelar mientras se está confirmando el borrado.
- **`PayrollReportModal.jsx`**: la cabecera título+insignia "Fichajes Bloqueados" usaba `space-x-2` sin `flex-wrap`. En anchos de escritorio intermedios (~700-950px de ventana) el título se partía en dos líneas y la insignia quedaba flotando a media altura entre ambas. Cambiado a `flex-wrap + gap-2` con la insignia `shrink-0`, así si no cabe baja limpiamente a su propia línea.
- **`PartnerDashboardView.jsx`**: las pestañas "📜 Control de Saldos & Acuerdos" y "💶 Resumen Financiero & Extras" estaban ocultas tras la condición `{adminUnlocked && ...}`. Ahora están visibles permanentemente en el Panel de Socias (modo solo lectura para socias, con edición habilitada para Admin). Además, se añadió el botón directo "🏢 Panel de Control" en la cabecera para poder navegar de vuelta al dashboard general con un solo clic.
- **`server/src/routes/balances.routes.js`**: `GET /api/balances` ya no exige token de administrador, permitiendo a Socias consultar saldos en tiempo real desde la API/MongoDB Atlas; las operaciones de mutación (`PUT /:id` y `POST /seed`) se mantienen estrictamente protegidas con `requireAdmin`.

Nueva funcionalidad pedida por el usuario tras la revisión — pestaña "📅 Estimado (Planning)":

- El usuario preguntó por qué el informe se veía vacío y esperaba ver "lo que se lleva hasta ahora" aunque nadie hubiera fichado. Se le explicó que el informe solo cuenta fichajes reales (botón Fichar Entrada/Salida), no la planificación semanal — son dos sistemas separados. Preguntado explícitamente, confirmó que sí quiere una estimación basada en el planning, como pestaña **separada** de lo real (nunca mezclada en "Gasto Total Extras" / "Horas Extras Totales", que siguen siendo solo de fichajes reales) y **sin inventar duración** para tareas sin horario completo (esas se listan aparte como "sin estimar").
- Implementado en `PayrollReportModal.jsx`: nueva pestaña que recorre `activeWeekData.schedule` + `saturdaySpecial.weddings` + `sundayMonday.tasks`, parsea `timeFrame` con formato `"HH:MM - HH:MM"` (soporta turnos que cruzan medianoche, p. ej. las bodas del sábado `09:00 - 02:00`), fusiona intervalos solapados del mismo trabajador **dentro del mismo día real** para no contar dos veces horas que ya se sabe que se pisan (ver el punto de solapes en `PENDIENTES.md`), y separa por tarifa (Extra 10€/h vs Nómina Fija 14€/h) igual que el resto del informe. Las tareas con horario incompleto (una sola hora suelta, o vacío) quedan fuera del cálculo y se listan aparte, nunca se les asigna una duración inventada.
- Detalle importante: `sundayMonday` agrupa **dos días de calendario distintos** (domingo y lunes) bajo una sola clave de `schedule` — sin esto, el código de fusión de solapes habría mezclado por error horas de un trabajador el domingo con sus horas el lunes solo porque coincidían en minuto-del-día. Se usa una sub-clave por tarea (índice dentro del array) para que nunca se fusionen entre sí.
- Cálculos verificados a mano contra los datos reales de Semana 3 (Johan 54h, Jeferson 51h, Gonzalo 39h, Jaime 37h, Ricardo 34h, Irene 19h Nómina, Raúl 8h Nómina, Kerly/Jose 6h cada uno — total extras 227h/2270€) — cuadran exactamente.
- El filtro "Trabajador" también se aplica a esta pestaña, incluyendo el total del pie de tabla y la lista de tareas sin estimar (antes de un ajuste, el total del pie seguía mostrando el global aunque se filtrara — corregido en el mismo desarrollo).
- Deliberadamente **no** se incluyó esta estimación en el texto de "Copiar WhatsApp" — ese texto sigue reflejando solo fichajes reales, para no arriesgar que alguien lo lea como una cifra ya confirmada de horas trabajadas.

Observaciones sin cambiar (revisar con el usuario, ver `PENDIENTES.md`):

- La "Valoración Interna Nóminas" (turnos a 14€/h) se calcula (`totalPayrollValuation`) pero solo aparece en el texto copiado de WhatsApp — no hay ninguna tarjeta en el modal que la muestre. Un admin que solo mire el modal (sin copiar el WhatsApp) no ve ese dato agregado, aunque sí puede verlo fila a fila en la tabla "Jornadas Completadas".
- El filtro "Trabajador" del modal solo filtra las filas de las tablas de fichajes reales; las 3 tarjetas resumen de arriba (Gasto Total Extras / Horas Extras Totales / Trabajadores en Turno) siempre muestran el total global, no el del trabajador filtrado — sí se corrigió esto para la nueva pestaña "Estimado (Planning)", pero no para las tarjetas de fichajes reales, para no tocar más de lo pedido. Puede ser intencional, pero podría confundir si se espera que el resumen cambie al filtrar.

## Hechas en sesiones anteriores

- Eliminado `PartnerDashboardModal.jsx` — duplicaba `PartnerDashboardView.jsx` casi por completo (mismas pestañas: financiero, saldos, logística) y se abría encima de él sin necesidad; además rompía en móvil (overflow horizontal, contenido cortado).
- `TaskFlowGraphView.jsx` refactorizado: las 4 secciones casi-idénticas por día (martes/miércoles/jueves/viernes) que repetían la misma lógica de enlaces con nombres de trabajador hardcodeados dentro de cada bloque se unificaron en un único bucle genérico (`dayConfigs.forEach`) + helpers reutilizables (`linkAssignedWorkers`, `linkTrucksFromText`). Antes: ~120 líneas repetidas y frágiles (dependían de que el nombre apareciera literal en el texto). Ahora: ~40 líneas, y usa el campo `assigned` real.
- Corregido overflow horizontal en móvil en los dos selectores de semana (`App.jsx` y `PartnerDashboardView.jsx`).
- Eliminados 3 componentes muertos con contraseñas hardcodeadas de una versión antigua (`AdminPanel.jsx`, `LoginModal.jsx`, `SecureAccessModal.jsx`) — no los importaba nadie.
- `server/src/data/logisticsData.js` estaba totalmente desincronizado del contenido real (un stub de 13 líneas) — quedaba invisible porque el planning nunca llegó a depender de Mongo hasta hoy. Sincronizado.

## Pasada de limpieza — hecha

- **Lógica de cálculo de saldos por turnos duplicada**: extraída a `client/src/data/shiftCalculations.js` (`pairShiftsFromEntries` empareja entrada/salida en turnos con duración y coste; `aggregateShiftsByWorker` agrega esa lista por trabajador). `PartnerDashboardView.jsx` y `PayrollReportModal.jsx` ahora llaman a las mismas funciones en vez de tener cada uno su propia copia casi idéntica. Verificado con Gemini (revisión de equivalencia de comportamiento) y a mano en el navegador — se detectó y corrigió una regresión real en el primer intento (`activeWorkerShifts`/recuento de "Trabajadores en Turno" en `PayrollReportModal.jsx` se perdía al extraer, porque la función compartida solo devolvía los turnos ya cerrados; ahora devuelve también los fichajes de entrada aún sin cerrar).
- **Mensaje de WhatsApp de saldos duplicado**: quedó resuelto solo al eliminar `BalancesAgreementsModal.jsx` (modal de saldos duplicado, con datos obsoletos de localStorage — `PartnerDashboardView.jsx` ya interpreta el mismo `?view=saldos` directamente y con datos reales de la API). Ya no queda ninguna segunda copia de `handleSendWhatsApp`.
- **Polling combinado en un único `setInterval`**: ya estaba hecho (probablemente en la unificación de paneles) — `client/src/App.jsx` solo tiene un intervalo de 20s que llama a `fetchClockEntriesFromAPI` y `fetchWeeksFromAPI` juntos.

## Candidatas para una futura pasada de limpieza (no hecha, para no arriesgar el estado actual)

- El patrón `typeof task === 'object' ? task.text : task` (task puede ser string u objeto) se repite en muchos componentes (`WorkerView`, `App.jsx`, `TaskFlowGraphView`, `AdminTaskEditorModal`). Ahora que todas las tareas nuevas se crean como objetos, se podría plantear (con cuidado, hay datos antiguos) normalizar todo a objeto una sola vez al cargar la semana, y quitar esa comprobación de todos los sitios. Se deja fuera de esta pasada porque toca muchos archivos a la vez y varias sesiones han estado trabajando en paralelo sobre este mismo código.

## Rendimiento / escalabilidad — notas honestas

- No hay paginación en fichajes (`GET /api/clock` trae todo). Con el volumen actual (una empresa pequeña, unos pocos fichajes al día) no es un problema real; si la plantilla crece mucho o pasan meses sin limpiar el histórico, revisarlo.
- El *bootstrap* automático de Mongo (crear el documento inicial en el primer `GET`) es correcto para esta escala, pero si algún día hay más de una "semana base" tipo `week_3`, habría que revisar esa lógica (solo bootstrapea `week_3`).
- Backend en el plan gratuito de Render: se duerme tras 15 min de inactividad, la primera petición tras eso tarda 30-50s. No es un bug, pero vale la pena que el usuario lo sepa si nota lentitud "al primer fichaje del día".
