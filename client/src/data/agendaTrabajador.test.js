import { describe, it, expect } from 'vitest';
import {
  aClaveGuardada, diasDeLaSemana, actividadesDelDia, agendaDeLaSemana, sinLunesRepetido,
  proximaTareaDe, diaDeHoy, esDiaFuturo, diasParaVer, textoDePuerta, textoDeEspera, companerosDeTarea,
} from './agendaTrabajador';

// Semana ficticia del 22 al 27 de septiembre de 2026 (martes 22 … domingo 27, lunes 28 de cola).
const semana = {
  meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026' },
  schedule: {
    martes: { tasks: [
      { id: 'm1', text: 'Boda Uno - Carga', timeFrame: '09:00 - 10:00', assigned: ['Ana'] },
      { id: 'm2', text: 'Otra', timeFrame: '11:00 - 12:00', assigned: ['Luis'] },
      { id: 'm3', text: 'Desactivada', timeFrame: '12:00 - 13:00', assigned: ['Ana'], active: false },
    ] },
    jueves: { tasks: [{ id: 'j1', text: 'Boda Dos - Descarga', timeFrame: '08:00 - 09:00', assigned: ['ana'] }] },
  },
  saturdaySpecial: { weddings: [{ location: 'Finca Sur', truck: 'Camión Uno', timeFrame: '11:00 - 20:00', assigned: ['Ana'] }] },
  sundayMonday: { tasks: [
    { id: 's1', text: 'Recogida', timeFrame: '10:00 - 11:00', targetDay: 'Domingo', assigned: ['Ana'] },
    { id: 's2', text: 'Devolución', timeFrame: '10:00 - 11:00', targetDay: 'Lunes', assigned: ['Ana'] },
  ] },
};
const miercoles = new Date(2026, 8, 23, 10, 0, 0);

describe('agendaTrabajador', () => {
  it('lunes se guarda en la lista del domingo', () => {
    expect(aClaveGuardada('lunes')).toBe('domingo');
    expect(aClaveGuardada('martes')).toBe('martes');
  });

  it('los días van de martes al lunes de cola, con su número de meta.dateRange', () => {
    const dias = diasDeLaSemana(semana, miercoles);
    expect(dias.map(d => d.key)).toEqual(['martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'lunes']);
    expect(dias[0].date).toBe('22');
    expect(dias[6].date).toBe('28');
  });

  it('solo las tareas activas de la persona (nombre sin distinguir mayúsculas)', () => {
    expect(actividadesDelDia(semana, 'martes', 'Ana').tasks.map(t => t.id)).toEqual(['m1']);
    expect(actividadesDelDia(semana, 'jueves', 'Ana').totalCount).toBe(1);
    expect(actividadesDelDia(semana, 'sabado', 'Ana').weddings).toHaveLength(1);
  });

  it('BUG evitado: el lunes no enseña lo etiquetado «Domingo»; el domingo enseña los dos', () => {
    expect(actividadesDelDia(semana, 'lunes', 'Ana').tasks.map(t => t.id)).toEqual(['s2']);
    expect(actividadesDelDia(semana, 'domingo', 'Ana').tasks.map(t => t.id)).toEqual(['s1', 's2']);
  });

  it('los totales no cuentan dos veces la lista domingo/lunes', () => {
    const dias = agendaDeLaSemana(semana, 'Ana', miercoles);
    expect(sinLunesRepetido(dias).reduce((n, d) => n + d.totalCount, 0)).toBe(5);
  });

  it('BUG evitado: la próxima tarea es la que empieza antes y no ha terminado, no la primera por día', () => {
    const dias = agendaDeLaSemana(semana, 'Ana', miercoles);
    const p = proximaTareaDe(semana, dias, miercoles);
    expect(p.taskName).toBe('Boda Dos - Descarga'); // la del martes ya pasó
    expect(p.dayKey).toBe('jueves');
    expect(p.taskIndex).toBe(0);
  });

  it('una boda como próxima tarea lleva su nombre de boda', () => {
    const viernes = new Date(2026, 8, 25, 10, 0, 0);
    const p = proximaTareaDe(semana, agendaDeLaSemana(semana, 'Ana', viernes), viernes);
    expect(p.isWedding).toBe(true);
    expect(p.dayKey).toBe('sabado');
  });

  it('sin tareas pendientes no hay próxima', () => {
    const tarde = new Date(2026, 8, 29, 23, 0, 0);
    expect(proximaTareaDe(semana, agendaDeLaSemana(semana, 'Ana', tarde), tarde)).toBeNull();
  });

  it('hoy sale por fecha real; si la semana no es la de hoy, no hay hoy', () => {
    expect(diaDeHoy(semana, miercoles)).toBe('miercoles');
    expect(diaDeHoy(semana, new Date(2026, 9, 7, 10, 0, 0))).toBeFalsy();
  });

  it('día futuro por fecha real', () => {
    expect(esDiaFuturo(semana, 'jueves', miercoles)).toBe(true);
    expect(esDiaFuturo(semana, 'miercoles', miercoles)).toBe(false);
    expect(esDiaFuturo(semana, 'martes', miercoles)).toBe(false);
  });

  it('BUG evitado: sin fechas legibles, el domingo visto un lunes fue ayer, no es futuro', () => {
    const sinFechas = { schedule: {} };
    const lunes = new Date(2026, 8, 28, 10, 0, 0);
    expect(esDiaFuturo(sinFechas, 'domingo', lunes)).toBe(false);
    expect(esDiaFuturo(sinFechas, 'martes', lunes)).toBe(true);
  });

  it('en «Toda la semana» van primero hoy y lo que viene, y los pasados al final (sin el lunes)', () => {
    const dias = agendaDeLaSemana(semana, 'Ana', miercoles);
    const vistos = diasParaVer(dias, 'all', 'miercoles', (k) => esDiaFuturo(semana, k, miercoles));
    expect(vistos.map(d => d.key)).toEqual(['miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'martes']);
    expect(diasParaVer(dias, 'lunes', 'miercoles', () => false).map(d => d.key)).toEqual(['lunes']);
  });

  it('textos de la puerta y de la espera', () => {
    expect(textoDePuerta({ sinTareasPendientes: true })).toBe('No tienes tareas pendientes ahora');
    expect(textoDePuerta({ sinTareasPendientes: false, inicioPrimeraTarea: null })).toBe('');
    const ahora = new Date(2026, 8, 23, 7, 0, 0);
    expect(textoDePuerta({ sinTareasPendientes: false, inicioPrimeraTarea: new Date(2026, 8, 23, 9, 0, 0), ahora })).toMatch(/a partir de las 08:55/);
    expect(textoDeEspera(new Date(2026, 8, 23, 9, 0, 0), ahora)).toBe('1 h 55 min');
    expect(textoDeEspera(new Date(2026, 8, 23, 7, 20, 0), ahora)).toBe('15 min');
  });

  it('BUG evitado: los compañeros se comparan por nombre exacto, no «lo contiene»', () => {
    const equipo = [{ name: 'Ana', avatar: 'A' }, { name: 'Mariana', avatar: 'M' }, { name: 'Luis', avatar: 'L' }];
    const c = companerosDeTarea(['ana', 'Mariana', 'Luis'], 'Ana', equipo, ['luis']);
    expect(c.map(x => x.name)).toEqual(['Mariana', 'Luis']);
    expect(c[0].profile.avatar).toBe('M');
    expect(c[0].isClockedIn).toBe(false);
    expect(c[1].isClockedIn).toBe(true);
  });
});
