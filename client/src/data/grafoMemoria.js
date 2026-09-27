import { esBorradorSemana } from './eventNaming';
import { tipoDeTarea } from './aprendizajeFichajes';
import { esMemoriaPropuesta } from './memoriaIa';

// Grafo de lo que sabe el asistente, hecho con datos que ya existen:
//   · tipos de tarea  ← aprendizaje de los fichajes (con su duración real)
//   · personas        — tipo de tarea: horas fichadas de esa persona en ese tipo
//   · camiones        — persona: veces que van juntos en el planning (bodas y
//                       tareas que nombran el camión)
//   · reglas          — lo que nombran (persona, camión o tipo de tarea)
// { nodos: [{ id, tipo, etiqueta, peso, texto?, propuesta?, detalle? }],
//   enlaces: [{ origen, destino, peso, etiqueta }] }

const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nombra = (texto, clave) => clave.length > 1 && new RegExp(`(^|[^a-z0-9])${escapar(clave)}([^a-z0-9]|$)`).test(texto);

// "Camión Gula (Propio)" → etiqueta "Camión Gula", clave "gula" (lo que se escribe
// al nombrarlo). Una boda puede llevar varios ("Camión A + Camión B"). Un nombre
// genérico ("Camión", "Furgoneta") no identifica a ninguno: se ignora (si no,
// cualquier tarea que diga "camión" lo enlazaría con todo el mundo).
const GENERICOS = new Set(['camion', 'camiones', 'furgoneta', 'furgo', 'apoyo', 'alquiler']);
function datosCamiones(nombre) {
  return String(nombre || '').replace(/\(.*?\)/g, '').split(/\s*(?:\+|\/|,|\sy\s)\s*/).map(parte => {
    const etiqueta = parte.trim();
    const clave = plano(etiqueta).replace(/^camion\s+/, '').trim();
    return clave && !GENERICOS.has(clave) ? { etiqueta, clave } : null;
  }).filter(Boolean);
}

export const TIPOS_NODO = {
  tipo: { nombre: 'Tipos de tarea', singular: 'Tipo de tarea', clase: 'fill-amber-400' },
  persona: { nombre: 'Personas', singular: 'Persona', clase: 'fill-sky-400' },
  camion: { nombre: 'Camiones', singular: 'Camión', clase: 'fill-violet-400' },
  regla: { nombre: 'Reglas', singular: 'Regla', clase: 'fill-emerald-400' },
};

export function construirGrafoMemoria({ equipo = [], semanas = {}, aprendizaje = null, memorias = [] } = {}) {
  const nodos = new Map();
  const enlaces = new Map();
  const nodo = (id, datos) => { if (!nodos.has(id)) nodos.set(id, { id, peso: 0, ...datos }); return nodos.get(id); };
  const enlazar = (a, b, peso, etiqueta) => {
    const clave = [a, b].sort().join('|');
    const previo = enlaces.get(clave);
    enlaces.set(clave, { origen: a, destino: b, peso: (previo?.peso || 0) + peso, etiqueta });
  };

  // Tipos de tarea y personas, de los fichajes.
  const stats = new Map((aprendizaje?.porTipo || []).map(t => [t.tipo, t]));
  Object.entries(aprendizaje?.porPersona || {}).forEach(([persona, tipos]) => {
    Object.entries(tipos).forEach(([tipo, horas]) => {
      if (tipo === 'Otras' || horas < 0.5) return;
      const t = nodo(`tipo:${tipo}`, { tipo: 'tipo', etiqueta: tipo, detalle: stats.get(tipo) || null });
      const p = nodo(`persona:${persona}`, { tipo: 'persona', etiqueta: persona });
      t.peso += horas;
      p.peso += horas;
      enlazar(p.id, t.id, horas, 'h fichadas');
    });
  });
  // Todo el equipo aparece aunque aún no haya fichado nada.
  equipo.forEach(w => w?.name && nodo(`persona:${w.name}`, { tipo: 'persona', etiqueta: w.name }));

  // Camiones y con quién van, de las semanas aceptadas.
  const personasPorClave = new Map([...nodos.values()].filter(n => n.tipo === 'persona').map(n => [plano(n.etiqueta), n.id]));
  const idPersona = (nombre) => personasPorClave.get(plano(nombre));
  Object.values(semanas || {}).filter(w => w && !esBorradorSemana(w)).forEach(semana => {
    const camiones = [...(semana.trucks || []).map(t => t?.name), ...(semana.saturdaySpecial?.weddings || []).map(b => b?.truck)]
      .flatMap(datosCamiones);
    camiones.forEach(c => nodo(`camion:${c.clave}`, { tipo: 'camion', etiqueta: c.etiqueta }));
    const juntos = (texto, asignados = [], camionesFijos = null) => {
      const t = plano(texto);
      const usados = camionesFijos || camiones.filter(c => nombra(t, c.clave));
      usados.forEach(c => (asignados || []).forEach(nombre => {
        const p = idPersona(nombre);
        if (!p) return;
        nodos.get(`camion:${c.clave}`).peso += 1;
        enlazar(p, `camion:${c.clave}`, 1, 'veces juntos');
      }));
    };
    (semana.saturdaySpecial?.weddings || []).forEach(b => b?.active !== false && juntos('', b.assigned, datosCamiones(b.truck)));
    [...Object.values(semana.schedule || {}).map(d => d?.tasks), semana.sundayMonday?.tasks].forEach(lista =>
      (lista || []).forEach(t => t && typeof t === 'object' && t.active !== false && juntos(t.text, t.assigned)));
  });

  // Reglas y lo que nombran.
  const destinos = [...nodos.values()].filter(n => n.tipo === 'persona' || n.tipo === 'camion');
  memorias.forEach((m, i) => {
    if (!m?.content) return;
    const id = `regla:${m._id || i}`;
    nodo(id, { tipo: 'regla', etiqueta: `R${i + 1}`, texto: m.content, propuesta: esMemoriaPropuesta(m), peso: 1 });
    const texto = plano(m.content);
    destinos.forEach(d => {
      const clave = d.tipo === 'camion' ? d.id.slice('camion:'.length) : plano(d.etiqueta);
      if (nombra(texto, clave)) enlazar(id, d.id, 1, 'la nombra');
    });
    const tipo = tipoDeTarea(m.content);
    if (tipo !== 'Otras') enlazar(id, nodo(`tipo:${tipo}`, { tipo: 'tipo', etiqueta: tipo, detalle: stats.get(tipo) || null }).id, 1, 'trata de');
  });

  return { nodos: [...nodos.values()], enlaces: [...enlaces.values()] };
}

// Vecinos de un nodo con el peso del enlace (para el detalle del nodo elegido).
export function vecinosDe(grafo, id) {
  const porId = new Map(grafo.nodos.map(n => [n.id, n]));
  return grafo.enlaces
    .filter(e => e.origen === id || e.destino === id)
    .map(e => ({ nodo: porId.get(e.origen === id ? e.destino : e.origen), peso: e.peso, etiqueta: e.etiqueta }))
    .filter(v => v.nodo)
    .sort((a, b) => b.peso - a.peso);
}

// Colocación en anillos (sin física: siempre sale igual): tipos de tarea en el
// centro, personas alrededor y camiones y reglas por fuera. Cada nodo de fuera
// se acerca al ángulo medio de los nodos de dentro con los que se enlaza, así
// las líneas se cruzan poco. Devuelve los nodos con x, y.
// En pantallas estrechas (más alto que ancho) los anillos se abren más: si no,
// las etiquetas de los tipos de tarea, que van en el centro, se pisan.
const ANILLOS = [{ tipos: ['tipo'], radio: 0.17, estrecho: 0.27 }, { tipos: ['persona'], radio: 0.33, estrecho: 0.41 }, { tipos: ['camion', 'regla'], radio: 0.45, estrecho: 0.47 }];

export function colocarGrafo(grafo, { ancho, alto }) {
  const estrecho = alto > ancho;
  const cx = ancho / 2;
  const cy = alto / 2;
  const angulos = new Map();
  const colocados = [];

  ANILLOS.forEach(({ tipos, radio: radioAncho, estrecho: radioEstrecho }, nivel) => {
    const radio = estrecho ? radioEstrecho : radioAncho;
    const delAnillo = grafo.nodos.filter(n => tipos.includes(n.tipo));
    if (!delAnillo.length) return;
    const objetivo = (n) => {
      if (nivel === 0) return 0;
      let sx = 0; let sy = 0;
      grafo.enlaces.forEach(e => {
        const otro = e.origen === n.id ? e.destino : e.destino === n.id ? e.origen : null;
        if (otro && angulos.has(otro)) { sx += Math.cos(angulos.get(otro)) * e.peso; sy += Math.sin(angulos.get(otro)) * e.peso; }
      });
      return sx || sy ? Math.atan2(sy, sx) : Infinity;
    };
    const ordenados = nivel === 0
      ? [...delAnillo].sort((a, b) => b.peso - a.peso)
      : delAnillo.map(n => ({ n, a: objetivo(n) })).sort((x, y) => x.a - y.a).map(x => x.n);
    const paso = (2 * Math.PI) / ordenados.length;
    const inicio = nivel === 0 ? -Math.PI / 2 : (Number.isFinite(objetivo(ordenados[0])) ? objetivo(ordenados[0]) : -Math.PI / 2);
    ordenados.forEach((n, i) => {
      const a = inicio + i * paso;
      angulos.set(n.id, a);
      colocados.push({ ...n, x: cx + Math.cos(a) * ancho * radio, y: cy + Math.sin(a) * alto * radio, angulo: a, nivel });
    });
  });

  return colocados;
}
