import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/render';
import LogisticsTab from './LogisticsTab';

describe('LogisticsTab', () => {
  it('BUG evitado: las bodas y tareas del jueves desactivadas (active: false) no se muestran en Flota', () => {
    const semana = {
      meta: { week: 'Semana 4' },
      saturdaySpecial: {
        weddings: [
          { location: 'Finca Activa', truck: 'Camión Gula', details: 'Boda activa', active: true },
          { location: 'Finca Apagada', truck: 'Camión Norte', details: 'Boda cancelada', active: false },
        ],
      },
      schedule: {
        jueves: {
          tasks: [
            { id: 'j1', location: 'Sede Uno', truck: 'Camión Gula', text: 'Evento activo' },
            { id: 'j2', location: 'Sede Dos', truck: 'Camión Norte', text: 'Evento apagado', active: false },
          ],
        },
      },
    };
    render(<LogisticsTab activeWeekData={semana} adminUnlocked={false} />);
    expect(screen.getByText('Finca Activa')).toBeInTheDocument();
    expect(screen.getByText('Evento activo')).toBeInTheDocument();
    expect(screen.queryByText('Finca Apagada')).toBeNull();
    expect(screen.queryByText('Evento apagado')).toBeNull();
  });

  it('muestra estado vacío cuando la semana no tiene eventos clave', () => {
    render(<LogisticsTab activeWeekData={{ meta: { week: 'Semana 4' }, saturdaySpecial: { weddings: [] }, schedule: {} }} adminUnlocked={false} />);
    expect(screen.getByText(/No hay eventos clave/i)).toBeInTheDocument();
  });
});
