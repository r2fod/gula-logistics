#!/usr/bin/env node
// Filtro de privacidad: el repositorio es PÚBLICO. Para un commit (o falla GitHub Actions)
// si lleva nombres reales del equipo o de clientes, teléfonos, correos, IBAN o claves.
//
//   node scripts/privacidad.mjs                 archivos preparados para el commit (hook pre-commit)
//   node scripts/privacidad.mjs --todo          todos los archivos del repo (GitHub Actions)
//   node scripts/privacidad.mjs --mensaje FILE  el mensaje del commit (hook commit-msg)
//
// Los nombres reales NO están en el repo ni en ningún archivo o secreto: salen de la base
// de datos cada vez (GET /api/roster, público: es el equipo), así no hay lista que
// mantener. Se guardan en `.git/` (nunca se sube) para los commits sin red o con el
// servidor dormido; en Actions se espera lo que tarde en despertar. Sin nombres (ni red ni
// caché) solo se buscan teléfonos, correos y claves. Los de 3 letras o menos solo cuentan
// con mayúscula («Bo», no «bo»), y no cuentan los nombres inventados de siempre (Ana,
// Luis, Eva…). Una línea con «privacidad-ok» se salta.
// Nunca imprime lo encontrado, solo dónde: los registros de Actions de un repo público se ven.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const plano = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CORREOS_PERMITIDOS = /@(example\.(com|org|net)|[a-z0-9-]+\.(test|invalid|example)|anthropic\.com)$/i;

const PATRONES = [
  { motivo: 'teléfono', re: /(?<![\d.,:/-])(?:\+34[ -]?)?[6-9]\d{2}[ -]?\d{3}[ -]?\d{3}(?![\d.,:/-])/g, vale: (m) => /^\d(\d)\1{7}$/.test(m.replace(/\D/g, '').slice(-9)) }, // 600 000 000: de ejemplo
  { motivo: 'correo', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, vale: (m) => CORREOS_PERMITIDOS.test(m) },
  { motivo: 'IBAN', re: /\bES\d{2}(?: ?\d{4}){5}\b/g },
  { motivo: 'clave de Google', re: /AIza[0-9A-Za-z_-]{35}/g },
  { motivo: 'clave de API', re: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { motivo: 'token de GitHub', re: /\bgh[pousr]_[A-Za-z0-9]{36,}/g },
  { motivo: 'clave privada', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { motivo: 'contraseña en una URL de Mongo', re: /mongodb(?:\+srv)?:\/\/[^\s:@/<>]+:[^\s@/<>]+@/g },
  { motivo: 'token firmado (JWT)', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { motivo: 'clave VAPID', re: /VAPID_PRIVATE_KEY\s*[=:]\s*['"]?[A-Za-z0-9_-]{30,}/g },
];

// Los nombres a buscar: «Telmo» como palabra (sin mirar tildes) y su id de ficha
// («iñigo-gula» → «inigo-gula»). Los cortos, solo con mayúscula: «bo», «dan»… son palabras.
export function reglasDeNombres(nombres = []) {
  return nombres.map(n => plano(n).trim()).filter(Boolean).flatMap((n) => {
    const corto = n.replace(/\s+gula$/i, '').length <= 3;
    const palabra = new RegExp(`(?<![A-Za-z0-9_])${escapar(n)}(?![A-Za-z0-9_])`, corto ? 'g' : 'gi');
    const id = n.toLowerCase().replace(/\s+/g, '-');
    const reglas = [{ motivo: 'nombre real', re: palabra }];
    if (id.length >= 4 && id !== n.toLowerCase()) reglas.push({ motivo: 'nombre real (id)', re: new RegExp(`(?<![A-Za-z0-9_-])${escapar(id)}(?![A-Za-z0-9_-])`, 'g') });
    return reglas;
  });
}

// Lo que no debería estar en un texto: [{ linea, motivo }] (sin el texto encontrado).
export function revisarTexto(texto, nombres = []) {
  const reglas = [...PATRONES, ...reglasDeNombres(nombres)];
  const hallazgos = [];
  String(texto).split('\n').forEach((original, i) => {
    if (original.includes('privacidad-ok')) return;
    const linea = plano(original);
    reglas.forEach(({ motivo, re, vale }) => {
      re.lastIndex = 0;
      for (const m of linea.matchAll(re)) {
        if (!vale || !vale(m[0])) { hallazgos.push({ linea: i + 1, motivo }); break; }
      }
    });
  });
  return hallazgos;
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const API_POR_DEFECTO = 'https://gula-logistics.onrender.com/api'; // pública: ya está en los workflows
// Los nombres inventados que usan los tests y los ejemplos del repo (Ana, Luis, Eva…): una
// persona real que se llame igual no se puede distinguir de ellos, así que no cuentan.
const EJEMPLOS = new Set(['ana', 'luis', 'eva', 'carlos', 'elena', 'bruno', 'pau', 'diego', 'mariana', 'lara', 'marta', 'rafael', 'tomas', 'sofia', 'sara', 'nico', 'marcos', 'juan']);

const rutaDeCache = () => resolve(git('rev-parse', '--git-common-dir').trim(), 'privacidad-nombres.json');
const leerCache = (ruta) => { try { return existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')).nombres || [] : []; } catch { return []; } };
const guardarCache = (ruta, nombres) => { try { writeFileSync(ruta, JSON.stringify({ nombres, en: new Date().toISOString() })); } catch { /* sin caché: se pedirá otra vez */ } };

// Los nombres del equipo, de la base: { nombres, origen: 'base' | 'caché' | 'ninguno' }.
// Nunca falla: sin red ni caché, `ninguno` (el resto del filtro sigue funcionando).
export async function nombresDelEquipo({ env = process.env, llamar = fetch, cache = null } = {}) {
  let rutaCache = cache;
  if (rutaCache === null) { try { rutaCache = rutaDeCache(); } catch { rutaCache = ''; } }
  const base = String(env.PRIVACIDAD_API || API_POR_DEFECTO).replace(/\/+$/, '');
  try {
    const res = await llamar(`${base}/roster`, { signal: AbortSignal.timeout(env.CI ? 90000 : 5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const equipo = (await res.json()).workers;
    if (!Array.isArray(equipo)) throw new Error('respuesta inesperada');
    const nombres = [...new Set(equipo.map(w => String(w?.name || '').trim()).filter(n => n.length > 1))];
    // Un equipo vacío es un fallo (base recién despierta o caída), no «nadie que vigilar»:
    // no pisa la caché y se usa la última lista buena.
    if (!nombres.length) throw new Error('equipo vacío');
    if (rutaCache) guardarCache(rutaCache, nombres);
    return { nombres, origen: 'base' };
  } catch {
    const guardados = rutaCache ? leerCache(rutaCache) : [];
    return { nombres: guardados, origen: guardados.length ? 'caché' : 'ninguno' };
  }
}

// Sin los nombres inventados de siempre.
// Solo el nombre suelto: «Luis García» (nombre y apellido) sí se busca.
export const sinEjemplos = (nombres) => nombres.filter(n => !EJEMPLOS.has(plano(n).trim().toLowerCase()));

const IGNORAR = /(^|\/)(package-lock\.json|node_modules\/|dist\/)|\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|zip)$/i;

async function principal(argv) {
  const { nombres: delEquipo, origen } = await nombresDelEquipo();
  const nombres = sinEjemplos(delEquipo);
  const avisos = [];
  if (origen === 'ninguno') console.warn('privacidad: no se pudieron leer los nombres del equipo de la base (sin red y sin caché): solo se buscan teléfonos, correos y claves.');
  else console.log(`privacidad: ${delEquipo.length} nombres del equipo (${origen === 'base' ? 'de la base de datos' : 'de la última vez que hubo red'}).`);

  if (argv[0] === '--mensaje') {
    revisarTexto(readFileSync(argv[1], 'utf8'), nombres).forEach(h => avisos.push(`mensaje del commit, línea ${h.linea}: ${h.motivo}`));
  } else {
    const todo = argv[0] === '--todo';
    const archivos = (todo ? git('ls-files') : git('diff', '--cached', '--name-only', '--diff-filter=ACMR')).split('\n').filter(f => f && !IGNORAR.test(f));
    archivos.forEach((f) => {
      let contenido;
      try { contenido = todo ? readFileSync(f, 'utf8') : git('show', `:${f}`); } catch { return; }
      if (contenido.includes('\0')) return; // binario
      revisarTexto(contenido, nombres).forEach(h => avisos.push(`${f}:${h.linea}: ${h.motivo}`));
    });
  }

  if (avisos.length) {
    console.error(`\n✋ Privacidad: el repo es PÚBLICO y esto lleva datos que no pueden subirse:\n${avisos.map(a => `  · ${a}`).join('\n')}\n\nCámbialos por datos inventados (Ana, Luis, Eva… / 600 000 000). Si es un nombre inventado que coincide con uno real, añade «privacidad-ok» en esa línea.\n`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await principal(process.argv.slice(2));
