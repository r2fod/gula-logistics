# Contexto de negocio — Gula Logística

## Qué es
Logística de eventos y catering (bodas, banquetes, corporativos) en la zona de Valencia. La app coordina el planning semanal (tareas, recogidas, bodas), la flota, el fichaje de horas del equipo, los saldos/acuerdos con cada persona y el resumen de costes por evento.

**Quién la usa:** el admin (panel completo, con sesión), las socias (mismo panel en solo lectura, con un enlace que genera el admin en "Enlaces de WhatsApp"/"Link Socias": caduca a los 90 días y se puede anular), cada trabajador con su enlace fijo `?worker=Nombre` (su semana y sus fichajes) y una vista pública sin datos económicos.

## Equipo y flota
- El equipo vive en Mongo (`/api/roster`, editable desde la app). Roles: conductores de flota, apoyo de logística y preparación, limpieza de vajilla, base/checklist y jefe de logística. La mayoría cobra por hora como extra; dos personas están en nómina fija; algunas tienen ayuda de transporte por día y una tiene una bolsa mensual de horas. **Las cifras y los nombres están en Mongo, no en el repo.**
- Personal de sala de otras empresas puede salir nombrado en el texto de una tarea: no está en el roster ni ficha.
- Flota: un camión propio y alquileres que cambian por semana (gestor de flota del panel; se puede adjuntar el PDF del contrato).

## La semana
- Va de **martes a domingo** y el **lunes siguiente es su cola** (devoluciones, limpieza, cargas). Domingo y lunes comparten una lista; cada tarea lleva "Día Específico" (sin él cuenta como lunes).
- La carga de un evento del martes se hace el lunes anterior y va en la cola de la semana anterior; el Cuadrante de la semana que empieza la enseña como "Lunes N · Víspera" (solo lectura; se edita en su semana).
- `meta.dateRange` ("Del 22 al 27 de Septiembre de 2026") manda: de él salen los números de día y las fechas de cada tarea.
- Las semanas se anticipan solas como **BORRADOR** (las 2 siguientes, desde el Calendario Gula) y no cuentan para nada hasta que un admin las acepta. Para el generador cuentan eventos (con pax y hora) y recogidas/devoluciones de alquiler; no visitas, reuniones ni días cerrados.

## Reglas de negocio (también en el generador y el prompt de Gemini)
1. Las recogidas las hace **una sola persona**, salvo que se pidan dos; las de camión, **por la mañana temprano**.
2. Descargar en un evento incluye **montaje de estructura** (cuenta en el tiempo).
3. Por rol: limpieza solo vajilla y utensilios; conductores y apoyo cargan, descargan y montan; jefe de logística y base/checklist supervisan (ver en `PENDIENTES.md` si esta última regla sigue vigente).
4. **Texto de cada tarea: `"EVENTO - Tarea"`** (varios eventos: `"Boda A + Boda B - Tarea"`). EVENTO es el nombre de la boda/evento o una categoría: "Logística Preparación", "Logística Carga", "Limpieza Eventos". Una tarea de varios eventos reparte horas y coste **por pax** (`week.events`; sin pax, a partes iguales).
5. **Una tarea está hecha SOLO si alguien la marca** (clic) **o se ficha su salida** — decisión del usuario del 25/09: nada se marca solo por la hora ni al terminar la semana. Se guarda la hora real (`completedAt`); pulsar otra vez la desmarca.
6. Una tarea se puede **desactivar** sin borrarla (`active: false`): no cuenta ni se ve en las vistas de trabajo.
7. **Fichajes:** la jornada (y cada tramo de una jornada partida) se puede empezar desde 5 min antes de su primera tarea. Horas redondeadas a la media hora; un turno cuenta como máximo 14 h y uno abierto más de 16 h sale "REVISAR".
8. **Resumen Financiero** por semana (martes a lunes), mes, año o todo; un turno cuenta en el periodo en que empieza. Las horas fichadas sin tarea concreta se reparten entre las tareas del planning asignadas a esa persona (≈, estimación) y solo si no hay ninguna quedan en "Tareas Internas". Quien tiene bolsa de horas cuesta lo mismo que en Saldos. Lo apuntado a mano en Saldos (turnos, transporte, bolsa, ajustes) se enseña aparte, sin mezclarlo con el coste fichado; lo que no lleva fecha solo cuenta en «Todo». **Saldos & Acuerdos** es la cuenta de cada persona (lo que se le debe): turnos fichados + lo apuntado a mano; lo que se le paga en efectivo o Bizum se apunta como «Adelanto» y resta del saldo. En el Resumen esos pagos salen aparte (no son coste) y en «Todo» se ve lo que queda por pagar.
9. **Enlaces:** el de cada trabajador es fijo (`?worker=Nombre`) y abre la semana de hoy (o la siguiente aceptada si la de hoy ya terminó). Quitar a alguien del roster deja su enlace sin efecto. Un borrador nunca se abre a un trabajador.

## Otros proyectos del usuario (NO tocar)
- **CaterFlow**: backend propio en Render y base `BeraCode_Gula` en el mismo cluster de Atlas (`beverages`, `clientes`, `corners`, `departments`, `event_*`…). Nunca leer, escribir ni mezclar.
- **Calendario Gula** (`r2fod.github.io/Generate_Checklist_Gula/calendario/`): fuente de los borradores automáticos; se lee solo desde el servidor con las variables `CALENDARIO_*` de Render.
