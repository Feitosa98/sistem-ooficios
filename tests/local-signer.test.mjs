import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { harness } from './helpers.mjs';

const origin = 'https://oficios.registromanacapuru.com.br';
const extensionId = 'a'.repeat(32);
const thumbprint = 'A'.repeat(40);
const hash = Buffer.alloc(32, 1).toString('base64');

function worker() {
  let listener;
  const ports = [];
  const runtime = {
    id: extensionId,
    onMessage: { addListener(fn) { listener = fn; } },
    connectNative(name) {
      assert.equal(name, 'br.com.registromanacapuru.oficios');
      const port = { onMessage: { addListener(fn) { port.receive = fn; } }, onDisconnect: { addListener(fn) { port.closed = fn; } }, postMessage(request) { port.request = request; }, disconnect() { port.closed(); } };
      ports.push(port);
      return port;
    },
  };
  vm.runInNewContext(fs.readFileSync('local-signer/extension/background.js', 'utf8'), { chrome: { runtime }, URL, Set });
  const sender = { id: extensionId, frameId: 0, tab: { id: 1 }, url: origin + '/', origin };
  return { ports, sender, send: (...args) => listener(...args) };
}

test('extension blocks foreign sites, frames, malformed hashes and unknown operations', () => {
  const w = worker();
  for (const sender of [{ ...w.sender, url: 'https://evil.test/' }, { ...w.sender, frameId: 1 }, { ...w.sender, id: 'other' }, { ...w.sender, origin: 'null' }]) {
    assert.equal(w.send({ command: 'ping' }, sender, () => assert.fail()), false);
  }
  assert.equal(w.send({ command: 'exportPrivateKey' }, w.sender, () => assert.fail()), false);
  assert.equal(w.send({ command: 'sign', thumbprint, hash: 'invalid', documentLabel: 'Ofício 1' }, w.sender, () => assert.fail()), false);
  assert.equal(w.ports.length, 0);
});

test('extension forwards only allowed data and serializes pending signatures', () => {
  const w = worker();
  const results = [];
  const request = { command: 'sign', thumbprint, hash, documentLabel: 'Ofício 1', privateKey: 'never forward' };
  assert.equal(w.send(request, w.sender, value => results.push(value)), true);
  assert.equal(w.ports[0].request.origin, origin);
  assert.equal(w.ports[0].request.privateKey, undefined);
  assert.equal(w.send(request, w.sender, value => results.push(value)), false);
  assert.equal(results[0].ok, false);
  w.ports[0].receive({ ok: true, result: 'signature' });
  assert.equal(results.length, 2);
  assert.equal(results[1].result, 'signature');
  assert.equal(w.send(request, w.sender, () => {}), true);
  w.ports[1].closed();
});

test('adapter correlates responses, ignores foreign events and cleans up listeners', async (t) => {
  const h = harness();
  const listeners = new Set();
  const timers = new Map();
  let outgoing;
  const window = {
    location: { origin },
    addEventListener(_event, fn) { listeners.add(fn); },
    removeEventListener(_event, fn) { listeners.delete(fn); },
    setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    postMessage(data) { outgoing = data; },
  };
  const previous = globalThis.window;
  globalThis.window = window;
  t.after(() => { h.close(); if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  const signer = h.load('lib/local-signer.ts').createLocalSigner('Ofício 1');
  const result = new Promise((resolve, reject) => signer.readCertificate(thumbprint).success(resolve).error(reject));
  const data = { ...outgoing, direction: 'response', ok: true, result: 'certificate' };
  for (const listener of listeners) listener({ source: {}, origin, data });
  for (const listener of listeners) listener({ source: window, origin: 'https://evil.test', data });
  assert.equal(listeners.size, 1);
  for (const listener of listeners) listener({ source: window, origin, data });
  assert.equal(await result, 'certificate');
  assert.equal(listeners.size, 0);
  assert.equal(timers.size, 0);
  const timeout = new Promise(resolve => signer.listCertificates().error(resolve));
  for (const fn of [...timers.values()]) fn();
  assert.match(await timeout, /indisponível/);
  assert.equal(listeners.size, 0);
});

test('native protocol validates caller, framing and site before accessing certificates', { skip: process.platform !== 'win32' ? 'Windows required' : !fs.existsSync('local-signer/dist/OficiosSigner.exe') ? 'Run local-signer/build.ps1 to enable native protocol tests' : false }, () => {
  assert.ok(fs.existsSync('local-signer/dist/OficiosSigner.exe'), 'Compile local-signer/build.ps1 before running this test');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oficios-signer-test-'));
  try {
    const binary = path.join(dir, 'OficiosSigner.exe');
    fs.copyFileSync('local-signer/dist/OficiosSigner.exe', binary);
    fs.writeFileSync(path.join(dir, 'allowed-origins.txt'), `chrome-extension://${extensionId}/\n`);
    const call = (request, args = [`chrome-extension://${extensionId}/`]) => {
      const body = Buffer.from(JSON.stringify(request));
      const prefix = Buffer.alloc(4); prefix.writeUInt32LE(body.length);
      return spawnSync(binary, args, { input: Buffer.concat([prefix, body]), windowsHide: true, timeout: 5000 });
    };
    const decode = result => {
      assert.equal(result.status, 0);
      assert.equal(result.stdout.readUInt32LE(), result.stdout.length - 4);
      return JSON.parse(result.stdout.subarray(4).toString());
    };
    assert.deepEqual(decode(call({ command: 'ping', origin })), { ok: true, result: { version: 1 } });
    assert.equal(call({ command: 'ping', origin }, ['chrome-extension://' + 'b'.repeat(32) + '/']).status, 1);
    assert.equal(decode(call({ command: 'list', origin: 'https://evil.test' })).ok, false);
    assert.equal(decode(call({ command: 'export', origin })).ok, false);
    assert.equal(decode(call({ command: 'sign', origin, thumbprint, hash: 'bad', documentLabel: 'Ofício' })).ok, false);
    const oversize = Buffer.alloc(4); oversize.writeUInt32LE(100000);
    assert.equal(decode(spawnSync(binary, [`chrome-extension://${extensionId}/`], { input: oversize, windowsHide: true, timeout: 5000 })).ok, false);
  } finally {
    // Only remove the three files created in this test, without recursive deletion.
    for (const name of ['OficiosSigner.exe', 'allowed-origins.txt']) fs.unlinkSync(path.join(dir, name));
    fs.rmdirSync(dir);
  }
});
