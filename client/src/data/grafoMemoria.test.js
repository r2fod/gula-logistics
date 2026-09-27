import { describe, it, expect } from 'vitest';
import { construirGrafoMemoria, colocarGrafo, vecinosDe } from './grafoMemoria';

const semana = {
  meta: { dateRange: 'Del 15 al 20 de Septiembre de 2026', status: 'Operativa Activa' },
  trucks: [{ name: 'Camión Norte (Propio)' }, { name: 'Camión Sur' }],
  schedule: { martes: { tasks: [{ text: 'Boda Ana - Carga Camión Norte', assigned: ['Ana', 'Luis'] }] } },
  saturdaySpecial: { weddings: [{ location: 'Finca', truck: 'Camión Sur', assigned: ['Eva'] }] },
};
const aprendizaje = {
  porTipo: [{ tipo: 'Carga', tareas: 4, planificadoMin: 60, realMin: 90, desvioMin: 30 }],
  porPersona: { Ana: { Carga: 6, Otras: 3 }, Luis: { Carga: 2 } },
};
const equipo = [{ name: 'Ana' }, { name: 'Luis' }, { name: 'Eva' }];
const ids = (g) => g.nodos.map(n => n.id).sort();

describe('construirGrafoMemoria', () => {
  const g = construirGrafoMemoria({
    equipo, semanas: { s: semana }, aprendizaje,
    memorias: [{ _id: 'm1', content: 'A Eva no le gusta el camión Sur' }, { _id: 'm2', content: 'Las cargas dobles llevan un apoyo más', estado: 'propuesta' }],
  });

  it('personas, tipos de tarea (sin "Otras"), camiones sin su paréntesis y reglas', () => {
    expect(ids(g)).toEqual(['camion:norte', 'camion:sur', 'persona:Ana', 'persona:Eva', 'persona:Luis', 'regla:m1', 'regla:m2', 'tipo:Carga']);
    expect(g.nodos.find(n => n.id === 'camion:norte').etiqueta).toBe('Camión Norte');
    expect(g.nodos.find(n => n.id === 'tipo:Carga').detalle).toMatchObject({ desvioMin: 30 });
    expect(g.nodos.find(n => n.id === 'regla:m2')).toMatchObject({ propuesta: true, etiqueta: 'R2' });
  });

  it('enlaza persona–tipo por horas fichadas y persona–camión por el planning (tareas que lo nombran y bodas)', () => {
    expect(vecinosDe(g, 'tipo:Carga').map(v => [v.nodo.id, v.peso])).toEqual(expect.arrayContaining([['persona:Ana', 6], ['persona:Luis', 2], ['regla:m2', 1]]));
    expect(vecinosDe(g, 'camion:norte').map(v => v.nodo.id).sort()).toEqual(['persona:Ana', 'persona:Luis']);
    expect(vecinosDe(g, 'camion:sur').map(v => v.nodo.id)).toContain('persona:Eva');
  });

  it('una regla se enlaza con lo que nombra (persona y camión)', () => {
    expect(vecinosDe(g, 'regla:m1').map(v => v.nodo.id).sort()).toEqual(['camion:sur', 'persona:Eva']);
  });

  it('BUG evitado: un camión genérico ("Camión") no se enlaza con todo el mundo, y una boda con dos camiones da dos', () => {
    const s = { ...semana, trucks: [], saturdaySpecial: { weddings: [{ truck: 'Camión (Alquiler)', assigned: ['Eva'] }, { truck: 'Camión Norte + Camión Sur', assigned: ['Ana'] }] } };
    const g2 = construirGrafoMemoria({ equipo, semanas: { s } });
    expect(g2.nodos.filter(n => n.tipo === 'camion').map(n => n.id).sort()).toEqual(['camion:norte', 'camion:sur']);
    expect(vecinosDe(g2, 'camion:sur').map(v => v.nodo.id)).toEqual(['persona:Ana']);
  });

  it('los borradores no cuentan y sin datos sale vacío', () => {
    const borrador = { ...semana, meta: { ...semana.meta, status: 'Borrador' } };
    expect(construirGrafoMemoria({ semanas: { borrador } }).nodos).toEqual([]);
    expect(construirGrafoMemoria()).toEqual({ nodos: [], enlaces: [] });
  });
});

describe('colocarGrafo', () => {
  it('coloca todos los nodos dentro del lienzo, sin dos en el mismo sitio, con los tipos en el anillo interior', () => {
    const g = construirGrafoMemoria({ equipo, semanas: { s: semana }, aprendizaje, memorias: [{ _id: 'm1', content: 'Regla Eva' }] });
    const colocados = colocarGrafo(g, { ancho: 800, alto: 600 });
    expect(colocados).toHaveLength(g.nodos.length);
    colocados.forEach(n => {
      expect(n.x).toBeGreaterThan(0); expect(n.x).toBeLessThan(800);
      expect(n.y).toBeGreaterThan(0); expect(n.y).toBeLessThan(600);
    });
    expect(new Set(colocados.map(n => `${Math.round(n.x)},${Math.round(n.y)}`)).size).toBe(colocados.length);
    const distancia = (n) => Math.hypot((n.x - 400) / 800, (n.y - 300) / 600);
    const tipo = colocados.find(n => n.tipo === 'tipo');
    colocados.filter(n => n.tipo !== 'tipo').forEach(n => expect(distancia(n)).toBeGreaterThan(distancia(tipo)));
  });
});
