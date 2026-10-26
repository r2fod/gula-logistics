// node --test scripts/  (los datos de ejemplo se montan por trozos para que el propio
// filtro no salte con este archivo)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { revisarTexto, nombresDelEquipo, sinEjemplos } from './privacidad.mjs';

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

// Los nombres salen de la base (GET /api/roster): sin archivo ni secreto que mantener.
const respuesta = (equipo, ok = true) => async () => ({ ok, status: ok ? 200 : 503, json: async () => ({ workers: equipo }) });
const cacheTemporal = () => join(mkdtempSync(join(tmpdir(), 'priv-')), 'nombres.json');

test('los nombres son los del equipo en la base, sin repetidos ni vacíos; se guardan en la caché', async () => {
  const cache = cacheTemporal();
  const r = await nombresDelEquipo({ env: {}, llamar: respuesta([{ name: 'Telmo' }, { name: ' Telmo ' }, { name: '' }, {}, { name: 'Íñigo' }]), cache });
  assert.deepEqual(r, { nombres: ['Telmo', 'Íñigo'], origen: 'base' });
  assert.deepEqual(JSON.parse(readFileSync(cache, 'utf8')).nombres, ['Telmo', 'Íñigo']);
});

test('pide la dirección que diga PRIVACIDAD_API (por defecto, la pública del servidor)', async () => {
  const pedidas = [];
  const llamar = async (url) => { pedidas.push(url); return { ok: true, json: async () => ({ workers: [] }) }; };
  await nombresDelEquipo({ env: { PRIVACIDAD_API: 'http://localhost:5000/api/' }, llamar, cache: '' });
  await nombresDelEquipo({ env: {}, llamar, cache: '' });
  assert.equal(pedidas[0], 'http://localhost:5000/api/roster');
  assert.match(pedidas[1], /^https:\/\/.+\/api\/roster$/);
});

test('sin red o con el servidor caído usa la caché de la última vez; sin caché, sin nombres (y no falla)', async () => {
  const cache = cacheTemporal();
  writeFileSync(cache, JSON.stringify({ nombres: ['Telmo'] }));
  assert.deepEqual(await nombresDelEquipo({ env: {}, llamar: async () => { throw new Error('sin red'); }, cache }), { nombres: ['Telmo'], origen: 'caché' });
  assert.deepEqual(await nombresDelEquipo({ env: {}, llamar: respuesta([], false), cache }), { nombres: ['Telmo'], origen: 'caché' });
  assert.deepEqual(await nombresDelEquipo({ env: {}, llamar: async () => { throw new Error('sin red'); }, cache: cacheTemporal() }), { nombres: [], origen: 'ninguno' });
});

test('una respuesta que no es un equipo no borra la caché ni hace saltar nada', async () => {
  const cache = cacheTemporal();
  writeFileSync(cache, JSON.stringify({ nombres: ['Telmo'] }));
  const llamar = async () => ({ ok: true, json: async () => ({ error: 'x' }) });
  assert.deepEqual((await nombresDelEquipo({ env: {}, llamar, cache })).origen, 'caché');
  assert.equal(existsSync(cache), true);
});

test('no cuentan los nombres inventados de siempre (Ana, Luis…); los demás, sí', () => {
  assert.deepEqual(sinEjemplos(['Ana', 'Luis García', 'Telmo', 'Íñigo Gula', 'Sofía']), ['Luis García', 'Telmo', 'Íñigo Gula']); // el nombre suelto; con apellido, sí se busca
});


test('BUG evitado: un equipo vacío (base recién despierta) no pisa la caché ni deja el filtro sin nombres', async () => {
  const cache = cacheTemporal();
  writeFileSync(cache, JSON.stringify({ nombres: ['Telmo'] }));
  assert.deepEqual(await nombresDelEquipo({ env: {}, llamar: respuesta([]), cache }), { nombres: ['Telmo'], origen: 'caché' });
  assert.deepEqual(JSON.parse(readFileSync(cache, 'utf8')).nombres, ['Telmo']);
});
