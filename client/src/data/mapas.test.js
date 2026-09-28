import { describe, it, expect } from 'vitest';
import { enlaceMaps } from './mapas';

describe('enlaceMaps', () => {
  it('busca el lugar en Google Maps', () => {
    expect(enlaceMaps('Finca Norte, Valencia')).toBe('https://www.google.com/maps/search/?api=1&query=Finca+Norte%2C+Valencia');
  });

  it('sin lugar o en la base no hay enlace', () => {
    expect(enlaceMaps('')).toBe('');
    expect(enlaceMaps('  ')).toBe('');
    expect(enlaceMaps('Almacén Base')).toBe('');
    expect(enlaceMaps('almacen')).toBe('');
  });
});
