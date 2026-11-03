// Props para una tarjeta que se marca o desmarca con un clic o con Enter/Espacio (un `div`
// que hace de botón). `marcar` null = solo lectura: sin rol ni foco.
export const alMarcar = (marcar, hecha) => (marcar ? {
  role: 'button', tabIndex: 0, 'aria-pressed': hecha, onClick: marcar,
  // Solo con el foco en la propia tarjeta: Enter sobre un botón de dentro es de ese botón.
  onKeyDown: (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); marcar(); } },
} : {});
