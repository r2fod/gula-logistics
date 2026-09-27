// render/renderHook de los tests con los mismos proveedores que monta main.jsx
// (hoy DialogProvider: sin él, todo lo que usa useDialog revienta al montar).
// Mismo API que @testing-library/react: basta con cambiar el import.
import React from 'react';
import { render as renderBase, renderHook as renderHookBase } from '@testing-library/react';
import { DialogProvider } from '../contexts/DialogContext';

const Proveedores = ({ children }) => <DialogProvider>{children}</DialogProvider>;

export * from '@testing-library/react';
export const render = (ui, opciones) => renderBase(ui, { wrapper: Proveedores, ...opciones });
export const renderHook = (hook, opciones) => renderHookBase(hook, { wrapper: Proveedores, ...opciones });
