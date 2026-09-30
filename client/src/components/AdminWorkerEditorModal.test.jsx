import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '../test/render';
import AdminWorkerEditorModal from './AdminWorkerEditorModal';

const equipo = [
  { name: 'Ana', role: 'Conductora Flota', avatar: '🚚' },
  { name: 'Luis', role: 'Conductor & Backup', avatar: '🚚', backup: true, disponibilidad: [{ dia: 'lunes', tipo: 'no' }] },
  { name: 'Eva', role: 'Limpieza Eventos', avatar: '🧹', nota: 'cuando no está en cocina' },
  { name: 'Pau', role: 'Jefe de Logística', avatar: '📋', isPayroll: true },
];

const pintar = (props = {}) => {
  const p = { isOpen: true, onClose: vi.fn(), workersList: equipo, onAddWorker: vi.fn(), onRemoveWorker: vi.fn(), onUpdateWorker: vi.fn().mockResolvedValue(true), ...props };
  render(<AdminWorkerEditorModal {...p} />);
  return p;
};

describe('AdminWorkerEditorModal (Gestionar equipo)', () => {
  it('agrupa por perfil y enseña lo de cada ficha como etiquetas, no pegado al nombre', () => {
    pintar();
    expect(within(screen.getByRole('region', { name: 'Conductores' })).getAllByRole('listitem')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: 'Limpieza' })).getByText('Eva')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Jefe de logística' })).getByText('Nómina')).toBeInTheDocument();
    expect(screen.getByText('Solo si hace falta')).toBeInTheDocument();
    expect(screen.getByText('cuando no está en cocina')).toBeInTheDocument();
    expect(screen.getByText('Luis')).toBeInTheDocument(); // el nombre, limpio
  });

  it('"Añadir persona" abre el formulario y guarda con el icono elegido', () => {
    const p = pintar();
    fireEvent.click(screen.getByRole('button', { name: /Añadir persona al equipo/ }));
    fireEvent.change(screen.getByPlaceholderText('Ej: Marcos'), { target: { value: 'Marcos' } });
    fireEvent.click(screen.getByRole('button', { name: /Limpieza/ }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(p.onAddWorker).toHaveBeenCalledWith(expect.objectContaining({ name: 'Marcos', avatar: '🧹', role: 'Conductor Extra' }));
    expect(screen.queryByPlaceholderText('Ej: Marcos')).toBeNull();
  });

  it('no añade a alguien con un nombre que ya existe', async () => {
    const p = pintar();
    fireEvent.click(screen.getByRole('button', { name: /Añadir persona al equipo/ }));
    fireEvent.change(screen.getByPlaceholderText('Ej: Marcos'), { target: { value: 'ana' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(p.onAddWorker).not.toHaveBeenCalled();
    expect(await screen.findByText(/Ya hay alguien llamado "ana"/)).toBeInTheDocument();
  });

  it('quitar pide confirmación en la propia fila', () => {
    const p = pintar();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar a Eva' }));
    expect(screen.getByText('¿Quitar a Eva del equipo?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(p.onRemoveWorker).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar a Eva' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }));
    expect(p.onRemoveWorker).toHaveBeenCalledWith('Eva');
  });

  it('el lápiz abre la ficha editable de esa persona', () => {
    pintar();
    const lapiz = screen.getByRole('button', { name: 'Editar la ficha de Ana' });
    fireEvent.click(lapiz);
    expect(lapiz).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByDisplayValue('Conductora Flota')).toBeInTheDocument();
  });
});
