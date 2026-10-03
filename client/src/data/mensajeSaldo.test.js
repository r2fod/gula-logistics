import { describe, it, expect } from 'vitest';
import { mensajeDeSaldo } from './mensajeSaldo';
import { saldoDeTrabajador } from './saldoTrabajador';

const ahora = new Date(2026, 9, 2, 18, 0);
const ficha = {
  name: 'Ana', currentBalance: 15, hourlyRate: 10,
  breakdown: [
    { concept: '🕒 23/09 — 10€ ayuda transporte', amount: 10, tipo: 'transporte', date: '2026-09-23' },
    { concept: 'Rotura de copas', amount: -5, tipo: 'ajuste', date: '2026-09-24' },
    { concept: 'Bizum adelanto', amount: -40, tipo: 'pago', date: '2026-09-30' },
  ],
};
const turno = (dia, mes, horas) => ({ durationHours: horas, cost: horas * 10, startEntry: { timestamp: new Date(2026, mes, dia, 9).toISOString() } });
const turnosHoras = [turno(29, 8, 6), turno(1, 9, 4), turno(2, 9, 3)];
const horas = { totalHours: 13, shifts: turnosHoras };
const turnos = turnosHoras.map(t => ({ concept: `🕒 ${new Date(t.startEntry.timestamp).getDate()}/${new Date(t.startEntry.timestamp).getMonth() + 1} - ${t.durationHours}h`, amount: t.cost, timestamp: t.startEntry.timestamp }));
const texto = (extra = {}) => mensajeDeSaldo({ ficha, saldo: saldoDeTrabajador({ ficha, horas }), turnos, turnosHoras, ahora, ...extra });

describe('mensajeDeSaldo (WhatsApp de Saldos)', () => {
  it('BUG evitado: el saldo es el de la pantalla (a mano + fichados), no solo lo apuntado a mano', () => {
    expect(texto()).toContain('💰 *Pendiente de cobro: +145,00 €*'); // 15 a mano + 130 fichados
  });

  it('horas de la semana (martes a lunes) y del mes, y turnos del mes con los anteriores resumidos', () => {
    const t = texto();
    expect(t).toMatch(/13\s?h esta semana · 7\s?h en octubre/);
    expect(t).toContain('*Turnos fichados* (+130,00 €)');
    expect(t).toContain('• 1 turno anterior: +60,00 €');
    expect(t).toContain('*Apuntado a mano* (+5,00 €)');
    expect(t).toContain('*Pagos y adelantos* (-40,00 €)');
  });

  it('se pueden quitar partes; el enlace personal solo si lo hay y se pide', () => {
    const t = texto({ incluir: { turnos: false, aMano: false }, enlace: 'https://app.test/?worker=Ana&t=firma' });
    expect(t).not.toContain('Turnos fichados');
    expect(t).not.toContain('Apuntado a mano');
    expect(t).toContain('🔗 Míralo al día en tu enlace (es personal): https://app.test/?worker=Ana&t=firma');
    expect(texto({ enlace: 'x', incluir: { enlace: false } })).not.toContain('🔗');
  });

  it('en nómina fija no habla de euros; la bolsa sale con SUS cifras, no unas escritas en el código', () => {
    const nomina = { ...ficha, statusType: 'payroll' };
    const t = mensajeDeSaldo({ ficha: nomina, saldo: saldoDeTrabajador({ ficha: nomina, horas }), turnosHoras, ahora });
    expect(t).toContain('Nómina fija');
    expect(t).not.toMatch(/€/);
    const conBolsa = { ...ficha, isSpecialPurse: true, purseInfo: { totalHours: 60, consumedHours: 20, hourlyRate: 8, extraRateAfter80h: 11 } };
    expect(mensajeDeSaldo({ ficha: conBolsa, saldo: saldoDeTrabajador({ ficha: conBolsa, horas }), ahora })).toMatch(/20\s?h de 60\s?h gastadas; las siguientes, a 11,00 €\/h/);
  });
});
