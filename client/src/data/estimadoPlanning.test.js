import { describe, it, expect } from 'vitest';
import { estimarHorasPlanning } from './estimadoPlanning';

const equipo = [{ name: 'Ana', rate: 10 }, { name: 'Luis', isPayroll: true, rate: 14 }, { name: 'Eva', rate: 12 }];
const semana = {
  schedule: {
    martes: { title: 'Martes 22', tasks: [
      { text: 'Carga', timeFrame: '09:00 - 11:00', assigned: ['Ana', 'Luis'] },
      { text: 'Solapada', timeFrame: '10:00 - 12:00', assigned: ['Ana'] }, // se solapa 1 h con la anterior
      { text: 'Sin hora', timeFrame: 'pendiente', assigned: ['Eva'] },
      { text: 'Desactivada', timeFrame: '15:00 - 18:00', assigned: ['Ana'], active: false },
    ] },
  },
  saturdaySpecial: { title: 'Sábado', weddings: [{ location: 'Finca', timeFrame: '20:00 - 02:00', assigned: ['Eva'] }] },
  sundayMonday: { tasks: [
    { text: 'Recogida', timeFrame: '10:00 - 12:00', targetDay: 'Domingo', assigned: ['Ana'] },
    { text: 'Devolución', timeFrame: '10:00 - 11:00', assigned: ['Ana'] }, // sin día: lunes, no se funde con la del domingo
  ] },
};

describe('estimarHorasPlanning', () => {
  const r = estimarHorasPlanning(semana, equipo);

  it('suma las horas previstas por persona sin contar dos veces los solapes del mismo día', () => {
    const ana = r.porPersona.find(p => p.nombre === 'Ana');
    expect(ana.horas).toBe(3 + 2 + 1); // martes 09-12, domingo 2 h, lunes 1 h
    expect(ana.coste).toBe(60);
  });

  it('cruza medianoche, deja fuera las desactivadas y avisa de las que no tienen hora', () => {
    expect(r.porPersona.find(p => p.nombre === 'Eva')).toMatchObject({ horas: 6, coste: 72 });
    expect(r.sinHorario).toEqual([{ dia: 'Martes 22', texto: 'Sin hora', asignados: ['Eva'] }]);
  });

  it('la nómina fija no cuesta aparte y no entra en los totales de extras', () => {
    expect(r.porPersona.find(p => p.nombre === 'Luis')).toMatchObject({ horas: 2, nomina: true, coste: 0 });
    expect(r.horasExtra).toBe(12);
    expect(r.costeExtra).toBe(132);
  });

  it('sin semana, vacío', () => {
    expect(estimarHorasPlanning(null)).toEqual({ porPersona: [], sinHorario: [], horasExtra: 0, costeExtra: 0 });
  });
});
