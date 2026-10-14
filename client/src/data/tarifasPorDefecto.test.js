import { describe, it, expect, vi } from 'vitest';
import { alCambiarTarifasPorDefecto, sinTarifa, tarifaCorta, tarifaDe, tarifaPorDefecto, tarifasPorDefecto, transporteDia, usarTarifasPorDefecto } from './tarifasPorDefecto';

// En los tests, tarifas de PRUEBA (inventadas, test/setup.js); en la app salen de la base de datos.
describe('tarifas por defecto (vienen de la base, el código no lleva ninguna)', () => {
  it('la suya manda; sin ella, la por defecto según esté en nómina o no', () => {
    usarTarifasPorDefecto({ extra: 11, nomina: 15, transporte: 7 });
    expect(tarifaDe({ rate: 12 })).toBe(12);
    expect(tarifaDe({ isPayroll: true })).toBe(15);
    expect(tarifaDe({})).toBe(11);
    expect(tarifaDe(undefined)).toBe(11);
    expect(transporteDia()).toBe(7);
    expect(tarifaPorDefecto(true)).toBe(15);
  });

  it('BUG evitado: sin tarifa en la base no se inventa ninguna (antes, 14 en nómina y 10 el resto escritos en el código): vale 0 y se ve «sin tarifa»', () => {
    usarTarifasPorDefecto({});
    expect(tarifaDe({})).toBe(0);
    expect(tarifaDe({ isPayroll: true })).toBe(0);
    expect(tarifaDe({ rate: 12 })).toBe(12); // la suya, siempre
    expect(tarifaCorta({})).toBe('sin tarifa');
    expect(transporteDia()).toBeNull();
  });

  it('solo valen números positivos (lo demás, null)', () => {
    usarTarifasPorDefecto({ extra: '12.5', nomina: 0, transporte: 'mucho' });
    expect(tarifasPorDefecto()).toEqual({ extra: 12.5, nomina: null, transporte: null });
    usarTarifasPorDefecto(undefined);
    expect(tarifasPorDefecto()).toEqual({ extra: null, nomina: null, transporte: null });
  });

  it('la etiqueta corta lleva su tarifa, con coma si tiene decimales', () => {
    usarTarifasPorDefecto({ extra: 10, nomina: 14 });
    expect(tarifaCorta({ rate: 12.5 })).toBe('12,5€/h');
    expect(tarifaCorta({})).toBe('10€/h');
  });

  it('sinTarifa: quién se queda sin ninguna (ni la suya ni la por defecto de su tipo)', () => {
    usarTarifasPorDefecto({ extra: 10 });
    const equipo = [{ name: 'Ana', rate: 12 }, { name: 'Luis' }, { name: 'Eva', isPayroll: true }];
    expect(sinTarifa(equipo).map(w => w.name)).toEqual(['Eva']);
    usarTarifasPorDefecto({});
    expect(sinTarifa(equipo).map(w => w.name)).toEqual(['Luis', 'Eva']);
  });

  it('avisa a quien las esté pintando cuando cambian', () => {
    const oyente = vi.fn();
    const quitar = alCambiarTarifasPorDefecto(oyente);
    usarTarifasPorDefecto({ extra: 9 });
    expect(oyente).toHaveBeenCalledTimes(1);
    quitar();
    usarTarifasPorDefecto({ extra: 8 });
    expect(oyente).toHaveBeenCalledTimes(1);
  });
});
