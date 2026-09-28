# Gula Logística — CLAUDE.md
> App en producción. Leer primero `CONTEXTO.md` (negocio), luego `PENDIENTES.md` (lo abierto) y `MEJORAS.md` (decisiones y lecciones).

## CORE
- Idioma: SOLO español (código, comentarios, UI, commits). Hay comentarios viejos en inglés (auth): no reescribirlos solo por eso.
- Salida: código directo, sin relleno.
- Privacidad: el repo es PÚBLICO. Nunca nombres reales, teléfonos, tarifas, saldos en €, contraseñas ni tokens en código, tests, docs ni commits (en tests: Ana, Luis, Eva…). Ya pasó con `balancesData.js` y con claves de admin (ver `MEJORAS.md`).
- Docs: actualizar `CONTEXTO.md`/`PENDIENTES.md` en el mismo commit si el cambio afecta al negocio o deja algo a medias. Cortos: lo resuelto sale de `PENDIENTES.md` (queda en git), sin narrativas largas.

## DATA SCHEMA
- `meta.dateRange` (`Del 15 al 20 de Septiembre de 2026`): de él salen las fechas reales (`taskPlanning.js`); ilegible = nada se resuelve por fecha. Semana: martes→domingo + lunes de COLA. `sundayMonday.tasks` es una sola lista domingo+lunes: `targetDay` ('Domingo'/'Lunes'); sin él cuenta como lunes.
- Tarea: `{ id, text, timeFrame "HH:MM - HH:MM", assigned[], completed, completedAt, reopened, active, event, targetDay }`. `active: false` = desactivada (no se borra). Se marca SOLO a mano o al fichar su salida — nada se marca solo por la hora.
- Texto de tarea `"EVENTO - Tarea"` (guion normal entre espacios, `data/eventNaming.js`; `+` para varios eventos) — de ahí sale el coste por evento. No reescribir textos de tareas ya fichadas (el fichaje guarda el texto): usar el campo `event`.
- Task ID: corta y manual por día (`m1`, `mi2`, `v1c`…), sin chocar con las del mismo día. `taskRef` de los fichajes apunta por índice (ver `PENDIENTES.md`).
- Week ID: `week_<Date.now()>` a mano; borradores automáticos `week_auto_AAAA-MM-DD` (martes que la abre). `meta.status` `"Borrador"` hasta que un admin la acepta (`"Operativa Activa"`). `week_3` es la semilla base (no renombrar sin tocar `server/src/data/logisticsData.js` y el bootstrap).
- Equipo: solo en Mongo (`/api/roster`, `hooks/useWorkers.js`); el código no trae ninguna lista de arranque. `assigned` usa sus nombres exactos: renombrar a alguien sin migrar los `assigned` los deja huérfanos.
- WorkerBalance ID: `nombre.toLowerCase().replace(/\s+/g, '-')` — cambiar el nombre sin el id rompe su vínculo con fichajes/saldos.
- ClockEntry ID: `crypto.randomUUID()` (`data/fichajes.js`, `crearFichaje`). `POST /api/clock` es idempotente por id (cola offline).

## CODE & UX
- Diffs mínimos, sin duplicar: buscar primero el helper que ya existe. Responsive 320–1920 px de verdad (sin scroll horizontal).
- UI: solo Tailwind + animaciones propias (`animate-fadeIn|aparecer|pop|pulse…`, keyframes en `client/src/index.css`; iconos animados por regla global o clase `icono-campana|camion|reloj|latido|destello`). Respetar "reducir movimiento". Sin librerías de animación.
- Componentes base (`components/ui/`) antes de copiar clases: `Modal`+`CabeceraModal`, `Input`/`Selector`/`AreaTexto`/`Campo`, `Tarjeta`, `EstadoVacio`, `BarraProgreso`, `KpiCard`, `Seccion`, `SelectorPosicion`. Acciones del panel: `components/panel/acciones.js`. Importes/horas: `data/formatoFinanciero.js`; fechas: `utils/dateUtils.js`; horarios "HH:MM - HH:MM": `data/horarios.js`; comparar textos: `plano` de `utils/texto.js`; fechas e ids de semana: `data/fechasSemana.js`; fichajes: `data/fichajes.js`; quién hace cada tarea (reparto, disponibilidad, límites): `data/optimizadorPlanning.js` + `data/disponibilidad.js`; Gemini: `data/editorIa.js` (elige el camino que menos gasta) sobre `data/planificadorIa.js`; dinero de un turno abierto: `data/costeEnVivo.js`, y lo que cambia cada segundo va en `<EnVivo>` (nunca repintar la pantalla entera). Avisos y confirmaciones: `useDialog()` (`contexts/DialogContext.jsx`), nunca `window.alert/confirm`. Iconos: lucide.
- Tests (Vitest): `npx vitest run` en `client/` (~680) y en `server/` (~110; `vitest.setup.js` fija supertest a 127.0.0.1), `npx eslint <archivos>` en `client/`. Componentes con `client/src/test/render.jsx` (monta los proveedores). Un bug arreglado lleva su test "BUG evitado: …".
- Verificación = tests + `npm run build` + mirar la app en el navegador (escritorio y móvil) + `curl` a Render si toca servidor. Build verde ≠ funciona.
- ⚠️ `npm run dev` usa la API de PRODUCCIÓN (`client/.env`): en local solo mirar; nada de fichar, marcar ni guardar.
- Seguridad: secretos solo en Render/Atlas; todo acceso de admin por `/api/auth/*` y `requireAdmin`. Antes de mergear algo de auth o dinero, releer esta sección y `MEJORAS.md`.
- IA (Gemini): revisar el JSON antes de aplicarlo a una semana (puede inventar asignaciones o camiones).

## WORKFLOW
- El planning vive en Mongo: `logisticsData.js` (cliente/servidor) es solo semilla. Cambiar una semana = `POST /api/logistics/weeks` con el objeto COMPLETO (reemplaza el documento; control por `updatedAt`, 409 si alguien guardó antes).
- Dos checkouts: el worktree (rama de trabajo) y `/Users/raul/Desktop/projects/gula-logistics` (`main`, solo para merge + push). Antes de fusionar, traer `origin/main` a la rama (otras sesiones trabajan en paralelo).
- Deploy cliente: automático en cada push a `main` (GitHub Action, ~1 min; comprobar `gh run list` y el hash del bundle en la URL pública). Servidor: Render auto-despliega (de 5 a 25 min y no avisa: comprobar con `curl` algo observable del cambio).

```bash
git add -A && git commit -m "..."                                        # en el worktree
git -C /Users/raul/Desktop/projects/gula-logistics merge <rama-worktree>
git -C /Users/raul/Desktop/projects/gula-logistics push origin main
gh run list --limit 1
```

## PROHIBITED
- Contraseñas, tokens o datos financieros/personales reales en código, commits, tests o docs.
- Renombrar `name` de un trabajador, `id` de semana o `weekId` sin migrar las referencias.
- Dar por buena una vista solo porque compila.
- Poner secretos o contraseñas en el chat (flujo del token o que el usuario lo pegue en Render/Atlas). Borrar datos reales sin permiso explícito.
- Tocar la base `BeraCode_Gula` o colecciones `event_*`/`beverages`/`clientes`/`corners`/`departments` (CaterFlow, otro proyecto, mismo cluster).
