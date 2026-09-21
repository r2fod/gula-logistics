# Gula Logística — CLAUDE.md
> Live production app. Read `CONTEXTO.md` first.

## CORE
- Lang: Spanish ONLY (código, comentarios, UI, commits). El código de hoy tiene comentarios en inglés en `server/src/routes/auth.routes.js`, `requireAdmin.js`, `authToken.js` — no reescribir solo por esto, pero todo lo nuevo va en español.
- Output: Código directo. Sin texto de relleno antes/después.
- Privacy: Repo tratado como público. Nunca nombres reales, teléfonos, saldos en € ni contraseñas en código, fixtures o commits — pasó exactamente esto con `balancesData.js` y con las claves de admin, ver `MEJORAS.md`.
- Sync: Actualizar `CONTEXTO.md`/`PENDIENTES.md` en el mismo commit si el cambio afecta al negocio o deja algo a medias.

## DATA SCHEMA
- `meta.dateRange` de la semana: texto legible tipo `Del 15 al 20 de Septiembre de 2026` — de él salen las fechas reales de cada tarea (`taskPlanning.js`); si no se puede leer, no se auto-marca ni se tacha nada. `sundayMonday.tasks` es una sola lista domingo+lunes: usar `targetDay` ('Domingo'/'Lunes'); sin él cuenta como lunes.
- Texto de tarea: `"EVENTO - Tarea"` (guion normal entre espacios; ver `client/src/data/eventNaming.js`) — de ahí sale el coste por evento. Las rayas largas (—) son descripción, no separador.
- Task ID: string corta manual por día (`m1`, `mi2`, `v1c`...), sin sistema de migración — al insertar una tarea nueva, elegir un id que no choque con los del mismo día.
- Week ID: `week_<Date.now()>` al crear semana nueva a mano; los borradores automáticos usan `week_auto_AAAA-MM-DD` (martes que la abre) para que dos sesiones no dupliquen; `meta.status` es `"Borrador"` hasta que un admin la acepta (`"Operativa Activa"`); `week_3` es la semilla base (no renombrar sin actualizar `server/src/data/logisticsData.js` y el bootstrap de Mongo).
- WorkerBalance ID: `nombre.toLowerCase().replace(/\s+/g, '-')` — cambiar el nombre de un trabajador sin actualizar este id rompe el vínculo con sus fichajes/saldos.
- ClockEntry ID: `Date.now().toString()`.
- Toda tarea (día normal, boda, domingo/lunes) lleva `assigned: [...]` con nombres exactos de `WORKERS_LIST` — es la fuente de verdad para el grafo, `WorkerView` y `LiveMonitorPanel`. Renombrar a alguien en `WORKERS_LIST` sin tocar los `assigned` existentes los deja huérfanos.

## CODE & UX
- Diffs mínimos. Responsive 320–1920px de verdad — hoy había overflow horizontal real en móvil en dos selectores, ver `MEJORAS.md`.
- UI: Solo Tailwind + transiciones/animaciones nativas (`animate-fadeIn`, `animate-aparecer`, `animate-pop`, `animate-pulse`...; los keyframes viven en `client/src/index.css`). Iconos: la regla global de `index.css` ya los anima al pasar el ratón; para una animación propia, clase `icono-campana|camion|reloj|latido|destello` en el botón. Todo respeta "reducir movimiento". Nada de librerías de animación.
- UI visual: verificar abriendo la app desplegada (https://r2fod.github.io/gula-logistics) y mirando de verdad, no solo que compile. `npm run build` en verde no significa que se vea bien.
- Componentes base (`client/src/components/ui/`) — **usarlos antes de copiar clases**: `Modal` + `CabeceraModal` (todo modal nuevo; ya trae Escape, scroll y botón de cerrar), `Input`/`Selector`/`AreaTexto`/`Campo` (formularios), `Tarjeta`, `EstadoVacio`, `BarraProgreso`, `KpiCard`, `Seccion`. Una acción nueva del panel va en `components/panel/acciones.js` (una sola lista para escritorio, móvil y menú lateral). Importes/horas: `data/formatoFinanciero.js`; fechas y horas: `utils/dateUtils.js` (nada de `toFixed`/`toLocale*` sueltos); un fichaje nuevo: `data/fichajes.js` (`crearFichaje`). Iconos: solo lucide en botones y pestañas (los emojis de avatar son datos).
- Tests: **no hay suite de tests automatizados en este proyecto.** Verificación = build limpio + comprobación manual en el navegador (desktop y móvil) + `curl` contra la API de Render para cambios de backend.
- Seguridad: nunca contraseñas/secretos hardcodeados en el cliente — todo pasa por `/api/auth/*` contra Mongo. Antes de mergear cualquier código que toque auth o datos financieros, releer `CLAUDE.md` (sección seguridad) y `MEJORAS.md`.
- Cambios de IA (Gemini u otros): revisar el JSON que devuelven antes de aplicarlo a una semana — puede alucinar asignaciones o camiones que no existen.

## WORKFLOW
- No editar `logisticsData.js` (cliente o servidor) esperando que afecte a lo ya desplegado — **el planning vive en Mongo desde hoy**, esos archivos solo son la semilla para un bootstrap desde cero. Para cambiar la semana activa hay que hacer `POST /api/logistics/weeks` con el objeto de semana completo (no parcial, `findOneAndUpdate` sin `$set` reemplaza el documento entero).
- Dos checkouts en este entorno: este worktree (rama de trabajo) y `/Users/raul/Desktop/projects/gula-logistics` (checkout principal, rama `main`, desde donde se hace merge + push + `npm run deploy`). Ver flujo completo abajo.
- Deploy cliente: **automático** — cada push a `main` lo despliega la GitHub Action (`.github/workflows/deploy.yml`, Pages en modo workflow; tarda ~1 min, comprobar el hash del bundle en la URL pública). `npm run deploy` (rama `gh-pages`) ya no es lo que se sirve. Deploy servidor: push a `main` dispara auto-deploy en Render (o "Manual Deploy" en su dashboard si no).
- Git: commit en el worktree → merge a `main` en el checkout principal → push → deploy. No hacer commit directo en el checkout principal salvo para el merge.

```bash
# Desde el worktree
git add -A && git commit -m "..."

# Merge + push en el checkout principal
git -C /Users/raul/Desktop/projects/gula-logistics merge <rama-worktree>
git -C /Users/raul/Desktop/projects/gula-logistics push origin main

# El cliente se despliega solo al hacer push (GitHub Action); comprobar con:
gh run list --limit 1
```

## PROHIBITED
- Contraseñas, tokens o datos financieros reales en código, commits o fixtures.
- Renombrar `name` de un trabajador, `id` de semana o `weekId` sin migrar las referencias.
- Dar por buena una vista o flujo solo porque `npm run build` no falla — verificar en el navegador.
- Volver a poner un secreto de sesión/contraseña en el chat si se puede evitar (usar el flujo del token o pedir al usuario que lo pegue directo en Render/Atlas).
- Tocar la base de datos `BeraCode_Gula` o cualquier colección `event_*`/`beverages`/`clientes`/`corners`/`departments` — pertenecen a CaterFlow, otro proyecto, mismo cluster.
