// Bezpośrednie testy heurystyki sentymentu: leksykon, negacja, frazy, emoji
// oraz kolizje prefiksów (strateg/wartość nie mają być liczone jako sygnał).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sentimentScore } from '../scripts/bankier.js';

test('pozytyw: kupno + pochwała => Positive, score > 0', () => {
  const r = sentimentScore('kupuję bo tanio, świetna spółka');
  assert.equal(r.label, 'Positive');
  assert.ok(r.score > 0, `score ${r.score}`);
  assert.ok(r.positiveHits > 0);
});

test('negatyw: sprzedaż + slang => Negative, score < 0', () => {
  const r = sentimentScore('sprzedaję ten syf, katastrofa i tragedia');
  assert.equal(r.label, 'Negative');
  assert.ok(r.score < 0, `score ${r.score}`);
  assert.ok(r.negativeHits > 0);
});

test('negacja: "nie kupuj" odwraca pozytywny sygnał', () => {
  const plain = sentimentScore('kupuj');
  const negated = sentimentScore('nie kupuj');
  assert.equal(plain.label, 'Positive');
  assert.ok(negated.score < plain.score, 'negacja musi obniżyć score');
  assert.notEqual(negated.label, 'Positive');
});

test('fraza wielowyrazowa: "leci na łeb" => Negative', () => {
  const r = sentimentScore('kurs leci na łeb na szyję');
  assert.equal(r.label, 'Negative');
});

test('emoji: rakieta liczona jako pozytyw', () => {
  const r = sentimentScore('🚀🚀🚀');
  assert.equal(r.label, 'Positive');
  assert.ok(r.score > 0);
});

test('emoji: kupa liczona jako negatyw', () => {
  const r = sentimentScore('no comment 💩');
  assert.equal(r.label, 'Negative');
});

test('neutralny tekst bez leksykonu => Neutral, score 0', () => {
  const r = sentimentScore('dzisiaj jest wtorek a jutro środa');
  assert.equal(r.label, 'Neutral');
  assert.equal(r.score, 0);
  assert.equal(r.hits, 0);
});

test('kolizja prefiksu: "strategia" nie jest liczona jako strata', () => {
  const r = sentimentScore('dobra strategia rozwoju spółki na kolejne lata');
  assert.notEqual(r.label, 'Negative', `błędnie ujemny: ${r.score}`);
  assert.equal(r.negativeHits, 0, 'strateg* nie może trafiać w stem strat');
});

test('kolizja prefiksu: "wartość księgowa" nie jest liczona jako pozytyw', () => {
  const r = sentimentScore('wartość księgowa i wartości niematerialne');
  assert.equal(r.positiveHits, 0, 'wartosc* nie może trafiać w stem warto');
});

test('score zawsze w zakresie [-1, 1]', () => {
  const spam = 'krach bessa katastrofa panika bankructwo tragedia syf szrot ' .repeat(10);
  const r = sentimentScore(spam);
  assert.ok(r.score >= -1 && r.score <= 1, `score ${r.score}`);
});

// ── Rozszerzony, „solony” leksykon negatywny (forum bywa bardzo salty) ──

test('salty: nowe rdzenie negatywne łapane jako Negative', () => {
  for (const txt of [
    'totalna masakra na tym kursie',
    'kryzys i recesja, idzie bessa',
    'wtopa zycia, zaorane konto',
    'spolka to trup i scam',
    'co za zenada, pierdolnie w dol',
    'lapanie spadajacego noza',
    'kurs leci do piwnicy',
    'balon spekulacyjny zaraz peknie'
  ]) {
    const r = sentimentScore(txt);
    assert.equal(r.label, 'Negative', `${txt} -> ${r.label} (${r.score})`);
    assert.ok(r.negativeHits > 0, `brak trafień negatywnych: ${txt}`);
  }
});

test('false-friend: słowa neutralne/bankowe nie wpadają w negatyw', () => {
  for (const txt of [
    'pieniadze w bankach europejskich',
    'konto w banku',
    'cyrkulacja gotowki w spolce',
    'klapki na oczach',
    'dobra strategia rozwoju',
    'wartosc ksiegowa spolki'
  ]) {
    assert.notEqual(sentimentScore(txt).label, 'Negative', `błędnie ujemne: ${txt}`);
  }
});

test('emoji: niedźwiedź i trupia czaszka => Negative', () => {
  assert.equal(sentimentScore('no i tyle 🐻').label, 'Negative');
  assert.equal(sentimentScore('rip portfel 💀').label, 'Negative');
});

test('negacja: "nigdy nie sprzedam" nie jest Negative', () => {
  const r = sentimentScore('nigdy nie sprzedam, trzymam mocno');
  assert.notEqual(r.label, 'Negative', `score ${r.score}`);
});

test('vulgaryzm krachowy liczony jako Negative', () => {
  const r = sentimentScore('jutro to jebnie i pierdolnie na samo dno');
  assert.equal(r.label, 'Negative');
  assert.ok(r.score < 0);
});
