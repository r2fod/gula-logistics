import { useSyncExternalStore } from 'react';
import { alCambiarFestivosLocales, festivosLocales } from '../data/festivos';

// Los festivos locales del admin, al día: quien lo usa se repinta cuando se cargan o
// se cambian en Configuración.
export function useFestivosLocales() {
  return useSyncExternalStore(alCambiarFestivosLocales, festivosLocales);
}
