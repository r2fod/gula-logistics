# Pendientes

## Abiertos, esperando decisión o dato del usuario

- [ ] **Tarea "Recoger Generador 7K + Recoger Fulanita"** (viernes 18, Semana 3) sigue sin nadie asignado (`assigned: []`). Confirmado que "Fulanita" es tal cual como aparece en la hoja real, no es un error de transcripción.
- [ ] Ricardo tiene dos recogidas la misma mañana del martes (Dealde + apoyo en Albacar con Johan) — posible solape de horario, sin confirmar si es intencional.
- [ ] **`PayrollReportModal.jsx` no muestra la "Valoración Interna Nóminas"** (turnos de Irene/Raúl a 14€/h) como tarjeta — solo se calcula internamente y aparece en el texto de WhatsApp copiado. ¿Se quiere una 4ª tarjeta resumen en el modal para verla sin tener que copiar el WhatsApp? (ver detalle en `MEJORAS.md`).
- [ ] **Filtro "Trabajador" del Informe de Fichajes**: al filtrar por un trabajador, las 3 tarjetas resumen de fichajes reales (Gasto Extras / Horas Extras / Activos) siguen mostrando el total de todo el equipo, no el del trabajador filtrado (sí se corrigió esto en la pestaña nueva "Estimado (Planning)"). ¿Es el comportamiento deseado para las tarjetas de fichajes reales o deberían recalcularse también con el filtro aplicado?
- [ ] **Pestaña "Estimado (Planning)" y el texto de WhatsApp**: la nueva pestaña de horas estimadas desde el planning (ver `MEJORAS.md`) no se incluyó en el texto que genera "Copiar WhatsApp", que sigue siendo solo de fichajes reales. ¿Se quiere también un bloque de estimación en ese mensaje, o mejor mantenerlo fuera para no confundirlo con horas ya confirmadas?

## Funcionalidad pedida, no empezada todavía

- [ ] **Detección de solapes de horario**: avisar si dos tareas asignadas a la misma persona se pisan en el tiempo. Pedido explícitamente por el usuario, no implementado aún.
- [ ] **Gestión de flota (camiones)**: poder añadir/quitar camiones desde la app, igual que ya existe "Añadir Trabajador" para el roster de personas. Ahora mismo la lista de camiones (`trucks`) solo se edita tocando el código/Mongo directamente.
- [ ] Migrar el **roster de trabajadores** (`workersList`) a Mongo también — ahora mismo solo vive en `localStorage` del navegador de cada admin, así que añadir un trabajador nuevo en un dispositivo no se ve en otro. Relacionado con el punto de gestión de flota.

## Revisión pendiente (el usuario pidió repasar, no se ha cerrado el bucle)

- [ ] Repasar la foto completa de la hoja de planning original una vez más, día por día, contra lo que hay guardado en Mongo ahora mismo, para confirmar que no se ha perdido nada en las varias rondas de ediciones de esta sesión.

## Ideas mencionadas pero no confirmadas como necesarias

- El usuario preguntó por "código limpio, sin duplicados, buen rendimiento, escalable" de forma genérica — no se ha hecho una auditoría completa, solo se ha limpiado lo que se ha encontrado de paso (ver MEJORAS.md).

## Investigado y no reproducido (dejar constancia por si vuelve a pasar)

- [ ] **Salto espontáneo de pestaña en `PartnerDashboardView`**: el usuario reportó que, tras ~90s en "Control de Saldos & Acuerdos" sin interactuar, la vista volvió sola a "Actividad en Tiempo Real". Investigado a fondo: `activeTab` es estado local que solo cambia en los 7 `onClick` de las pestañas (`client/src/components/PartnerDashboardView.jsx`), no hay ningún `useEffect` que lo reinicie por props, y el polling de 20s de `App.jsx` (`fetchClockEntriesFromAPI`/`fetchWeeksFromAPI`) solo cambia las props que recibe el componente — no le pasa una `key`, así que React no debería desmontarlo. Instrumentado con logs de mount/unmount y de cambios de `activeTab`, y verificado con identidad de nodo DOM: tras 6+ ciclos de polling (~185s) en la pestaña de Saldos, sin backend real disponible, el componente nunca se desmontó ni la pestaña cambió sola. Solo se observó el salto una vez, sin comprobación intermedia — lo más probable es que fuera un clic accidental durante esa verificación manual, no un bug de la app. Si vuelve a pasar, sería útil anotar el minuto exacto y si coincidió con algún clic/scroll concreto.
