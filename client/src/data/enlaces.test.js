import { describe, it, expect, beforeEach, vi } from 'vitest';
import { construirEnlaceTrabajador, semanaPedidaEnEnlace, urlBase, enlaceTrabajador, enlaceSocias, enlaceVistaPublica, enlaceWhatsApp, abrirEnPestanaNueva, telefonoWhatsApp } from './enlaces';

const semana = (dateRange, status = 'Operativa Activa') => ({ meta: { dateRange, status } });
const semanas = {
  s3: semana('Del 15 al 20 de Septiembre de 2026'),
  s4: semana('Del 22 al 27 de Septiembre de 2026'),
  s5: semana('Del 29 de Septiembre al 4 de Octubre de 2026', 'Borrador'),
};

describe('construirEnlaceTrabajador', () => {
  it('el enlace no lleva la semana: es el mismo todas las semanas', () => {
    const enlace = construirEnlaceTrabajador('https://ejemplo.test', '/app/', 'Ana');
    expect(enlace).toBe('https://ejemplo.test/app/?worker=Ana');
    expect(enlace).not.toContain('week');
  });

  it('codifica nombres con espacios o acentos', () => {
    expect(construirEnlaceTrabajador('https://x.test', '/', 'José Luis')).toBe('https://x.test/?worker=Jos%C3%A9%20Luis');
  });
});

// null = el enlace no fija semana: la app sigue sola la de hoy (useWeeks).
describe('semanaPedidaEnEnlace', () => {
  it('un trabajador con el enlace nuevo (sin semana) no fija ninguna: ve la de hoy', () => {
    expect(semanaPedidaEnEnlace({ workerParam: 'Ana', semanas })).toBeNull();
  });

  it('BUG evitado: un enlace viejo con ?week= de una semana pasada ya no ancla al trabajador a ella', () => {
    expect(semanaPedidaEnEnlace({ weekParam: 's3', workerParam: 'Ana', semanas })).toBeNull();
  });

  it('un borrador no se abre nunca a un trabajador por ?week=', () => {
    expect(semanaPedidaEnEnlace({ weekParam: 's5', workerParam: 'Ana', semanas })).toBeNull();
    expect(semanaPedidaEnEnlace({ weekParam: 's5', semanas })).toBeNull(); // sin admin, tampoco
  });

  it('un admin sí respeta ?week=, también a un borrador, aunque abra un enlace de trabajador', () => {
    expect(semanaPedidaEnEnlace({ weekParam: 's3', hayAdmin: true, semanas })).toBe('s3');
    expect(semanaPedidaEnEnlace({ weekParam: 's5', hayAdmin: true, semanas })).toBe('s5');
    expect(semanaPedidaEnEnlace({ weekParam: 's3', workerParam: 'Ana', hayAdmin: true, semanas })).toBe('s3');
  });

  it('sin trabajador, un ?week= válido se respeta; uno inexistente no fija nada', () => {
    expect(semanaPedidaEnEnlace({ weekParam: 's3', semanas })).toBe('s3');
    expect(semanaPedidaEnEnlace({ weekParam: 'no_existe', semanas })).toBeNull();
  });
});

describe('enlaces con la dirección actual', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/gula-logistics/?week=x&tab=live');
  });

  it('la base es el origen y la ruta, sin parámetros', () => {
    expect(urlBase()).toBe(`${window.location.origin}/gula-logistics/`);
  });

  it('el enlace de un trabajador es fijo (sin semana) y lleva su nombre codificado', () => {
    expect(enlaceTrabajador('Ana Sofía')).toBe(`${urlBase()}?worker=Ana%20Sof%C3%ADa`);
  });

  it('el de socias lleva su token de solo lectura en `acceso` (nunca en `token`, que es sesión de admin)', () => {
    expect(enlaceSocias()).toBe(`${urlBase()}?socias`);
    expect(enlaceSocias(null)).toBe(`${urlBase()}?socias`);
    expect(enlaceSocias('abc.def')).toBe(`${urlBase()}?socias&acceso=abc.def`);
  });

  it('la vista pública tiene su parámetro', () => {
    expect(enlaceVistaPublica()).toBe(`${urlBase()}?view=public`);
  });

  it('el de WhatsApp codifica el texto', () => {
    expect(enlaceWhatsApp('Hola & adiós')).toBe('https://api.whatsapp.com/send?text=Hola%20%26%20adi%C3%B3s');
  });
});

describe('abrirEnPestanaNueva', () => {
  it('abre en otra pestaña y la página abierta no puede tocar la de la app (sin window.opener)', () => {
    const ventana = { opener: window };
    const abrir = vi.spyOn(window, 'open').mockReturnValue(ventana);
    abrirEnPestanaNueva('https://api.whatsapp.com/send?text=hola');
    expect(abrir).toHaveBeenCalledWith('https://api.whatsapp.com/send?text=hola', '_blank');
    expect(ventana.opener).toBeNull();
    abrir.mockRestore();
  });

  it('si el navegador bloquea la ventana no falla', () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() => abrirEnPestanaNueva('https://ejemplo.test')).not.toThrow();
    abrir.mockRestore();
  });
});

describe('WhatsApp a un teléfono', () => {
  it('normaliza el teléfono (un móvil español sin prefijo va con +34) y descarta lo que no lo es', () => {
    expect(telefonoWhatsApp('600 11 22 33')).toBe('34600112233');
    expect(telefonoWhatsApp('+34 600-11-22-33')).toBe('34600112233');
    expect(telefonoWhatsApp('0034600112233')).toBe('34600112233');
    expect(telefonoWhatsApp('1234')).toBeNull();
    expect(telefonoWhatsApp('')).toBeNull();
  });

  it('con teléfono abre su chat (wa.me); sin él, se elige el contacto en WhatsApp', () => {
    expect(enlaceWhatsApp('Hola', '600112233')).toBe('https://wa.me/34600112233?text=Hola');
    expect(enlaceWhatsApp('Hola')).toBe('https://api.whatsapp.com/send?text=Hola');
    expect(enlaceWhatsApp('Hola', 'no es un teléfono')).toBe('https://api.whatsapp.com/send?text=Hola');
  });
});
