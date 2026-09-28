import React from 'react';
import { formatearNumero } from '../../data/formatoFinanciero';

// Lo que ha costado la última petición (editorIa.resolverPeticion):
// "0 tokens · Entendido sin gastar Gemini…" o "Gemini: 812 tokens · solo los cambios".
export default function GastoGemini({ resultado }) {
  if (!resultado) return null;
  const texto = resultado.via === 'local'
    ? `0 tokens · ${resultado.resumen}`
    : resultado.uso ? `Gemini: ${formatearNumero(resultado.uso.total, 0)} tokens · ${resultado.via === 'cambios' ? 'solo los cambios' : 'semana completa'}` : '';
  return texto ? <p className="text-[11px] text-slate-400">{texto}</p> : null;
}
