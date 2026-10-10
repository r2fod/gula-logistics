// El equipo (`WORKERS_LIST`) usa nombres cortos ("Marta") pero las fichas de
// Saldos en Mongo guardan el nombre completo ("Marta Gula"), así que una
// comparación exacta nunca los cruza. Esta es la única regla para relacionarlos.

import { plano } from '../utils/texto';

// Sin tildes, en minúsculas, sin espacios de sobra y "ff"→"f": venía de un typo real
// entre dos grafías de un mismo nombre (una con doble f en Saldos y otra con una sola
// en el equipo), corregido el 20/09; se deja como red de seguridad. Las tildes, igual:
// "Sofía" en el equipo y "Sofia Gula" en Saldos se quedaban sin cruzar y su enlace
// salía sin saldo.
export const normalizarNombre = (nombre) => plano(nombre).replace(/ff/g, 'f');

// Cuánto se parece la ficha `nombreSaldo` a la persona del equipo `nombreEquipo`:
// 3 igual, 2 es su nombre seguido de más ("Marta" → "Marta Gula"), 1 lo contiene
// ("Luis" en "José Luis Gula" o dentro de una palabra), 0 nada.
export function parecidoNombre(nombreEquipo, nombreSaldo) {
  const corto = normalizarNombre(nombreEquipo);
  const largo = normalizarNombre(nombreSaldo);
  if (!corto || !largo) return 0;
  if (largo === corto) return 3;
  if (largo.startsWith(`${corto} `)) return 2;
  return largo.includes(corto) ? 1 : 0;
}

// ¿Es la ficha `nombreSaldo` de la persona del equipo `nombreEquipo`?
export const coincideNombre = (nombreEquipo, nombreSaldo) => parecidoNombre(nombreEquipo, nombreSaldo) > 0;

// El elemento de `lista` que más se parece (`puntos(x)`, de parecidoNombre), o null.
// Coger el PRIMERO que coincidiera dejaba a "Ana" con la ficha de "Mariana" si salía
// antes: su enlace enseñaba el saldo de otra persona.
export function elMasParecido(lista = [], puntos) {
  let mejor = null;
  let maximo = 0;
  lista.forEach((x) => {
    const p = puntos(x);
    if (p > maximo) { mejor = x; maximo = p; }
  });
  return mejor;
}

// ¿La misma persona del EQUIPO, escrita igual salvo mayúsculas, tildes y espacios? Para
// comparar nombres del equipo entre sí (fichajes, asignaciones), donde "lo contiene" no
// vale: la salida de "Mariana" cerraba el turno de "Ana".
export function mismoNombre(a, b) {
  const x = normalizarNombre(a);
  return !!x && x === normalizarNombre(b);
}

// De `lista`, la persona a la que corresponde un nombre de fichaje o de planning:
// igual o su nombre seguido de más ("Marta" → "Marta Gula"), o null. "Lo contiene" no
// basta: las horas de "Mariana" (ya fuera del equipo) iban a "Ana".
export function personaDelFichaje(lista, nombre, nombreDe = (x) => x) {
  return elMasParecido(lista, (x) => {
    const p = parecidoNombre(nombreDe(x), nombre);
    return p >= 2 ? p : 0;
  });
}

// La ficha de Saldos de `nombre` mirando a todo el `equipo` (sus nombres): una ficha es
// de quien MÁS se le parece. "Mariana Gula" es de Mariana aunque contenga "Ana": sin
// esto, Ana sin ficha propia se quedaba con la de Mariana (y veía su dinero).
export function fichaDePersona(nombre, fichas = [], equipo = [], nombreDe = (f) => f?.name) {
  return elMasParecido(fichas, (f) => {
    const n = nombreDe(f);
    const p = parecidoNombre(nombre, n);
    return p > 0 && !equipo.some((otro) => !mismoNombre(otro, nombre) && parecidoNombre(otro, n) > p) ? p : 0;
  });
}
