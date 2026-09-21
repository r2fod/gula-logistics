import { describe, it, expect, vi } from 'vitest';
import { crearAcciones, accionesDe, SECCIONES_MENU } from './acciones';

const todasLasFunciones = () => ({
  fichar: vi.fn(), avisar: vi.fn(), editarPlanning: vi.fn(), editarEquipo: vi.fn(), nominas: vi.fn(), gemini: vi.fn(),
  compartir: vi.fn(), copiarEnlaceSocias: vi.fn(), vistaPublica: vi.fn(), claves: vi.fn(), nuevaSemana: vi.fn(),
});

const ids = (acciones) => acciones.map((a) => a.id);

describe('crearAcciones', () => {
  it('sin ser admin solo quedan las acciones de todos (y las que tienen su función)', () => {
    const acciones = crearAcciones({ admin: false }, todasLasFunciones());
    expect(ids(acciones)).toEqual(['fichar', 'whatsapp', 'enlaceSocias', 'vistaPublica']);
  });

  it('un admin ve todas', () => {
    const acciones = crearAcciones({ admin: true }, todasLasFunciones());
    expect(ids(acciones)).toEqual([
      'fichar', 'avisar', 'planning', 'trabajador', 'nominas', 'gemini', 'whatsapp', 'enlaceSocias', 'vistaPublica', 'claves', 'nuevaSemana',
    ]);
  });

  it('las acciones que abren un modal desaparecen si nadie les dio su función', () => {
    const { editarPlanning, editarEquipo, compartir, vistaPublica, ...resto } = todasLasFunciones();
    const acciones = crearAcciones({ admin: true }, resto);
    expect(ids(acciones)).not.toContain('planning');
    expect(ids(acciones)).not.toContain('trabajador');
    expect(ids(acciones)).not.toContain('whatsapp');
    expect(ids(acciones)).not.toContain('vistaPublica');
    expect(ids(acciones)).toContain('nominas');
  });

  it('cada variante enseña sus acciones: barra, barra rápida del móvil, cabecera y menú', () => {
    const acciones = crearAcciones({ admin: true }, todasLasFunciones());
    expect(ids(accionesDe(acciones, 'barra'))).toEqual(['fichar', 'avisar', 'planning', 'trabajador', 'nominas', 'gemini', 'whatsapp', 'enlaceSocias', 'vistaPublica']);
    expect(ids(accionesDe(acciones, 'movil'))).toEqual(['fichar', 'whatsapp']);
    expect(ids(accionesDe(acciones, 'cabecera'))).toEqual(['claves', 'nuevaSemana']);
    expect(accionesDe(acciones, 'menu')).toHaveLength(acciones.length);
  });

  it('todas las acciones del menú caen en una sección que existe', () => {
    const acciones = crearAcciones({ admin: true }, todasLasFunciones());
    const secciones = SECCIONES_MENU.map((s) => s.id);
    accionesDe(acciones, 'menu').forEach((a) => expect(secciones).toContain(a.seccion));
  });

  it('mientras avisa, el botón cambia de texto y pasa a "cargando"', () => {
    const avisar = (estado) => crearAcciones({ admin: true, ...estado }, todasLasFunciones()).find((a) => a.id === 'avisar');
    expect(avisar({ avisando: false })).toMatchObject({ etiqueta: 'Avisar Cambios', cargando: false });
    expect(avisar({ avisando: true })).toMatchObject({ etiqueta: 'Avisando...', cargando: true });
  });

  it('tras copiar el enlace de socias enseña "¡Copiado!" con su icono verde', () => {
    const enlace = (estado) => crearAcciones({ admin: false, ...estado }, todasLasFunciones()).find((a) => a.id === 'enlaceSocias');
    expect(enlace({ enlaceSociasCopiado: false })).toMatchObject({ etiqueta: 'Link Socias', etiquetaMenu: 'Copiar link de socias' });
    expect(enlace({ enlaceSociasCopiado: true })).toMatchObject({ etiqueta: '¡Copiado!', etiquetaMenu: '¡Enlace copiado!', colorIcono: 'text-emerald-400' });
  });

  it('la función de cada acción es la que se le dio', () => {
    const funciones = todasLasFunciones();
    const acciones = crearAcciones({ admin: true }, funciones);
    acciones.find((a) => a.id === 'nominas').onClick();
    expect(funciones.nominas).toHaveBeenCalledTimes(1);
  });

  it('tolera que no se le pase nada', () => {
    expect(ids(crearAcciones())).toEqual(['fichar', 'enlaceSocias']);
  });
});
