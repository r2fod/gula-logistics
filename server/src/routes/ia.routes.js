import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';

// Gemini con la clave del SERVIDOR (variable GEMINI_API_KEY en Render), solo para
// el admin. Así la clave no vive en el navegador de nadie ni hay que pegarla en
// cada móvil. La app la usa cuando el navegador no tiene clave propia.
const router = express.Router();

// Mismo orden que el cliente (GEMINI_MODELS): solo se pasa al siguiente si el
// modelo ya no existe (404).
const MODELOS = ['gemini-2.5-flash', 'gemini-flash-latest'];

router.get('/estado', requireAdmin, (req, res) => res.json({ configurada: !!process.env.GEMINI_API_KEY }));

router.post('/gemini', requireAdmin, async (req, res) => {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) return res.status(503).json({ error: 'El servidor no tiene clave de Gemini (GEMINI_API_KEY en Render).' });
  const { contents, generationConfig } = req.body || {};
  if (!Array.isArray(contents) || contents.length === 0) return res.status(400).json({ error: 'Falta el contenido para Gemini' });

  try {
    let respuesta = null;
    for (const modelo of MODELOS) {
      respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
        body: JSON.stringify({ contents, generationConfig }),
      });
      if (respuesta.status !== 404) break;
    }
    const datos = await respuesta.json().catch(() => ({}));
    return res.status(respuesta.status).json(datos);
  } catch (error) {
    console.error('Error llamando a Gemini:', error.message);
    return res.status(502).json({ error: 'No se pudo contactar con Gemini' });
  }
});

export default router;
