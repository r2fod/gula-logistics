import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/render';
import TarjetaDia from './TarjetaDia';
import KpiCard from '../ui/KpiCard';

describe('TarjetaDia — simetría y adaptación de pantallas', () => {
  it('BUG evitado: estira al 100% de la celda de la rejilla con h-full y flex-1 interior', () => {
    const { container } = render(
      <TarjetaDia titulo="Miércoles 16" insignia="Normal">
        <div>Contenido de tareas</div>
      </TarjetaDia>
    );

    const raiz = container.firstElementChild;
    expect(raiz.className).toContain('h-full');
    expect(raiz.className).toContain('flex-col');
    expect(raiz.className).toContain('justify-between');

    const cabecera = raiz.querySelector('.border-b');
    expect(cabecera.className).toContain('items-center');
    expect(cabecera.className).not.toContain('items-start');

    const cuerpo = screen.getByText('Contenido de tareas').parentElement;
    expect(cuerpo.className).toContain('flex-1');
  });
});

describe('KpiCard — simetría de alturas', () => {
  it('BUG evitado: estira a la misma altura que sus tarjetas hermanas con pie alineado', () => {
    const { container } = render(
      <KpiCard
        titulo="Coste de personal"
        valor={1500}
        formato={(v) => `${v} €`}
        pie={<span>Nota inferior</span>}
      />
    );

    const raiz = container.firstElementChild;
    expect(raiz.className).toContain('h-full');
    expect(raiz.className).toContain('flex-col');
    expect(raiz.className).toContain('justify-between');
  });
});
