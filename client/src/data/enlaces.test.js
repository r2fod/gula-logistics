import { describe, it, expect, beforeEach } from 'vitest';
import { urlBase, enlaceTrabajador, enlaceSocias, enlaceVistaPublica, enlaceWhatsApp } from './enlaces';

beforeEach(() => {
  window.history.replaceState({}, '', '/gula-logistics/?week=x&tab=live');
});

describe('enlaces', () => {
  it('la base es el origen y la ruta, sin parámetros', () => {
    expect(urlBase()).toBe(`${window.location.origin}/gula-logistics/`);
  });

  it('el enlace de un trabajador lleva la semana y su nombre codificado', () => {
    expect(enlaceTrabajador('week_3', 'Ana María')).toBe(`${urlBase()}?week=week_3&worker=Ana%20Mar%C3%ADa`);
  });

  it('el de socias entra sin clave solo si hay token', () => {
    expect(enlaceSocias()).toBe(`${urlBase()}?socias`);
    expect(enlaceSocias(null)).toBe(`${urlBase()}?socias`);
    expect(enlaceSocias('abc')).toBe(`${urlBase()}?socias&token=abc`);
  });

  it('la vista pública tiene su parámetro', () => {
    expect(enlaceVistaPublica()).toBe(`${urlBase()}?view=public`);
  });

  it('el de WhatsApp codifica el texto', () => {
    expect(enlaceWhatsApp('Hola & adiós')).toBe('https://api.whatsapp.com/send?text=Hola%20%26%20adi%C3%B3s');
  });
});
