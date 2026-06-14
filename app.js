/* GIEŁDOWY EXPRESS — app.js
   Ten sam kontrakt danych co oryginał: ./data/index.json + ./data/stocks/SYMBOL.json
   Zmieniona wyłącznie warstwa prezentacji (tryb tabloid). */

const app = document.querySelector('#app');
const form = document.querySelector('#symbol-form');
const input = document.querySelector('#symbol-input');
const commentLimitInput = document.querySelector('#comment-limit-input');
const template = document.querySelector('#result-template');
const reportsList = document.querySelector('#reports-list');
const reportsUpdated = document.querySelector('#reports-updated');
const tickerList = document.querySelector('#ticker-list');
const pilneTape = document.querySelector('#pilne-tape');
const pilneTape2 = document.querySelector('#pilne-tape-2');
const mastheadDate = document.querySelector('#masthead-date');
const mastheadNaklad = document.querySelector('#masthead-naklad');

/* ── Redakcyjne słowniki ─────────────────────────────── */

const SIGNALS = {
  BUY: {
    cls: 'sig-buy',
    stamp: 'KUPUJ',
    kicker: 'EUFORIA NA PARKIECIE',
    headline: (name) => `${name}: <em class="green">GRUBE WORY WCHODZĄ!!!</em> FORUM JUŻ LICZY ZYSKI`,
    subhead: (score, conf) =>
      `Sentyment wystrzelił do ${fmtScore(score)} (pewność: ${conf}%). Forum Bankier.pl jednogłośnie melduje hossę. Redakcja przypomina, że forum meldowało ją też przed każdą bessą.`
  },
  HOLD: {
    cls: 'sig-hold',
    stamp: 'TRZYMAJ',
    kicker: 'NUDA STULECIA',
    headline: (name) => `${name}: <em class="hold">NIKT NIC NIE WIE!!!</em> FORUM PODZIELONE JAK ZAWSZE`,
    subhead: (score, conf) =>
      `Sentyment utknął na ${fmtScore(score)} (pewność: ${conf}%). Połowa forum widzi dno, druga połowa księżyc. Obie połowy są tego pewne.`
  },
  SELL: {
    cls: 'sig-sell',
    stamp: 'SPRZEDAWAJ',
    kicker: 'SZOK NA PARKIECIE',
    headline: (name) => `${name}: <em>WSZYSCY SPRZEDAJĄ!!!</em> FORUM ZGODNE PIERWSZY RAZ W HISTORII`,
    subhead: (score, conf) =>
      `Sentyment runął do ${fmtScore(score)} (pewność: ${conf}%). Eksperci z forum ostrzegali od trzech lat — w końcu trafili. Redakcja dotarła do wstrząsających komentarzy.`
  }
};

const TITLES = ['prof. dr hab.', 'doc.', 'mgr inż.', 'dr (internetu)', 'lic.', 'inż.', 'red. nacz.', 'st. analityk'];
const DEPARTMENTS = [
  'Instytut Badań nad Dnem',
  'Katedra Łapania Spadających Noży',
  'Wyższa Szkoła Trzymania Akcji im. Nadziei',
  'Samodzielna Pracownia Uśredniania w Dół',
  'Zakład Analizy Pofaktycznej',
  'Katedra Hopium Stosowanego',
  'Instytut Wykresów i Linii Trendu',
  'Biuro Prognoz Długoterminowo Błędnych',
  'Wydział Diamentowych Rączek',
  'Obserwatorium Grubych Worów'
];
const AVATARS = ['👨‍🏫', '👵', '🧔', '👴', '🕵️', '👨‍💼', '🧑‍🌾', '👨‍🔧', '🧙', '👨‍⚕️'];
const VERDICTS = {
  positive: ['KUPUJE (NIESTETY)', 'WIDZI KSIĘŻYC', 'ALL-IN (ŻONA NIE WIE)', 'DOKUPUJE NA GÓRCE'],
  negative: ['SPRZEDAWAJ (OD 3 LAT)', 'WIDZI DNO (POD DNEM)', 'UCIEKA Z TONĄCEGO', 'PANIKUJE PROFESJONALNIE'],
  neutral: ['NIE WIE (JAK MY WSZYSCY)', 'TRZYMA (FIZYCZNIE)', 'OBSERWUJE (Z DALEKA)', 'PYTA DLA KOLEGI']
};
const TREND_LABELS = [
  { min: 0.3, labels: ['euforia w wątku', 'szampan w komentarzach', 'księżyc widoczny gołym okiem'] },
  { min: 0.12, labels: ['hopium dostarczone', '„teraz to już na pewno"', 'ktoś wspomniał dywidendę'] },
  { min: -0.12, labels: ['nikt nic nie wie', 'cisza w wątku (zła cisza)', 'spór o makro, jak co tydzień'] },
  { min: -0.3, labels: ['łapanie spadającego noża', 'nerwowe odświeżanie wykresu', '„to tylko korekta"'] },
  { min: -Infinity, labels: ['płacz zbiorowy', 'panika pełnoetatowa', 'wątek przeszedł na modlitwę'] }
];

/* ── Pomocnicze ──────────────────────────────────────── */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function fmtScore(score) {
  const n = Number(score) || 0;
  return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(2);
}

function formatDate(date) {
  const parsed = new Date(String(date).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? 'brak daty' : parsed.toLocaleString('pl-PL');
}

// Dane odświeża cron co 6 h; powyżej tego progu (≈2 nieudane przebiegi) wydanie
// jest "nieaktualne" — drukarnia strajkuje.
const STALE_HOURS = 14;

function hoursSince(date) {
  const t = new Date(String(date).replace(' ', 'T')).getTime();
  return Number.isNaN(t) ? Infinity : (Date.now() - t) / 3600000;
}

function isStale(date) {
  return hoursSince(date) > STALE_HOURS;
}

function trendLabel(score, seed) {
  const bucket = TREND_LABELS.find((b) => score >= b.min) || TREND_LABELS[TREND_LABELS.length - 1];
  return pick(bucket.labels, seed);
}

function signalConf(signal) {
  return SIGNALS[signal] || SIGNALS.HOLD;
}

/* Inline SVG sparkline z dziennego trendu sentymentu (dane liczbowe, więc
   bezpieczne dla innerHTML). Czarny tusz na gazecie, ostatni punkt kolorowany. */
function buildSparkline(trend) {
  const days = (Array.isArray(trend) ? trend : []).filter((d) => Number.isFinite(Number(d?.score)));
  if (!days.length) return '<p class="sparkline-empty">Brak danych dziennych — wykres na urlopie.</p>';

  const W = 320;
  const H = 64;
  const padX = 6;
  const padY = 8;
  const span = Math.max(1, days.length - 1);
  const x = (i) => padX + (i / span) * (W - 2 * padX);
  const y = (score) => {
    const clamped = Math.max(-1, Math.min(1, Number(score)));
    return H / 2 - clamped * (H / 2 - padY);
  };

  const pts = days.map((d, i) => `${x(i).toFixed(1)},${y(d.score).toFixed(1)}`).join(' ');
  const dots = days.map((d, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(d.score).toFixed(1)}" r="2.2" />`).join('');
  const last = days[days.length - 1].score;
  const cls = last > 0.05 ? 'pos' : last < -0.05 ? 'neg' : 'flat';

  return `<svg viewBox="0 0 ${W} ${H}" class="spark spark-${cls}" role="img" aria-label="Krzywa sentymentu dzień po dniu">` +
    `<line x1="${padX}" y1="${H / 2}" x2="${W - padX}" y2="${H / 2}" class="spark-zero" />` +
    (days.length > 1 ? `<polyline points="${pts}" class="spark-line" fill="none" />` : '') +
    `<g class="spark-dots">${dots}</g>` +
    `</svg>`;
}

function setMessage(title, message, error = false) {
  app.innerHTML = `<section class="paper-box ${error ? 'error-box' : 'loading-box'}">` +
    `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p></section>`;
}

function scrollToApp() {
  const y = app.getBoundingClientRect().top + window.scrollY - 60;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}

/* ── Pasek PILNE!!! ──────────────────────────────────── */

function renderPilne(reports) {
  const arrows = { improving: '▲', deteriorating: '▼', stable: '■' };
  const bits = reports.map((r) => {
    const conf = signalConf(r.signal);
    return `${r.symbol}: ${conf.stamp} ${arrows[r.trendDirection] || ''}`;
  });
  const jokes = [
    'GRAŻYNA SPRZEDAŁA WSZYSTKO I KUPIŁA DZIAŁKĘ',
    'ANALITYK Z FORUM: „MÓWIŁEM”',
    'SEJM ZDZIWIONY, RYNEK BARDZIEJ',
    'DRUKARNIA PRACUJE NA TRZY ZMIANY'
  ];
  const tape = 'PILNE!!! ★ ' + bits.concat(jokes).join(' ★ ') + ' ★ ';
  pilneTape.textContent = tape;
  pilneTape2.textContent = tape;
}

/* ── Kiosk ───────────────────────────────────────────── */

function renderReportsIndex(indexData) {
  const stale = isStale(indexData.generatedAt);
  reportsUpdated.classList.toggle('stale', stale);
  reportsUpdated.textContent =
    (stale ? '⚠ WYDANIE NIEAKTUALNE — DRUKARNIA STRAJKUJE · ' : '') +
    `ostatnia dostawa do kiosku: ${formatDate(indexData.generatedAt)}`;
  reportsList.innerHTML = '';

  // podpowiedzi tickerów dla pola "ZAMÓW ANALIZĘ"
  if (tickerList) {
    tickerList.innerHTML = '';
    indexData.reports.forEach((report) => {
      const option = document.createElement('option');
      option.value = report.symbol;
      option.label = report.companyName || report.symbol;
      tickerList.appendChild(option);
    });
  }

  indexData.reports.forEach((report) => {
    const conf = signalConf(report.signal);
    const arrow = { improving: '▲', deteriorating: '▼', stable: '■' }[report.trendDirection] || '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kiosk-item';
    button.innerHTML = `
      <span class="kiosk-symbol"><span>${escapeHtml(report.symbol)}</span><span class="kiosk-signal ${conf.cls}">${conf.stamp} ${arrow}</span></span>
      <span class="kiosk-name">${escapeHtml(report.companyName || report.symbol)}</span>
      <span class="kiosk-meta">${report.commentCount ?? '–'} kom. / ${report.windowDays || 7} dni · ${formatDate(report.updatedAt)}</span>
    `;
    button.addEventListener('click', () => {
      input.value = report.symbol;
      loadStock(report.symbol, { scroll: true });
    });
    reportsList.appendChild(button);
  });

  renderPilne(indexData.reports);
}

/* ── Wydanie (analiza spółki) ────────────────────────── */

function renderExpert(comment, index) {
  const seed = hashStr(comment.author || `anonim-${index}`);
  const sentiment = String(comment.sentimentLabel || 'Neutral').toLowerCase();
  const verdictPool = VERDICTS[sentiment] || VERDICTS.neutral;
  const verdictCls = sentiment === 'positive' ? 'sig-buy' : sentiment === 'negative' ? 'sig-sell' : '';

  const article = document.createElement('article');
  article.className = 'expert';
  article.innerHTML = `
    <div class="avatar">${pick(AVATARS, seed)}</div>
    <div>
      <div class="expert-name">${pick(TITLES, seed >> 3)} ~${escapeHtml(comment.author || 'anonim')}</div>
      <div class="expert-title">${pick(DEPARTMENTS, seed >> 5)}</div>
      <p class="expert-quote">„${escapeHtml(comment.body || '(ekspert milczy wymownie)')}”</p>
      <div class="verdict ${verdictCls}">WERDYKT: ${pick(verdictPool, seed >> 7)}</div>
      <div class="expert-meta">
        ${comment.postedAt ? formatDate(comment.postedAt) : 'data nieznana'}
        ${comment.votes ? ` · głosy czytelników: +${comment.votes.up} / −${comment.votes.down}` : ''}
        · <a href="${escapeHtml(comment.url || '#')}" target="_blank" rel="noreferrer">${escapeHtml(comment.threadTitle || 'wątek na forum')}</a>
      </div>
    </div>
  `;
  return article;
}

function renderStock(data, options = {}) {
  if (!data || !data.analysis) {
    setMessage('AWARIA DRUKARNI!!!', 'Plik danych istnieje, ale nie zawiera poprawnej analizy. Zecer został zwolniony.', true);
    return;
  }

  const analysis = data.analysis;
  const signal = analysis.signal || 'HOLD';
  const conf = signalConf(signal);
  const confidencePct = Math.round((analysis.confidence || 0) * 100);
  const name = data.companyName || data.symbol;

  const requestedLimit = Math.max(1, Number(commentLimitInput.value) || 8);
  const allComments = Array.isArray(data.comments) ? data.comments : [];
  const visibleComments = allComments.slice(0, requestedLimit);

  const node = template.content.cloneNode(true);

  /* nagłówek */
  node.querySelector('.kicker').textContent = conf.kicker;
  node.querySelector('.headline').innerHTML = conf.headline(escapeHtml(name));
  node.querySelector('.subhead').textContent = conf.subhead(analysis.score, confidencePct);
  const stamp = node.querySelector('.stamp');
  stamp.classList.add(conf.cls);
  stamp.querySelector('.stamp-word').textContent = conf.stamp;

  /* barometr */
  const pct = Math.max(2, Math.min(98, ((Number(analysis.score) + 1) / 2) * 100));
  node.querySelector('.barometr-needle').style.left = `${pct}%`;

  /* krzywa nastrojów (sparkline) */
  node.querySelector('.sparkline').innerHTML = buildSparkline(analysis.trend);

  /* statystyki */
  const scoreEl = node.querySelector('.score');
  scoreEl.textContent = fmtScore(analysis.score);
  if (analysis.score < -0.05) scoreEl.classList.add('neg');
  if (analysis.score > 0.05) scoreEl.classList.add('pos');
  node.querySelector('.confidence').textContent = `${confidencePct}%`;
  node.querySelector('.comment-count').textContent = analysis.commentCount ?? '–';
  const b = analysis.breakdown;
  const breakdownEl = node.querySelector('.breakdown');
  breakdownEl.textContent = b ? `${b.positive}/${b.negative}/${b.neutral}` : '–';
  if (b && b.negative > b.positive) breakdownEl.classList.add('neg');

  /* eksperci */
  const experts = node.querySelector('.experts');
  if (!visibleComments.length) {
    const empty = document.createElement('p');
    empty.className = 'expert-title';
    empty.textContent = 'Wszyscy eksperci odmówili komentarza. To się zdarza pierwszy raz.';
    experts.appendChild(empty);
  }
  visibleComments.forEach((comment, i) => experts.appendChild(renderExpert(comment, i)));

  /* z ostatniej chwili (trend dzienny) */
  const trendRows = node.querySelector('.trend-rows');
  (analysis.trend || []).slice(-10).forEach((day) => {
    const row = document.createElement('div');
    row.className = 'trend-row';
    const cls = day.score > 0.05 ? 'pos' : day.score < -0.05 ? 'neg' : '';
    const dayLabel = String(day.date).slice(5).split('-').reverse().join('.');
    row.innerHTML = `<span>${escapeHtml(dayLabel)} — ${escapeHtml(trendLabel(day.score, hashStr(day.date)))} (${day.count} kom.)</span><b class="${cls}">${fmtScore(day.score)}</b>`;
    trendRows.appendChild(row);
  });
  if (!trendRows.children.length) {
    trendRows.innerHTML = '<div class="trend-row"><span>Brak danych dziennych. Podejrzanie spokojnie.</span></div>';
  }

  /* słowa tygodnia */
  const keywords = node.querySelector('.keywords');
  (analysis.topKeywords || []).forEach((item) => {
    const span = document.createElement('span');
    span.className = 'keyword';
    span.innerHTML = `${escapeHtml(item.word)} <b>(${item.count})</b>`;
    keywords.appendChild(span);
  });
  if (!keywords.children.length) {
    keywords.innerHTML = '<span class="keyword">forum wyjątkowo bez słów</span>';
  }

  /* ogłoszenia */
  node.querySelector('.quote-link').href = data.quoteUrl || '#';
  node.querySelector('.forum-link').href = data.forumUrl || '#';
  const composedAt = data.report?.fetchedAt || data.updatedAt;
  const updatedEl = node.querySelector('.updated-at');
  updatedEl.classList.toggle('stale', isStale(composedAt));
  updatedEl.textContent =
    `Skład wydania: ${formatDate(composedAt)} · okno: ${data.report?.windowDays || 7} dni` +
    (isStale(composedAt) ? ' · ⚠ wydanie nieaktualne' : '');

  /* nakład w winiecie */
  mastheadNaklad.textContent = `Nakład: ${analysis.commentCount ?? '?'} komentarzy / ${data.report?.windowDays || 7} dni`;

  app.innerHTML = '';
  app.appendChild(node);

  if (options.scroll) requestAnimationFrame(scrollToApp);
}

/* ── Ładowanie danych ────────────────────────────────── */

// Odbicie aktualnej spółki w URL (?symbol=JSW), żeby dało się ją linkować.
function syncUrl(symbol, replace) {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('symbol') === symbol) return;
    url.searchParams.set('symbol', symbol);
    const state = { symbol };
    if (replace) window.history.replaceState(state, '', url);
    else window.history.pushState(state, '', url);
  } catch {
    /* history niedostępne — pomiń, to tylko ułatwienie */
  }
}

function urlSymbol() {
  try {
    return (new URLSearchParams(window.location.search).get('symbol') || '').trim().toUpperCase();
  } catch {
    return '';
  }
}

async function loadStock(symbol, options = {}) {
  const normalized = String(symbol || '').trim().toUpperCase();
  if (!normalized) {
    setMessage('PUSTA STRONA!!!', 'Wpisz kod spółki, np. JSW. Bez tego drukujemy same przecinki.', true);
    return;
  }
  // whitelist — ticker lands in a fetch() path, so no dots/slashes allowed
  if (!/^[A-Z0-9-]{1,12}$/.test(normalized)) {
    setMessage('KRZYWY TICKER!!!', `„${normalized}" nie wygląda jak kod spółki. Dozwolone: litery, cyfry i myślnik.`, true);
    return;
  }
  setMessage('MASZYNY DRUKUJĄ…', `Skład wydania specjalnego dla ${normalized}.`);

  try {
    const response = await fetch(`./data/stocks/${normalized}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('not-found');
    const data = await response.json();
    renderStock(data, options);
    if (!options.skipUrl) syncUrl(normalized, options.replaceUrl === true);
  } catch {
    setMessage(
      'WYDANIE ZAGINĘŁO W DRUKARNI!!!',
      `Nie znaleziono pliku danych dla ${normalized}. Dodaj ticker do config/stocks.json i uruchom workflow refresh — zecer czeka.`,
      true
    );
  }
}

async function loadReportsIndex() {
  try {
    const response = await fetch('./data/index.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('index');
    const data = await response.json();
    renderReportsIndex(data);

    /* wydanie otwierające: deep-link z ?symbol= albo najbardziej dramatyczna spółka dnia */
    const reports = data.reports || [];
    if (reports.length) {
      const drama = [...reports].sort(
        (a, b) => Math.abs(b.score || 0) - Math.abs(a.score || 0) || (b.commentCount || 0) - (a.commentCount || 0)
      )[0];
      const target = urlSymbol() || drama.symbol;
      input.value = target;
      loadStock(target, { replaceUrl: true });
    } else {
      setMessage('KIOSK PUSTY', 'Brak raportów w data/index.json. Uruchom workflow refresh.', true);
    }
  } catch {
    reportsUpdated.textContent = 'Kiosk zamknięty — nie udało się wczytać listy raportów.';
    setMessage('KIOSK ZAMKNIĘTY', 'Nie udało się wczytać data/index.json. Sprawdź, czy workflow refresh wygenerował dane.', true);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  loadStock(input.value, { scroll: true });
});

/* przyciski wstecz/dalej przeglądarki przełączają wydanie bez kolejnego wpisu w historii */
window.addEventListener('popstate', () => {
  const symbol = urlSymbol();
  if (symbol) {
    input.value = symbol;
    loadStock(symbol, { skipUrl: true });
  }
});

/* winieta: data wydania */
mastheadDate.textContent =
  'Wydanie paniczne · ' + new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

loadReportsIndex();
