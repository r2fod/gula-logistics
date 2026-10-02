import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';

const createLocalStorageMock = () => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    length: 0,
    key: vi.fn((i) => Object.keys(store)[i] || null)
  };
};

globalThis.localStorage = createLocalStorageMock();

beforeEach(() => {
  if (globalThis.localStorage && typeof globalThis.localStorage.clear === 'function') {
    globalThis.localStorage.clear();
  }
});
