import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '../test/render';

const generar = vi.fn();
const extraer = vi.fn();
vi.mock('../data/geminiScheduleService', () => ({
  generateScheduleWithGemini: (...a) => generar(...a),
  extraerMemoriaDelPrompt: (...a) => extraer(...a),
  GEMINI_API_KEY_STORAGE_KEY: 'clave-gemini',
}));
const api = { getAiMemories: vi.fn(), addAiMemory: vi.fn(), aprobarAiMemory: vi.fn(), deleteAiMemory: vi.fn() };
vi.mock('../data/apiService', () => ({
  getAiMemories: (...a) => api.getAiMemories(...a),
  addAiMemory: (...a) => api.addAiMemory(...a),
  aprobarAiMemory: (...a) => api.aprobarAiMemory(...a),
  deleteAiMemory: (...a) => api.deleteAiMemory(...a),
}));
const { default: GeminiAssistantModal } = await import('./GeminiAssistantModal');

const aprendizaje = { porTipo: [], porPersona: {} };

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => 'CLAVE-FALSA', setItem: () => {}, removeItem: () => {} });
  Object.values(api).forEach(f => f.mockReset());
  api.getAiMemories.mockResolvedValue([{ _id: 'a', content: 'Activa' }, { _id: 'p', content: 'Pendiente', estado: 'propuesta' }]);
  generar.mockResolvedValue({ generatedJson: null, errorMsg: '' });
  extraer.mockResolvedValue('Las bodas grandes llevan un apoyo más');
  api.addAiMemory.mockResolvedValue({ _id: 'n', content: 'Las bodas grandes llevan un apoyo más', estado: 'propuesta' });
  api.aprobarAiMemory.mockResolvedValue({ _id: 'n', content: 'Las bodas grandes llevan un apoyo más', estado: 'activa' });
});

const pedir = async () => {
  render(<GeminiAssistantModal isOpen onClose={() => {}} onApplyGeneratedSchedule={() => {}} activeWeekData={{}} workersList={[]} aprendizaje={aprendizaje} />);
  await waitFor(() => expect(api.getAiMemories).toHaveBeenCalled());
  await act(async () => {}); // que llegue la lista de reglas antes de pedir
  fireEvent.change(screen.getByPlaceholderText(/Escribe tu solicitud/), { target: { value: 'A partir de ahora…' } });
  fireEvent.click(screen.getByRole('button', { name: /Generar Planificación/ }));
};

describe('GeminiAssistantModal — memoria', () => {
  it('Gemini recibe solo las reglas activas y lo aprendido de los fichajes', async () => {
    await pedir();
    await waitFor(() => expect(generar).toHaveBeenCalled());
    const args = generar.mock.calls[0][0];
    expect(args.aiMemories.map(m => m.content)).toEqual(['Activa']);
    expect(args.aprendizaje).toBe(aprendizaje);
  });

  it('BUG evitado: la regla que saca de lo que se pide queda PROPUESTA y solo se usa al pulsar "Recordar"', async () => {
    await pedir();
    expect(await screen.findByText('«Las bodas grandes llevan un apoyo más»')).toBeInTheDocument();
    expect(api.addAiMemory).toHaveBeenCalledWith('Las bodas grandes llevan un apoyo más', { estado: 'propuesta', origen: 'asistente' });
    expect(api.aprobarAiMemory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Recordar/ }));
    await waitFor(() => expect(api.aprobarAiMemory).toHaveBeenCalledWith('n'));
    await waitFor(() => expect(screen.queryByText('«Las bodas grandes llevan un apoyo más»')).toBeNull());
  });

  it('"No hace falta" la borra', async () => {
    api.deleteAiMemory.mockResolvedValue({ ok: true });
    await pedir();
    fireEvent.click(await screen.findByRole('button', { name: /No hace falta/ }));
    await waitFor(() => expect(api.deleteAiMemory).toHaveBeenCalledWith('n'));
  });
});

describe('GeminiAssistantModal — revisar antes de aplicar', () => {
  it('enseña qué cambia respecto a la semana actual y avisa de gente que no está en el equipo', async () => {
    const actual = { schedule: { martes: { tasks: [{ id: 'm1', text: 'Carga', timeFrame: '09:00 - 10:00', assigned: ['Ana'] }] } } };
    const propuesta = { schedule: { martes: { tasks: [
      { id: 'm1', text: 'Carga', timeFrame: '09:00 - 11:00', assigned: ['Ana'] },
      { id: 'm2', text: 'Recogida', timeFrame: '12:00 - 13:00', assigned: ['Inventado'] },
    ] } } };
    generar.mockResolvedValue({ generatedJson: propuesta, errorMsg: '' });
    extraer.mockResolvedValue(null);
    render(<GeminiAssistantModal isOpen onClose={() => {}} onApplyGeneratedSchedule={() => {}} activeWeekData={actual} workersList={[{ name: 'Ana' }]} aprendizaje={aprendizaje} />);
    await waitFor(() => expect(api.getAiMemories).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText(/Escribe tu solicitud/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar Planificación/ }));
    expect(await screen.findByText('+1 nuevas')).toBeInTheDocument();
    expect(screen.getByText('1 cambiadas')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Asigna a quien no está en el equipo: Inventado.');
  });
});
