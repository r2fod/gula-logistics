import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';
import { usarTarifasPorDefecto } from '../data/tarifasPorDefecto';

const createLocalStorageMock = () => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; }, // como el de verdad (antes siempre 0)
    key: vi.fn((i) => Object.keys(store)[i] || null)
  };
};

globalThis.localStorage = createLocalStorageMock();

beforeEach(() => {
  // Tarifas por defecto de PRUEBA (inventadas): en la app salen de la base de datos, el
  // código no lleva ninguna. Los tests que prueban «sin tarifa» llaman a usarTarifasPorDefecto({}).
  usarTarifasPorDefecto({ extra: 10, nomina: 14, transporte: 10 });
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === 'function') {
    globalThis.localStorage.clear();
  }
});
