// Eskalacja okna dla cichych forów: 7 -> 30 -> 90 -> 365 dni aż do minComments.
// Endpointy Bankiera są mockowane przez podmianę globalThis.fetch.
import test from 'node:test';
import assert from 'node:assert/strict';

const realFetch = globalThis.fetch;
const day = 86400000;
const dt = (daysAgo) => new Date(Date.now() - daysAgo * day).toISOString().slice(0, 16).replace('T', ' ');

function makePost(id, daysAgo, body) {
  return { id: String(id), date: dt(daysAgo), login: '~Tester' + id, subject: 'Re: watek',
    body, up: '1', down: '0', sum: '1' };
}

// forum z 1 postem w 7 dni, 3 w 30 dni, 12 w 90 dni
const THREADS = [
  { thread_id: '1', subject: 'Swiezy', quantity: '1', last_dt: dt(2), post_id: '100' },
  { thread_id: '2', subject: 'Miesieczny', quantity: '2', last_dt: dt(20), post_id: '200' },
  { thread_id: '3', subject: 'Kwartalny', quantity: '9', last_dt: dt(50), post_id: '300' }
];
const POSTS = {
  1: [makePost(11, 2, 'kupuje bo tanio')],
  2: [makePost(21, 20, 'sprzedalem wszystko'), makePost(22, 25, 'czekam na wyniki spolki')],
  3: Array.from({ length: 9 }, (_, i) => makePost(31 + i, 40 + i, `komentarz numer ${i} o kursie i rynku`))
};

function mockFetch(url) {
  const u = String(url);
  const ok = (body) => Promise.resolve({ ok: true, status: 200, text: async () => body });
  if (u.includes('quote.html')) return ok('<title>Cicha Spolka SA (CICHA) - Notowania</title> https://m.bankier.pl/forum/spolka/CICHA');
  if (u.includes('/forum/spolka/')) return ok('<link rel="canonical" href="https://www.bankier.pl/forum/f.html"/><div id="forumThreads" data-forum-id="6" data-instrument-type="21" data-far-id="99">');
  if (u.includes('get_threads')) {
    const page = Number(new URL(u).searchParams.get('page'));
    return ok(JSON.stringify({ threads: page === 1 ? THREADS : [] }));
  }
  if (u.includes('get_thread')) {
    const id = new URL(u).searchParams.get('thread_id');
    return ok(JSON.stringify({ quantity: String(POSTS[id].length), list: POSTS[id] }));
  }
  throw new Error('unexpected url: ' + u);
}

test('eskalacja okna: minComments=10 wymusza okno 90 dni', async (t) => {
  globalThis.fetch = mockFetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const { collectStock } = await import('../scripts/bankier.js');

  const stock = await collectStock('CICHA', { days: 7, minComments: 10 });
  assert.equal(stock.report.windowDays, 90, 'okno powinno eskalowac do 90 dni');
  assert.equal(stock.report.requestedDays, 7);
  assert.equal(stock.report.windowExtended, true);
  assert.equal(stock.analysis.commentCount, 12, 'wszystkie 12 komentarzy zebrane');
});

test('bez eskalacji: minComments=1 zostaje przy 7 dniach', async (t) => {
  globalThis.fetch = mockFetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const { collectStock } = await import('../scripts/bankier.js');

  const stock = await collectStock('CICHA', { days: 7, minComments: 1 });
  assert.equal(stock.report.windowDays, 7);
  assert.equal(stock.report.windowExtended, false);
  assert.equal(stock.analysis.commentCount, 1);
});

test('maxComments ogranicza liczbe zapisanych komentarzy', async (t) => {
  globalThis.fetch = mockFetch;
  t.after(() => { globalThis.fetch = realFetch; });
  const { collectStock } = await import('../scripts/bankier.js');

  const stock = await collectStock('CICHA', { days: 365, minComments: 1, maxComments: 10 });
  assert.ok(stock.analysis.commentCount <= 10);
});
