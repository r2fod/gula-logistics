// Apuntes a mano de una ficha de Saldos (`breakdown`): lo que el navegador manda se
// valida aquí y el saldo lo calcula el servidor. Antes se guardaba tal cual (importes
// de cualquier tipo, `currentBalance` incluido), sin rastro de lo que se quitaba.

export const TIPOS_APUNTE = ['turno', 'transporte', 'bolsa', 'ajuste', 'pago'];
const IMPORTE_MAXIMO = 100000;
const MAX_APUNTES = 500;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Lo único que el navegador puede escribir en una ficha de Saldos (primer nivel). El saldo
// sale de los apuntes y el rastro (`apuntesBorrados`) solo lo escribe el servidor.
export const CAMPOS_FICHA = ['name', 'role', 'avatar', 'status', 'statusType', 'hourlyRate', 'agreements', 'breakdown',
  'hasTransportBonus', 'transportBonusText', 'isSpecialPurse', 'purseInfo', 'phone', 'notes'];

// Rutas con punto o con $ (`breakdown.0.amount`, `$set`) se saltarían la validación del desglose.
export const hayClavesPeligrosas = (cuerpo) => Object.keys(cuerpo || {}).some((k) => k.includes('.') || k.startsWith('$'));
export const soloCamposDeFicha = (cuerpo) => Object.fromEntries(Object.entries(cuerpo || {}).filter(([k]) => CAMPOS_FICHA.includes(k)));

export const alCentimo = (n) => Math.round(n * 100) / 100;
const importeValido = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= IMPORTE_MAXIMO;
const textoCorto = (v, max) => typeof v === 'string' && v.length <= max;

export const saldoDeApuntes = (apuntes) => alCentimo(apuntes.reduce((suma, a) => suma + a.amount, 0));

function apunteValido(entrada) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return { error: 'Cada apunte debe ser un objeto' };
  // Los apuntes antiguos pueden traer campos opcionales a null: cuentan como ausentes
  // (si no, la ficha entera dejaría de poder guardarse).
  const a = Object.fromEntries(Object.entries(entrada).filter(([, valor]) => valor !== null));
  if (typeof a.concept !== 'string' || !a.concept.trim() || a.concept.length > 300) return { error: 'Cada apunte necesita un concepto de hasta 300 caracteres' };
  if (!importeValido(a.amount)) return { error: `El importe de «${a.concept.slice(0, 40)}» no es válido` };
  if (a.date !== undefined && a.date !== '' && !(typeof a.date === 'string' && FECHA.test(a.date))) return { error: 'La fecha de un apunte debe ser AAAA-MM-DD' };
  if (a.tipo !== undefined && a.tipo !== '' && !TIPOS_APUNTE.includes(a.tipo)) return { error: 'El tipo de un apunte no es válido' };
  if (a.timestamp !== undefined && !textoCorto(a.timestamp, 40)) return { error: 'La marca de hora de un apunte no es válida' };
  if (a.isPositive !== undefined && typeof a.isPositive !== 'boolean') return { error: 'isPositive debe ser booleano' };
  if (a.horasBolsa !== undefined && !(typeof a.horasBolsa === 'number' && Number.isFinite(a.horasBolsa) && a.horasBolsa >= 0 && a.horasBolsa <= 1000)) return { error: 'horasBolsa no es válido' };
  // Solo los campos que conoce el modelo, con el importe al céntimo.
  const limpio = { concept: a.concept, amount: alCentimo(a.amount) };
  ['isPositive', 'date', 'timestamp', 'tipo', 'horasBolsa'].forEach((campo) => { if (a[campo] !== undefined) limpio[campo] = a[campo]; });
  return { apunte: limpio };
}

// { apuntes } (limpios, importes al céntimo) o { error } (texto para el 400).
export function validarApuntes(breakdown) {
  if (!Array.isArray(breakdown)) return { error: 'breakdown debe ser una lista' };
  if (breakdown.length > MAX_APUNTES) return { error: `Hay demasiados apuntes (máximo ${MAX_APUNTES})` };
  const apuntes = [];
  for (const crudo of breakdown) {
    const { apunte, error } = apunteValido(crudo);
    if (error) return { error };
    apuntes.push(apunte);
  }
  return { apuntes };
}

// Los apuntes que estaban y ya no están. Se comparan por concepto e importe (con
// repeticiones): cambiar solo la fecha o el tipo de un apunte no cuenta como quitarlo.
const LINEA_BOLSA = /^valor acumulado horas bolsa/i; // se sustituye en cada turno de bolsa: no es un borrado
export function apuntesQuitados(antes = [], despues = []) {
  const clave = (a) => `${a?.concept}\u0000${alCentimo(Number(a?.amount))}`;
  const quedan = new Map();
  despues.forEach((a) => quedan.set(clave(a), (quedan.get(clave(a)) || 0) + 1));
  return (antes || []).filter((a) => {
    if (LINEA_BOLSA.test(String(a?.concept).trim())) return false;
    const k = clave(a);
    const n = quedan.get(k) || 0;
    if (n > 0) { quedan.set(k, n - 1); return false; }
    return true;
  });
}
