import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const generate = vi.fn();
vi.mock('../data/geminiScheduleService', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, generateScheduleWithGemini: (...args) => generate(...args) };
});

const WeekManagerModal = (await import('./WeekManagerModal')).default;

const renderModal = () => render(
  <WeekManagerModal
    isOpen
    onClose={() => {}}
    onCreateWeek={() => {}}
    currentWeekName="Semana 3"
    currentWeekTrucks={[{ name: 'Camión Gula' }]}
    workersList={[{ name: 'Ana', avatar: '🚚' }]}
  />
);

beforeEach(() => {
  // Este entorno de test no trae un localStorage completo.
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  generate.mockReset();
  generate.mockResolvedValue({ generatedJson: { schedule: {}, saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] } }, errorMsg: '' });
});

describe('WeekManagerModal — bodas y eventos por día', () => {
  it('se pueden añadir eventos de martes y viernes (no solo bodas de sábado) y llegan al prompt con su fecha', async () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('ej. Semana 4'), { target: { value: 'Semana 4' } });
    fireEvent.change(screen.getByPlaceholderText('ej. Del 22 al 27 de Septiembre'), { target: { value: 'Del 22 al 27 de septiembre' } });

    const add = screen.getByRole('button', { name: /Añadir boda o evento/ });
    fireEvent.click(add);
    fireEvent.click(add);
    fireEvent.click(add);

    const days = screen.getAllByLabelText('Día del evento');
    const kinds = screen.getAllByLabelText('Tipo de evento');
    const places = screen.getAllByPlaceholderText(/Nombre o lugar/);
    expect(days).toHaveLength(3);

    fireEvent.change(days[0], { target: { value: 'martes' } });
    fireEvent.change(kinds[0], { target: { value: 'Evento' } });
    fireEvent.change(places[0], { target: { value: 'Catering Uno' } });
    fireEvent.change(days[1], { target: { value: 'martes' } });
    fireEvent.change(kinds[1], { target: { value: 'Evento' } });
    fireEvent.change(places[1], { target: { value: 'Catering Dos' } });
    fireEvent.change(days[2], { target: { value: 'viernes' } });
    fireEvent.change(places[2], { target: { value: 'Finca Norte' } });

    fireEvent.click(screen.getByRole('button', { name: /Generar Planificación Inteligente/ }));
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));

    const { prompt } = generate.mock.calls[0][0];
    expect(prompt).toContain('- Martes 22: Evento Catering Uno.');
    expect(prompt).toContain('- Martes 22: Evento Catering Dos.');
    expect(prompt).toContain('- Viernes 25: Boda Finca Norte.');
    expect(prompt).toContain('El sábado no hay bodas esta semana');
    // los nombres de evento que verá la IA son los mismos que el usuario escribió
    expect(generate.mock.calls[0][0].eventNames).toEqual(['Evento Catering Uno', 'Evento Catering Dos', 'Boda Finca Norte']);
  });

  it('un evento se puede quitar', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Añadir boda o evento/ }));
    expect(screen.getAllByLabelText('Día del evento')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar este evento' }));
    expect(screen.queryByLabelText('Día del evento')).not.toBeInTheDocument();
  });

  it('los días del selector llevan el número real de la semana escrita', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('ej. Del 22 al 27 de Septiembre'), { target: { value: 'Del 22 al 27 de Septiembre de 2026' } });
    fireEvent.click(screen.getByRole('button', { name: /Añadir boda o evento/ }));
    const options = Array.from(screen.getByLabelText('Día del evento').querySelectorAll('option')).map(o => o.textContent);
    expect(options).toEqual(['Martes 22', 'Miércoles 23', 'Jueves 24', 'Viernes 25', 'Sábado 26', 'Domingo 27', 'Lunes 28']);
  });
});

describe('WeekManagerModal — clave de Gemini y errores', () => {
  const rellenar = () => {
    fireEvent.change(screen.getByPlaceholderText('ej. Semana 4'), { target: { value: 'Semana 4' } });
    fireEvent.change(screen.getByPlaceholderText('ej. Del 22 al 27 de Septiembre'), { target: { value: 'Del 22 al 27 de septiembre' } });
  };

  it('sin clave guardada pide la clave, y si falla la generación NO ofrece crear la semana', async () => {
    generate.mockResolvedValue({ generatedJson: null, errorMsg: 'Falta la clave de Gemini en este dispositivo. No se ha creado nada.' });
    renderModal();
    expect(screen.getByLabelText(/Clave de Gemini/)).toBeInTheDocument();
    rellenar();
    fireEvent.click(screen.getByRole('button', { name: /Generar Planificación Inteligente/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Falta la clave de Gemini');
    expect(screen.queryByRole('button', { name: /Crear la Semana con esta Planificación/ })).not.toBeInTheDocument();
  });

  it('la clave pegada se guarda en este navegador y se manda al generar', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem, removeItem: () => {} });
    renderModal();
    rellenar();
    fireEvent.change(screen.getByLabelText(/Clave de Gemini/), { target: { value: ' CLAVE-DE-PRUEBA ' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar Planificación Inteligente/ }));

    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect(generate.mock.calls[0][0].apiKey).toBe(' CLAVE-DE-PRUEBA ');
    expect(setItem).toHaveBeenCalledWith('gula_gemini_api_key', 'CLAVE-DE-PRUEBA');
  });

  it('con una clave ya guardada no enseña el campo, solo que hay clave', () => {
    vi.stubGlobal('localStorage', { getItem: () => 'CLAVE', setItem: () => {}, removeItem: () => {} });
    renderModal();
    expect(screen.queryByLabelText(/Clave de Gemini/)).not.toBeInTheDocument();
    expect(screen.getByText(/Clave de Gemini guardada/)).toBeInTheDocument();
  });
});
