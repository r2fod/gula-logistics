# Gula Logística — Guía técnica para Claude

Panel operativo de logística/catering: planificación semanal, fichaje de horas, saldos financieros del equipo, y paneles diferenciados para trabajadores / socias / admin.

## Arquitectura

- **Cliente** (`client/`): React 18 + Vite + Tailwind. Se despliega como sitio estático en **GitHub Pages** (`npm run deploy` → `gh-pages -d dist`). URL pública: https://r2fod.github.io/gula-logistics
- **Servidor** (`server/`): Express + Mongoose. Desplegado en **Render** (free tier: se duerme tras 15 min sin uso, ~30-50s en despertar). URL: https://gula-logistics.onrender.com
- **Base de datos**: MongoDB Atlas, cluster `BeraCode`, base de datos `gula_logistics` (dedicada, separada de `BeraCode_Gula`/CaterFlow que es OTRO proyecto no relacionado — nunca reutilizar esa base).

### ⚠️ El cliente no sabe del servidor en tiempo de compilación por defecto
`VITE_API_URL` se hornea en el JS al hacer `npm run build`. Si cambia la URL del backend (p. ej. redeploy de Render con otro nombre), hay que:
1. Actualizar `client/.env` (no versionado) con la URL nueva.
2. `npm run build && npm run deploy` de nuevo desde `client/`.

## Flujo de despliegue (¡dos repos-checkout distintos en este entorno!)

Este directorio es un **worktree** (`claude/project-functionality-analysis-3b2575`), no el checkout principal. El checkout principal está en `/Users/raul/Desktop/projects/gula-logistics` (rama `main`).

Para publicar cambios:
```bash
# 1. Commit en el worktree (esta rama)
git add -A && git commit -m "..."

# 2. Merge a main en el checkout PRINCIPAL (no aquí)
git -C /Users/raul/Desktop/projects/gula-logistics merge claude/project-functionality-analysis-3b2575
git -C /Users/raul/Desktop/projects/gula-logistics push origin main

# 3. Deploy del cliente (desde el checkout principal, con .env real)
cd /Users/raul/Desktop/projects/gula-logistics/client && npm run deploy

# 4. El servidor en Render se auto-despliega al hacer push a main
#    (si no, hay que darle a "Manual Deploy" en el dashboard de Render)
```

## Seguridad — cómo funciona el login de admin

- **No hay contraseñas hardcodeadas en el código**, nunca. Antes las había (`gula2026`, etc.) — se quitaron por seguridad, ver historial de commits.
- El admin se autentica contra `POST /api/auth/login`, que compara contra un hash bcrypt guardado en Mongo (`AdminConfig`).
- **Primer arranque**: si no existe el documento `AdminConfig` en Mongo, el servidor lo crea usando la variable de entorno `ADMIN_BOOTSTRAP_PASSWORD` (solo se lee esa vez). Después, cambiar la contraseña se hace desde la propia app (botón "Clave" en el panel admin), nunca tocando esa env var de nuevo.
- Variables de entorno requeridas en Render: `MONGODB_URI`, `ADMIN_BOOTSTRAP_PASSWORD`, `AUTH_TOKEN_SECRET` (secreto aleatorio para firmar tokens de sesión — generar con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
- Cambiar la contraseña invalida automáticamente todos los tokens/enlaces anteriores (versión de token en `AdminConfig.tokenVersion`).
- El enlace "Socias" seguro lleva un token real de sesión en la URL (`?token=...`), ya no un secreto estático.

## Dónde vive cada dato

| Dato | Dónde | Notas |
|---|---|---|
| Planning semanal (`allWeeks`) | MongoDB (`LogisticsWeek`) | **Migrado hoy** — antes solo vivía en `localStorage` de cada navegador, por eso nunca se compartía entre dispositivos. `GET /api/logistics/weeks` hace bootstrap desde `server/src/data/logisticsData.js` la primera vez que no hay documentos. |
| Fichajes (`clockentries`) | MongoDB (`ClockEntry`) | Sincronizado, con polling cada 20s en el cliente. |
| Saldos (`workerbalances`) | MongoDB (`WorkerBalance`) | El placeholder en `client/src/data/balancesData.js` es neutro (sin datos reales) a propósito — nunca meter cifras reales ahí, se compila al bundle público. |
| Roster de trabajadores (`workersList`) | Solo `localStorage` del navegador | Aún no migrado a Mongo. Pendiente si se quiere gestión de flota real. |

## Bugs ya corregidos que no hay que reintroducir

- `LiveMonitorPanel.jsx` necesita importar `Square` de `lucide-react` (crash si no, en cuanto alguien esté fichado).
- El grafo de tareas (`TaskFlowGraphView.jsx`) debe usar el array `task.assigned`, **no** buscar el nombre dentro del texto de la tarea — si no, cualquier tarea asignada sin mencionar el nombre en el texto no se conecta a esa persona en el grafo.
- No usar `findOneAndUpdate` con un objeto plano sin `$set` en rutas de Mongoose si se quiere hacer un *merge* parcial — reemplaza el documento entero. Las rutas de `logistics.routes.js` asumen que el cliente siempre manda el objeto de semana **completo**.
- El selector de semana (`<select>`) no debe ir sin límite de ancho en un `flex` sin `flex-wrap` — el texto de las opciones es largo y provoca scroll horizontal en móvil.

## Convenciones del modelo de datos de tareas

Cada tarea (día normal, boda del sábado, domingo/lunes) tiene esta forma:
```js
{ id: "m1", text: "...", location: "...", timeFrame: "09:00 - 11:00", mapsUrl: "https://...", assigned: ["Gonzalo"], completed: false }
```
`assigned` es la fuente de verdad de quién hace qué — lo usan `WorkerView` (para filtrar "mis tareas"), `TaskFlowGraphView` (para las conexiones) y `LiveMonitorPanel`. Si se añade una tarea a mano o por texto, hay que rellenar `assigned` explícitamente o esos tres sitios no la verán como propia de nadie.
