# Pendientes

_Actualizado tras la auditoría completa + tests unitarios + fixes de seguridad de esta sesión (15/09/2026)._

## Resuelto en esta sesión (dejado aquí solo como referencia, ya cerrado)

- ~~Render no desplegaba el servidor~~ — resuelto, deploy manual confirmado y funcionando.
- ~~POST /api/logistics/weeks sin autenticación~~ — resuelto, ahora exige admin; el trabajador sigue pudiendo autocompletar su tarea vía un endpoint nuevo y estrecho (PATCH /weeks/:weekId/tasks) que solo toca `completed` de una tarea.
- ~~Auto-edición/borrado de fichaje propio nunca funcionaba de verdad~~ — resuelto, se quitó ese botón de la vista del trabajador.
- ~~Jaime (novato) va solo en la boda de María y Joaquín~~ — resuelto por eliminación: Jaime se quitó del planning de Semana 3 y del roster de la app (ver detalle abajo). La regla de "novato acompañado" ya no aplica.
- Nuevo: botones de Fichar deshabilitados si el día de la tarea aún no ha llegado.
- Nuevo: horas reales fichadas visibles también en las tarjetas de Saldos & Acuerdos (antes solo en Resumen Financiero).
- Nuevo: se puede quitar/añadir trabajadores del roster desde la propia app (antes solo se podía añadir).
- Nuevo: 61 tests unitarios (antes no había ninguno) para la lógica que ya causó bugs reales — fichajes, caso especial domingo/lunes, autenticación, revocación de sesión admin.

## 🔴 Prioritario — encontrado en la auditoría de hoy, no arreglado todavía

- [ ] **`apiService.js` sigue tragándose errores en silencio en casi todas las escrituras**: `saveClockEntryToAPI`, `updateClockEntryInAPI`, `saveWorkerBalanceToAPI`, `patchTaskCompletionInAPI` no comprueban `res.ok` de forma consistente — si el backend rechaza la petición (token caducado, 500, sin conexión en el recinto de una boda), el cambio se ve "guardado" en local pero puede revertirse solo en el siguiente poll de 20s, sin avisar a nadie. Requiere decidir cómo mostrar el error (¿toast?, ¿reintento automático?) antes de tocarlo — puede afectar a muchos sitios de la app a la vez.
- [ ] **Inconsistencia de nombre "Jefferson" vs "Jeferson"**: `balancesData.workers` (Mongo) tiene `"Jefferson Gula"` (doble f) pero el roster (`workersList`) tiene `"Jeferson"` (una f). Por eso sus horas reales fichadas NUNCA aparecen en su tarjeta de Saldos & Acuerdos (el cruce de nombres que añadí hoy no lo encuentra). Hay que decidir cuál es el nombre correcto y corregirlo en el sitio que esté mal — no lo he tocado yo para no renombrar sin tu confirmación (regla de `CLAUDE.md`).
- [ ] **El roster de trabajadores sigue sin sincronizar entre dispositivos**: la función nueva de añadir/quitar trabajador que acabo de construir sigue guardando solo en `localStorage` de cada navegador — si quitas a alguien desde el móvil, no desaparece en el portátil hasta que también lo quites ahí. Arreglarlo de verdad significa migrar el roster a Mongo (como ya se hizo con el planning) — es una pieza de trabajo con entidad propia, no lo he hecho todavía.
- [ ] **Fichajes de alguien quitado del roster desaparecen del total sin aviso**: si quitas a un trabajador con la función nueva, sus fichajes históricos siguen en Mongo pero `aggregateShiftsByWorker` ya no los suma en ningún resumen (Resumen Financiero, Saldos) porque solo itera sobre `workersList` actual. Antes esto era solo un riesgo teórico (solo pasaba si renombrabas a alguien); ahora que hay un botón real de "quitar", es mucho más fácil que pase sin querer.

## Abiertos, esperando decisión o dato tuyo

- [ ] Ricardo tiene dos recogidas la misma mañana del martes (Dealde + apoyo en Albacar con Johan) — posible solape de horario, sin confirmar si es intencional.
- [ ] **Filtro "Trabajador" del Informe de Fichajes**: al filtrar por un trabajador, las 3 tarjetas resumen de fichajes reales (Gasto Extras / Horas Extras / Activos) siguen mostrando el total de todo el equipo, no el del trabajador filtrado.
- [ ] **Pestaña "Estimado (Planning)" y el texto de WhatsApp**: no se incluyó en "Copiar WhatsApp", que sigue siendo solo de fichajes reales.
- [ ] Texto de la tarea del miércoles "Carga del material de los eventos Encamina y TOUS... (Gonzalo y Jaime)" menciona a Jaime en la descripción aunque él nunca estuvo en el `assigned[]` de esa tarea concreta — inconsistencia cosmética preexistente, no relacionada con la eliminación de hoy (esa tarea no se tocó porque Jaime no estaba asignado ahí).

## Seguridad — detectado hoy, de severidad baja/media, sin tocar

- [ ] **`POST /api/auth/login` sin límite de intentos**: no hay rate-limiting en el servidor, así que en teoría se podría intentar adivinar la contraseña de admin por fuerza bruta (bcrypt lo ralentiza pero no lo bloquea). Con tráfico normal de la app es un riesgo bajo, pero es una mejora real y barata (ej. `express-rate-limit`).
- [ ] **Vulnerabilidad moderada en `esbuild`/`vite`** (dependencia de desarrollo, `npm audit`): solo afecta al servidor de desarrollo local, no a producción. El fix requiere subir Vite a una versión mayor (breaking change) — no lo he forzado.
- [ ] La vista de Saldos & Acuerdos sigue accesible sin login de admin si entras directo a la URL — confirmado hoy en producción real. Ya estaba detectado antes de esta sesión, sigue sin decisión sobre si es el comportamiento querido.
- [ ] `PublicView.jsx` tiene una sección de Checklist que lee `data.tasks`, un campo que no existe en el modelo actual (código muerto, no rompe nada pero no hace nada tampoco).

## Funcionalidad pedida, no empezada todavía

- [ ] **Detección de solapes de horario**: avisar si dos tareas asignadas a la misma persona se pisan en el tiempo.
- [ ] **Gestión de flota (camiones)**: poder añadir/quitar camiones desde la app, igual que ahora ya existe para el roster de personas.
- [ ] **Fase 3 del plan de limpieza — Animaciones**: `AnimatedBackground.jsx`, keyframes, micro-animaciones. Diferido por decisión tuya.
- [ ] **Revisión de adaptación a pantallas** (móvil/tablet/desktop): pedida en esta misma sesión, todavía no empezada — es el siguiente paso lógico tras el audit + tests + fixes de seguridad de hoy.

## Investigado y no reproducido (dejar constancia por si vuelve a pasar)

- [ ] **Salto espontáneo de pestaña en `PartnerDashboardView`**: reportado una vez, investigado a fondo (logs de mount/unmount, identidad de nodo DOM tras 6+ ciclos de polling), nunca reproducido. Probablemente un clic accidental. Si vuelve a pasar, anotar el minuto exacto y si coincidió con algún clic/scroll concreto.
