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
