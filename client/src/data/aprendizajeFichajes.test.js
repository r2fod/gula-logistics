import { describe, it, expect } from 'vitest';
import { tipoDeTarea, aprenderDeFichajes, textoAprendizajeParaPrompt, personasPorTipo, formatearMinutos } from './aprendizajeFichajes';
import { pairShiftsFromEntries } from './shiftCalculations';

const ahora = new Date(2026, 8, 30, 12, 0);
const semana = (dateRange, schedule, extra = {}) => ({ name: 'S', meta: { dateRange, status: 'Operativa Activa' }, schedule, ...extra });
const tarea = (text, timeFrame, assigned = ['Ana']) => ({ text, timeFrame, assigned });

let n = 0;
// Un turno fichado sobre una tarea (como lo hace la vista del trabajador: texto + horario).
const turno = (workerName, taskName, ini, fin) => ['entrada', 'salida'].map((type, i) => ({
  id: `f${++n}`, workerName, type, timestamp: (i ? fin : ini).toISOString(), taskName: i ? undefined : taskName, isPayroll: false, rate: 10,
}));
const turnosDe = (...grupos) => pairShiftsFromEntries(grupos.flat()).shifts;

describe('tipoDeTarea', () => {
  it('clasifica por la parte de la tarea, no por el evento', () => {
    expect(tipoDeTarea('Boda Ana y Luis - Carga camión')).toBe('Carga');
    expect(tipoDeTarea('Boda Ana y Luis - Descarga + Montaje Estructura')).toBe('Descarga y montaje');
    expect(tipoDeTarea('Logística Carga - Carga Camión Miércoles')).toBe('Carga');
    expect(tipoDeTarea('Logística Preparación - Devolución Alquileres Norte')).toBe('Recogida y devolución');
    expect(tipoDeTarea('Limpieza Eventos - Limpieza de vajilla')).toBe('Limpieza');
    expect(tipoDeTarea('Boda: Finca Sur (Camión Uno)')).toBe('Servicio de boda');
    expect(tipoDeTarea('Las cargas dobles llevan un apoyo más')).toBe('Carga');
    expect(tipoDeTarea('Revisar furgoneta')).toBe('Otras');
  });
});

describe('aprenderDeFichajes', () => {
  const s3 = semana('Del 15 al 20 de Septiembre de 2026', {
    martes: { tasks: [tarea('Boda Ana - Carga camión', '09:00 - 10:00'), tarea('Boda Eva - Carga camión', '11:00 - 12:00', ['Luis'])] },
    miercoles: { tasks: [tarea('Boda Ana - Carga camión', '09:00 - 10:00'), tarea('Limpieza Eventos - Vajilla', '10:00 - 14:00', ['Eva'])] },
  });

  it('enlaza cada fichaje con su tarea del planning por el texto (aunque lleve el horario pegado) y compara duración real y planificada', () => {
    const turnos = turnosDe(
      turno('Ana', 'Boda Ana - Carga camión (09:00 - 10:00)', new Date(2026, 8, 15, 9, 0), new Date(2026, 8, 15, 10, 30)),
      turno('Luis', 'Boda Eva - Carga camión (11:00 - 12:00)', new Date(2026, 8, 15, 11, 0), new Date(2026, 8, 15, 12, 30)),
      turno('Ana', 'Boda Ana - Carga camión (09:00 - 10:00)', new Date(2026, 8, 16, 9, 0), new Date(2026, 8, 16, 10, 30)),
      turno('Eva', 'Limpieza Eventos - Vajilla (10:00 - 14:00)', new Date(2026, 8, 16, 10, 0), new Date(2026, 8, 16, 14, 0)),
    );
    const a = aprenderDeFichajes(turnos, { s3 }, ahora);
    expect(a.porTipo[0]).toEqual({ tipo: 'Carga', tareas: 3, planificadoMin: 60, realMin: 90, desvioMin: 30 });
    expect(a.porTipo.find(t => t.tipo === 'Limpieza')).toMatchObject({ tareas: 1, desvioMin: 0 });
    expect(a.porPersona).toEqual({ Ana: { Carga: 3 }, Luis: { Carga: 1.5 }, Eva: { Limpieza: 4 } });
    expect(a.enlazados).toBe(4);
  });

  it('BUG evitado: un turno que abarca otras tareas de esa persona NO cuenta como duración de la primera (sí para "quién hace qué")', () => {
    // Ana ficha la carga de las 09:00 y no cambia de tarea hasta las 15:00: dentro
    // caen otras dos tareas suyas. Esas 6 h no son lo que dura una carga.
    const s = semana('Del 15 al 20 de Septiembre de 2026', {
      martes: { tasks: [tarea('Boda Ana - Carga camión', '09:00 - 10:00'), tarea('Boda Ana - Descarga + Montaje', '11:00 - 14:00')] },
    });
    const turnos = turnosDe(turno('Ana', 'Boda Ana - Carga camión', new Date(2026, 8, 15, 9, 0), new Date(2026, 8, 15, 15, 0)));
    const a = aprenderDeFichajes(turnos, { s }, ahora);
    expect(a.porTipo).toEqual([]);
    expect(a.enlazados).toBe(1);
    expect(a.porPersona).toEqual({ Ana: { Carga: 6 } });
  });

  it('un texto repetido en dos semanas se enlaza con la de la fecha del fichaje', () => {
    const s4 = semana('Del 22 al 27 de Septiembre de 2026', { martes: { tasks: [tarea('Boda Ana - Carga camión', '09:00 - 11:00')] } });
    const turnos = turnosDe(turno('Ana', 'Boda Ana - Carga camión', new Date(2026, 8, 22, 9, 0), new Date(2026, 8, 22, 11, 0)));
    expect(aprenderDeFichajes(turnos, { s3, s4 }, ahora).porTipo[0]).toMatchObject({ planificadoMin: 120, desvioMin: 0 });
  });

  it('la jornada sin tarea no enseña nada; una tarea libre cuenta para "quién hace qué" pero no para las duraciones', () => {
    const turnos = turnosDe(
      turno('Ana', 'Inicio de Jornada', new Date(2026, 8, 17, 8, 0), new Date(2026, 8, 17, 12, 0)),
      turno('Luis', 'Limpieza almacén', new Date(2026, 8, 17, 8, 0), new Date(2026, 8, 17, 11, 0)),
    );
    const a = aprenderDeFichajes(turnos, { s3 }, ahora);
    expect(a.porTipo).toEqual([]);
    expect(a.porPersona).toEqual({ Luis: { Limpieza: 3 } });
    expect(a.sinEnlazar).toBe(1);
  });

  it('los borradores no cuentan', () => {
    const borrador = { ...s3, meta: { ...s3.meta, status: 'Borrador' } };
    const turnos = turnosDe(turno('Ana', 'Boda Ana - Carga camión', new Date(2026, 8, 15, 9, 0), new Date(2026, 8, 15, 10, 0)));
    expect(aprenderDeFichajes(turnos, { borrador }, ahora).enlazados).toBe(0);
  });
});

describe('textoAprendizajeParaPrompt', () => {
  const aprendizaje = {
    porTipo: [
      { tipo: 'Carga', tareas: 5, planificadoMin: 60, realMin: 100, desvioMin: 40 },
      { tipo: 'Limpieza', tareas: 2, planificadoMin: 240, realMin: 330, desvioMin: 90 }, // pocas tareas
      { tipo: 'Descarga y montaje', tareas: 6, planificadoMin: 120, realMin: 125, desvioMin: 5 }, // desvío pequeño
      { tipo: 'Otras', tareas: 9, planificadoMin: 60, realMin: 120, desvioMin: 60 }, // no dice nada a Gemini
    ],
    porPersona: { Ana: { Carga: 12, Limpieza: 1 }, Luis: { Carga: 6 } },
  };

  it('solo pasa patrones con datos suficientes y desvío que importe, y quién suele hacer cada tipo', () => {
    const texto = textoAprendizajeParaPrompt(aprendizaje);
    expect(texto).toContain('- Carga: planificadas 1 h de media, reales 1 h 40 (+40 min, 5 tareas).');
    expect(texto).not.toContain('Limpieza: planificadas');
    expect(texto).not.toContain('Descarga y montaje: planificadas');
    expect(texto).not.toContain('Otras');
    expect(texto).toContain('- Carga: Ana (12 h), Luis (6 h).');
  });

  it('sin nada que merezca la pena, no añade nada al prompt', () => {
    expect(textoAprendizajeParaPrompt({ porTipo: [], porPersona: {} })).toBe('');
    expect(textoAprendizajeParaPrompt(null)).toBe('');
  });

  it('personasPorTipo ordena de más a menos horas y descarta lo poco', () => {
    expect(personasPorTipo({ Ana: { Carga: 1 }, Luis: { Carga: 3 }, Eva: { Carga: 5 } })).toEqual({ Carga: [{ nombre: 'Eva', horas: 5 }, { nombre: 'Luis', horas: 3 }] });
  });

  it('formatearMinutos', () => {
    expect(formatearMinutos(45)).toBe('45 min');
    expect(formatearMinutos(90)).toBe('1 h 30');
    expect(formatearMinutos(120)).toBe('2 h');
    expect(formatearMinutos(-15)).toBe('-15 min');
  });
});
