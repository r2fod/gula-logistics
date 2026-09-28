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

// El bloque «Equipo» de la vista pública: [{ role, members }] por perfil, en orden.
export function equipoPorRoles(equipo = []) {
  const pools = clasificarEquipo(equipo);
  const porNombre = new Map(equipo.map(p => [p.name, p]));
  return GRUPOS
    .map(([clave, role]) => ({ role, members: pools[clave].map(p => nombreConNotas(porNombre.get(p.name))).join(' · ') }))
    .filter(g => g.members);
}
