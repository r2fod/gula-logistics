import { defineConfig } from 'vitest/config';

// Varios tests hacen muchas peticiones seguidas contra Express: con toda la
// batería a la vez, a veces pasaban de los 5 s por defecto y fallaban sin motivo.
export default defineConfig({
  test: { testTimeout: 15000 },
});
