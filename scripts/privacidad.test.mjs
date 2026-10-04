// node --test scripts/  (los datos de ejemplo se montan por trozos para que el propio
// filtro no salte con este archivo)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revisarTexto } from './privacidad.mjs';

const motivos = (texto, nombres = []) => revisarTexto(texto, nombres).map(h => h.motivo);
const NOMBRES = ['Telmo', 'Íñigo Gula', 'Bo'];

test('nombres reales: como palabra, sin mirar tildes ni mayúsculas, y su id de ficha', () => {
  assert.deepEqual(motivos("assigned: ['Telmo']", NOMBRES), ['nombre real']);
  assert.deepEqual(motivos('fichó inigo gula ayer', NOMBRES), ['nombre real']);
  assert.deepEqual(motivos("put('/api/balances/" + 'inigo-gula' + "')", NOMBRES), ['nombre real (id)']);
  assert.deepEqual(motivos('Telmonte y Telmos no son Telmo', ['Ana']), []);
  assert.deepEqual(motivos('los cortos solo con mayúscula: bo no, Bo sí', NOMBRES), ['nombre real']);
});

test('teléfonos, correos, IBAN y claves; los de ejemplo y los permitidos no', () => {
  assert.deepEqual(motivos('llama al ' + '6' + '12 345 678'), ['teléfono']);
  assert.deepEqual(motivos('ejemplo: ' + '6' + '00000000'), []);
  assert.deepEqual(motivos('ana' + '@' + 'gmail.com'), ['correo']);
  assert.deepEqual(motivos('ana' + '@' + 'example.com y noreply' + '@' + 'anthropic.com'), []);
  assert.deepEqual(motivos('ES' + '91 2100 0418 4502 0005 1332'), ['IBAN']);
  assert.deepEqual(motivos('key=' + 'AIza' + 'x'.repeat(35)), ['clave de Google']);
  assert.deepEqual(motivos('mongodb+srv://' + 'yo:secreto' + '@cluster.mongodb.net'), ['correo', 'contraseña en una URL de Mongo']);
  assert.deepEqual(motivos('mongodb+srv://' + '<usuario>:<password>' + '@cluster.mongodb.net'), []);
});

test('«privacidad-ok» salta esa línea (un nombre inventado que coincide con uno real)', () => {
  assert.deepEqual(motivos("expect(enlace('Telmo')) // " + 'privacidad' + '-ok', NOMBRES), []);
});
