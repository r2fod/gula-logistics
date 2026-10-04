// Confirmaciones de la limpieza de fichajes: el mismo texto en Fichajes (Papelera y
// Revisión) y en Configuración → Base de datos. Devuelven lo que conteste el admin.
export const confirmarVaciarPapelera = (confirm, n) => confirm(
  `Se ${n === 1 ? 'borrará para siempre el fichaje' : `borrarán para siempre los ${n} fichajes`} de la papelera: ya no se podrán restaurar. No cambia ninguna hora ni ningún saldo (lo de la papelera ya no contaba).`,
  { type: 'delete', title: 'Vaciar papelera', confirmText: 'Borrar para siempre' }
);

export const confirmarMoverAPapelera = (confirm, n) => confirm(
  `Se moverán a la papelera ${n === 1 ? '1 fichaje que no cuenta' : `${n} fichajes que no cuentan`} en horas ni en saldos. Podrás restaurarlos desde la Papelera hasta que la vacíes.`,
  { type: 'warning', title: 'Limpiar fichajes', confirmText: 'Mover a la papelera' }
);
