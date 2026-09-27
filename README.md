# Gula Logística

Panel de logística para eventos y catering: planning semanal (tareas, recogidas, bodas), flota, fichaje de horas del equipo, saldos y costes por evento. En producción en <https://r2fod.github.io/gula-logistics>.

- `client/` — React + Vite + Tailwind (GitHub Pages, se despliega solo en cada push a `main`).
- `server/` — Express + MongoDB Atlas (Render).

```bash
cd client && npm install && npm run dev      # ojo: usa la API de producción (client/.env)
cd client && npx vitest run && npm run build
cd server && npm install && npx vitest run
```

Documentación: `CONTEXTO.md` (negocio y reglas), `PENDIENTES.md` (lo abierto), `MEJORAS.md` (decisiones y lecciones), `CLAUDE.md` (normas para trabajar en el código).
