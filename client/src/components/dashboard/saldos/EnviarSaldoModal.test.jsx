import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '../../../test/render';

vi.mock('../../../data/apiService', () => ({
  crearEnlacesTrabajadoresEnAPI: vi.fn().mockResolvedValue({ ok: true, enlaces: [{ id: 'ana', name: 'Ana', token: 'firma.ana' }] }),
}));
const { default: EnviarSaldoModal } = await import('./EnviarSaldoModal');
const { saldoDeTrabajador } = await import('../../../data/saldoTrabajador');

const ficha = { id: 'ana', name: 'Ana', currentBalance: 20, phone: '600000000', breakdown: [{ concept: 'Bizum', amount: -10, tipo: 'pago', date: '2026-09-30' }, { concept: 'Transporte', amount: 30, tipo: 'transporte', date: '2026-09-29' }] };
const datos = { ficha, saldo: saldoDeTrabajador({ ficha }), turnos: [], turnosHoras: [] };
const pintar = (props = {}) => render(<EnviarSaldoModal datos={datos} admin equipo={[{ name: 'Ana' }]} onCerrar={vi.fn()} {...props} />);
const mensaje = () => screen.getByRole('textbox').value;

afterEach(() => vi.restoreAllMocks());

describe('EnviarSaldoModal', () => {
  it('enseña el mensaje con el saldo de pantalla y su enlace personal en cuanto llega', async () => {
    pintar();
    expect(mensaje()).toContain('Pendiente de cobro: +20,00 €');
    expect(await screen.findByDisplayValue(/worker=Ana&t=firma\.ana/)).toBeInTheDocument();
  });

  it('quitar "Apuntado a mano y pagos" lo saca del mensaje', () => {
    pintar();
    expect(mensaje()).toContain('Pagos y adelantos');
    fireEvent.click(screen.getByRole('button', { name: 'Apuntado a mano y pagos' }));
    expect(mensaje()).not.toContain('Pagos y adelantos');
  });

  it('con teléfono en su ficha lo manda a su chat; también a otro contacto que se elige en WhatsApp', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    pintar();
    fireEvent.click(screen.getByRole('button', { name: /Enviar a Ana/ }));
    expect(abrir).toHaveBeenLastCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/34600000000\?text=/), '_blank');
    fireEvent.click(screen.getByRole('button', { name: /Mandarlo a otro contacto/ }));
    expect(abrir).toHaveBeenLastCalledWith(expect.stringMatching(/^https:\/\/api\.whatsapp\.com\/send\?text=/), '_blank');
  });

  it('sin teléfono lo dice y ofrece elegir el contacto', () => {
    pintar({ datos: { ...datos, ficha: { ...ficha, phone: '' } } });
    expect(screen.getByText(/no tiene teléfono/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar a Ana/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Elegir contacto en WhatsApp/ })).toBeInTheDocument();
  });

  it('el texto se puede retocar y se manda tal cual; "Volver al mensaje generado" lo deshace', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    pintar();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hola Ana, te debo 20 €' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar a Ana/ }));
    expect(decodeURIComponent(abrir.mock.calls.at(-1)[0])).toContain('Hola Ana, te debo 20 €');
    fireEvent.click(screen.getByRole('button', { name: /Volver al mensaje generado/ }));
    expect(mensaje()).toContain('Pendiente de cobro');
  });
});
