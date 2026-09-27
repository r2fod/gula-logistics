import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '../../test/render';
import GrafoMemoria from './GrafoMemoria';
import ReglasPanel from './ReglasPanel';
import AprendizajePanel from './AprendizajePanel';
import { construirGrafoMemoria } from '../../data/grafoMemoria';

const aprendizaje = {
  porTipo: [
    { tipo: 'Carga', tareas: 4, planificadoMin: 60, realMin: 90, desvioMin: 30 },
    { tipo: 'Limpieza', tareas: 1, planificadoMin: 240, realMin: 300, desvioMin: 60 },
  ],
  porPersona: { Ana: { Carga: 6 }, Luis: { Carga: 3 } },
  enlazados: 7,
  sinEnlazar: 1,
};

describe('GrafoMemoria', () => {
  const grafo = construirGrafoMemoria({
    equipo: [{ name: 'Ana' }, { name: 'Luis' }], aprendizaje,
    memorias: [{ _id: 'm1', content: 'Ana prefiere cargar por la mañana' }, { _id: 'm2', content: 'Regla nueva', estado: 'propuesta' }],
  });

  it('dibuja un punto por nodo y, al tocar uno, resalta y enseña con qué se relaciona', () => {
    render(<GrafoMemoria grafo={grafo} />);
    const ana = screen.getByRole('button', { name: 'Persona: Ana' });
    expect(screen.getByRole('button', { name: 'Tipo de tarea: Carga' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regla: Regla nueva' })).toBeInTheDocument();
    fireEvent.click(ana);
    expect(ana).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Carga · 6 h fichadas/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Regla R1 · la nombra/ })).toBeInTheDocument();
  });

  it('elegir un vecino salta a él; Escape y tocar el fondo lo quitan', () => {
    const { container } = render(<GrafoMemoria grafo={grafo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Persona: Ana' }));
    fireEvent.click(screen.getByRole('button', { name: /Carga · 6 h fichadas/ }));
    expect(screen.getByText(/Planificado 1 h de media, fichado 1 h 30/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Tipo de tarea: Carga' }), { key: 'Escape' });
    expect(screen.getByText(/Toca un punto/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Persona: Luis' }));
    fireEvent.click(container.querySelector('svg[role="group"]'));
    expect(screen.getByText(/Toca un punto/)).toBeInTheDocument();
  });

  it('sin datos, un estado vacío', () => {
    render(<GrafoMemoria grafo={{ nodos: [], enlaces: [] }} />);
    expect(screen.getByText('Aún no hay nada que dibujar')).toBeInTheDocument();
  });
});

describe('ReglasPanel', () => {
  const memoria = (extra = {}) => {
    const memorias = [{ _id: 'p1', content: 'Propuesta', estado: 'propuesta' }, { _id: 'a1', content: 'Activa' }];
    return {
      memorias, propuestas: [memorias[0]], activas: [memorias[1]], cargando: false,
      anadir: vi.fn().mockResolvedValue({ _id: 'n' }), aprobar: vi.fn().mockResolvedValue(true), descartar: vi.fn().mockResolvedValue(true), ...extra,
    };
  };

  it('las propuestas se aprueban o se descartan', () => {
    const m = memoria();
    render(<ReglasPanel memoria={m} />);
    fireEvent.click(screen.getByRole('button', { name: /Aprobar/ }));
    expect(m.aprobar).toHaveBeenCalledWith('p1');
    fireEvent.click(screen.getByRole('button', { name: /Descartar/ }));
    expect(m.descartar).toHaveBeenCalledWith('p1');
  });

  it('borrar una regla activa pide confirmación', async () => {
    const m = memoria();
    render(<ReglasPanel memoria={m} />);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar la regla R2' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Confirmación' })).getByRole('button', { name: 'Borrar' }));
    await waitFor(() => expect(m.descartar).toHaveBeenCalledWith('a1'));
  });

  it('añadir una regla a mano', async () => {
    const m = memoria();
    render(<ReglasPanel memoria={m} />);
    fireEvent.change(screen.getByLabelText('Nueva regla para el asistente'), { target: { value: 'Nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir regla' }));
    await waitFor(() => expect(m.anadir).toHaveBeenCalledWith('Nueva'));
  });
});

describe('AprendizajePanel', () => {
  it('enseña cada tipo y dice cuáles llegan a Gemini y por qué no el resto', () => {
    render(<AprendizajePanel aprendizaje={aprendizaje} />);
    const fila = (tipo) => screen.getByRole('rowheader', { name: tipo }).closest('tr');
    expect(within(fila('Carga')).getByText('Sí')).toBeInTheDocument();
    expect(within(fila('Carga')).getByText('+30 min')).toBeInTheDocument();
    expect(within(fila('Limpieza')).getByText('Faltan 2 más')).toBeInTheDocument();
    expect(screen.getByText(/Ana \(6 h\) · Luis \(3 h\)/)).toBeInTheDocument();
  });

  it('sin fichajes, lo dice', () => {
    render(<AprendizajePanel aprendizaje={{ porTipo: [], porPersona: {} }} />);
    expect(screen.getByText('Todavía no hay fichajes que enseñen nada')).toBeInTheDocument();
  });
});
