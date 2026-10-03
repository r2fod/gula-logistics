import { Clock, Bell, Edit3, Users, DollarSign, Wand2, Share2, Copy, Check, Eye, KeyRound, Plus, RefreshCw, BrainCircuit } from 'lucide-react';

// Secciones del menú lateral, en orden.
export const SECCIONES_MENU = [
  { id: 'operaciones', titulo: 'Operaciones & Turnos' },
  { id: 'compartir', titulo: 'Compartir & Accesos' },
  { id: 'configuracion', titulo: 'Configuración' },
];

// Las acciones del panel, escritas UNA sola vez. La cabecera (escritorio y móvil)
// y el menú lateral las pintan a partir de esta lista con <BotonAccion>.
//
// Cada acción trae:
// - id, icono (lucide), colorIcono y claseIcono (animación propia del icono al pasar el ratón, ver index.css: icono-reloj, icono-campana...).
// - etiqueta (barra y chips) y etiquetaMenu (menú lateral, más descriptiva).
// - tono: el estilo del botón (ver BotonAccion).
// - lugares: dónde se pinta: 'barra' (escritorio), 'movil' (barra rápida del móvil),
//   'menu' (menú lateral) y 'cabecera' (chips junto al título y al selector de semana).
// - seccion: sección del menú lateral.
// - onClick, cargando (icono latiendo y botón desactivado) y titulo (tooltip).
//
// Solo devuelve las acciones que este usuario puede usar ahora: las de administración
// necesitan `admin`, y las que abren un modal, que el llamador le haya dado su función.
//
// `estado`: { admin, avisando, enlaceSociasCopiado, enlaceSociasCargando }
// `alHacer`: { fichar, avisar, editarPlanning, editarEquipo, nominas, gemini, compartir,
//              copiarEnlaceSocias, vistaPublica, claves, nuevaSemana }
export function crearAcciones({ admin = false, avisando = false, enlaceSociasCopiado = false, enlaceSociasCargando = false } = {}, alHacer = {}) {
  const todas = [
    {
      id: 'fichar', etiqueta: 'Fichar', etiquetaMenu: 'Registrar fichaje', icono: Clock, claseIcono: 'icono-reloj', colorIcono: 'text-emerald-950', tono: 'fichar',
      lugares: ['barra', 'movil', 'menu'], seccion: 'operaciones', onClick: alHacer.fichar,
    },
    {
      id: 'avisar', etiqueta: avisando ? 'Avisando...' : 'Avisar Cambios', etiquetaMenu: avisando ? 'Avisando...' : 'Avisar cambios',
      icono: Bell, claseIcono: 'icono-campana', colorIcono: 'text-indigo-400', tono: 'aviso', cargando: avisando,
      lugares: ['barra', 'menu'], seccion: 'operaciones', visible: admin, onClick: alHacer.avisar,
    },
    {
      id: 'planning', etiqueta: 'Planning', etiquetaMenu: 'Editor de planning semanal', icono: Edit3, claseIcono: 'icono-bamboleo', colorIcono: 'text-orange-400', tono: 'planning',
      lugares: ['barra', 'menu'], seccion: 'operaciones', visible: admin && !!alHacer.editarPlanning, onClick: alHacer.editarPlanning,
    },
    {
      id: 'trabajador', etiqueta: 'Trabajador', etiquetaMenu: 'Gestión de trabajadores', icono: Users, claseIcono: 'icono-flotar', colorIcono: 'text-indigo-400', tono: 'equipo',
      lugares: ['barra', 'menu'], seccion: 'operaciones', visible: admin && !!alHacer.editarEquipo, onClick: alHacer.editarEquipo,
    },
    {
      id: 'nominas', etiqueta: 'Nóminas', etiquetaMenu: 'Nóminas y horas extra', icono: DollarSign, claseIcono: 'icono-pop', colorIcono: 'text-amber-400', tono: 'neutro',
      lugares: ['barra', 'menu'], seccion: 'operaciones', visible: admin, onClick: alHacer.nominas,
    },
    {
      id: 'gemini', etiqueta: 'Gemini AI', etiquetaMenu: 'Asistente IA Gemini', icono: Wand2, colorIcono: 'text-amber-950', claseIcono: 'icono-destello', tono: 'gemini',
      lugares: ['barra', 'menu'], seccion: 'operaciones', visible: admin, onClick: alHacer.gemini,
    },
    {
      id: 'whatsapp', etiqueta: 'WhatsApp', etiquetaMenu: 'Compartir por WhatsApp', icono: Share2, colorIcono: 'text-blue-400', claseIcono: 'icono-latido', tono: 'whatsapp',
      titulo: 'Enlaces de WhatsApp (Trabajadores y Socias)',
      lugares: ['barra', 'movil', 'menu'], seccion: 'compartir', visible: !!alHacer.compartir, onClick: alHacer.compartir,
    },
    {
      id: 'enlaceSocias', etiqueta: enlaceSociasCopiado ? '¡Copiado!' : 'Link Socias',
      etiquetaMenu: enlaceSociasCopiado ? '¡Enlace copiado!' : 'Copiar link de socias',
      icono: enlaceSociasCopiado ? Check : Copy, claseIcono: 'icono-pop', colorIcono: enlaceSociasCopiado ? 'text-emerald-400' : 'text-amber-400', tono: 'enlace',
      titulo: 'Copiar el enlace de solo lectura del Panel de Socias', cargando: enlaceSociasCargando,
      // Solo el admin: el enlace lo genera el servidor con su sesión.
      lugares: ['barra', 'menu'], seccion: 'compartir', visible: admin, onClick: alHacer.copiarEnlaceSocias,
    },
    {
      id: 'vistaPublica', etiqueta: 'Vista Pública', etiquetaMenu: 'Vista pública de operativa', icono: Eye, claseIcono: 'icono-latido', colorIcono: 'text-amber-400', tono: 'publica',
      titulo: 'Vista Pública',
      lugares: ['barra', 'menu'], seccion: 'compartir', visible: !!alHacer.vistaPublica, onClick: alHacer.vistaPublica,
    },
    {
      id: 'claves', etiqueta: 'Clave', etiquetaMenu: 'Claves y configuración', icono: KeyRound, claseIcono: 'icono-girar', colorIcono: 'text-slate-400', tono: 'claves',
      lugares: ['cabecera', 'menu'], seccion: 'configuracion', visible: admin, onClick: alHacer.claves,
    },
    {
      id: 'memoriaIa', etiqueta: 'Memoria IA', etiquetaMenu: 'Grafo de Conocimiento IA', icono: BrainCircuit, claseIcono: 'icono-bamboleo', colorIcono: 'text-indigo-400', tono: 'neutro',
      lugares: ['cabecera', 'menu'], seccion: 'configuracion', visible: admin && !!alHacer.memoriaIa, onClick: alHacer.memoriaIa,
    },
    {
      id: 'nuevaSemana', etiqueta: 'Semana', etiquetaMenu: 'Añadir nueva semana', icono: Plus, claseIcono: 'icono-pop', colorIcono: 'text-amber-400', tono: 'semana',
      lugares: ['cabecera', 'menu'], seccion: 'configuracion', visible: admin, onClick: alHacer.nuevaSemana,
    },
    {
      id: 'generarBorrador', etiqueta: 'Borrador Manual', etiquetaMenu: 'Generar borrador de semana manual', icono: RefreshCw, claseIcono: 'icono-girar', colorIcono: 'text-emerald-400', tono: 'aviso',
      lugares: ['cabecera', 'menu'], seccion: 'configuracion', visible: admin && !!alHacer.generarBorrador, onClick: alHacer.generarBorrador,
    },
  ];

  return todas.filter((accion) => accion.visible !== false);
}

// Las acciones de una variante ('barra', 'movil', 'menu' o 'cabecera').
export const accionesDe = (acciones, lugar) => acciones.filter((accion) => accion.lugares.includes(lugar));
