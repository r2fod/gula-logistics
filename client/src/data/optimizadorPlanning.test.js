import { describe, it, expect } from 'vitest';
import { asignarEquipo, perfilDeTarea, revisarPlanning, reajustarSemana } from './optimizadorPlanning';
import { clasificarEquipo, candidatosDePerfil } from './equipoRoles';
import { tramoDeHorario } from './horarios';
import { crearRestriccion, restriccionQueBloquea, textoRestriccion, limitesDe } from './disponibilidad';

const equipo = [
  { name: 'Ana', role: 'Conductora' },
  { name: 'Luis', role: 'Conductor' },
  { name: 'Eva', role: 'Apoyo logística' },
  { name: 'Pau', role: 'Apoyo logística (backup)' },
  { name: 'Marta', role: 'Limpieza' },
];
const conductores = ['Ana', 'Luis'];
const carga = ['Ana', 'Luis', 'Eva', 'Pau'];
const t = (clave, dia, ini, fin, n, candidatos, extra = {}) => ({ clave, dia, ini: ini * 60, fin: fin * 60, n, candidatos, etiqueta: clave, ...extra });
const r = (datos) => crearRestriccion(datos).restriccion;

describe('disponibilidad', () => {
  it('no puede / descansa bloquean todo el día; "solo" bloquea fuera de su horario', () => {
    const rs = [r({ persona: 'Ana', dia: 'jueves', tipo: 'no' }), r({ persona: 'Luis', dia: 'viernes', tipo: 'solo', desde: '9:00', hasta: '14:00' }), r({ persona: 'Eva', dia: 'semana', tipo: 'descansa' })];
    expect(restriccionQueBloquea(rs, 'Ana', 'jueves', 600, 660)).toBeTruthy();
    expect(restriccionQueBloquea(rs, 'Ana', 'viernes', 600, 660)).toBeNull();
    expect(restriccionQueBloquea(rs, 'Luis', 'viernes', 600, 780)).toBeNull();
    expect(restriccionQueBloquea(rs, 'Luis', 'viernes', 780, 900)).toBeTruthy();
    expect(restriccionQueBloquea(rs, 'eva', 'lunes', 0, 60)).toBeTruthy();
    expect(textoRestriccion(rs[1])).toBe('Luis solo puede de 09:00 a 14:00 el viernes');
  });

  it('valida lo que falta y los límites por defecto (9 h al día, 12 h de descanso)', () => {
    expect(crearRestriccion({ persona: '', dia: 'jueves', tipo: 'no' }).error).toBeTruthy();
    expect(crearRestriccion({ persona: 'Ana', dia: 'jueves', tipo: 'solo', desde: '9:00' }).error).toBeTruthy();
    expect(limitesDe({})).toEqual({ maxHorasDia: 9, descansoMinHoras: 12 });
    expect(limitesDe({ meta: { limites: { maxHorasDia: 10, descansoMinHoras: 'x' } } })).toEqual({ maxHorasDia: 10, descansoMinHoras: 12 });
  });
});

describe('asignarEquipo', () => {
  it('reparte para que nadie acumule horas si hay alternativa', () => {
    const tres = ['Ana', 'Luis', 'Eva'];
    const tareas = [t('a', 'martes', 8, 12, 1, tres), t('b', 'martes', 13, 17, 1, tres), t('c', 'miercoles', 8, 12, 1, tres)];
    const { horas, avisos } = asignarEquipo({ tareas, equipo });
    expect([horas.Ana, horas.Luis, horas.Eva]).toEqual([4, 4, 4]);
    expect(avisos).toEqual([]);
  });

  it('el backup solo entra cuando los demás van cargados (6 h más que él)', () => {
    const tareas = [t('a', 'martes', 8, 12, 1, carga), t('b', 'martes', 13, 17, 1, carga), t('c', 'miercoles', 8, 12, 1, carga), t('d', 'miercoles', 13, 17, 1, carga)];
    expect(asignarEquipo({ tareas, equipo }).horas.Pau).toBe(0);
    const muchas = [...tareas, t('e', 'jueves', 8, 16, 1, carga), t('f', 'viernes', 8, 16, 1, carga), t('g', 'viernes', 8, 16, 1, carga)];
    expect(asignarEquipo({ tareas: muchas, equipo }).horas.Pau).toBeGreaterThan(0);
  });

  it('respeta la disponibilidad: si no puede el jueves no va el jueves', () => {
    const tareas = [t('j', 'jueves', 9, 11, 1, conductores)];
    const { asignados } = asignarEquipo({ tareas, equipo, restricciones: [r({ persona: 'Ana', dia: 'jueves', tipo: 'no' })] });
    expect(asignados.j).toEqual(['Luis']);
  });

  it('nadie en dos sitios a la vez, y avisa si no hay gente suficiente', () => {
    const tareas = [t('x', 'viernes', 9, 12, 2, conductores), t('y', 'viernes', 10, 11, 1, conductores)];
    const { asignados, avisos } = asignarEquipo({ tareas, equipo });
    expect(asignados.x.length + asignados.y.length).toBe(2);
    expect(avisos.some(a => /solo \d de \d personas libres/.test(a))).toBe(true);
  });

  it('descanso entre jornadas: quien cierra la boda a las 00:30 no abre el domingo a las 10:00 si hay otro', () => {
    const tareas = [
      t('recogida', 'sabado', 20.5, 24.5, 1, conductores),
      t('domingo', 'domingo', 10, 14, 1, conductores),
    ];
    const { asignados, avisos } = asignarEquipo({ tareas, equipo });
    expect(asignados.recogida[0]).not.toBe(asignados.domingo[0]);
    expect(avisos).toEqual([]);
  });

  it('si no hay nadie más, lo hace pero AVISA de las horas y del descanso', () => {
    const tareas = [t('m', 'martes', 7, 13, 1, ['Ana']), t('t', 'martes', 14, 19, 1, ['Ana']), t('dom', 'domingo', 18, 23, 1, ['Ana']), t('lun', 'lunes', 7, 10, 1, ['Ana'])];
    const { asignados, avisos } = asignarEquipo({ tareas, equipo });
    expect(asignados.t).toEqual(['Ana']);
    expect(avisos.join(' ')).toMatch(/Ana tiene 11\sh el martes \(más de 9\sh\)/);
    expect(avisos.join(' ')).toMatch(/Ana descansa solo 8\sh entre el domingo y el lunes \(mínimo 12\sh\)/);
  });

  it('respeta a quien ya estaba (fijos) y las tareas fijas cuentan para solapes', () => {
    const tareas = [t('a', 'martes', 9, 11, 2, conductores, { fijos: ['Luis'] })];
    const { asignados } = asignarEquipo({ tareas, equipo, fijas: [{ clave: 'f', dia: 'martes', ini: 540, fin: 600, personas: ['Ana'] }] });
    expect(asignados.a).toEqual(['Luis']); // Ana está ocupada en la fija: no hay segundo conductor
  });
});

describe('perfiles', () => {
  it('saca el perfil del texto y los candidatos por rol', () => {
    const pools = clasificarEquipo(equipo);
    expect(perfilDeTarea('Boda X - Limpieza de vajilla')).toBe('limpieza');
    expect(perfilDeTarea('Boda X - Descarga adelantada (Finca)')).toBe('conductores');
    expect(perfilDeTarea('Boda X - Descarga + Montaje Estructura')).toBe('carga');
    expect(perfilDeTarea('Logística Preparación - Recoger mesas')).toBe('conductores');
    expect(perfilDeTarea('Algo raro', ['Marta'], pools)).toBe('limpieza');
    expect(candidatosDePerfil(pools, 'carga').map(p => p.name)).toEqual(['Ana', 'Luis', 'Eva', 'Pau']);
    expect(tramoDeHorario('20:30 - 00:30')).toEqual({ ini: 1230, fin: 1470 });
  });
});

describe('reajustarSemana', () => {
  const semana = () => ({
    meta: { dateRange: 'Del 22 al 27 de Septiembre de 2026' },
    schedule: {
      martes: { tasks: [{ id: 'm1', text: 'Boda X - Carga de material', timeFrame: '09:00 - 11:00', assigned: ['Ana'], completed: true }] },
      jueves: { tasks: [
        { id: 'j1', text: 'Boda X - Recogida y vuelta a base', timeFrame: '09:00 - 11:00', assigned: ['Ana'] },
        { id: 'j2', text: 'Boda X - Descarga + Montaje Estructura', timeFrame: '12:00 - 14:00', assigned: ['Luis', 'Eva'] },
      ] },
    },
    saturdaySpecial: { weddings: [] },
    sundayMonday: { tasks: [] },
  });
  const antesDelJueves = new Date(2026, 8, 23, 12, 0);

  it('reparar: cambia solo a quien ya no puede; lo hecho y el resto se quedan', () => {
    const res = reajustarSemana(semana(), { equipo, restricciones: [r({ persona: 'Ana', dia: 'jueves', tipo: 'no' })], ahora: antesDelJueves });
    expect(res.semana.schedule.jueves.tasks[0].assigned).toEqual(['Luis']);
    expect(res.semana.schedule.jueves.tasks[1].assigned).toEqual(['Luis', 'Eva']);
    expect(res.semana.schedule.martes.tasks[0].assigned).toEqual(['Ana']);
    expect(res.cambios).toEqual([{ etiqueta: 'Jueves: Boda X - Recogida y vuelta a base', sale: ['Ana'], entra: ['Luis'] }]);
  });

  it('no toca lo que ya ha empezado', () => {
    const res = reajustarSemana(semana(), { equipo, restricciones: [r({ persona: 'Ana', dia: 'jueves', tipo: 'no' })], ahora: new Date(2026, 8, 24, 10, 0) });
    expect(res.cambios).toEqual([]);
  });

  it('sin fechas legibles no reajusta', () => {
    expect(reajustarSemana({ ...semana(), meta: {} }, { equipo }).error).toBeTruthy();
  });

  it('revisarPlanning avisa de quien tiene tareas un día que no puede', () => {
    const avisos = revisarPlanning(semana(), { restricciones: [r({ persona: 'Ana', dia: 'jueves', tipo: 'no' })] });
    expect(avisos[0]).toBe('Jueves: Boda X - Recogida y vuelta a base — Ana, pero no puede el jueves.');
  });
});
