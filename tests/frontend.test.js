// Testy dymne nowego frontendu (tabloid) w jsdom: pasek PILNE, kiosk,
// nagłówki wg sygnału, barometr, eksperci, trend, auto-wydanie, stany błędów.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const html = await fs.readFile('index.html', 'utf8');
const appJs = await fs.readFile('app.js', 'utf8');

function makeReport(symbol, over = {}) {
  return {
    symbol, companyName: symbol + ' SA', updatedAt: '2026-06-10T06:00:00.000Z',
    signal: 'HOLD', score: 0, trendDirection: 'stable', commentCount: 10, windowDays: 7, ...over
  };
}

function makeStock(symbol, over = {}) {
  return {
    symbol, companyName: symbol + ' SA',
    quoteUrl: 'https://www.bankier.pl/q', forumUrl: 'https://www.bankier.pl/f',
    updatedAt: '2026-06-10T06:00:00.000Z',
    report: { fetchedAt: '2026-06-10T06:00:00.000Z', windowDays: 7 },
    analysis: {
      signal: 'HOLD', score: 0, confidence: 0.5, commentCount: 2,
      breakdown: { positive: 1, negative: 1, neutral: 0 },
      trend: [
        { date: '2026-06-09', score: 0.4, count: 1 },
        { date: '2026-06-10', score: -0.5, count: 1 }
      ],
      trendDirection: 'deteriorating',
      summary: 'test',
      topKeywords: [{ word: 'miedz', count: 3 }]
    },
    comments: [
      { id: '1', author: 'Grazyna', postedAt: '2026-06-10 09:00', threadTitle: 'Watek',
        url: 'https://www.bankier.pl/forum/t,1.html', body: 'kupuje wiecej',
        votes: { up: 5, down: 1 }, sentimentScore: 0.7, sentimentLabel: 'Positive' },
      { id: '2', author: 'Janusz', postedAt: '2026-06-09 09:00', threadTitle: 'Watek',
        url: 'https://www.bankier.pl/forum/t,2.html', body: 'sprzedaje syf',
        votes: { up: 0, down: 3 }, sentimentScore: -0.7, sentimentLabel: 'Negative' }
    ],
    ...over
  };
}

const flush = () => new Promise((r) => setTimeout(r, 5));

async function boot({ indexData, stocks = {}, failIndex = false, url = 'http://localhost/' } = {}) {
  const dom = new JSDOM(html.replace(/<script[^>]*src="\.\/app\.js"[^>]*><\/script>/, ''), {
    url, runScripts: 'outside-only', pretendToBeVisual: true
  });
  const { window } = dom;
  const fetched = [];
  window.scrollTo = () => {};
  window.fetch = async (url) => {
    fetched.push(String(url));
    if (String(url).includes('index.json')) {
      if (failIndex) throw new Error('net');
      return { ok: true, json: async () => indexData };
    }
    const symbol = String(url).match(/stocks\/([A-Z0-9]+)\.json/)?.[1];
    if (symbol && stocks[symbol]) return { ok: true, json: async () => stocks[symbol] };
    return { ok: false, json: async () => ({}) };
  };
  window.eval(appJs);
  await flush(); await flush();
  return { window, document: window.document, fetched };
}

test('pasek PILNE: wszystkie tickery, sygnały i strzałki trendu, obie taśmy identyczne', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [
    makeReport('AAA', { signal: 'BUY', trendDirection: 'improving', score: 0.5 }),
    makeReport('BBB', { signal: 'SELL', trendDirection: 'deteriorating', score: -0.4 })
  ] };
  const { document } = await boot({ indexData, stocks: { AAA: makeStock('AAA') } });
  const tape = document.querySelector('#pilne-tape').textContent;
  assert.ok(tape.startsWith('PILNE!!!'));
  assert.ok(tape.includes('AAA: KUPUJ ▲'));
  assert.ok(tape.includes('BBB: SPRZEDAWAJ ▼'));
  assert.equal(tape, document.querySelector('#pilne-tape-2').textContent);
});

test('kiosk: po jednym wydaniu na raport, kolorowany sygnał i metadane', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [
    makeReport('AAA', { score: 0.9, signal: 'BUY', trendDirection: 'improving' }),
    makeReport('BBB'), makeReport('CCC2')
  ] };
  const { document } = await boot({ indexData, stocks: { AAA: makeStock('AAA') } });
  const items = document.querySelectorAll('.kiosk-item');
  assert.equal(items.length, 3);
  assert.ok(items[0].querySelector('.kiosk-signal').classList.contains('sig-buy'));
  assert.ok(items[0].textContent.includes('10 kom. / 7 dni'));
  assert.ok(document.querySelector('#reports-updated').textContent.includes('ostatnia dostawa'));
});

test('wydanie otwierające: auto-ładuje spółkę z max |score|', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [
    makeReport('CICHA', { score: 0.1 }),
    makeReport('DRAMA', { score: -0.8, signal: 'SELL' })
  ] };
  const { document, fetched } = await boot({ indexData, stocks: { DRAMA: makeStock('DRAMA', { analysis: { ...makeStock('X').analysis, signal: 'SELL', score: -0.8 } }) } });
  assert.ok(fetched.some((u) => u.includes('stocks/DRAMA.json')));
  assert.ok(!fetched.some((u) => u.includes('stocks/CICHA.json')));
  assert.equal(document.querySelector('#symbol-input').value, 'DRAMA');
});

// Nagłówki rotują z puli (seed z symbolu+sygnału), więc testujemy własności,
// nie konkretny tekst: nazwa spółki w nagłówku, krzyk (!!!), brak śmieci JS,
// kicker/lid niepuste, oraz właściwa pieczątka.
for (const [signal, cls, stampWord] of [
  ['SELL', 'sig-sell', 'SPRZEDAWAJ'],
  ['BUY', 'sig-buy', 'KUPUJ'],
  ['HOLD', 'sig-hold', 'TRZYMAJ']
]) {
  test(`nagłówek i pieczątka dla ${signal}`, async () => {
    const score = signal === 'BUY' ? 0.6 : signal === 'SELL' ? -0.6 : 0;
    const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX', { signal, score })] };
    const stock = makeStock('XXX', { analysis: { ...makeStock('X').analysis, signal, score } });
    const { document } = await boot({ indexData, stocks: { XXX: stock } });
    const headline = document.querySelector('.headline').textContent;
    assert.ok(headline.includes('XXX SA'), `nagłówek bez nazwy spółki: ${headline}`);
    assert.ok(headline.includes('!!!'), `nagłówek nie krzyczy: ${headline}`);
    assert.ok(!/undefined|null|NaN/.test(headline), `śmieci w nagłówku: ${headline}`);
    const kicker = document.querySelector('.kicker').textContent;
    assert.ok(kicker.length > 2 && !/undefined/.test(kicker), `zły kicker: ${kicker}`);
    const subhead = document.querySelector('.subhead').textContent;
    assert.ok(!/undefined|NaN/.test(subhead), `śmieci w lidzie: ${subhead}`);
    const stamp = document.querySelector('.stamp');
    assert.ok(stamp.classList.contains(cls));
    assert.equal(stamp.querySelector('.stamp-word').textContent, stampWord);
  });
}

test('barometr paniki: pozycja igły ze score (clamp 2–98%)', async () => {
  for (const [score, expected] of [[1, '98%'], [-1, '2%'], [0, '50%']]) {
    const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX', { score })] };
    const stock = makeStock('XXX', { analysis: { ...makeStock('X').analysis, score } });
    const { document } = await boot({ indexData, stocks: { XXX: stock } });
    assert.equal(document.querySelector('.barometr-needle').style.left, expected, `score=${score}`);
  }
});

test('eksperci: po jednym na komentarz, werdykt wg sentymentu, prawdziwe metadane', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const { document } = await boot({ indexData, stocks: { XXX: makeStock('XXX') } });
  const experts = document.querySelectorAll('.expert');
  assert.equal(experts.length, 2);
  assert.ok(experts[0].querySelector('.verdict').classList.contains('sig-buy'));
  assert.ok(experts[1].querySelector('.verdict').classList.contains('sig-sell'));
  assert.ok(experts[0].textContent.includes('głosy czytelników: +5 / −1'));
  assert.equal(experts[0].querySelector('a').href, 'https://www.bankier.pl/forum/t,1.html');
  // tytuł naukowy i instytut nadane (niepuste, z puli redakcyjnej)
  assert.match(experts[0].querySelector('.expert-name').textContent, /~Grazyna$/);
  assert.ok(experts[0].querySelector('.expert-title').textContent.length > 5);
});

test('eksperci: deterministyczni (ten sam autor => ten sam tytuł i instytut)', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const a = await boot({ indexData, stocks: { XXX: makeStock('XXX') } });
  const b = await boot({ indexData, stocks: { XXX: makeStock('XXX') } });
  for (const sel of ['.expert-name', '.expert-title', '.verdict']) {
    assert.equal(
      a.document.querySelector(sel).textContent,
      b.document.querySelector(sel).textContent,
      `${sel} niedeterministyczny`
    );
  }
});

test('eksperci: limit z pola "ilu ekspertów wydrukować"', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const { window, document } = await boot({ indexData, stocks: { XXX: makeStock('XXX') } });
  document.querySelector('#comment-limit-input').value = '1';
  document.querySelector('#symbol-input').value = 'XXX';
  document.querySelector('#symbol-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flush(); await flush();
  assert.equal(document.querySelectorAll('.expert').length, 1);
});

test('z ostatniej chwili: wiersz na każdy dzień trendu z redakcyjnym podpisem', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const { document } = await boot({ indexData, stocks: { XXX: makeStock('XXX') } });
  const rows = document.querySelectorAll('.trend-row');
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /09\.06 — .+ \(1 kom\.\)/);
  assert.ok(rows[1].querySelector('b').classList.contains('neg'));
});

test('puste dane: brak trendu i komentarzy ma redakcyjne komunikaty', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX', { commentCount: 0 })] };
  const stock = makeStock('XXX', {
    comments: [],
    analysis: { ...makeStock('X').analysis, commentCount: 0, trend: [], topKeywords: [], breakdown: { positive: 0, negative: 0, neutral: 0 } }
  });
  const { document } = await boot({ indexData, stocks: { XXX: stock } });
  assert.ok(document.querySelector('.trend-rows').textContent.includes('Podejrzanie spokojnie'));
  assert.ok(document.querySelector('.experts').textContent.includes('odmówili komentarza'));
  assert.ok(document.querySelector('.keywords').textContent.includes('bez słów'));
});

test('stan błędu: brak pliku spółki => WYDANIE ZAGINĘŁO W DRUKARNI', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const { window, document } = await boot({ indexData, stocks: { XXX: makeStock('XXX') } });
  document.querySelector('#symbol-input').value = 'NIEMA';
  document.querySelector('#symbol-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flush(); await flush();
  assert.ok(document.querySelector('#app').textContent.includes('WYDANIE ZAGINĘŁO W DRUKARNI'));
});

test('stan błędu: brak index.json => KIOSK ZAMKNIĘTY', async () => {
  const { document } = await boot({ failIndex: true });
  assert.ok(document.querySelector('#app').textContent.includes('KIOSK ZAMKNIĘTY'));
  assert.ok(document.querySelector('#reports-updated').textContent.includes('Kiosk zamknięty'));
});

test('winieta: żywa data wydania i nakład po załadowaniu spółki', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const { document } = await boot({ indexData, stocks: { XXX: makeStock('XXX') } });
  assert.match(document.querySelector('#masthead-date').textContent, /Wydanie paniczne · .+\d{4}/);
  assert.equal(document.querySelector('#masthead-naklad').textContent, 'Nakład: 2 komentarzy / 7 dni');
});

test('sparkline: SVG z polyline i kropką na każdy dzień trendu', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const { document } = await boot({ indexData, stocks: { XXX: makeStock('XXX') } });
  const svg = document.querySelector('.sparkline .spark');
  assert.ok(svg, 'brak SVG sparkline');
  assert.ok(svg.querySelector('polyline.spark-line'), 'brak linii trendu');
  assert.equal(svg.querySelectorAll('.spark-dots circle').length, 2, 'kropka na każdy dzień');
});

test('sparkline: pusty trend => komunikat zastępczy', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const stock = makeStock('XXX', { analysis: { ...makeStock('X').analysis, trend: [] } });
  const { document } = await boot({ indexData, stocks: { XXX: stock } });
  assert.ok(document.querySelector('.sparkline .sparkline-empty'), 'brak komunikatu o pustym trendzie');
});

test('datalist: po jednej opcji na ticker z indeksu', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [
    makeReport('AAA', { companyName: 'Alfa SA' }), makeReport('BBB', { companyName: 'Beta SA' })
  ] };
  const { document } = await boot({ indexData, stocks: { AAA: makeStock('AAA') } });
  const options = document.querySelectorAll('#ticker-list option');
  assert.equal(options.length, 2);
  assert.equal(options[0].value, 'AAA');
  assert.equal(options[0].label, 'Alfa SA');
});

test('deep-link: ?symbol= ładuje wskazaną spółkę zamiast najbardziej dramatycznej', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [
    makeReport('DRAMA', { score: -0.9, signal: 'SELL' }),
    makeReport('BBB', { score: 0.1 })
  ] };
  const { document, fetched } = await boot({
    indexData, stocks: { BBB: makeStock('BBB') }, url: 'http://localhost/?symbol=BBB'
  });
  assert.ok(fetched.some((u) => u.includes('stocks/BBB.json')), 'powinno załadować BBB z URL');
  assert.ok(!fetched.some((u) => u.includes('stocks/DRAMA.json')), 'nie powinno ładować DRAMA');
  assert.equal(document.querySelector('#symbol-input').value, 'BBB');
});

test('staleness: stare dane => znacznik NIEAKTUALNE na pasku kiosku', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const { document } = await boot({ indexData, stocks: { XXX: makeStock('XXX') } });
  const updated = document.querySelector('#reports-updated');
  assert.ok(updated.classList.contains('stale'));
  assert.ok(updated.textContent.includes('NIEAKTUALNE'));
});

test('staleness: świeże dane => brak znacznika nieaktualności', async () => {
  const fresh = new Date().toISOString();
  const indexData = { generatedAt: fresh, reports: [makeReport('XXX')] };
  const stock = makeStock('XXX', { report: { fetchedAt: fresh, windowDays: 7 } });
  const { document } = await boot({ indexData, stocks: { XXX: stock } });
  const updated = document.querySelector('#reports-updated');
  assert.ok(!updated.classList.contains('stale'));
  assert.ok(!updated.textContent.includes('NIEAKTUALNE'));
});

test('responsywność/markup: media query 860px i prefers-reduced-motion w CSS', async () => {
  const css = await fs.readFile('styles.css', 'utf8');
  assert.ok(/max-width:\s*860px/.test(css), 'brak breakpointu 860px');
  assert.ok(/prefers-reduced-motion/.test(css), 'brak prefers-reduced-motion');
});

test('marquee PILNE: animowany track z dwiema identycznymi taśmami (płynna pętla)', async () => {
  const css = await fs.readFile('styles.css', 'utf8');
  // animacja na tracku, pętla -50%, nigdy nie zatrzymana na sztywno
  assert.ok(/\.pilne-track\s*\{[^}]*animation:\s*pilne-scroll/.test(css), 'brak animacji na .pilne-track');
  assert.ok(/translateX\(-50%\)/.test(css), 'pętla powinna przesuwać o -50% szerokości tracku');
  assert.ok(!/animation:\s*none/.test(css), 'marquee nie może być wyłączany (ma zwalniać, nie stawać)');
  // struktura DOM: track owija obie taśmy
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const { document } = await boot({ indexData, stocks: { XXX: makeStock('XXX') } });
  const track = document.querySelector('.pilne-track');
  assert.ok(track, 'brak .pilne-track w HTML');
  const tapes = track.querySelectorAll('.pilne-inner');
  assert.equal(tapes.length, 2, 'track musi zawierać dokładnie 2 taśmy');
  assert.equal(tapes[0].textContent, tapes[1].textContent, 'taśmy muszą być identyczne dla płynnej pętli');
});

/* ── Regresja: pula redakcyjna nigdy nie drukuje "undefined" ──
   Wcześniej pick() używał pól >> (ze znakiem) i dla ~24% autorów dawał ujemny
   indeks => arr[-n] === undefined, które lądowało jako "undefined" na polskiej
   stronie (tytuł/instytut/werdykt eksperta). 60 różnych autorów wymusza wiele
   różnych seedów, w tym takie z ustawionym najwyższym bitem hasza. */
test('regresja: pula redakcyjna nigdy nie drukuje "undefined" (ujemny seed)', async () => {
  const comments = Array.from({ length: 60 }, (_, i) => ({
    id: String(i), author: `Inwestor_${i}_x${i * 97 + 13}`, postedAt: '2026-06-10 09:00',
    threadTitle: 'Watek', url: 'https://www.bankier.pl/forum/t,1.html', body: 'komentarz testowy',
    votes: { up: i % 5, down: i % 3 }, sentimentScore: 0,
    sentimentLabel: ['Positive', 'Negative', 'Neutral'][i % 3]
  }));
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const stock = makeStock('XXX', { comments, analysis: { ...makeStock('X').analysis, commentCount: comments.length } });
  const { window, document } = await boot({ indexData, stocks: { XXX: stock } });
  document.querySelector('#comment-limit-input').value = '60';
  document.querySelector('#symbol-input').value = 'XXX';
  document.querySelector('#symbol-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flush(); await flush();
  const experts = [...document.querySelectorAll('.expert')];
  assert.equal(experts.length, 60, 'powinno wydrukować wszystkich 60 ekspertów');
  for (const el of experts) {
    assert.ok(!el.textContent.includes('undefined'), `"undefined" w karcie eksperta: ${el.textContent.slice(0, 90)}`);
    assert.ok(el.querySelector('.expert-title').textContent.trim().length > 3, 'pusty instytut');
    assert.match(el.querySelector('.verdict').textContent, /WERDYKT: \S/, 'pusty werdykt');
  }
});

test('ekspert: redakcyjny dopisek (footnote) obecny, niepusty i bez śmieci', async () => {
  const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport('XXX')] };
  const { document } = await boot({ indexData, stocks: { XXX: makeStock('XXX') } });
  const fn = document.querySelector('.expert .expert-footnote');
  assert.ok(fn, 'brak redakcyjnego dopisku pod ekspertem');
  assert.ok(fn.textContent.trim().length > 5 && !/undefined/.test(fn.textContent), `zły dopisek: ${fn.textContent}`);
});

test('nagłówki: różne spółki dostają różne wydania (różnorodność z puli)', async () => {
  const variants = new Set();
  for (const sym of ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF']) {
    const indexData = { generatedAt: '2026-06-10T06:00:00.000Z', reports: [makeReport(sym, { signal: 'BUY', score: 0.6 })] };
    const stock = makeStock(sym, { analysis: { ...makeStock('X').analysis, signal: 'BUY', score: 0.6 } });
    const { document } = await boot({ indexData, stocks: { [sym]: stock } });
    variants.add(document.querySelector('.headline').innerHTML.replace(new RegExp(sym + ' SA'), 'NAZWA'));
  }
  assert.ok(variants.size > 1, 'pula nagłówków BUY powinna dawać więcej niż jeden wariant');
});
