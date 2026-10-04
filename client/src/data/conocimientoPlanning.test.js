import { describe, it, expect } from 'vitest';
import { aprenderDelPlanning, claveDeTarea } from './conocimientoPlanning';

const semana = (tareas, extra = {}) => ({
  meta: { status: 'Operativa Activa' },
  schedule: { martes: { tasks: tareas }, miercoles: { tasks: [] }, jueves: { tasks: [] }, viernes: { tasks: [] } },
  saturdaySpecial: { weddings: [] }, sundayMonday: { tasks: [] }, trucks: [{ name: 'Camión Norte (Alquiler)' }], ...extra,
});
const equipo = [{ name: 'Ana' }, { name: 'Luis' }, { name: 'Eva' }];

describe('aprenderDelPlanning', () => {
  it('reconoce la misma tarea escrita distinto (evento delante, furgo/camión, plural)', () => {
    expect(claveDeTarea('Boda Uno - Recoger camión Norte')).toBe(claveDeTarea('Logística - recoger furgo norte'));
    expect(claveDeTarea('Recoger generadores 7K')).toBe(claveDeTarea('Recoger Generador 7k'));
  });

  it('tareas que se repiten (2 semanas o más) con quién las hace; las de una sola vez y los borradores no cuentan', () => {
    const semanas = {
      a: semana([{ text: 'Recoger generadores 7K', assigned: ['Ana'] }, { text: 'Boda Uno - Carga camión Norte', assigned: ['Luis', 'Eva'] }]),
      b: semana([{ text: 'Logística - Recoger Generador 7k', assigned: ['Ana', 'Eva'] }]),
      c: semana([{ text: 'Recoger generador 7k', assigned: ['Luis'] }], { meta: { status: 'Borrador' } }),
    };
    const { recurrentes, camiones } = aprenderDelPlanning(semanas, equipo);
    expect(recurrentes).toEqual([{ clave: claveDeTarea('Recoger generador 7k'), tarea: 'Recoger Generador 7k', semanas: 2, personas: [{ nombre: 'Ana', veces: 2 }, { nombre: 'Eva', veces: 1 }] }]);
    expect(camiones).toEqual([{ camion: 'Camión Norte', personas: [{ nombre: 'Eva', veces: 1 }, { nombre: 'Luis', veces: 1 }] }]);
  });
});
