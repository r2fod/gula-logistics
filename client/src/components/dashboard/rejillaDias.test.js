import { describe, it, expect } from 'vitest';
import { rejillaDeDias } from './rejillaDias';

// Columnas que aplica cada ancho: lee la clase `<prefijo>grid-cols-N` más alta que no supera el ancho.
const ANCHOS = { base: 0, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };
const columnasA = (contenedor, ancho) => {
  let cols = 1;
  contenedor.split(' ').forEach(c => {
    const m = /^(?:(md|lg|xl|2xl):)?grid-cols-(\d+)$/.exec(c);
    if (m && ANCHOS[m[1] || 'base'] <= ancho) cols = Number(m[2]);
  });
  return cols;
};
const spanA = (ultima, ancho) => {
  let span = 1;
  ultima.split(' ').filter(Boolean).forEach(c => {
    const m = /^(?:(md|lg|xl|2xl):)?col-span-(\d+)$/.exec(c);
    if (m && ANCHOS[m[1] || 'base'] <= ancho) span = Number(m[2]);
  });
  return span;
};

describe('rejillaDeDias', () => {
  it('BUG evitado: con 5 días (víspera + martes a viernes) van en una fila en pantalla muy ancha y, en las demás, la última se ensancha en vez de quedar sola', () => {
    const { contenedor, ultima } = rejillaDeDias(5);
    expect(columnasA(contenedor, 2000)).toBe(5);
    expect(spanA(ultima, 2000)).toBe(1);
    expect(columnasA(contenedor, 1440)).toBe(3); // 3 + 2, con la última ocupando dos columnas
    expect(spanA(ultima, 1440)).toBe(2);
  });

  it('para cualquier cantidad y ancho, las filas quedan llenas (nada de huecos a la derecha de la última)', () => {
    for (let n = 2; n <= 7; n++) {
      const { contenedor, ultima } = rejillaDeDias(n);
      [768, 1024, 1280, 1440, 1536, 2000].forEach(ancho => {
        const cols = columnasA(contenedor, ancho);
        const ocupadas = ((n - 1) % cols) + spanA(ultima, ancho); // celdas de la última fila, contando la última tarjeta
        expect(ocupadas % cols, `n=${n} ancho=${ancho} cols=${cols}`).toBe(0);
      });
    }
  });

  it('4 días siguen en 4 columnas en pantallas anchas (como antes) y una cantidad rara usa la rejilla por defecto', () => {
    expect(columnasA(rejillaDeDias(4).contenedor, 1440)).toBe(4);
    expect(rejillaDeDias(12)).toEqual(rejillaDeDias(4));
  });
});
