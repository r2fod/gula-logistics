import { describe, it, expect } from 'vitest';
import { equipoPorRoles, nombreConNotas, esBackup, descripcionParaIa } from './equipoRoles';
import { restriccionesDelEquipo, restriccionesEfectivas, textoDisponibilidadFija } from './disponibilidad';
import { asignarEquipo } from './optimizadorPlanning';

// Como el equipo real, con nombres de prueba.
const equipo = [
  { name: 'Ana', role: 'Conductor Flota (Veterano)' },
  { name: 'Luis', role: 'Conductor Extra', disponibilidad: [{ dia: 'semana', tipo: 'solo', desde: '15:00', hasta: '23:59' }] },
  { name: 'Pau', role: 'Conductor & Backup' },
  { name: 'Eva', role: 'Apoyo Logística & Prep', backup: true, nota: 'cuando no está en cocina' },
  { name: 'Marta', role: 'Jefe de Logística' },
  { name: 'Sara', role: 'Gula Limpieza Eventos' },
];

describe('equipo por roles (bloque «Equipo» de la vista pública)', () => {
  it('se construye desde el equipo real, por perfiles y con sus notas', () => {
    expect(equipoPorRoles(equipo)).toEqual([
      { role: 'Jefe de logística', members: 'Marta' },
      { role: 'Conductores', members: 'Ana · Luis (desde las 15:00) · Pau (solo si hace falta)' },
      { role: 'Apoyo logística', members: 'Eva (cuando no está en cocina)' },
      { role: 'Limpieza', members: 'Sara' },
    ]);
  });

  it('BUG evitado: nadie que no esté en el equipo aparece (el texto copiado de semana en semana se quedaba viejo)', () => {
    expect(JSON.stringify(equipoPorRoles(equipo))).not.toMatch(/Dirección|Cocina \/ Ventas/);
  });

  it('solo si hace falta: marcado en la ficha o, en fichas antiguas, "backup" en el rol', () => {
    expect(equipo.filter(esBackup).map(p => p.name)).toEqual(['Pau', 'Eva']);
    expect(nombreConNotas(equipo[3])).toBe('Eva (cuando no está en cocina)');
    expect(descripcionParaIa(equipo[3])).toBe('Eva (Apoyo Logística & Prep; cuando no está en cocina; solo si hace falta)');
  });
});

describe('disponibilidad fija (ficha del equipo)', () => {
  it('cuenta en todas las semanas junto a la de cada semana', () => {
    const semana = { meta: { disponibilidad: [{ id: 'r', persona: 'Ana', dia: 'jueves', tipo: 'no' }] } };
    expect(restriccionesEfectivas(semana, equipo).map(r => `${r.persona}:${r.dia}:${r.tipo}${r.fija ? ':fija' : ''}`)).toEqual(['Luis:semana:solo:fija', 'Ana:jueves:no']);
    expect(restriccionesDelEquipo([{ name: 'X', disponibilidad: [{ dia: 'nunca', tipo: 'no' }] }])).toEqual([]);
  });

  it('texto corto para la ficha', () => {
    expect(textoDisponibilidadFija({ dia: 'semana', tipo: 'solo', desde: '15:00', hasta: '23:59' })).toBe('desde las 15:00');
    expect(textoDisponibilidadFija({ dia: 'viernes', tipo: 'solo', desde: '09:00', hasta: '14:00' })).toBe('de 09:00 a 14:00 los viernes');
    expect(textoDisponibilidadFija({ dia: 'sabado', tipo: 'no' })).toBe('no los sábados');
    expect(textoDisponibilidadFija({ dia: 'semana', tipo: 'no' })).toBe('no disponible');
  });

  it('el reparto no pone a quien solo puede desde las 15:00 en una tarea de mañana', () => {
    const tareas = [{ clave: 'm', dia: 'martes', ini: 9 * 60, fin: 11 * 60, n: 1, candidatos: ['Luis', 'Ana'], etiqueta: 'm' }];
    const { asignados } = asignarEquipo({ tareas, equipo, restricciones: restriccionesDelEquipo(equipo) });
    expect(asignados.m).toEqual(['Ana']);
  });
});

describe('textos agrupados por días', () => {
  it('entre semana desde las 15:00 y el fin de semana todo el día: una sola nota', () => {
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
    const persona = { name: 'Luis', role: 'Conductor Extra', disponibilidad: dias.map(dia => ({ dia, tipo: 'solo', desde: '15:00', hasta: '23:59' })) };
    expect(nombreConNotas(persona)).toBe('Luis (desde las 15:00 de lunes a viernes)');
    expect(restriccionesDelEquipo([persona])).toHaveLength(5);
  });
});
