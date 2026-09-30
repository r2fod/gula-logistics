import { plano } from '../utils/texto';
import { textosAgrupados } from './disponibilidad';

// El equipo por perfiles, según el ROL de cada persona. Lo usan el reparto de tareas
// (optimizadorPlanning.js) y el bloque «Equipo» de la vista pública, que se construye
// desde aquí: antes era un texto escrito a mano en cada semana y se quedaba viejo.

// Solo si hace falta: entra cuando los demás van cargados. Marcado en su ficha o, en
// fichas antiguas, con "backup" en el rol.
export const esBackup = (p) => p?.backup === true || /backup/.test(plano(p?.role));

export function clasificarEquipo(equipo = []) {
  const pools = { conductores: [], apoyo: [], prep: [], supervisor: [], limpieza: [] };
  equipo.forEach((p, i) => {
    const rol = plano(p.role);
    const entrada = { name: p.name, orden: i, backup: esBackup(p) };
    if (/limpieza/.test(rol)) pools.limpieza.push(entrada);
    else if (/conductor/.test(rol)) pools.conductores.push(entrada);
    else if (/jefe/.test(rol)) pools.supervisor.push(entrada);
    else if (/prepara|checklist|ayudante/.test(rol)) pools.prep.push(entrada);
    else if (/apoyo/.test(rol)) pools.apoyo.push(entrada);
  });
  return pools;
}

// Quién puede hacer una tarea de ese perfil, por orden de preferencia.
export function candidatosDePerfil(pools, perfil) {
  if (perfil === 'prepEquipo') return [...pools.prep, ...pools.supervisor, ...pools.apoyo];
  if (perfil === 'carga') return [...pools.conductores, ...pools.apoyo];
  if (perfil === 'equipo') return [...pools.conductores, ...pools.apoyo, ...pools.supervisor];
  return pools[perfil] || [];
}

// "Luis (desde las 15:00)", "Eva (cuando no está en cocina)", "Pau (solo si hace falta)".
export function nombreConNotas(p) {
  const notas = [
    p.nota,
    ...textosAgrupados((p.disponibilidad || []).map(r => ({ ...r, persona: p.name, fija: true })), { conPersona: false }),
    esBackup(p) && !p.nota ? 'solo si hace falta' : '',
  ].filter(Boolean);
  return notas.length ? `${p.name} (${notas.join('; ')})` : p.name;
}

// Para los prompts: "Eva (Apoyo logística; cuando no está en cocina; solo si hace falta)".
// La disponibilidad va aparte, en la línea de disponibilidad.
export const descripcionParaIa = (p) => `${p.name} (${[p.role || 'sin rol', p.nota, esBackup(p) ? 'solo si hace falta' : ''].filter(Boolean).join('; ')})`;

const GRUPOS = [
  ['supervisor', 'Jefe de logística'],
  ['conductores', 'Conductores'],
  ['apoyo', 'Apoyo logística'],
  ['prep', 'Base y preparación'],
  ['limpieza', 'Limpieza'],
];

// El equipo agrupado por perfil, en orden: [{ titulo, personas }] (las fichas tal cual).
// Quien no encaja en ningún perfil va al final, en "Otros".
export function gruposDeEquipo(equipo = []) {
  const pools = clasificarEquipo(equipo);
  const porNombre = new Map(equipo.map(p => [p.name, p]));
  const grupos = GRUPOS
    .map(([clave, titulo]) => ({ titulo, personas: pools[clave].map(p => porNombre.get(p.name)) }))
    .filter(g => g.personas.length);
  const clasificados = new Set(Object.values(pools).flat().map(p => p.name));
  const otros = equipo.filter(p => !clasificados.has(p.name));
  return otros.length ? [...grupos, { titulo: 'Otros', personas: otros }] : grupos;
}

// El bloque «Equipo» de la vista pública: [{ role, members }] por perfil, en orden.
export function equipoPorRoles(equipo = []) {
  return gruposDeEquipo(equipo)
    .filter(g => g.titulo !== 'Otros')
    .map(g => ({ role: g.titulo, members: g.personas.map(nombreConNotas).join(' · ') }));
}
