import { describe, it, expect } from 'vitest';
import { revisarBaseDeDatos } from './saludBaseDatos';

const f = (id, workerName, type, hora, extra = {}) => ({ id, workerName, type, timestamp: `2026-09-20T${hora}Z`, ...extra });
const equipo = [{ name: 'Ana' }, { name: 'Luis' }];
const semana = { meta: { week: 'Semana 4' }, schedule: { martes: { tasks: [{ id: 'm1', text: 'Carga', timeFrame: '09:00 - 10:00', assigned: ['Ana', 'Pau'] }] }, miercoles: { tasks: [] }, jueves: { tasks: [] }, viernes: { tasks: [] } }, saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] } };

describe('revisarBaseDeDatos', () => {
  it('todo en orden: nada pendiente', () => {
    const r = revisarBaseDeDatos({ fichajes: [f('1', 'Ana', 'entrada', '08:00:00'), f('2', 'Ana', 'salida', '12:00:00')], equipo, fichas: [{ name: 'Ana Gula' }, { name: 'Luis' }], ahora: new Date('2026-09-21T00:00:00Z') });
    expect(r.pendientes).toBe(0);
  });

  it('papelera, fichajes que sobran, turnos largos y huérfanos (fichajes, tareas y fichas de quien no está; quien no tiene ficha)', () => {
    const r = revisarBaseDeDatos({
      fichajes: [
        f('1', 'Ana', 'entrada', '08:00:00'), f('2', 'Ana', 'salida', '08:00:05'), // sobran (0 min)
        f('3', 'Luis', 'entrada', '01:00:00'), f('4', 'Luis', 'salida', '17:00:00'), // 16 h: revisar
        f('5', 'Pau', 'entrada', '09:00:00'), f('6', 'Pau', 'salida', '10:00:00'), // ya no está en el equipo
      ],
      borrados: [{ id: 'b' }],
      equipo, semanas: { s4: semana }, fichas: [{ name: 'Ana Gula' }, { name: 'Sara' }],
      ahora: new Date('2026-09-21T00:00:00Z'),
    });
    expect(r).toMatchObject({ papelera: 1, idsQueSobran: ['1', '2'], turnosLargos: 1, fichajesSinPersona: ['Pau'], fichasSinPersona: ['Sara'], personasSinFicha: ['Luis'] });
    expect(r.tareasSinPersona).toEqual([{ semana: 'Semana 4', dia: 'Martes', tarea: 'Carga', nombre: 'Pau' }]);
    expect(r.pendientes).toBe(7);
  });

  it('sin fichas de Saldos cargadas no avisa de «sin ficha» (no se sabe)', () => {
    expect(revisarBaseDeDatos({ fichajes: [], equipo, fichas: [] }).personasSinFicha).toEqual([]);
  });
});
