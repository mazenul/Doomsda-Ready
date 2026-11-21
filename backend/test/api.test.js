const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { Store } = require('../src/store');
const { minBundles } = require('../src/booking');

async function startServer() {
  const app = createApp(new Store());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  return { server, call };
}

const SAMPLE = [
  { title: 'Iron Man', releaseYear: 2008, runtimeMinutes: 126 },
  { title: 'Captain America: The First Avenger', releaseYear: 2011, runtimeMinutes: 124 },
  { title: 'The Avengers', releaseYear: 2012, runtimeMinutes: 143, prerequisites: ['Iron Man', 'Captain America: The First Avenger'] },
  { title: 'Captain America: Civil War', releaseYear: 2016, runtimeMinutes: 147, prerequisites: ['The Avengers'] },
  { title: 'Thor: Ragnarok', releaseYear: 2017, runtimeMinutes: 130 },
  { title: 'Avengers: Infinity War', releaseYear: 2018, runtimeMinutes: 149, prerequisites: ['Captain America: Civil War', 'Thor: Ragnarok'] },
  { title: 'Avengers: Endgame', releaseYear: 2019, runtimeMinutes: 181, prerequisites: ['Avengers: Infinity War'] },
  { title: 'Avengers: Doomsday', releaseYear: 2026, runtimeMinutes: 150, prerequisites: ['Avengers: Endgame'] },
];

async function seeded() {
  const ctx = await startServer();
  const res = await ctx.call('POST', '/movies', SAMPLE);
  assert.equal(res.status, 201);
  const id = Object.fromEntries(res.body.map((m) => [m.title, m.id]));
  return { ...ctx, id };
}

function assertValidOrder(order, movies) {
  const pos = new Map(order.map((m, i) => [m.id, i]));
  assert.equal(pos.size, order.length, 'each movie exactly once');
  for (const m of order) {
    for (const p of movies.find((x) => x.id === m.id).prerequisites) {
      assert.ok(pos.get(p) < pos.get(m.id), 'prerequisite must come first');
    }
  }
}

test('rewatch order for Doomsday: all 7 others, valid order, target excluded', async () => {
  const { server, call, id } = await seeded();
  const r = await call('GET', `/movies/${id['Avengers: Doomsday']}/rewatch-order`);
  assert.equal(r.status, 200);
  assert.equal(r.body.order.length, 7);
  assert.equal(r.body.totalCount, 7);
  assert.ok(!r.body.order.some((m) => m.id === id['Avengers: Doomsday']));
  const all = (await call('GET', '/movies')).body;
  assertValidOrder(r.body.order, all);
  assert.equal(r.body.watchedCount, 0);
  assert.equal(r.body.remainingRuntimeMinutes, 126 + 124 + 143 + 147 + 130 + 149 + 181);
  server.close();
});

test('rewatch order for Civil War and Ragnarok', async () => {
  const { server, call, id } = await seeded();
  const cw = await call('GET', `/movies/${id['Captain America: Civil War']}/rewatch-order`);
  const titles = cw.body.order.map((m) => m.title);
  assert.equal(titles.length, 3);
  assert.equal(titles[2], 'The Avengers');
  assert.deepEqual(titles.slice(0, 2).sort(), ['Captain America: The First Avenger', 'Iron Man']);

  const th = await call('GET', `/movies/${id['Thor: Ragnarok']}/rewatch-order`);
  assert.deepEqual(th.body.order, []);
  assert.equal(th.body.remainingRuntimeMinutes, 0);
  server.close();
});

test('watched count and remaining runtime update', async () => {
  const { server, call, id } = await seeded();
  await call('PATCH', `/movies/${id['Iron Man']}`, { watched: true });
  await call('PATCH', `/movies/${id['Thor: Ragnarok']}`, { watched: true });
  const r = await call('GET', `/movies/${id['Avengers: Doomsday']}/rewatch-order`);
  assert.equal(r.body.watchedCount, 2);
  assert.equal(r.body.remainingRuntimeMinutes, 124 + 143 + 147 + 149 + 181);
  server.close();
});

test('circular dependencies are rejected with 409 CIRCULAR_DEPENDENCY', async () => {
  const { server, call, id } = await seeded();
  // Endgame -> prerequisite of Iron Man (transitive cycle)
  let r = await call('PATCH', `/movies/${id['Iron Man']}`, { prerequisites: [id['Avengers: Endgame']] });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CIRCULAR_DEPENDENCY');
  // self dependency
  r = await call('PATCH', `/movies/${id['Iron Man']}`, { prerequisites: [id['Iron Man']] });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CIRCULAR_DEPENDENCY');
  // direct two-movie cycle
  r = await call('PATCH', `/movies/${id['Iron Man']}`, { prerequisites: [id['The Avengers']] });
  assert.equal(r.status, 409);
  // nothing was changed by the rejected updates
  const iron = (await call('GET', `/movies/${id['Iron Man']}`)).body;
  assert.deepEqual(iron.prerequisites, []);
  // a valid change is still accepted
  r = await call('PATCH', `/movies/${id['Thor: Ragnarok']}`, { prerequisites: [id['Iron Man']] });
  assert.equal(r.status, 200);
  server.close();
});

test('movie validation and uniqueness', async () => {
  const { server, call } = await startServer();
  const ok = { title: 'A', releaseYear: 2000, runtimeMinutes: 100 };
  assert.equal((await call('POST', '/movies', ok)).status, 201);
  const dup = await call('POST', '/movies', { ...ok, title: ' a ' });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'DUPLICATE_TITLE');
  for (const bad of [
    { ...ok, title: 'B', runtimeMinutes: 0 },
    { ...ok, title: 'B', runtimeMinutes: 301 },
    { ...ok, title: 'B', runtimeMinutes: 1.5 },
    { ...ok, title: '' },
    { ...ok, title: 'B', watched: 'yes' },
    { ...ok, title: 'B', prerequisites: [999] },
  ]) {
    const r = await call('POST', '/movies', bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
  const one = (await call('GET', '/movies')).body[0];
  assert.equal(one.watched, false);
  assert.equal((await call('PATCH', '/movies/999', { watched: true })).status, 404);
  server.close();
});

test('batch create is all-or-nothing', async () => {
  const { server, call } = await startServer();
  const r = await call('POST', '/movies', [
    { title: 'X', releaseYear: 2000, runtimeMinutes: 90 },
    { title: 'Y', releaseYear: 2000, runtimeMinutes: 0 },
  ]);
  assert.equal(r.status, 400);
  assert.deepEqual((await call('GET', '/movies')).body, []);
  server.close();
});

test('minBundles matches the examples in the brief', () => {
  const show = (r) => r.bundles.map((b) => `${b.size}x${b.count}`).join(',');
  let r = minBundles([1, 3, 4], 6);
  assert.equal(r.totalBundles, 2); assert.equal(show(r), '3x2');
  r = minBundles([2, 5], 11);
  assert.equal(r.totalBundles, 4); assert.equal(show(r), '5x1,2x3');
  r = minBundles([6, 9, 20], 44);
  assert.equal(r.totalBundles, 4); assert.equal(show(r), '20x1,9x2,6x1');
  r = minBundles([4, 6], 7);
  assert.equal(r.possible, false); assert.deepEqual(r.bundles, []);
});

test('minBundles agrees with brute force on random inputs', () => {
  const brute = (sizes, n) => {
    const best = Array(n + 1).fill(Infinity); best[0] = 0;
    for (let t = 1; t <= n; t++) for (const s of sizes) if (s <= t) best[t] = Math.min(best[t], best[t - s] + 1);
    return best[n];
  };
  for (let i = 0; i < 200; i++) {
    const sizes = [...new Set(Array.from({ length: 1 + (i % 5) }, () => 1 + Math.floor(Math.random() * 30)))];
    const n = 1 + Math.floor(Math.random() * 200);
    const r = minBundles(sizes, n);
    const expected = brute(sizes, n);
    if (expected === Infinity) assert.equal(r.possible, false);
    else {
      assert.equal(r.totalBundles, expected);
      assert.equal(r.bundles.reduce((s, b) => s + b.size * b.count, 0), n);
      assert.equal(r.bundles.reduce((s, b) => s + b.count, 0), expected);
    }
  }
});

test('max group size is fast', () => {
  const t = Date.now();
  minBundles([499, 500, 7, 13, 101, 250, 333, 2, 3, 5], 10000);
  assert.ok(Date.now() - t < 500);
});

test('cinemas and booking endpoint', async () => {
  const { server, call } = await startServer();
  const c = await call('POST', '/cinemas', { name: 'Odd', bundleSizes: [6, 4] });
  assert.equal(c.status, 201);
  const id = c.body.id;

  let r = await call('GET', `/cinemas/${id}/booking?groupSize=7`);
  assert.equal(r.status, 200);
  assert.equal(r.body.possible, false);

  r = await call('GET', `/cinemas/${id}/booking?groupSize=10`);
  assert.equal(r.body.possible, true);
  assert.equal(r.body.totalBundles, 2);
  assert.deepEqual(r.body.bundles, [{ size: 6, count: 1 }, { size: 4, count: 1 }]);

  for (const g of ['0', '10001', 'abc', '2.5', '']) {
    assert.equal((await call('GET', `/cinemas/${id}/booking?groupSize=${g}`)).status, 400, g);
  }
  assert.equal((await call('GET', `/cinemas/${id}/booking`)).status, 400);
  assert.equal((await call('GET', '/cinemas/999/booking?groupSize=4')).status, 404);

  assert.equal((await call('POST', '/cinemas', { name: 'odd', bundleSizes: [1] })).status, 409);
  for (const bad of [
    { name: 'N', bundleSizes: [] },
    { name: 'N', bundleSizes: [0] },
    { name: 'N', bundleSizes: [501] },
    { name: 'N', bundleSizes: [2, 2] },
    { name: 'N', bundleSizes: Array.from({ length: 11 }, (_, i) => i + 1) },
    { name: '', bundleSizes: [1] },
  ]) {
    assert.equal((await call('POST', '/cinemas', bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal((await call('GET', '/cinemas')).body.length, 1);
  server.close();
});
