import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';

// Gemini con la clave del SERVIDOR (variable GEMINI_API_KEY en Render), solo para
// el admin. Así la clave no vive en el navegador de nadie ni hay que pegarla en
// cada móvil. La app la usa cuando el navegador no tiene clave propia.
const router = express.Router();
const API = 'https://generativelanguage.googleapis.com/v1beta';

// Los de siempre, por orden (el cliente usa la misma lista, GEMINI_MODELS). Google los
// va retirando: si ninguno existe (404), se le pregunta cuáles tiene esta clave y se
// elige el mejor Flash (modeloDescubierto). El que funciona se recuerda para la próxima.
const MODELOS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];
let modeloRecordado = null;
export const olvidarModeloRecordado = () => { modeloRecordado = null; }; // para los tests

// Preferencia entre los que ofrece Google: Flash estable y lo más nuevo; nada de
// vistas previas, experimentales ni modelos de imagen, audio o embeddings.
export function puntuarModelo(id) {
  if (!/^gemini/.test(id) || /embedding|image|tts|audio|live|vision/.test(id)) return -Infinity;
  const version = Number((/^gemini-(\d+(?:\.\d+)?)/.exec(id) || [])[1] || 0);
  return (/flash/.test(id) ? 100 : 0) - (/lite/.test(id) ? 30 : 0) - (/preview|exp|thinking/.test(id) ? 60 : 0) + version;
}

async function modelosDeLaClave(clave) {
  try {
    const r = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': clave } });
    if (r.status < 200 || r.status >= 300) return [];
    const { models = [] } = await r.json();
    return models
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => String(m.name || '').replace(/^models\//, ''))
      .filter(id => puntuarModelo(id) > -Infinity)
      .sort((a, b) => puntuarModelo(b) - puntuarModelo(a));
  } catch {
    return [];
  }
}

// Prueba los modelos por orden. Sigue si el modelo no existe (404) o está saturado
// (503); cualquier otra respuesta (bien, clave mala, cuota…) es la definitiva y se
// devuelve. Si no, null y en `fallos` quedan el primer "saturado" y el último "no existe".
async function probar(modelos, clave, cuerpo, fallos) {
  for (const modelo of modelos) {
    const respuesta = await fetch(`${API}/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify(cuerpo),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (respuesta.status >= 200 && respuesta.status < 300) { modeloRecordado = modelo; return { respuesta, datos }; }
    if (respuesta.status === 503) fallos.saturado = fallos.saturado || { respuesta, datos };
    else if (respuesta.status === 404) {
      fallos.noExiste = { respuesta, datos };
      if (modelo === modeloRecordado) modeloRecordado = null; // lo han retirado: no volver a gastar la llamada
    }
    else return { respuesta, datos };
  }
  return null;
}

router.get('/estado', requireAdmin, (req, res) => res.json({ configurada: !!process.env.GEMINI_API_KEY, modelo: modeloRecordado }));

router.post('/gemini', requireAdmin, async (req, res) => {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) return res.status(503).json({ error: 'El servidor no tiene clave de Gemini: en Render (Environment) la variable tiene que llamarse exactamente GEMINI_API_KEY y hay que guardar con «Save, rebuild and deploy».' });
  const { contents, generationConfig } = req.body || {};
  if (!Array.isArray(contents) || contents.length === 0) return res.status(400).json({ error: 'Falta el contenido para Gemini' });

  try {
    const cuerpo = { contents, generationConfig };
    const fallos = {};
    const lista = [...new Set([modeloRecordado, ...MODELOS].filter(Boolean))];
    // Si ninguno de la lista vale (no existen o están saturados), se prueban los que
    // Google dice que tiene esta clave, del mejor al peor.
    const resultado = await probar(lista, clave, cuerpo, fallos)
      || await probar((await modelosDeLaClave(clave)).filter(m => !lista.includes(m)).slice(0, 3), clave, cuerpo, fallos);
    // Sin éxito: el error más útil. "Saturado" antes que "no existe": el 404 de un modelo
    // de reserva no dice nada del problema real.
    const { respuesta, datos } = resultado || fallos.saturado || fallos.noExiste;
    return res.status(respuesta.status).json(datos);
  } catch (error) {
    console.error('Error llamando a Gemini:', error.message);
    return res.status(502).json({ error: 'No se pudo contactar con Gemini' });
  }
});

export default router;
