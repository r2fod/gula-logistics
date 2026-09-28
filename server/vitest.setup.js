import { Server as ServidorTls } from 'node:tls';
import supertest from 'supertest';

// supertest abre cada app con listen(0) en TODAS las interfaces (::) y se conecta a
// 127.0.0.1. En macOS otro proceso puede coger ese mismo puerto solo en 127.0.0.1 y
// llevarse la petición: tests que fallaban sueltos con un 403 ajeno o colgados 15 s.
// Aquí la app escucha solo en 127.0.0.1 (así nadie más puede quedarse ese puerto) y
// cada petición espera a que esté escuchando (con dirección, listen no es inmediato).
const { Test } = supertest;
const SIN_PUERTO = 'puerto-pendiente';

Test.prototype.serverAddress = function (app, path) {
  if (!app.address()) this._server = app.listen(0, '127.0.0.1');
  const protocolo = app instanceof ServidorTls ? 'https' : 'http';
  return `${protocolo}://127.0.0.1:${app.address()?.port ?? SIN_PUERTO}${path}`;
};

const terminar = Test.prototype.end;
Test.prototype.end = function (fn) {
  const servidor = this._server;
  if (!servidor || servidor.listening) return terminar.call(this, fn);
  servidor.once('listening', () => {
    this.url = this.url.replace(SIN_PUERTO, servidor.address().port);
    terminar.call(this, fn);
  });
  return this;
};
