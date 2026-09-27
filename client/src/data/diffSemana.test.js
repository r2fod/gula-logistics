import { describe, it, expect } from 'vitest';
import { diffSemana, avisosDeSemana, tareasDeSemana } from './diffSemana';

const actual = {
  trucks: [{ name: 'Camión Norte (Propio)' }],
  schedule: { martes: { tasks: [
    { id: 'm1', text: 'Boda A - Carga', timeFrame: '09:00 - 10:00', assigned: ['Ana'] },
    { id: 'm2', text: 'Recoger sillas', timeFrame: '11:00 - 12:00', assigned: ['Luis'] },
  ] } },
  saturdaySpecial: { weddings: [{ location: 'Finca', truck: 'Camión Norte', timeFrame: '12:00 - 20:00', assigned: ['Ana'] }] },
  sundayMonday: { tasks: [{ id: 'd1', text: 'Devolución', timeFrame: '10:00 - 11:00', targetDay: 'Domingo', assigned: ['Eva'] }] },
};
const equipo = [{ name: 'Ana' }, { name: 'Luis' }, { name: 'Eva' }];

describe('diffSemana', () => {
  it('sin cambios, nada que enseñar', () => {
    expect(diffSemana(actual, structuredClone(actual))).toEqual({ porDia: [], resumen: { nuevas: 0, quitadas: 0, cambiadas: 0 } });
  });

  it('enseña por día lo nuevo, lo quitado y lo cambiado (horario y quién entra o sale)', () => {
    const propuesta = structuredClone(actual);
    propuesta.schedule.martes.tasks[0].timeFrame = '09:00 - 11:00';
    propuesta.schedule.martes.tasks[0].assigned = ['Ana', 'Luis'];
    propuesta.schedule.martes.tasks.splice(1, 1); // quita "Recoger sillas"
    propuesta.schedule.miercoles = { tasks: [{ id: 'mi1', text: 'Boda A - Descarga', timeFrame: '10:00 - 14:00', assigned: ['Eva'] }] };
    const d = diffSemana(actual, propuesta);
    expect(d.resumen).toEqual({ nuevas: 1, quitadas: 1, cambiadas: 1 });
    const martes = d.porDia.find(x => x.dia === 'martes');
    expect(martes.quitadas).toEqual(['Recoger sillas']);
    expect(martes.cambiadas).toEqual([{ texto: 'Boda A - Carga', cambios: ['horario: 09:00 - 10:00 → 09:00 - 11:00', 'entra Luis'] }]);
    expect(d.porDia.find(x => x.dia === 'miercoles').nuevas).toEqual(['Boda A - Descarga']);
  });

  it('empareja por texto si Gemini quita o cambia los ids', () => {
    const propuesta = structuredClone(actual);
    delete propuesta.schedule.martes.tasks[1].id;
    expect(diffSemana(actual, propuesta).resumen).toEqual({ nuevas: 0, quitadas: 0, cambiadas: 0 });
  });

  it('las tareas desactivadas no cuentan y el domingo/lunes va a su día', () => {
    const w = structuredClone(actual);
    w.schedule.martes.tasks[1].active = false;
    expect(tareasDeSemana(w).map(t => `${t.dia}:${t.texto}`)).toEqual(['martes:Boda A - Carga', 'sabado:Boda: Finca (Camión Norte)', 'domingo:Devolución']);
  });
});

describe('avisosDeSemana', () => {
  it('BUG evitado: avisa de gente y camiones que Gemini se ha inventado', () => {
    const propuesta = structuredClone(actual);
    propuesta.schedule.martes.tasks[1].assigned = ['Pepe'];
    propuesta.saturdaySpecial.weddings[0].truck = 'Camión Fantasma';
    const avisos = avisosDeSemana(propuesta, { equipo });
    expect(avisos).toContain('Asigna a quien no está en el equipo: Pepe.');
    expect(avisos).toContain('Usa camiones que no están en la flota: Camión Fantasma.');
  });

  it('avisa de quien tiene dos tareas a la vez el mismo día', () => {
    const propuesta = structuredClone(actual);
    propuesta.schedule.martes.tasks[1] = { id: 'm2', text: 'Recoger sillas', timeFrame: '09:30 - 10:30', assigned: ['Ana'] };
    expect(avisosDeSemana(propuesta, { equipo })).toEqual(['Personas con dos tareas a la vez: Ana (martes): «Boda A - Carga» y «Recoger sillas».']);
  });

  it('una semana bien hecha no da avisos (camión de la flota aunque lleve paréntesis)', () => {
    expect(avisosDeSemana(actual, { equipo })).toEqual([]);
  });
});
