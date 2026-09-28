import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';

const revisar = vi.fn();
vi.mock('../../data/editorIa', () => ({ revisarBorradorConGemini: (...a) => revisar(...a) }));
vi.mock('../../data/apiService', () => ({ getAiMemories: vi.fn().mockResolvedValue([]) }));
const { default: RevisionIaBorrador } = await import('./RevisionIaBorrador');

const semana = {
  meta: { dateRange: 'Del 20 al 25 de Octubre de 2026', status: 'Borrador', revisionIa: { el: new Date(2026, 9, 1, 12, 30).toISOString(), cambios: 3, tokens: 1240 } },
  schedule: { martes: { tasks: [{ id: 'm1', text: 'Carga', timeFrame: '09:00 - 10:00', assigned: ['Ana'] }] } },
  saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] },
};

describe('RevisionIaBorrador', () => {
  it('dice qué hizo Gemini al crearlo (cambios y tokens)', () => {
    render(<RevisionIaBorrador semana={semana} equipo={[{ name: 'Ana' }]} onGuardar={vi.fn()} />);
    expect(screen.getByText(/Gemini lo revisó el .* a las 12:30: 3 cambios · 1\.240 tokens\./)).toBeInTheDocument();
  });

  it('otra revisión se enseña antes; Aplicar guarda el planning y la marca de revisión', async () => {
    revisar.mockResolvedValueOnce({
      generatedJson: { schedule: { martes: { tasks: [{ id: 'm1', text: 'Carga', timeFrame: '09:00 - 10:00', assigned: ['Luis'] }] } }, saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] } },
      aplicados: 1, uso: { total: 600 }, avisos: [], errorMsg: '',
    });
    const onGuardar = vi.fn();
    render(<RevisionIaBorrador semana={semana} equipo={[{ name: 'Ana' }, { name: 'Luis' }]} onGuardar={onGuardar} />);
    fireEvent.click(screen.getByRole('button', { name: /Revisar con Gemini/ }));
    expect(await screen.findByText(/entra Luis/)).toBeInTheDocument();
    expect(screen.getByText(/Gemini: 600 tokens · solo los cambios/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    const guardado = onGuardar.mock.calls[0][0];
    expect(guardado.schedule.martes.tasks[0].assigned).toEqual(['Luis']);
    expect(guardado.meta.revisionIa).toMatchObject({ cambios: 1, tokens: 600 });
    expect(guardado.meta.status).toBe('Borrador');
  });

  it('si Gemini lo ve bien, lo dice y no propone nada', async () => {
    revisar.mockResolvedValueOnce({ generatedJson: null, aplicados: 0, uso: { total: 450 }, errorMsg: '' });
    render(<RevisionIaBorrador semana={semana} equipo={[]} onGuardar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Revisar con Gemini/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Gemini lo ve bien: no propone cambios (450 tokens).'));
  });
});
