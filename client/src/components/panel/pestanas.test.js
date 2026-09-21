import { describe, it, expect, beforeEach } from 'vitest';
import { PESTANAS, pestanaDesdeUrl, guardarPestanaEnUrl } from './pestanas';

describe('pestanaDesdeUrl', () => {
  it('abre en tiempo real si no hay nada', () => {
    expect(pestanaDesdeUrl('')).toBe('live');
    expect(pestanaDesdeUrl('week=week_3')).toBe('live');
  });

  it('entiende el id y los alias de cada pestaña (en ?tab y en ?view)', () => {
    expect(pestanaDesdeUrl('tab=balances')).toBe('balances');
    expect(pestanaDesdeUrl('tab=saldos')).toBe('balances');
    expect(pestanaDesdeUrl('tab=acuerdos')).toBe('balances');
    expect(pestanaDesdeUrl('view=resumen')).toBe('financial');
    expect(pestanaDesdeUrl('tab=financiero')).toBe('financial');
    expect(pestanaDesdeUrl('tab=cuadrante')).toBe('schedule');
    expect(pestanaDesdeUrl('tab=planning')).toBe('schedule');
    expect(pestanaDesdeUrl('tab=grafo')).toBe('graph');
    expect(pestanaDesdeUrl('tab=flota')).toBe('logistics');
    expect(pestanaDesdeUrl('tab=bodas')).toBe('logistics');
    expect(pestanaDesdeUrl('tab=fichaje')).toBe('fichajes');
    expect(pestanaDesdeUrl('tab=directo')).toBe('live');
  });

  it('todos los ids de PESTANAS se abren a sí mismos', () => {
    PESTANAS.forEach((p) => expect(pestanaDesdeUrl(`tab=${p.id}`)).toBe(p.id));
  });

  it('un valor desconocido cae en la pestaña inicial', () => {
    expect(pestanaDesdeUrl('tab=nada')).toBe('live');
  });

  it('?socias abre los saldos, pero una pestaña explícita manda', () => {
    expect(pestanaDesdeUrl('socias')).toBe('balances');
    expect(pestanaDesdeUrl('socias&token=abc')).toBe('balances');
    expect(pestanaDesdeUrl('socias&tab=grafo')).toBe('graph');
  });
});

describe('guardarPestanaEnUrl', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/gula-logistics/?week=week_3&socias&token=abc');
  });

  it('pone ?tab=, quita ?socias y respeta el resto de parámetros', () => {
    guardarPestanaEnUrl('graph');
    const params = new URLSearchParams(window.location.search);
    expect(params.get('tab')).toBe('graph');
    expect(params.has('socias')).toBe(false);
    expect(params.get('week')).toBe('week_3');
    expect(params.get('token')).toBe('abc');
  });
});

describe('PESTANAS', () => {
  it('cada pestaña tiene id único, icono y etiqueta', () => {
    const ids = PESTANAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    PESTANAS.forEach((p) => {
      expect(p.icono).toBeTruthy();
      expect(p.etiqueta).toBeTruthy();
    });
  });

  it('la barra inferior del móvil enseña En Vivo, Cuadrante, Saldos y Grafo', () => {
    expect(PESTANAS.filter((p) => p.etiquetaCorta).map((p) => p.id)).toEqual(['live', 'schedule', 'graph', 'balances']);
  });
});
