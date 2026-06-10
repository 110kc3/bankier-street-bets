// Kontrakt danych: pola, których wymaga nowy frontend (app.js tabloid).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const SIGNALS = new Set(['BUY', 'HOLD', 'SELL']);
const TRENDS = new Set(['improving', 'deteriorating', 'stable']);
const LABELS = new Set(['Positive', 'Negative', 'Neutral']);
const REMOVED = new Set(['CCC', 'PLAY', 'SANTANDER']); // CCC -> MODIVO, SANTANDER -> ERSTEPL (zmiany nazw), PLAY -> delisting

const index = JSON.parse(await fs.readFile('data/index.json', 'utf8'));
const stockFiles = (await fs.readdir('data/stocks')).filter((f) => f.endsWith('.json'));

test('index.json: struktura i brak usuniętych tickerów', () => {
  assert.ok(Array.isArray(index.reports) && index.reports.length > 0, 'reports puste');
  assert.ok(!Number.isNaN(new Date(index.generatedAt).getTime()), 'generatedAt nieparsowalne');
  for (const r of index.reports) {
    assert.ok(!REMOVED.has(r.symbol), `usunięty ticker w indeksie: ${r.symbol}`);
    assert.ok(SIGNALS.has(r.signal), `${r.symbol}: zły sygnał ${r.signal}`);
    assert.equal(typeof r.score, 'number', `${r.symbol}: score nie jest liczbą`);
    assert.ok(TRENDS.has(r.trendDirection), `${r.symbol}: zły trendDirection`);
    assert.equal(typeof r.commentCount, 'number', `${r.symbol}: commentCount`);
    assert.ok(r.windowDays >= 1, `${r.symbol}: windowDays`);
    assert.ok(r.companyName, `${r.symbol}: brak companyName`);
  }
});

test('index.json <-> data/stocks spójne 1:1', () => {
  const inIndex = new Set(index.reports.map((r) => r.symbol));
  const onDisk = new Set(stockFiles.map((f) => f.replace('.json', '')));
  assert.deepEqual([...inIndex].sort(), [...onDisk].sort());
});

for (const file of stockFiles) {
  test(`data/stocks/${file}: pełny kontrakt frontendu`, async () => {
    const stock = JSON.parse(await fs.readFile(`data/stocks/${file}`, 'utf8'));
    const a = stock.analysis;
    assert.ok(a, 'brak analysis');
    assert.ok(SIGNALS.has(a.signal));
    assert.ok(a.score >= -1 && a.score <= 1, 'score poza [-1,1]');
    assert.ok(a.confidence >= 0 && a.confidence <= 1, 'confidence poza [0,1]');
    assert.equal(a.commentCount, stock.comments.length, 'commentCount != comments.length');
    assert.ok(a.breakdown, 'brak breakdown');
    assert.equal(
      a.breakdown.positive + a.breakdown.negative + a.breakdown.neutral,
      a.commentCount,
      'breakdown nie sumuje się do commentCount'
    );
    assert.ok(Array.isArray(a.trend), 'trend nie jest tablicą');
    for (const day of a.trend) {
      assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(typeof day.score, 'number');
      assert.ok(day.count > 0);
    }
    assert.ok(TRENDS.has(a.trendDirection));
    assert.ok(Array.isArray(a.topKeywords));
    assert.ok(stock.report.windowDays >= 1, 'brak report.windowDays');
    assert.ok(stock.quoteUrl.startsWith('https://'), 'quoteUrl');
    assert.ok(stock.forumUrl.startsWith('https://'), 'forumUrl');
    const trendSum = a.trend.reduce((s, d) => s + d.count, 0);
    assert.equal(trendSum, a.commentCount, 'suma trend.count != commentCount');
    for (const c of stock.comments) {
      assert.ok(c.id && c.author !== undefined && typeof c.body === 'string', 'pola komentarza');
      assert.ok(LABELS.has(c.sentimentLabel), `zły sentimentLabel: ${c.sentimentLabel}`);
      assert.ok(c.sentimentScore >= -1 && c.sentimentScore <= 1);
      assert.ok(c.votes && typeof c.votes.up === 'number' && typeof c.votes.down === 'number', 'brak votes');
      assert.ok(!Number.isNaN(new Date(String(c.postedAt).replace(' ', 'T')).getTime()), 'postedAt nieparsowalne');
      assert.ok(c.url.startsWith('https://www.bankier.pl/forum/'), 'url komentarza');
      assert.ok(!/napisał\(a\):/.test(c.body), 'nagłówek cytatu nie został usunięty');
    }
  });
}
