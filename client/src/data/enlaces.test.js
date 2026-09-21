import { describe, it, expect, beforeEach } from 'vitest';
import { construirEnlaceTrabajador, semanaInicialDeEnlace, urlBase, enlaceTrabajador, enlaceSocias, enlaceVistaPublica, enlaceWhatsApp } from './enlaces';

const semana = (dateRange, status = 'Operativa Activa') => ({ meta: { dateRange, status } });
const semanas = {
  s3: semana('Del 15 al 20 de Septiembre de 2026'),
  s4: semana('Del 22 al 27 de Septiembre de 2026'),
  s5: semana('Del 29 de Septiembre al 4 de Octubre de 2026', 'Borrador'),
};
const hoy = new Date(2026, 8, 24, 12, 0); // jueves de la semana 4

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

describe('semanaInicialDeEnlace', () => {
  it('un trabajador con el enlace nuevo (sin semana) ve la semana de hoy', () => {
    expect(semanaInicialDeEnlace({ workerParam: 'Ana', semanas, hoy })).toBe('s4');
  });

  it('BUG evitado: un enlace viejo con ?week= de una semana pasada ya no ancla al trabajador a ella', () => {
    expect(semanaInicialDeEnlace({ weekParam: 's3', workerParam: 'Ana', semanas, hoy })).toBe('s4');
  });

  it('el enlace es el mismo pero la semana cambia sola con la fecha', () => {
    const args = { workerParam: 'Ana', semanas };
    expect(semanaInicialDeEnlace({ ...args, hoy: new Date(2026, 8, 17, 9) })).toBe('s3');
    expect(semanaInicialDeEnlace({ ...args, hoy: new Date(2026, 8, 24, 9) })).toBe('s4');
  });

  it('un borrador no se abre nunca a un trabajador, ni por ?week= ni por defecto', () => {
    expect(semanaInicialDeEnlace({ weekParam: 's5', workerParam: 'Ana', semanas, hoy })).toBe('s4');
    expect(semanaInicialDeEnlace({ weekParam: 's5', semanas, hoy })).toBe('s4'); // sin admin, tampoco
    expect(semanaInicialDeEnlace({ workerParam: 'Ana', semanas, hoy: new Date(2026, 9, 1, 9) })).toBe('s4'); // el borrador de la semana en curso no cuenta
  });

  it('un admin sí respeta ?week=, también a un borrador, aunque abra un enlace de trabajador', () => {
    expect(semanaInicialDeEnlace({ weekParam: 's3', hayAdmin: true, semanas, hoy })).toBe('s3');
    expect(semanaInicialDeEnlace({ weekParam: 's5', hayAdmin: true, semanas, hoy })).toBe('s5');
    expect(semanaInicialDeEnlace({ weekParam: 's3', workerParam: 'Ana', hayAdmin: true, semanas, hoy })).toBe('s3');
  });

  it('sin trabajador, un ?week= válido se respeta y uno inexistente cae en la semana de hoy', () => {
    expect(semanaInicialDeEnlace({ weekParam: 's3', semanas, hoy })).toBe('s3');
    expect(semanaInicialDeEnlace({ weekParam: 'no_existe', semanas, hoy })).toBe('s4');
  });

  it('sin semanas devuelve null', () => {
    expect(semanaInicialDeEnlace({ workerParam: 'Ana', semanas: {}, hoy })).toBeNull();
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
    expect(enlaceTrabajador('Ana María')).toBe(`${urlBase()}?worker=Ana%20Mar%C3%ADa`);
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
