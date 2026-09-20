// Lógica compartida para pedirle a Gemini que genere/actualice el JSON de
// una semana de planning. Antes vivía duplicada dentro de
// GeminiAssistantModal.jsx; se extrae aquí porque el asistente guiado de
// "Crear Nueva Semana" (WeekManagerModal.jsx) necesita la misma llamada,
// con las mismas reglas de negocio — mantenerlas en dos sitios las habría
// desincronizado en cuanto alguien ajustara una sola copia.
export const GEMINI_API_KEY_STORAGE_KEY = 'gula_gemini_api_key';

function buildSystemPrompt(activeWeekData) {
  return `Eres el Asistente Experto en Logística de "Gula Logística".
REGLAS DE NEGOCIO IMPORTANTES:
1. Para las tareas de RECOGIDA, asigna SIEMPRE a una sola persona, a menos que el usuario pida explícitamente que asigne a dos.
2. Persona4 y Persona8 NO hacen cargas ni descargas, NO los asignes a esas tareas bajo ningún concepto. Persona7 y Persona6 SOLO hacen limpieza de vajilla y utensilios en eventos, NUNCA cargas, descargas ni montaje de estructura. Persona5 SÍ ayuda como apoyo en cargas, descargas y montaje de estructura cuando hace falta.
3. Al planificar recogidas (especialmente recogidas de camión), prográmalas SIEMPRE por la mañana temprano, a menos que se indique lo contrario.
4. Cuando se descargue en un evento, ten en cuenta que también hay MONTAJE DE ESTRUCTURA. Esto debe reflejarse en el texto y el tiempo estimado de la tarea.
5. Genera las tareas como OBJETOS, intentando siempre separar el texto de la tarea (ej: "Recoger material") del horario (ej: "09:00 - 11:30") y de la ubicación (ej: "Empresa5").
6. Para cada tarea, si es fuera de la base, GENERA UN ENLACE DE GOOGLE MAPS válido para la ubicación usando este formato exacto: "https://www.google.com/maps/search/?api=1&query=Nombre+Del+Sitio". Si es en la base, déjalo vacío "".
7. Te pasaré la SEMANA ACTUAL en formato JSON. Si el usuario te pide un cambio o ajuste, MODIFICA el JSON actual de forma inteligente, preservando lo que no cambie, y devuelve el JSON completo actualizado.

Este es el JSON ACTUAL de la semana (únelo con los cambios que pide el usuario):
${JSON.stringify(activeWeekData || {}, null, 2)}

Genera una respuesta EXCLUSIVAMENTE en formato JSON válido sin texto previo ni posterior, con TODAS LAS CLAVES ORIGINALES Y TUS CAMBIOS, siguiendo esta estructura exacta:
{
  "meta": { "week": "Semana X", "dateRange": "Fechas", "status": "Operativa Activa" },
  "schedule": {
    "martes": { "title": "Martes", "badge": "Arranque", "tasks": [{ "id": "m1", "text": "Texto", "location": "Empresa5", "timeFrame": "09:00 - 11:00", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Empresa5", "assigned": ["Persona1"], "completed": false }] },
    "miercoles": { "title": "Miércoles", "badge": "Pre-carga", "tasks": [...] },
    "jueves": { "title": "Jueves", "badge": "Eventos", "tasks": [...] },
    "viernes": { "title": "Viernes", "badge": "Cierre", "tasks": [...] }
  },
  "saturdaySpecial": {
    "title": "Sábado — Eventos Simultáneos",
    "weddings": [{ "location": "Lugar", "truck": "Camión X", "details": "Detalles", "timeFrame": "10:00 - 02:00", "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Lugar", "assigned": ["Persona1"] }]
  },
  "sundayMonday": {
    "title": "Domingo & Lunes — Logística Inversa",
    "tasks": [{ "id": "sl1", "text": "Texto", "location": "Almacén", "timeFrame": "09:00 - 14:00", "mapsUrl": "", "assigned": ["Persona5"], "completed": false }]
  }
}`;
}

// Ejemplo de demostración: mismo fallback que ya usaba GeminiAssistantModal
// cuando no hay API key configurada, para no dejar al usuario sin ver nada
// (ni aquí ni en el asistente guiado) si todavía no ha metido su clave.
function buildMockSchedule() {
  return {
    meta: {
      week: "Semana (IA Generada)",
      dateRange: "Fechas generadas por Asistente Gemini AI",
      status: "Operativa Activa (IA)"
    },
    schedule: {
      martes: {
        title: "Martes", badge: "IA Flota",
        tasks: [
          { id: "ia1", text: "Revisión de combustible en Camión Gula y Covey.", location: "Nave Base Gula", timeFrame: "09:00 - 10:30", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Paterna", assigned: ["Persona1"], completed: false },
          { id: "ia2", text: "Recogida de Camión Albacar y flejado de cargas.", location: "Albacar Rent", timeFrame: "11:30 - 13:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Albacar+Alquiler+Camiones", assigned: ["Persona2"], completed: false }
        ]
      },
      miercoles: {
        title: "Miércoles", badge: "IA Pre-carga",
        tasks: [
          { id: "ia3", text: "Carga en frío y menaje para eventos.", location: "Almacén Principal", timeFrame: "10:00 - 14:00", mapsUrl: "", assigned: ["Persona3", "Persona5"], completed: false }
        ]
      },
      jueves: {
        title: "Jueves", badge: "IA Logística",
        tasks: [
          { id: "ia4", text: "Control y validación de albaranes de salida.", location: "Almacén Principal", timeFrame: "15:00 - 17:00", mapsUrl: "", assigned: ["Persona8", "Persona4"], completed: false }
        ]
      },
      viernes: {
        title: "Viernes", badge: "IA Cierre",
        tasks: [
          { id: "ia5", text: "Carga final y precintado de los 3 camiones.", location: "Base Logística", timeFrame: "16:00 - 21:00", mapsUrl: "", assigned: ["Persona1", "Persona2", "Persona3"], completed: false }
        ]
      }
    },
    saturdaySpecial: {
      title: "Sábado — Eventos Simultáneos (Gemini AI)",
      weddings: [
        { location: "Lugar1 de Chera", truck: "Camión 1 (Gula)", details: "Conduce: Persona2 | Apoyo: Persona5.", assigned: ["Persona2", "Persona5"], timeFrame: "09:00 - 02:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Lugar1+de+Chera" },
        { location: "Mas dels Refranys", truck: "Camión 2 (Covey)", details: "Conduce: Persona1 | Apoyo: Persona3.", assigned: ["Persona1", "Persona3"], timeFrame: "11:00 - 01:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Mas+dels+Refranys" },
        { location: "Evento Especial 3", truck: "Camión 3 (Albacar)", details: "Conduce: Persona3.", assigned: ["Persona3"], timeFrame: "13:00 - 00:00", mapsUrl: "" }
      ]
    },
    sundayMonday: {
      title: "Domingo & Lunes — Logística Inversa (IA)",
      tasks: [
        { id: "ias1", text: "Descarga completa en almacén y limpieza de vajilla.", location: "Almacén", timeFrame: "09:00 - 14:00", mapsUrl: "", assigned: ["Persona5", "Persona3"], completed: false },
        { id: "ias2", text: "Devolución de Camión Albacar y material de alquiler.", location: "Empresa5", timeFrame: "10:00 - 13:00", mapsUrl: "https://www.google.com/maps/search/?api=1&query=Empresa5+Paterna", assigned: ["Persona1", "Persona2"], completed: false }
      ]
    }
  };
}

// Devuelve { generatedJson } en éxito, o { generatedJson: mock, errorMsg }
// si Gemini falla o no hay API key — nunca lanza, para que quien llama
// pueda mostrar siempre algo (el mock de demostración) en vez de un
// formulario roto.
export async function generateScheduleWithGemini({ prompt, apiKey, activeWeekData }) {
  // Sin fallback a import.meta.env.VITE_GEMINI_API_KEY a propósito:
  // cualquier variable con prefijo VITE_ se compila tal cual en el JS
  // público del bundle (GitHub Pages), así que un "default" ahí
  // filtraría la clave a cualquiera que inspeccione el bundle en cuanto
  // se configurara y desplegara. La única clave válida es la que cada
  // admin pega a mano en este mismo navegador (persistida solo en su
  // localStorage, nunca compilada).
  const activeApiKey = (apiKey || '').trim();

  if (!activeApiKey) {
    await new Promise(resolve => setTimeout(resolve, 1200));
    return { generatedJson: buildMockSchedule(), errorMsg: '' };
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeApiKey}`;
    const systemPrompt = buildSystemPrompt(activeWeekData);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nSolicitud del usuario: ${prompt}` }] }
        ]
      })
    });

    if (!res.ok) throw new Error(`Error Gemini API (${res.status})`);

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('La respuesta de Gemini no contenía un JSON válido.');

    return { generatedJson: JSON.parse(jsonMatch[0]), errorMsg: '' };
  } catch (err) {
    console.error(err);
    return {
      generatedJson: buildMockSchedule(),
      errorMsg: `Error al conectar con Gemini: ${err.message}. Mostrando vista previa demostrativa.`
    };
  }
}
