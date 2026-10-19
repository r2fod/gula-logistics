import { describe, it, expect, vi, beforeEach } from 'vitest';
import { accionesDeDisponibilidadFija, aplicarAcciones, esquemaAcciones, pideAccionDeApp, promptDeAcciones, validarAccion } from './accionesIa';
import { usarTarifasPorDefecto } from './tarifasPorDefecto';

// Horas locales, sin depender de la zona de la máquina.
const a = (dia, hora) => new Date(2026, 9, dia, hora).toISOString();
const ahora = new Date(2026, 9, 19, 10); // lunes 19 de octubre
const equipo = [
  { name: 'Ana', role: 'Conductora', rate: 10, disponibilidad: [{ dia: 'lunes', tipo: 'solo', desde: '15:00', hasta: '23:59' }] },
  { name: 'Luis', role: 'Apoyo', rate: 10 },
  { name: 'Eva', role: 'Limpieza' },
];
const fichajes = [
  { id: 'e1', workerName: 'Ana', type: 'entrada', timestamp: a(4, 10), rate: 10 }, { id: 's1', workerName: 'Ana', type: 'salida', timestamp: a(4, 17), rate: 10 },
  { id: 'e0', workerName: 'Ana', type: 'entrada', timestamp: a(1, 10), rate: 10 }, { id: 's0', workerName: 'Ana', type: 'salida', timestamp: a(1, 12), rate: 10 },
];
const comprobar = (accion, extra = {}) => validarAccion(accion, { equipo, fichajes, festivos: [], ahora, ...extra });

beforeEach(() => usarTarifasPorDefecto({ extra: 10, nomina: 14, transporte: 8 }));

describe('qué peticiones son de la app (no del cuadrante)', () => {
  it('tarifa, apuntes en Saldos y festivos; un cambio del cuadrante no', () => {
    expect(pideAccionDeApp('Ana cobra 12 € la hora desde el día 4')).toBe(true);
    expect(pideAccionDeApp('sube la tarifa de Luis a 11')).toBe(true);
    expect(pideAccionDeApp('Apunta 10 € de transporte a Luis del lunes')).toBe(true);
    expect(pideAccionDeApp('le hemos pagado 50 en efectivo a Eva')).toBe(true);
    expect(pideAccionDeApp('El 8 de diciembre es festivo')).toBe(true);
    expect(pideAccionDeApp('Pon a Luis en la carga del jueves')).toBe(false);
    expect(pideAccionDeApp('Mueve la recogida del miércoles a las 8:00')).toBe(false);
  });

  it('«nunca / siempre» + disponibilidad es FIJA (su ficha), sin Gemini; la de una semana, no', () => {
    expect(accionesDeDisponibilidadFija('Eva nunca puede los lunes', equipo)).toEqual([{ tipo: 'disponibilidad', persona: 'Eva', dia: 'lunes', disponibilidad: 'no', horaDesde: '', horaHasta: '' }]);
    expect(accionesDeDisponibilidadFija('Luis siempre descansa los domingos', equipo)).toEqual([expect.objectContaining({ persona: 'Luis', dia: 'domingo', disponibilidad: 'descansa' })]);
    expect(accionesDeDisponibilidadFija('Ana a partir de ahora solo puede de 9 a 14 los viernes', equipo)).toEqual([expect.objectContaining({ dia: 'viernes', disponibilidad: 'solo', horaDesde: '09:00', horaHasta: '14:00' })]);
    expect(accionesDeDisponibilidadFija('Eva no puede el lunes', equipo)).toBeNull();
    expect(accionesDeDisponibilidadFija('Las bodas siempre llevan un apoyo más', equipo)).toBeNull();
  });
});

describe('lo que se le manda a Gemini', () => {
  it('hoy, la semana abierta y solo los nombres del equipo (sin tarifas ni saldos)', () => {
    const texto = promptDeAcciones({ peticion: 'x', equipo, semana: { meta: { dateRange: 'Del 20 al 25 de Octubre de 2026' } }, ahora });
    expect(texto).toMatch(/Hoy es lunes, 19 de octubre de 2026 \(2026-10-19\)/);
    expect(texto).toMatch(/Martes 20/);
    expect(texto).toMatch(/Equipo: Ana, Luis, Eva\./);
    expect(texto).not.toMatch(/10 ?€|rate/);
  });

  it('el esquema solo deja elegir gente del equipo y acciones del catálogo', () => {
    const { items } = esquemaAcciones(['Ana', 'Luis']).properties.acciones;
    expect(items.properties.persona.enum).toEqual(['Ana', 'Luis']);
    expect(items.properties.tipo.enum).toEqual(['tarifa', 'apunte', 'festivo', 'disponibilidad']);
  });
});

describe('validarAccion — cada acción con su efecto exacto, o el motivo de no poder', () => {
  it('tarifa: antes → después y cuántos fichajes cambian desde ese día', () => {
    const r = comprobar({ tipo: 'tarifa', persona: 'Ana', tarifa: 12, desde: '2026-10-04' });
    expect(r).toMatchObject({ ok: true, persona: 'Ana', tarifa: 12, antes: 10, fichajes: ['e1', 's1'] });
    expect(r.texto).toBe('Tarifa de Ana: 10,00 €/h → 12,00 €/h y 2 fichajes desde el 4 oct');
    expect(comprobar({ tipo: 'tarifa', persona: 'Luis', tarifa: 12 }).texto).toMatch(/\(sus fichajes nuevos\)$/);
  });

  it('tarifa: fuera de 0–100, un «desde» futuro o alguien de fuera no se aplican', () => {
    expect(comprobar({ tipo: 'tarifa', persona: 'Ana', tarifa: 0 })).toMatchObject({ ok: false, error: expect.stringMatching(/entre 0 y 100/) });
    expect(comprobar({ tipo: 'tarifa', persona: 'Ana', tarifa: 12, desde: '2026-10-30' })).toMatchObject({ ok: false });
    expect(comprobar({ tipo: 'tarifa', persona: 'Pepe', tarifa: 12 })).toMatchObject({ ok: false, error: 'No es nadie del equipo.' });
  });

  it('apunte: el pago resta, el transporte sin importe lleva el de por defecto, la fecha por defecto es hoy', () => {
    expect(comprobar({ tipo: 'apunte', persona: 'Eva', clase: 'pago', importe: 50, concepto: 'Efectivo', fecha: '2026-10-18' }))
      .toMatchObject({ ok: true, item: { concept: 'Efectivo', amount: -50, isPositive: false, tipo: 'pago', date: '2026-10-18' }, texto: 'Saldos de Eva: -50,00 € «Efectivo» · 18 oct' });
    expect(comprobar({ tipo: 'apunte', persona: 'Luis', clase: 'transporte' }).item).toEqual({ concept: 'Transporte', amount: 8, isPositive: true, tipo: 'transporte', date: '2026-10-19' });
    expect(comprobar({ tipo: 'apunte', persona: 'Luis', clase: 'ajuste', importe: -15, concepto: 'Rotura de copas' }).item.amount).toBe(-15);
  });

  it('apunte: sin importe, de un día futuro o sin clase no se aplica (no se inventa)', () => {
    expect(comprobar({ tipo: 'apunte', persona: 'Eva', clase: 'pago' })).toMatchObject({ ok: false, error: 'Falta el importe.' });
    expect(comprobar({ tipo: 'apunte', persona: 'Eva', clase: 'pago', importe: 20, fecha: '2026-10-25' })).toMatchObject({ ok: false });
    expect(comprobar({ tipo: 'apunte', persona: 'Eva', importe: 20 })).toMatchObject({ ok: false });
    usarTarifasPorDefecto({});
    expect(comprobar({ tipo: 'apunte', persona: 'Luis', clase: 'transporte' })).toMatchObject({ ok: false, error: expect.stringMatching(/no hay ayuda de transporte por defecto/) });
  });

  it('festivo: añadir uno local; uno que ya es festivo oficial no se repite ni se quita', () => {
    expect(comprobar({ tipo: 'festivo', operacion: 'anadir', fecha: '2026-11-16', nombre: 'Fiesta del pueblo' }))
      .toMatchObject({ ok: true, texto: 'Festivo local: lunes, 16 de noviembre «Fiesta del pueblo»' });
    expect(comprobar({ tipo: 'festivo', operacion: 'anadir', fecha: '2026-12-08' })).toMatchObject({ ok: false, error: 'Ya es festivo: Inmaculada Concepción.' });
    expect(comprobar({ tipo: 'festivo', operacion: 'quitar', fecha: '2026-12-08' })).toMatchObject({ ok: false });
    expect(comprobar({ tipo: 'festivo', operacion: 'quitar', fecha: '2026-11-16' }, { festivos: [{ fecha: '2026-11-16', nombre: 'Fiesta del pueblo' }] })).toMatchObject({ ok: true });
  });

  it('disponibilidad fija: el texto de siempre y qué sustituye de lo que ya tenía', () => {
    const r = comprobar({ tipo: 'disponibilidad', persona: 'Ana', dia: 'lunes', disponibilidad: 'no' });
    expect(r).toMatchObject({ ok: true, nuevas: [{ dia: 'lunes', tipo: 'no', desde: '', hasta: '' }] });
    expect(r.texto).toMatch(/^Disponibilidad fija de Ana: /);
    expect(r.aviso).toMatch(/^Sustituye lo que tenía: /);
    expect(comprobar({ tipo: 'disponibilidad', persona: 'Eva', dia: 'entresemana', disponibilidad: 'solo', horaDesde: '15:00' }).nuevas).toHaveLength(5);
  });

  it('algo fuera del catálogo no se hace', () => {
    expect(comprobar({ tipo: 'borrar_todo' })).toMatchObject({ ok: false });
  });
});

describe('aplicarAcciones — con las mismas piezas que los botones', () => {
  const saldos = { workers: [{ id: 'ana', name: 'Ana', hourlyRate: 10, agreements: ['Extra a 10,00 € / hora (Por Defecto)'], breakdown: [{ concept: 'Rotura', amount: -5 }], currentBalance: -5 }] };
  const ctx = (extra = {}) => ({
    equipo,
    guardarFichas: vi.fn().mockResolvedValue(true),
    cambiarTarifaFichajes: vi.fn().mockResolvedValue(true),
    usarSaldos: vi.fn(),
    leerSaldos: vi.fn().mockResolvedValue(saldos),
    guardarSaldo: vi.fn().mockResolvedValue({}),
    festivos: [],
    guardarFestivos: vi.fn().mockResolvedValue(true),
    ...extra,
  });

  it('BUG evitado: dos cambios de fichas van en un solo guardado (de uno en uno, el segundo pisaba al primero)', async () => {
    const c = ctx();
    const acciones = [comprobar({ tipo: 'tarifa', persona: 'Luis', tarifa: 12 }), comprobar({ tipo: 'disponibilidad', persona: 'Ana', dia: 'lunes', disponibilidad: 'no' }), comprobar({ tipo: 'disponibilidad', persona: 'Luis', dia: 'martes', disponibilidad: 'descansa' })];
    expect(await aplicarAcciones(acciones, c)).toEqual([{ ok: true, error: '' }, { ok: true, error: '' }, { ok: true, error: '' }]);
    expect(c.guardarFichas).toHaveBeenCalledTimes(1);
    expect(c.guardarFichas).toHaveBeenCalledWith({
      Luis: { rate: 12, disponibilidad: [{ dia: 'martes', tipo: 'descansa', desde: '', hasta: '' }] },
      Ana: { disponibilidad: [{ dia: 'lunes', tipo: 'no', desde: '', hasta: '' }] }, // sustituye lo del lunes
    });
  });

  it('tarifa desde un día: la ficha, sus fichajes y su ficha de Saldos (sobre lo que hay ahora en el servidor)', async () => {
    const c = ctx();
    const [r] = await aplicarAcciones([comprobar({ tipo: 'tarifa', persona: 'Ana', tarifa: 12, desde: '2026-10-04' })], c);
    expect(r.ok).toBe(true);
    expect(c.cambiarTarifaFichajes).toHaveBeenCalledWith(['e1', 's1'], 12);
    expect(c.guardarSaldo).toHaveBeenCalledWith('ana', { hourlyRate: 12, agreements: ['Extra a 12,00 € / hora'] });
    expect(c.usarSaldos).toHaveBeenCalledWith(saldos);
  });

  it('apuntes: se suman a los que ya tiene y el saldo es la suma; quien no tiene ficha la recibe entera', async () => {
    const c = ctx();
    const acciones = [comprobar({ tipo: 'apunte', persona: 'Ana', clase: 'pago', importe: 20, concepto: 'Bizum' }), comprobar({ tipo: 'apunte', persona: 'Eva', clase: 'transporte', importe: 8 })];
    expect((await aplicarAcciones(acciones, c)).every(r => r.ok)).toBe(true);
    expect(c.guardarSaldo).toHaveBeenCalledWith('ana', { breakdown: [{ concept: 'Rotura', amount: -5 }, acciones[0].item], currentBalance: -25 });
    const [id, nueva] = c.guardarSaldo.mock.calls[1];
    expect(id).toBe('eva');
    expect(nueva).toMatchObject({ id: 'eva', name: 'Eva', breakdown: [acciones[1].item], currentBalance: 8 });
  });

  it('BUG evitado: si no se pueden leer los saldos no se escribe (un apunte sobre una copia vacía borraría los demás)', async () => {
    const c = ctx({ leerSaldos: vi.fn().mockResolvedValue({ workers: [] }) });
    const [r] = await aplicarAcciones([comprobar({ tipo: 'apunte', persona: 'Ana', clase: 'pago', importe: 20 })], c);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/No se pudieron leer los saldos/) });
    expect(c.guardarSaldo).not.toHaveBeenCalled();
  });

  it('festivos: la lista entera en un guardado; si falla, lo dice', async () => {
    const c = ctx({ festivos: [{ fecha: '2026-11-02', nombre: 'Puente' }] });
    await aplicarAcciones([comprobar({ tipo: 'festivo', operacion: 'anadir', fecha: '2026-11-16', nombre: 'Fiesta' }), comprobar({ tipo: 'festivo', operacion: 'quitar', fecha: '2026-11-02' }, { festivos: [{ fecha: '2026-11-02', nombre: 'Puente' }] })], c);
    expect(c.guardarFestivos).toHaveBeenCalledWith([{ fecha: '2026-11-16', nombre: 'Fiesta' }]);
    const fallo = ctx({ guardarFestivos: vi.fn().mockResolvedValue(false) });
    expect((await aplicarAcciones([comprobar({ tipo: 'festivo', operacion: 'anadir', fecha: '2026-11-16' })], fallo))[0].ok).toBe(false);
  });

  it('si la ficha no se guarda, no toca sus fichajes ni sus saldos', async () => {
    const c = ctx({ guardarFichas: vi.fn().mockResolvedValue(false) });
    const [r] = await aplicarAcciones([comprobar({ tipo: 'tarifa', persona: 'Ana', tarifa: 12, desde: '2026-10-04' })], c);
    expect(r.ok).toBe(false);
    expect(c.cambiarTarifaFichajes).not.toHaveBeenCalled();
    expect(c.guardarSaldo).not.toHaveBeenCalled();
  });
});

describe('aplicarAcciones — los saldos se leen del servidor, nunca de la copia del navegador', () => {
  it('BUG evitado: sin red, fetchBalancesFromAPI devolvía la copia guardada (quizá vieja) y el apunte la pisaba', async () => {
    localStorage.setItem('gula_balances_data_v1', JSON.stringify({ workers: [{ id: 'eva', name: 'Eva', breakdown: [], currentBalance: 0 }] }));
    localStorage.setItem('gula_admin_token_v1', JSON.stringify({ token: 't', expiresAt: Date.now() + 60000 }));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
    const guardarSaldo = vi.fn();
    const [r] = await aplicarAcciones([comprobar({ tipo: 'apunte', persona: 'Eva', clase: 'pago', importe: 20 })], { equipo, guardarSaldo });
    expect(r.ok).toBe(false);
    expect(guardarSaldo).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    localStorage.clear();
  });
});
