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
      { id: 'm3', text: 'Recoger material Dealde', timeFrame: '11:00-12:00', assigned: [], completed: false },
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
    expect(guardado.schedule.martes.tasks[2].text).toBe('Boda Eva y Pau + Boda Ana y Luis - Recoger material Dealde');
  });

  it('ofrece las tres categorías generales junto a los eventos ya usados', () => {
    render(<AdminTaskEditorModal isOpen onClose={() => {}} activeWeekData={semana()} workersList={[]} onSaveWeekData={() => {}} />);
    const nombres = Array.from(document.querySelectorAll('button[aria-pressed]')).map(b => b.textContent);
    for (const n of ['Logística Preparación', 'Logística Carga', 'Limpieza Eventos', 'Boda Ana y Luis', 'Boda Eva y Pau']) expect(nombres).toContain(n);
  });
});
