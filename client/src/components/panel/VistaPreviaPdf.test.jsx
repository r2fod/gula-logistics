import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/render';
import VistaPreviaPdf from './VistaPreviaPdf';

const pdf = { blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }), nombre: 'Planning Semana 1 (Del 1 al 6).pdf', texto: 'Planning Semana 1' };
const agente = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
const conAgente = (ua) => Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:local/pdf');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(window, 'open').mockReturnValue({ opener: window, location: { href: '' } });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (agente) Object.defineProperty(window.navigator, 'userAgent', agente); else delete window.navigator.userAgent;
  delete navigator.canShare; delete navigator.share;
});

describe('VistaPreviaPdf', () => {
  it('sin PDF no pinta nada', () => {
    render(<VistaPreviaPdf pdf={null} onCerrar={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('BUG evitado: en el ordenador enseña la vista previa y «WhatsApp» descarga el PDF y abre WhatsApp con el texto (antes salía el menú de macOS, sin WhatsApp)', async () => {
    conAgente('Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)');
    navigator.canShare = vi.fn(() => true); navigator.share = vi.fn();
    render(<VistaPreviaPdf pdf={pdf} onCerrar={() => {}} />);
    expect(screen.getByTitle('Vista previa del planning')).toHaveAttribute('src', 'blob:local/pdf');
    fireEvent.click(screen.getByRole('button', { name: /WhatsApp/ }));
    await waitFor(() => expect(window.open).toHaveBeenCalled());
    expect(navigator.share).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/adjúntalo en el chat/);
  });

  it('en el móvil «WhatsApp» usa el menú de compartir con el archivo (ahí sale WhatsApp)', async () => {
    conAgente('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile');
    navigator.canShare = vi.fn(() => true); navigator.share = vi.fn().mockResolvedValue(undefined);
    render(<VistaPreviaPdf pdf={pdf} onCerrar={() => {}} />);
    expect(screen.queryByTitle('Vista previa del planning')).toBeNull(); // en el móvil se abre aparte
    fireEvent.click(screen.getByRole('button', { name: /WhatsApp/ }));
    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(navigator.share.mock.calls[0][0].files[0].name).toBe(pdf.nombre);
    expect(window.open).not.toHaveBeenCalled();
  });

  it('«Descargar» guarda el PDF con su nombre', () => {
    conAgente('Mozilla/5.0 (Macintosh)');
    const clics = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { this.dataset.probado = this.download; });
    render(<VistaPreviaPdf pdf={pdf} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Descargar/ }));
    expect(clics).toHaveBeenCalledTimes(1);
  });
});
