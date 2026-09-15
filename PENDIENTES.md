# Pendientes

## Abiertos, esperando decisión o dato del usuario

- [ ] **Jaime (novato) va solo en la boda de María y Joaquín** (sábado, Semana 3): regla de negocio dice que Jaime debe ir siempre acompañado de Ricardo o Gonzalo por ser novato, pero las 3 bodas son simultáneas — Ricardo y Gonzalo están cada uno en su propia boda a la misma hora, así que no pueden acompañarlo ahí. Sin resolver: ¿se pasa a Johan (o a otra persona del roster) como apoyo en vez de Ricardo/Gonzalo, o se acepta como excepción inevitable dado que solo hay 2 veteranos para 3 bodas a la vez?
- [ ] Ricardo tiene dos recogidas la misma mañana del martes (Dealde + apoyo en Albacar con Johan) — posible solape de horario, sin confirmar si es intencional.
- [ ] **Filtro "Trabajador" del Informe de Fichajes**: al filtrar por un trabajador, las 3 tarjetas resumen de fichajes reales (Gasto Extras / Horas Extras / Activos) siguen mostrando el total de todo el equipo, no el del trabajador filtrado (sí se corrigió esto en la pestaña nueva "Estimado (Planning)"). ¿Es el comportamiento deseado para las tarjetas de fichajes reales o deberían recalcularse también con el filtro aplicado?
- [ ] **Pestaña "Estimado (Planning)" y el texto de WhatsApp**: la nueva pestaña de horas estimadas desde el planning (ver `MEJORAS.md`) no se incluyó en el texto que genera "Copiar WhatsApp", que sigue siendo solo de fichajes reales. ¿Se quiere también un bloque de estimación en ese mensaje, o mejor mantenerlo fuera para no confundirlo con horas ya confirmadas?

## Detectado al investigar el bug de "no desficha" — real, pero no arreglado todavía

- [ ] **Fallos de la API de fichaje se tragan en silencio**: `saveClockEntryToAPI`/`updateClockEntryInAPI`/`deleteClockEntryInAPI` (`client/src/data/apiService.js`) no comprueban `res.ok` — si el backend responde con error (token admin caducado, validación, 500) o directamente no se llega a llamar, el fichaje se queda "guardado" solo en local/localStorage sin avisar a nadie, y en el siguiente poll de 20s puede revertirse sin explicación aparente. Con la conexión del recinto de una boda esto es plausible. No se ha tocado para no arriesgar el fix de esta sesión — requiere decidir cómo mostrar el error al trabajador/admin.
- [ ] **Sin protección contra doble-toque en Fichar Entrada/Salida** (`ClockInModal.jsx`): un doble clic rápido puede crear dos fichajes del mismo tipo seguidos; al emparejar turnos, el segundo pisa al primero silenciosamente (se pierde la hora real, aunque el fichaje duplicado sigue ahí ensuciando el historial).
- [ ] **Fichajes de un trabajador que ya no está en `workersList` desaparecen del total sin aviso** (`aggregateShiftsByWorker` en `shiftCalculations.js`) — relevante si se renombra a alguien sin migrar sus fichajes ya existentes (ver regla en `CLAUDE.md`).

## Funcionalidad pedida, no empezada todavía

- [ ] **Detección de solapes de horario**: avisar si dos tareas asignadas a la misma persona se pisan en el tiempo. Pedido explícitamente por el usuario, no implementado aún.
- [ ] **Gestión de flota (camiones)**: poder añadir/quitar camiones desde la app, igual que ya existe "Añadir Trabajador" para el roster de personas. Ahora mismo la lista de camiones (`trucks`) solo se edita tocando el código/Mongo directamente.
- [ ] Migrar el **roster de trabajadores** (`workersList`) a Mongo también — ahora mismo solo vive en `localStorage` del navegador de cada admin, así que añadir un trabajador nuevo en un dispositivo no se ve en otro. Relacionado con el punto de gestión de flota. **También es requisito previo** para poder genericizar `DEFAULT_WORKERS_LIST` en `App.jsx` (nombres reales del equipo) de forma segura — ver `MEJORAS.md`, Fase 1 de limpieza de datos sensibles.
- [ ] **Fase 3 del plan de limpieza — Animaciones**: `AnimatedBackground.jsx` con iconos flotantes por sección, keyframes CSS en `index.css`, integración en las vistas principales, micro-animaciones en iconos interactivos (hover, pestaña activa...). Diferido a petición del usuario por ser función nueva decorativa, no limpieza — pendiente de decidir cuándo abordarla.

## Revisión pendiente (el usuario pidió repasar, no se ha cerrado el bucle)

- [ ] Repasar la foto completa de la hoja de planning original una vez más, día por día, contra lo que hay guardado en Mongo ahora mismo, para confirmar que no se ha perdido nada en las varias rondas de ediciones de esta sesión.

## Ideas mencionadas pero no confirmadas como necesarias

- El usuario preguntó por "código limpio, sin duplicados, buen rendimiento, escalable" de forma genérica — no se ha hecho una auditoría completa, solo se ha limpiado lo que se ha encontrado de paso (ver MEJORAS.md).

## Investigado y no reproducido (dejar constancia por si vuelve a pasar)

- [ ] **Salto espontáneo de pestaña en `PartnerDashboardView`**: el usuario reportó que, tras ~90s en "Control de Saldos & Acuerdos" sin interactuar, la vista volvió sola a "Actividad en Tiempo Real". Investigado a fondo: `activeTab` es estado local que solo cambia en los 7 `onClick` de las pestañas (`client/src/components/PartnerDashboardView.jsx`), no hay ningún `useEffect` que lo reinicie por props, y el polling de 20s de `App.jsx` (`fetchClockEntriesFromAPI`/`fetchWeeksFromAPI`) solo cambia las props que recibe el componente — no le pasa una `key`, así que React no debería desmontarlo. Instrumentado con logs de mount/unmount y de cambios de `activeTab`, y verificado con identidad de nodo DOM: tras 6+ ciclos de polling (~185s) en la pestaña de Saldos, sin backend real disponible, el componente nunca se desmontó ni la pestaña cambió sola. Solo se observó el salto una vez, sin comprobación intermedia — lo más probable es que fuera un clic accidental durante esa verificación manual, no un bug de la app. Si vuelve a pasar, sería útil anotar el minuto exacto y si coincidió con algún clic/scroll concreto.
