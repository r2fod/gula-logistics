# Instrucciones para cualquier asistente de IA (Claude, Copilot, Cursor, Codex…)

Las normas completas del proyecto están en `CLAUDE.md`: léelas antes de tocar nada.
Lo imprescindible:

## Privacidad (el repositorio es PÚBLICO)
- **Nunca** pongas datos reales en código, tests, comentarios, documentación ni mensajes de
  commit: nombres del equipo o de clientes, teléfonos, correos, direcciones, tarifas o saldos
  en €, contraseñas, tokens ni claves. En los tests, nombres inventados (Ana, Luis, Eva, Pau…)
  y teléfonos de ejemplo (600 000 000).
- Los datos reales viven solo en la base de datos (MongoDB Atlas), nunca en el repo.
- Un filtro lo comprueba solo: `scripts/privacidad.mjs`, en cada commit (ganchos de
  `.githooks`, se activan con `git config core.hooksPath .githooks`) y en cada subida
  (GitHub Actions, «Privacidad»). Si te para, **cambia el dato por uno inventado**; no lo
  saltes (`--no-verify`) ni lo desactives. Un nombre inventado que coincida con uno real se
  marca con «privacidad-ok» en esa línea.
- La lista de nombres reales está fuera del repo (`.privacidad-nombres.txt` en la copia
  principal y el secreto `PRIVACIDAD_NOMBRES` de GitHub): no la copies a ningún archivo del repo.

## Lo demás
- Idioma: español (código, comentarios, interfaz y commits).
- Nada de borrar datos reales sin permiso explícito, ni tocar la base `BeraCode_Gula`.
- Verificar = tests (`npx vitest run` en `client/` y `server/`) + `npm run build` + mirarlo en el navegador.
