import { describe, it, expect, vi } from 'vitest';
import { semanasAAnticipar, semanaPorDefecto, siguienteNombre, anticiparSemanas, esBorrador } from './anticipacion';

const semana = (id, name, dateRange, status = 'Operativa Activa') => ({ id, name, meta: { dateRange, status }, team: [{ role: 'x', members: 'y' }], trucks: [{ name: 'Camión Gula' }] });
const SEMANAS = {
  week_3: semana('week_3', 'Semana 3', 'Del 15 al 20 de Septiembre de 2026'),
};
const LUNES_21 = new Date(2026, 8, 21, 11, 0); // lunes: aún cola de la semana 3

describe('semanasAAnticipar', () => {
  it('el lunes 21 (cola de la semana 3) anticipa las semanas del 22 y del 29', () => {
    expect(semanasAAnticipar(SEMANAS, LUNES_21).map(d => `${d.getMonth() + 1}/${d.getDate()}`)).toEqual(['9/22', '9/29']);
  });

  it('no repite las que ya existen (ni como borrador)', () => {
    const conBorrador = { ...SEMANAS, x: semana('x', 'Semana 4', 'Del 22 al 27 de Septiembre de 2026', 'Borrador') };
    expect(semanasAAnticipar(conBorrador, LUNES_21).map(d => d.getDate())).toEqual([29]);
  });

  it('a mitad de semana sigue mirando 2 semanas por delante', () => {
    expect(semanasAAnticipar(SEMANAS, new Date(2026, 8, 17)).map(d => d.getDate())).toEqual([22, 29]);
  });
});

describe('semanaPorDefecto', () => {
  const con = { ...SEMANAS, b: semana('b', 'Semana 4', 'Del 22 al 27 de Septiembre de 2026', 'Borrador') };
  it('nunca elige un borrador, aunque sea la semana en curso', () => {
    expect(semanaPorDefecto(con, new Date(2026, 8, 23))).toBe('week_3'); // la última ya empezada que no es borrador
  });
  it('elige la semana cuyo rango contiene hoy (con su lunes de cola) y, aceptada, pasa a ser la de hoy', () => {
    expect(semanaPorDefecto(SEMANAS, new Date(2026, 8, 21))).toBe('week_3');
    const aceptada = { ...SEMANAS, b: semana('b', 'Semana 4', 'Del 22 al 27 de Septiembre de 2026') };
    expect(semanaPorDefecto(aceptada, new Date(2026, 8, 23))).toBe('b');
    expect(semanaPorDefecto(aceptada, new Date(2026, 8, 28))).toBe('b'); // lunes de cola de la 4
  });
  it('sin semanas legibles devuelve null (se conserva la actual)', () => {
    expect(semanaPorDefecto({ a: semana('a', 'X', 'fechas raras') }, LUNES_21)).toBeNull();
  });
});

describe('siguienteNombre / esBorrador', () => {
  it('numera a partir del mayor existente', () => {
    expect(siguienteNombre(SEMANAS)).toBe('Semana 4');
    expect(siguienteNombre(SEMANAS, 1)).toBe('Semana 5');
    expect(siguienteNombre({})).toBe('Semana 1');
    expect(esBorrador({ meta: { status: 'Borrador' } })).toBe(true);
    expect(esBorrador(SEMANAS.week_3)).toBe(false);
  });
});

describe('anticiparSemanas', () => {
  const apuntes = [
    { id: '1', fecha: '2026-09-22', tipo: 'corporativo', titulo: 'EVENTO X', pax: 40, hora: '11:00' },
    // la semana del 29 no tiene nada
  ];
  const roster = [{ name: 'Gonzalo', role: 'Conductor Flota' }, { name: 'Ricardo', role: 'Conductor Flota' }, { name: 'Raúl', role: 'Jefe de Logística' }, { name: 'Kerly', role: 'Limpieza' }, { name: 'Jose', role: 'Limpieza' }];

  it('crea SOLO los borradores de semanas con eventos, con id determinista y nombre siguiente', async () => {
    const leerApuntes = vi.fn().mockResolvedValue({ configurado: true, apuntes });
    const crearBorrador = vi.fn().mockResolvedValue({ ok: true });
    const r = await anticiparSemanas({ semanas: SEMANAS, hoy: LUNES_21, roster, leerApuntes, crearBorrador });

    expect(leerApuntes).toHaveBeenCalledWith('2026-09-22', '2026-10-05'); // las dos semanas en UNA lectura
    expect(r.estado).toBe('ok');
    expect(r.creadas.map(c => [c.weekId, c.name])).toEqual([['week_auto_2026-09-22', 'Semana 4']]);
    expect(r.omitidas).toHaveLength(1); // la del 29: sin eventos
    const [weekId, week, reemplazar] = crearBorrador.mock.calls[0];
    expect(weekId).toBe('week_auto_2026-09-22');
    expect(week.meta.status).toBe('Borrador');
    expect(week.team).toEqual(SEMANAS.week_3.team); // equipo y camiones de la última semana aceptada
    expect(reemplazar).toBe(false);
  });

  it('sin calendario configurado no hace nada ni falla', async () => {
    const crearBorrador = vi.fn();
    const r = await anticiparSemanas({ semanas: SEMANAS, hoy: LUNES_21, roster, leerApuntes: vi.fn().mockResolvedValue({ configurado: false, apuntes: [] }), crearBorrador });
    expect(r.estado).toBe('no-configurado');
    expect(crearBorrador).not.toHaveBeenCalled();
  });

  it('un error al leer el calendario se devuelve, no se crea nada', async () => {
    const crearBorrador = vi.fn();
    const r = await anticiparSemanas({ semanas: SEMANAS, hoy: LUNES_21, roster, leerApuntes: vi.fn().mockResolvedValue({ error: 'HTTP 502', apuntes: [] }), crearBorrador });
    expect(r).toMatchObject({ estado: 'error', error: 'HTTP 502' });
    expect(crearBorrador).not.toHaveBeenCalled();
  });

  it('si el servidor dice que ya existe (otra sesión se adelantó) lo respeta y sigue', async () => {
    const r = await anticiparSemanas({
      semanas: SEMANAS, hoy: LUNES_21, roster,
      leerApuntes: vi.fn().mockResolvedValue({ configurado: true, apuntes }),
      crearBorrador: vi.fn().mockResolvedValue({ ok: false, existe: true, status: 409 }),
    });
    expect(r.creadas).toHaveLength(0);
    expect(r.omitidas.some(o => o.motivo === 'ya existe')).toBe(true);
  });

  it('regenerar un borrador: inicios forzados y reemplazar:true', async () => {
    const crearBorrador = vi.fn().mockResolvedValue({ ok: true });
    await anticiparSemanas({
      semanas: { ...SEMANAS, x: semana('x', 'Semana 4', 'Del 22 al 27 de Septiembre de 2026', 'Borrador') }, hoy: LUNES_21, roster,
      leerApuntes: vi.fn().mockResolvedValue({ configurado: true, apuntes }), crearBorrador,
      inicios: [new Date(2026, 8, 22)], reemplazar: true, idsForzados: { '2026-09-22': 'week_x' },
    });
    expect(crearBorrador.mock.calls[0][2]).toBe(true);
    expect(crearBorrador.mock.calls[0][0]).toBe('week_x'); // conserva el id del borrador que regenera
  });
});
