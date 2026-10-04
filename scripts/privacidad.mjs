#!/usr/bin/env node
// Filtro de privacidad: el repositorio es PÚBLICO. Para un commit (o falla GitHub Actions)
// si lleva nombres reales del equipo o de clientes, teléfonos, correos, IBAN o claves.
//
//   node scripts/privacidad.mjs                 archivos preparados para el commit (hook pre-commit)
//   node scripts/privacidad.mjs --todo          todos los archivos del repo (GitHub Actions)
//   node scripts/privacidad.mjs --mensaje FILE  el mensaje del commit (hook commit-msg)
//
// Los nombres NO pueden estar en el repo: se leen de `.privacidad-nombres.txt` (en la raíz
// de la copia principal, fuera de git) o de la variable PRIVACIDAD_NOMBRES (secreto de
// GitHub). Uno por línea; los de 3 letras o menos solo cuentan con mayúscula («Bo», no «bo»).
// Una línea con «privacidad-ok» se salta (nombres inventados que coinciden con uno real).
// Nunca imprime lo encontrado, solo dónde: los registros de Actions de un repo público se ven.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const plano = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CORREOS_PERMITIDOS = /@(example\.(com|org|net)|[a-z0-9-]+\.(test|invalid|example)|anthropic\.com|gulalogistics\.com)$/i;

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

export function leerNombres() {
  const delEntorno = (process.env.PRIVACIDAD_NOMBRES || '').split(/[\n,]/);
  let delArchivo = [];
  try {
    const raiz = dirname(resolve(git('rev-parse', '--git-common-dir').trim()));
    const archivo = join(raiz, '.privacidad-nombres.txt');
    if (existsSync(archivo)) delArchivo = readFileSync(archivo, 'utf8').split('\n').filter(l => !l.trim().startsWith('#'));
  } catch { /* fuera de git: solo la variable */ }
  return [...new Set([...delEntorno, ...delArchivo].map(s => s.trim()).filter(Boolean))];
}

const IGNORAR = /(^|\/)(package-lock\.json|node_modules\/|dist\/)|\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|zip)$/i;

function principal(argv) {
  const nombres = leerNombres();
  const avisos = [];
  if (!nombres.length) console.warn('privacidad: sin lista de nombres (.privacidad-nombres.txt o PRIVACIDAD_NOMBRES): solo se buscan teléfonos, correos y claves.');

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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal(process.argv.slice(2));
