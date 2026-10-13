import { describe, it, expect, afterEach } from 'vitest';
import { festivosDelAno, festivoEn, esDiaHabil, diaHabilCercano, festivosEntre, limpiarFestivosLocales, usarFestivosLocales, festivosLocales, alCambiarFestivosLocales } from './festivos';

afterEach(() => usarFestivosLocales([]));

describe('festivos de la Comunitat Valenciana', () => {
  it('2026: los doce del decreto 100/2025 (con San Juan; sin Todos los Santos ni Constitución, que caen en domingo)', () => {
    expect(festivosDelAno(2026).map(f => f.fecha)).toEqual([
      '2026-01-01', '2026-01-06', '2026-03-19', '2026-04-03', '2026-04-06', '2026-05-01',
      '2026-06-24', '2026-08-15', '2026-10-09', '2026-10-12', '2026-12-08', '2026-12-25',
    ]);
    expect(festivoEn('2026-10-12').nombre).toBe('Fiesta Nacional de España');
    expect(festivoEn('2026-11-01')).toBeNull();
    expect(festivoEn('2026-11-02')).toBeNull();
  });

  it('2027: los doce del calendario aprobado (sin San Juan ni el 15 de agosto, domingo)', () => {
    expect(festivosDelAno(2027).map(f => f.fecha)).toEqual([
      '2027-01-01', '2027-01-06', '2027-03-19', '2027-03-26', '2027-03-29', '2027-05-01',
      '2027-10-09', '2027-10-12', '2027-11-01', '2027-12-06', '2027-12-08', '2027-12-25',
    ]);
    expect(festivosDelAno(2027).some(f => f.previsto)).toBe(false);
  });

  it('de 2028 en adelante es una previsión por regla hasta que salga su decreto', () => {
    const lista = festivosDelAno(2028);
    expect(lista.every(f => f.previsto)).toBe(true);
    expect(lista.map(f => f.fecha)).toContain('2028-04-14'); // Viernes Santo
    expect(lista.map(f => f.fecha)).not.toContain('2028-03-19'); // el 19 de marzo cae en domingo
  });
});

describe('días hábiles (abren proveedores y alquileres)', () => {
  it('el lunes 12/10/2026 es festivo: una devolución pasa al martes 13 y una recogida, al sábado 10', () => {
    expect(esDiaHabil('2026-10-12')).toBe(false);
    expect(diaHabilCercano('2026-10-12', 1)).toBe('2026-10-13');
    expect(diaHabilCercano('2026-10-12', -1)).toBe('2026-10-10'); // el domingo 11 tampoco abren
  });

  it('salta varios festivos seguidos: del Viernes Santo al martes tras el Lunes de Pascua', () => {
    expect(diaHabilCercano('2026-04-03', 1)).toBe('2026-04-04'); // sábado: abren
    expect(diaHabilCercano('2026-04-04', 1)).toBe('2026-04-07'); // domingo 5 y Lunes de Pascua 6, no
    expect(diaHabilCercano('2026-04-06', -1)).toBe('2026-04-04');
  });

  it('festivosEntre: los de una semana, de martes a lunes', () => {
    expect(festivosEntre('2026-10-06', '2026-10-12').map(f => f.fecha)).toEqual(['2026-10-09', '2026-10-12']);
    expect(festivosEntre('2026-10-13', '2026-10-19')).toEqual([]);
  });
});

describe('festivos locales (los añade el admin)', () => {
  it('cuentan como festivo y avisan a quien los pinta', () => {
    let avisos = 0;
    const dejar = alCambiarFestivosLocales(() => { avisos += 1; });
    usarFestivosLocales([{ fecha: '2026-10-14', nombre: 'Fiesta del pueblo' }]);
    expect(avisos).toBe(1);
    expect(festivoEn('2026-10-14')).toEqual({ fecha: '2026-10-14', nombre: 'Fiesta del pueblo', local: true });
    expect(diaHabilCercano('2026-10-12', 1)).toBe('2026-10-13');
    expect(diaHabilCercano('2026-10-13', 1)).toBe('2026-10-15');
    dejar();
    usarFestivosLocales([]);
    expect(avisos).toBe(1);
    expect(festivoEn('2026-10-14')).toBeNull();
  });

  it('se limpian: fechas válidas, sin repetir, por orden y con el nombre acotado', () => {
    expect(limpiarFestivosLocales([
      { fecha: '2027-04-05', nombre: '  San Vicente  ' }, { fecha: '2027-01-22', nombre: 'x'.repeat(80) },
      { fecha: '2027-04-05', nombre: 'repetido' }, { fecha: 'mañana' }, null,
    ])).toEqual([{ fecha: '2027-01-22', nombre: 'x'.repeat(60) }, { fecha: '2027-04-05', nombre: 'San Vicente' }]);
    expect(limpiarFestivosLocales('nada')).toEqual([]);
    expect(festivosLocales()).toEqual([]);
  });
});
