# Contexto de negocio — Gula Logística

## Qué es

Empresa de logística para eventos/catering (bodas, banquetes) en la zona de Valencia. La app coordina: planificación semanal de tareas y recogidas, flota de camiones (uno propio, dos de alquiler), fichaje de horas del equipo, y saldos/acuerdos económicos con cada trabajador.

## Equipo (roster actual — `WORKERS_LIST` en `App.jsx`)

| Nombre | Rol | Tipo |
|---|---|---|
| Gonzalo | Conductor Flota (Veterano) | Extra 10€/h |
| Ricardo | Conductor Flota (Veterano) | Extra 10€/h |
| Johan | Conductor & Backup | Extra 10€/h |
| Irene | Base & Checklist — **NO hace carga ni descarga** | Nómina fija 14€/h |
| Jeferson | Apoyo Logística & Prep — sí ayuda en cargas/descargas/montaje | Extra 10€/h (bolsa especial de 80h/mes) |
| Kerly | Limpieza — solo vajilla/utensilios | Extra 10€/h + 10€ transporte/día |
| Jose | Limpieza & Apoyo — solo vajilla/utensilios | Extra 10€/h + 10€ transporte/día |
| Raúl | Jefe de Logística — supervisión, **NO hace carga ni descarga** | Nómina fija 14€/h |

Personal de eventos/sala mencionado en tareas puntuales (Anto, Marc, Miriam, Luis, Jessi) **no son parte de la flota de Gula** — son personal de sala/catering de otra empresa/proveedor, se mencionan solo como texto de contexto en las tareas, no están en el roster ni fichan en la app.

**Jaime salió del equipo** (quitado del roster y de todas las asignaciones de Semana 3 el 15/09/2026, sin fichajes históricos que migrar). La regla de "novato va siempre acompañado" que existía para él ya no aplica — no hay conductor novato en el roster actual.

## Flota

- **Camión Gula** — propio.
- **Camión Covey** — alquiler.
- **Camión Albacar** — alquiler.

Desde el 19/09/2026 la flota ya no es fija en el código: se gestiona por semana desde el panel de admin (Flota & Bodas → gestor de flota), permitiendo añadir/quitar camiones, marcarlos propio/alquiler y adjuntar el PDF del contrato de alquiler. La lista de arriba es la de partida (Semana 3), no una lista cerrada.

## Semana 3 (15–20 sept. 2026) — la semana operativa actual

La semana **empieza el martes** (no hay lunes operativo — los lunes son reuniones internas, no logística de campo).

Sábado 19 es el día clave: **3 bodas simultáneas**:
1. Sot de Chera (250 pax) — Camión Gula — Ricardo, Raúl + Jeferson (ayuda con la comida)
2. Rocío, Mas dels Refranys — Camión Covey — Gonzalo, Raúl + Jeferson (ayuda con la comida)
3. María y Joaquín — Camión Albacar — Raúl, Johan + Jeferson (ayuda con la comida) — tras quitar a Jaime, Johan pasó a cubrir esta boda

## Reglas de negocio importantes (usadas también en el prompt de Gemini AI)

1. Las recogidas van normalmente **una sola persona**, salvo que se pida explícitamente dos.
2. **Irene y Raúl nunca cargan ni descargan** — solo supervisión/checklist.
3. **Jose y Kerly solo hacen limpieza de vajilla** — nunca carga, descarga ni montaje de estructura.
4. **Jeferson sí ayuda** en carga, descarga y montaje cuando hace falta.
5. Las recogidas de camión se programan **por la mañana temprano** salvo que se diga lo contrario.
6. Descargar en un evento implica también **montaje de estructura** — debe reflejarse en el tiempo estimado.
7. **Domingo y lunes comparten una sola lista de tareas.** Cada tarea puede llevar "Día Específico" (Solo Domingo / Solo Lunes). Sin él es ambigua y el sistema la trata como lunes (nunca se da por hecha antes de tiempo). Las tareas de la última semana operativa se pueden separar así en el planning.
8. **El rango de fechas de la semana (`meta.dateRange`) manda**: de él salen los números de día y cuándo se considera pasada una tarea. Formato que se entiende: "Del 15 al 20 de Septiembre de 2026" (con el año). Si no se entiende, no se marca ni se tacha nada por horario.
9. **Cada tarea lleva su evento en el texto: `"EVENTO - Tarea"`** (si es de varios eventos: `"Boda A + Boda B - Tarea"`, y su coste se reparte entre ellos en proporción a los pax de cada evento, `week.events`; sin pax, a partes iguales) (guion normal entre espacios). El evento es el nombre de la boda o evento ("Boda Ana y Luis", "Evento Catering Norte") o una categoría general: "Logística Preparación", "Logística Carga", "Limpieza Eventos". De ahí sale el desglose de costes por evento y por persona (Resumen Financiero). En el asistente de nueva semana se añaden las bodas y eventos con su día y la IA usa esos nombres.
11. **Las semanas se anticipan solas como BORRADOR** (las 2 siguientes, desde el Calendario Gula) y no se activan hasta que un admin las revisa y las acepta. Para el generador cuentan los eventos (boda, comunión, corporativo, con pax y hora) y las recogidas/devoluciones de alquiler; no las visitas, reuniones ni días cerrados. Las semanas van de martes a domingo (+ lunes de cola).
10. **Cuándo se da una tarea por hecha:** cuando alguien la marca, cuando se ficha su salida, o cuando pasa su hora + 45 min (solo si nadie la desmarcó a propósito y nadie está fichado en ella ahora mismo). Pulsar una tarea que se ve hecha la desmarca, y así se queda.

## Otros proyectos del mismo usuario (NO tocar)

- **CaterFlow** — otro proyecto del usuario, con su propio backend en Render ("CaterFlow-backend", desplegado hace tiempo) y su propia base de datos (`BeraCode_Gula`, mismo cluster de Atlas que Gula Logística pero base separada: `beverages`, `clientes`, `corners`, `departments`, `event_*`...). Completamente independiente — nunca leer, escribir ni mezclar datos con Gula Logística.
