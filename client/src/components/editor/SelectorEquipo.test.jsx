import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/render';
import SelectorEquipo from './SelectorEquipo';

const equipo = [
  { name: 'Ana', role: 'Conductora', avatar: '🚚' },
  { name: 'Luis', role: 'Limpieza', avatar: '🧹' },
  { name: 'Eva', role: 'Conductora', avatar: '🚚' },
];

describe('SelectorEquipo', () => {
  it('sin onAddWorker no sale «+ Nueva persona»', () => {
    render(<SelectorEquipo equipo={equipo} asignados={[]} onAlternar={() => {}} />);
    expect(screen.queryByText(/Nueva persona/)).toBeNull();
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('marcar a alguien llama a onAlternar con su nombre', () => {
    const onAlternar = vi.fn();
    render(<SelectorEquipo equipo={equipo} asignados={['Ana']} onAlternar={onAlternar} />);
    fireEvent.click(screen.getByText('Luis'));
    expect(onAlternar).toHaveBeenCalledWith('Luis');
  });

  it('da de alta a una persona nueva con su rol y la asigna a la tarea', () => {
    const onAddWorker = vi.fn(); const onAlternar = vi.fn();
    const { container } = render(<SelectorEquipo equipo={equipo} asignados={[]} onAlternar={onAlternar} onAddWorker={onAddWorker} />);
    fireEvent.click(screen.getByText('+ Nueva persona'));
    fireEvent.change(screen.getByLabelText('Nombre de la persona nueva'), { target: { value: 'Marcos' } });
    fireEvent.change(screen.getByLabelText('Rol de la persona nueva'), { target: { value: 'Apoyo' } });
    // sugerencias: los roles que ya hay, sin repetir
    expect([...container.querySelectorAll('datalist option')].map(o => o.value)).toEqual(['Conductora', 'Limpieza']);
    fireEvent.click(screen.getByRole('button', { name: 'Añadir persona' }));
    expect(onAddWorker).toHaveBeenCalledWith(expect.objectContaining({ name: 'Marcos', role: 'Apoyo' }));
    expect(onAlternar).toHaveBeenCalledWith('Marcos');
    expect(screen.queryByLabelText('Nombre de la persona nueva')).toBeNull();
  });

  it('BUG evitado: si ya hay alguien con ese nombre no se duplica: se avisa y se asigna a esa persona', async () => {
    const onAddWorker = vi.fn(); const onAlternar = vi.fn();
    render(<SelectorEquipo equipo={equipo} asignados={[]} onAlternar={onAlternar} onAddWorker={onAddWorker} />);
    fireEvent.click(screen.getByText('+ Nueva persona'));
    fireEvent.change(screen.getByLabelText('Nombre de la persona nueva'), { target: { value: ' luis ' } });
    fireEvent.keyDown(screen.getByLabelText('Nombre de la persona nueva'), { key: 'Enter' });
    expect(onAddWorker).not.toHaveBeenCalled();
    expect(onAlternar).toHaveBeenCalledWith('Luis');
    expect(await screen.findByText(/Ya hay alguien llamado "Luis"/)).toBeInTheDocument();
  });

  it('Escape cierra el formulario sin dar de alta', () => {
    const onAddWorker = vi.fn();
    render(<SelectorEquipo equipo={equipo} asignados={[]} onAlternar={() => {}} onAddWorker={onAddWorker} />);
    fireEvent.click(screen.getByText('+ Nueva persona'));
    fireEvent.keyDown(screen.getByLabelText('Nombre de la persona nueva'), { key: 'Escape' });
    expect(screen.queryByLabelText('Nombre de la persona nueva')).toBeNull();
    expect(onAddWorker).not.toHaveBeenCalled();
  });
});
