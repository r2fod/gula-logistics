import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminTaskEditorModal from './AdminTaskEditorModal';

const semana = () => ({
  id: 'week_test',
  meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026' },
  trucks: [],
  schedule: {
    martes: { title: 'Martes 15', tasks: [
      { id: 'm1', text: 'Boda Ana y Luis - Carga de material', timeFrame: '09:00-10:00', assigned: [], completed: false },
      { id: 'm2', text: 'Boda Eva y Pau - Supervisión', timeFrame: '10:00-11:00', assigned: [], completed: false },
      { id: 'm3', text: 'Recoger material Alquileres Norte', timeFrame: '11:00-12:00', assigned: [], completed: false },
    ] },
  },
  saturdaySpecial: { weddings: [] },
  sundayMonday: { title: 'D/L', tasks: [] },
});

let guardado;
beforeEach(() => {
  guardado = null;
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
});

describe('AdminTaskEditorModal — tarea de varios eventos', () => {
  it('los chips añaden y quitan eventos de una tarea, unidos con " + ", y se guardan', () => {
    render(<AdminTaskEditorModal isOpen onClose={() => {}} activeWeekData={semana()} workersList={[]} onSaveWeekData={(w) => { guardado = w; }} />);

    // La tercera tarea (sin evento) pasa a ser de las dos bodas.
    const eventInputs = screen.getAllByPlaceholderText('Dejar vacío si es una Tarea General');
    expect(eventInputs).toHaveLength(3);
    const tercera = eventInputs[2].closest('div.flex.flex-col.gap-2');
    const chip = (nombre) => Array.from(tercera.querySelectorAll('button[aria-pressed]')).find(b => b.textContent === nombre);

    fireEvent.click(chip('Boda Ana y Luis'));
    fireEvent.click(chip('Boda Eva y Pau'));
    expect(eventInputs[2].value).toBe('Boda Ana y Luis + Boda Eva y Pau');
    expect(chip('Boda Ana y Luis').getAttribute('aria-pressed')).toBe('true');

    // Quitar uno lo deja con un solo evento.
    fireEvent.click(chip('Boda Ana y Luis'));
    expect(eventInputs[2].value).toBe('Boda Eva y Pau');

    fireEvent.click(chip('Boda Ana y Luis'));
    fireEvent.click(screen.getByRole('button', { name: /Guardar y Actualizar Planning/ }));
    expect(guardado.schedule.martes.tasks[2].text).toBe('Boda Eva y Pau + Boda Ana y Luis - Recoger material Alquileres Norte');
  });

  it('ofrece las tres categorías generales junto a los eventos ya usados', () => {
    render(<AdminTaskEditorModal isOpen onClose={() => {}} activeWeekData={semana()} workersList={[]} onSaveWeekData={() => {}} />);
    const nombres = Array.from(document.querySelectorAll('button[aria-pressed]')).map(b => b.textContent);
    for (const n of ['Logística Preparación', 'Logística Carga', 'Limpieza Eventos', 'Boda Ana y Luis', 'Boda Eva y Pau']) expect(nombres).toContain(n);
  });
});

describe('AdminTaskEditorModal — pax por evento', () => {
  it('se anotan los pax de cada boda y se guardan en la semana; vaciarlos los quita', () => {
    render(<AdminTaskEditorModal isOpen onClose={() => {}} activeWeekData={semana()} workersList={[]} onSaveWeekData={(w) => { guardado = w; }} />);

    fireEvent.change(screen.getByLabelText('Pax de Boda Ana y Luis'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Pax de Boda Eva y Pau'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Pax de Boda Eva y Pau'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar y Actualizar Planning/ }));

    expect(guardado.events).toEqual([{ name: 'Boda Ana y Luis', pax: 150 }]);
  });

  it('las categorías generales no piden pax', () => {
    render(<AdminTaskEditorModal isOpen onClose={() => {}} activeWeekData={semana()} workersList={[]} onSaveWeekData={() => {}} />);
    expect(screen.queryByLabelText('Pax de Logística Carga')).not.toBeInTheDocument();
  });
});

describe('AdminTaskEditorModal — tareas anteriores al formato (evento en el campo event)', () => {
  const legado = () => ({
    ...semana(),
    events: [{ name: 'Boda Ana y Luis', pax: 100 }],
    schedule: { martes: { title: 'Martes 15', tasks: [{ id: 'm1', text: 'Recoger sillas Proveedor', event: 'Logística Preparación', timeFrame: '11:00-12:00', assigned: [], completed: false }] } },
  });

  it('BUG evitado: tocar un chip NO reescribe el texto de la tarea (desligaba sus fichajes): cambia solo el campo event', () => {
    render(<AdminTaskEditorModal isOpen onClose={() => {}} activeWeekData={legado()} workersList={[]} onSaveWeekData={(w) => { guardado = w; }} />);
    const entrada = screen.getByPlaceholderText('Dejar vacío si es una Tarea General');
    expect(entrada.value).toBe('Logística Preparación'); // muestra el evento del campo
    const contenedor = entrada.closest('div.flex.flex-col.gap-2');
    fireEvent.click(Array.from(contenedor.querySelectorAll('button[aria-pressed]')).find(b => b.textContent === 'Logística Preparación')); // quitarlo
    fireEvent.click(Array.from(contenedor.querySelectorAll('button[aria-pressed]')).find(b => b.textContent === 'Boda Ana y Luis')); // ponerlo
    fireEvent.click(screen.getByRole('button', { name: /Guardar y Actualizar Planning/ }));

    const tarea = guardado.schedule.martes.tasks[0];
    expect(tarea.text).toBe('Recoger sillas Proveedor'); // el texto NO cambia
    expect(tarea.event).toBe('Boda Ana y Luis');
  });

  it('editar la descripción de una de estas tareas cambia el texto pero no le mete el evento delante', () => {
    render(<AdminTaskEditorModal isOpen onClose={() => {}} activeWeekData={legado()} workersList={[]} onSaveWeekData={(w) => { guardado = w; }} />);
    fireEvent.change(screen.getByPlaceholderText(/Carga de camión y montaje/), { target: { value: 'Recoger sillas nuevas' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar y Actualizar Planning/ }));
    expect(guardado.schedule.martes.tasks[0]).toMatchObject({ text: 'Recoger sillas nuevas', event: 'Logística Preparación' });
  });
});
