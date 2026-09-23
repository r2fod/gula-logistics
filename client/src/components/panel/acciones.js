import { Clock, Bell, Edit3, Users, DollarSign, Wand2, Share2, Copy, Check, Eye, KeyRound, Plus, RefreshCw } from 'lucide-react';

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
// `estado`: { admin, avisando, enlaceSociasCopiado }
// `alHacer`: { fichar, avisar, editarPlanning, editarEquipo, nominas, gemini, compartir,
//              copiarEnlaceSocias, vistaPublica, claves, nuevaSemana }
export function crearAcciones({ admin = false, avisando = false, enlaceSociasCopiado = false } = {}, alHacer = {}) {
  const todas = [
    {
      id: 'fichar', etiqueta: 'Fichar', etiquetaMenu: 'Registrar fichaje', icono: Clock, claseIcono: 'icono-reloj', tono: 'fichar',
      lugares: ['barra', 'movil', 'menu'], seccion: 'operaciones', onClick: alHacer.fichar,
    },
    {
      id: 'avisar', etiqueta: avisando ? 'Avisando...' : 'Avisar Cambios', etiquetaMenu: avisando ? 'Avisando...' : 'Avisar cambios',
      icono: Bell, claseIcono: 'icono-campana', tono: 'aviso', cargando: avisando,
      lugares: ['barra', 'menu'], seccion: 'operaciones', visible: admin, onClick: alHacer.avisar,
    },
    {
      id: 'planning', etiqueta: 'Planning', etiquetaMenu: 'Editor de planning semanal', icono: Edit3, tono: 'planning',
      lugares: ['barra', 'menu'], seccion: 'operaciones', visible: admin && !!alHacer.editarPlanning, onClick: alHacer.editarPlanning,
    },
    {
      id: 'trabajador', etiqueta: 'Trabajador', etiquetaMenu: 'Gestión de trabajadores', icono: Users, tono: 'equipo',
      lugares: ['barra', 'menu'], seccion: 'operaciones', visible: admin && !!alHacer.editarEquipo, onClick: alHacer.editarEquipo,
    },
    {
      id: 'nominas', etiqueta: 'Nóminas', etiquetaMenu: 'Nóminas y horas extra', icono: DollarSign, colorIcono: 'text-amber-400', tono: 'neutro',
      lugares: ['barra', 'menu'], seccion: 'operaciones', visible: admin, onClick: alHacer.nominas,
    },
    {
      id: 'gemini', etiqueta: 'Gemini AI', etiquetaMenu: 'Asistente IA Gemini', icono: Wand2, colorIcono: 'text-amber-400', claseIcono: 'icono-destello', tono: 'gemini',
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
      icono: enlaceSociasCopiado ? Check : Copy, colorIcono: enlaceSociasCopiado ? 'text-emerald-400' : 'text-amber-400', tono: 'enlace',
      titulo: 'Copiar enlace directo al Panel de Socias',
      lugares: ['barra', 'menu'], seccion: 'compartir', onClick: alHacer.copiarEnlaceSocias,
    },
    {
      id: 'vistaPublica', etiqueta: 'Vista Pública', etiquetaMenu: 'Vista pública de operativa', icono: Eye, colorIcono: 'text-amber-400', tono: 'publica',
      titulo: 'Vista Pública',
      lugares: ['barra', 'menu'], seccion: 'compartir', visible: !!alHacer.vistaPublica, onClick: alHacer.vistaPublica,
    },
    {
      id: 'claves', etiqueta: 'Clave', etiquetaMenu: 'Claves y configuración', icono: KeyRound, colorIcono: 'text-slate-400', tono: 'claves',
      lugares: ['cabecera', 'menu'], seccion: 'configuracion', visible: admin, onClick: alHacer.claves,
    },
    {
      id: 'nuevaSemana', etiqueta: 'Semana', etiquetaMenu: 'Añadir nueva semana', icono: Plus, colorIcono: 'text-amber-400', tono: 'semana',
      lugares: ['cabecera', 'menu'], seccion: 'configuracion', visible: admin, onClick: alHacer.nuevaSemana,
    },
    {
      id: 'generarBorrador', etiqueta: 'Borrador Manual', etiquetaMenu: 'Generar borrador de semana manual', icono: RefreshCw, colorIcono: 'text-emerald-400', tono: 'aviso',
      lugares: ['cabecera', 'menu'], seccion: 'configuracion', visible: admin && !!alHacer.generarBorrador, onClick: alHacer.generarBorrador,
    },
  ];

  return todas.filter((accion) => accion.visible !== false);
}

// Las acciones de una variante ('barra', 'movil', 'menu' o 'cabecera').
export const accionesDe = (acciones, lugar) => acciones.filter((accion) => accion.lugares.includes(lugar));
