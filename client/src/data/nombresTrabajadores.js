// El equipo (`WORKERS_LIST`) usa nombres cortos ("Marta") pero las fichas de
// Saldos en Mongo guardan el nombre completo ("Marta Gula"), así que una
// comparación exacta nunca los cruza. Esta es la única regla para relacionarlos.

// Minúsculas, sin espacios de sobra y "ff"→"f": venía de un typo real entre dos
// grafías de un mismo nombre (una con doble f en Saldos y otra con una sola en el
// equipo), corregido el 20/09; se deja como red de seguridad, es inofensivo aunque
// ya no haga falta.
export const normalizarNombre = (nombre) => (nombre || '').trim().toLowerCase().replace(/ff/g, 'f');

// ¿Es la ficha `nombreSaldo` de la persona del equipo `nombreEquipo`? Vale el
// nombre igual o el corto contenido en el completo ("Marta" en "Marta Gula").
export function coincideNombre(nombreEquipo, nombreSaldo) {
  const corto = normalizarNombre(nombreEquipo);
  const largo = normalizarNombre(nombreSaldo);
  if (!corto || !largo) return false;
  return largo === corto || largo.startsWith(`${corto} `) || largo.includes(corto);
}
