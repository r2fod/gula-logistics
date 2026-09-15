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

## Otros proyectos del mismo usuario (NO tocar)

- **CaterFlow** — otro proyecto del usuario, con su propio backend en Render ("CaterFlow-backend", desplegado hace tiempo) y su propia base de datos (`BeraCode_Gula`, mismo cluster de Atlas que Gula Logística pero base separada: `beverages`, `clientes`, `corners`, `departments`, `event_*`...). Completamente independiente — nunca leer, escribir ni mezclar datos con Gula Logística.
