import express from 'express';

// Cuerpos JSON de las peticiones. Lo público (fichar, suscribirse a los avisos) cabe en
// pocos KB: con el límite general (2 MB, para el prompt de Gemini y las semanas)
// cualquiera con la URL podía llenar la base gratuita de Atlas con fichajes enormes.
export const LIMITES_PUBLICOS = { '/api/clock': '16kb', '/api/notifications': '16kb' };

export function usarCuerposJson(app) {
  Object.entries(LIMITES_PUBLICOS).forEach(([ruta, limit]) => app.use(ruta, express.json({ limit })));
  // El general no vuelve a leer lo que ya se leyó arriba.
  app.use(express.json({ limit: '2mb' }));
}

// Un cuerpo demasiado grande o que no es JSON: el motivo en JSON (sin esto, Express
// devolvía su página HTML de error y la app no podía enseñarlo).
export function erroresDeCuerpo(err, req, res, next) {
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Los datos enviados son demasiado grandes' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Los datos enviados no son JSON válido' });
  return next(err);
}
