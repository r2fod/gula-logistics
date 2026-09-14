# Pendientes

## Abiertos, esperando decisión o dato del usuario

- [ ] **Tarea "Recoger Generador 7K + Recoger Fulanita"** (viernes 18, Semana 3) sigue sin nadie asignado (`assigned: []`). Confirmado que "Fulanita" es tal cual como aparece en la hoja real, no es un error de transcripción.
- [ ] Ricardo tiene dos recogidas la misma mañana del martes (Dealde + apoyo en Albacar con Johan) — posible solape de horario, sin confirmar si es intencional.

## Funcionalidad pedida, no empezada todavía

- [ ] **Detección de solapes de horario**: avisar si dos tareas asignadas a la misma persona se pisan en el tiempo. Pedido explícitamente por el usuario, no implementado aún.
- [ ] **Gestión de flota (camiones)**: poder añadir/quitar camiones desde la app, igual que ya existe "Añadir Trabajador" para el roster de personas. Ahora mismo la lista de camiones (`trucks`) solo se edita tocando el código/Mongo directamente.
- [ ] Migrar el **roster de trabajadores** (`workersList`) a Mongo también — ahora mismo solo vive en `localStorage` del navegador de cada admin, así que añadir un trabajador nuevo en un dispositivo no se ve en otro. Relacionado con el punto de gestión de flota.

## Revisión pendiente (el usuario pidió repasar, no se ha cerrado el bucle)

- [ ] Repasar la foto completa de la hoja de planning original una vez más, día por día, contra lo que hay guardado en Mongo ahora mismo, para confirmar que no se ha perdido nada en las varias rondas de ediciones de esta sesión.

## Ideas mencionadas pero no confirmadas como necesarias

- El usuario preguntó por "código limpio, sin duplicados, buen rendimiento, escalable" de forma genérica — no se ha hecho una auditoría completa, solo se ha limpiado lo que se ha encontrado de paso (ver MEJORAS.md).
