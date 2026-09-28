import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '../test/render';

const generar = vi.fn(); // el enrutador (resolverPeticion)
const corregir = vi.fn(); // modo cambios (editarConGemini)
const extraer = vi.fn();
vi.mock('../data/geminiScheduleService', () => ({
  extraerMemoriaDelPrompt: (...a) => extraer(...a),
  GEMINI_API_KEY_STORAGE_KEY: 'clave-gemini',
}));
vi.mock('../data/editorIa', async (original) => ({
  ...(await original()),
  resolverPeticion: (...a) => generar(...a),
  editarConGemini: (...a) => corregir(...a),
}));
const api = { getAiMemories: vi.fn(), addAiMemory: vi.fn(), aprobarAiMemory: vi.fn(), deleteAiMemory: vi.fn() };
vi.mock('../data/apiService', () => ({
  getAiMemories: (...a) => api.getAiMemories(...a),
  addAiMemory: (...a) => api.addAiMemory(...a),
  aprobarAiMemory: (...a) => api.aprobarAiMemory(...a),
  deleteAiMemory: (...a) => api.deleteAiMemory(...a),
  comprobarClaveIaEnServidor: async () => null,
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
    expect(args.memorias.map(m => m.content)).toEqual(['Activa']);
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

  it('"Pedir a Gemini que lo corrija" le manda los avisos sobre SU propuesta y enseña la corregida', async () => {
    generar.mockClear();
    extraer.mockClear();
    corregir.mockClear();
    const actual = { meta: { week: 'Semana 9' }, schedule: { martes: { tasks: [] } } };
    const conFallo = { schedule: { martes: { tasks: [{ id: 'm1', text: 'Recogida', timeFrame: '12:00 - 13:00', assigned: ['Inventado'] }] } } };
    const corregida = { schedule: { martes: { tasks: [{ id: 'm1', text: 'Recogida', timeFrame: '12:00 - 13:00', assigned: ['Ana'] }] } } };
    generar.mockResolvedValueOnce({ generatedJson: conFallo, errorMsg: '', via: 'cambios', uso: { total: 812 } });
    corregir.mockResolvedValueOnce({ generatedJson: corregida, errorMsg: '', uso: { total: 300 } });
    extraer.mockResolvedValue(null);
    render(<GeminiAssistantModal isOpen onClose={() => {}} onApplyGeneratedSchedule={() => {}} activeWeekData={actual} workersList={[{ name: 'Ana' }]} aprendizaje={aprendizaje} />);
    await waitFor(() => expect(api.getAiMemories).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText(/Escribe tu solicitud/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar Planificación/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Pedir a Gemini que lo corrija/ }));
    await waitFor(() => expect(corregir).toHaveBeenCalledTimes(1));
    const { peticion, semana } = corregir.mock.calls[0][0];
    expect(peticion).toMatch(/^Corrige SOLO estos problemas[\s\S]*Inventado/);
    expect(semana).toMatchObject({ meta: { week: 'Semana 9' }, schedule: conFallo.schedule });
    expect(await screen.findByText(/Gemini: 300 tokens · solo los cambios/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.queryByRole('button', { name: /Pedir a Gemini que lo corrija/ })).toBeNull();
    expect(extraer).toHaveBeenCalledTimes(0); // ni "x" suena a regla ni la corrección se toma por una
  });

  it('lo que se entiende sin Gemini lo dice ("0 tokens") y no busca reglas si no suena a regla', async () => {
    generar.mockClear();
    extraer.mockClear();
    const actual = { meta: { week: 'Semana 9' }, schedule: { jueves: { tasks: [{ id: 'j1', text: 'Carga', timeFrame: '09:00 - 10:00', assigned: ['Ana'] }] } } };
    generar.mockResolvedValueOnce({
      via: 'local', uso: null, errorMsg: '', resumen: 'Entendido sin gastar Gemini: Ana no puede el jueves. 1 tarea cambia de persona.',
      generatedJson: { schedule: { jueves: { tasks: [{ id: 'j1', text: 'Carga', timeFrame: '09:00 - 10:00', assigned: ['Luis'] }] } }, disponibilidad: [{ persona: 'Ana', dia: 'jueves', tipo: 'no' }] },
    });
    render(<GeminiAssistantModal isOpen onClose={() => {}} onApplyGeneratedSchedule={() => {}} activeWeekData={actual} workersList={[{ name: 'Ana' }, { name: 'Luis' }]} aprendizaje={aprendizaje} />);
    await waitFor(() => expect(api.getAiMemories).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Ana no puede el jueves/ }));
    fireEvent.click(screen.getByRole('button', { name: /Generar Planificación/ }));
    expect(await screen.findByText(/^0 tokens · Entendido sin gastar Gemini/)).toBeInTheDocument();
    expect(screen.getByText(/entra Luis/)).toBeInTheDocument();
    expect(extraer).not.toHaveBeenCalled();
  });
});
