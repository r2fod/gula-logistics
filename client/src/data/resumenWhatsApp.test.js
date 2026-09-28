import { describe, it, expect } from 'vitest';
import { textoResumenWhatsApp } from './resumenWhatsApp';

describe('textoResumenWhatsApp', () => {
  it('lleva el periodo, los totales, cada persona y lo apuntado a mano y lo previsto si los hay', () => {
    const texto = textoResumenWhatsApp({
      etiqueta: 'Semana 4 · 22 sept – 28 sept 2026',
      personas: [{ name: 'Ana', totalHours: 12, totalCost: 120 }, { name: 'Luis', isPayroll: true, totalHours: 5, totalCost: 70 }],
      totalExtras: 120, totalNomina: 70, totalHoras: 17,
      conceptos: { items: [{}], porTipo: { turno: { importe: 35 }, ajuste: { importe: -12 }, pago: { importe: -50 } }, total: 23, pagado: 50 },
      estimado: { porPersona: [{}], horasExtra: 20, costeExtra: 200 },
    });
    expect(texto).toContain('📅 Semana 4 · 22 sept – 28 sept 2026');
    expect(texto).toContain('💶 *Extras a pagar:* 120,00 €');
    expect(texto).toContain('👤 *Ana*: 12\u00a0h · 120,00 €');
    expect(texto).toContain('👤 *Luis* (nómina): 5\u00a0h · valoración 70,00 €');
    expect(texto).toContain('• Turnos apuntados a mano: +35,00 €');
    expect(texto).toContain('• Ajustes (roturas, saldos iniciales…): -12,00 €');
    expect(texto).toContain('💰 *Coste (extras + a mano):* 143,00 €');
    expect(texto).toContain('💵 *Ya pagado (efectivo, Bizum, adelantos):* 50,00 €');
    expect(texto).not.toContain('• Pagado');
    expect(texto).toContain('Previsto según el planning (no son fichajes):* 20\u00a0h de extras · 200,00 €');
  });

  it('sin conceptos ni previsto no añade esas partes', () => {
    const texto = textoResumenWhatsApp({ etiqueta: 'Todo el histórico' });
    expect(texto).not.toContain('Apuntado a mano');
    expect(texto).not.toContain('Previsto');
  });
});
