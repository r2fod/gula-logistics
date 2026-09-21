import { esBorrador, semanaPorDefecto } from './anticipacion';

// Enlaces de los trabajadores. El enlace de cada persona es SIEMPRE el mismo
// (`?worker=Nombre`, sin semana): al abrirlo enseña la semana que contiene hoy
// (semanaPorDefecto), así que se actualiza solo cada semana y no hay que volver a
// enviárselo. Antes llevaba `?week=<semana>` y cada semana había que mandar uno nuevo.
export function construirEnlaceTrabajador(origen, ruta, nombre) {
  return `${origen}${ruta}?worker=${encodeURIComponent(nombre)}`;
}

// Semana que hay que abrir al entrar por un enlace:
//  · Un TRABAJADOR (enlace con ?worker= y sin sesión de admin) siempre ve la semana
//    actual, aunque el enlace sea uno viejo con ?week= (los que ya se enviaron con
//    la semana escrita dejan de quedarse anclados a ella).
//  · Un admin, o quien entra sin ?worker=, respeta ?week= si existe, salvo que sea
//    un borrador y no haya admin: un borrador solo lo abre un admin.
//  · Sin ?week= válido, la semana por defecto (la que contiene hoy, nunca un borrador).
// Devuelve el id de la semana, o null si no hay ninguna que abrir.
export function semanaInicialDeEnlace({ weekParam = null, workerParam = null, hayAdmin = false, semanas = {}, hoy = new Date() } = {}) {
  const esEnlaceDeTrabajador = Boolean(workerParam) && !hayAdmin;
  if (weekParam && !esEnlaceDeTrabajador) {
    const semana = semanas?.[weekParam];
    if (semana && !(esBorrador(semana) && !hayAdmin)) return weekParam;
  }
  const porDefecto = semanaPorDefecto(semanas, hoy);
  return porDefecto && semanas?.[porDefecto] ? porDefecto : null;
}
