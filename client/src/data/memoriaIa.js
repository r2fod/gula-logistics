// Reglas a largo plazo del asistente (colección AiMemory). Las que propone el
// asistente quedan `propuesta` hasta que el admin las aprueba; solo las activas
// llegan a Gemini. Las antiguas, sin `estado`, son activas.
export const esMemoriaActiva = (m) => !!m && m.estado !== 'propuesta';
export const esMemoriaPropuesta = (m) => !!m && m.estado === 'propuesta';
