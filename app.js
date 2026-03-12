const app = document.querySelector('#app');
const form = document.querySelector('#symbol-form');
const input = document.querySelector('#symbol-input');
const commentLimitInput = document.querySelector('#comment-limit-input');
const template = document.querySelector('#result-template');
const reportsList = document.querySelector('#reports-list');
const reportsUpdated = document.querySelector('#reports-updated');

const signalClass = {
  BUY: 'signal-buy',
  HOLD: 'signal-hold',
  SELL: 'signal-sell'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setMessage(title, message, error = false) {
  app.innerHTML = `<section class="card ${error ? 'error' : ''}"><h2>${title}</h2><p>${message}</p></section>`;
}

function scoreToMeter(score) {
  return `${Math.max(0, Math.min(100, ((score + 1) / 2) * 100))}%`;
}

function formatDate(date) {
  const parsed = new Date(String(date).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? 'brak daty' : parsed.toLocaleString('pl-PL');
}

function renderReportsIndex(indexData) {
  reportsUpdated.textContent = `Ostatni fetch listy: ${formatDate(indexData.generatedAt)}`;
  reportsList.innerHTML = '';

  indexData.reports.forEach((report) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'report-item';
    button.innerHTML = `
      <strong>${report.symbol}</strong>
      <span>${report.companyName || report.symbol}</span>
      <span>Sygnał: ${report.signal}</span>
      <span>Limit komentarzy: ${report.commentLimit || 5}</span>
      <span>Fetch: ${formatDate(report.updatedAt)}</span>
    `;
    button.addEventListener('click', () => {
      input.value = report.symbol;
      commentLimitInput.value = report.commentLimit || 5;
      loadStock(report.symbol);
    });
    reportsList.appendChild(button);
  });
}

function renderStock(data) {
  if (!data || !data.analysis) {
    setMessage('Brak analizy', 'Plik danych istnieje, ale nie zawiera poprawnej analizy.', true);
    return;
  }

  const requestedLimit = Math.max(1, Number(commentLimitInput.value) || 5);
  const allComments = Array.isArray(data.comments) ? data.comments : [];
  const visibleComments = allComments.slice(0, requestedLimit);
  const node = template.content.cloneNode(true);
  const signal = data.analysis.signal || 'HOLD';
  node.querySelector('.symbol').textContent = data.symbol;
  node.querySelector('.company-name').textContent = data.companyName || data.symbol;
  const pill = node.querySelector('.signal-pill');
  pill.textContent = signal;
  pill.classList.add(signalClass[signal] || 'signal-hold');
  node.querySelector('.meter-fill').style.width = scoreToMeter(data.analysis.score);
  node.querySelector('.summary-copy').textContent = data.analysis.summary;
  node.querySelector('.score').textContent = data.analysis.score.toFixed(2);
  node.querySelector('.confidence').textContent = `${Math.round(data.analysis.confidence * 100)}%`;
  node.querySelector('.comment-count').textContent = String(visibleComments.length);
  node.querySelector('.comment-limit').textContent = `${visibleComments.length} / ${data.report?.commentLimit || data.analysis.commentCount}`;
  node.querySelector('.updated-at').textContent = formatDate(data.report?.fetchedAt || data.updatedAt);
  node.querySelector('.quote-link').href = data.quoteUrl;
  node.querySelector('.forum-link').href = data.forumUrl;

  const keywords = node.querySelector('.keywords');
  (data.analysis.topKeywords || []).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.word} (${item.count})`;
    keywords.appendChild(li);
  });
  if (!keywords.children.length) {
    const li = document.createElement('li');
    li.textContent = 'Brak dominujących słów dla tego zestawu komentarzy.';
    keywords.appendChild(li);
  }

  const comments = node.querySelector('.comments');
  if (!visibleComments.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Brak zapisanych komentarzy dla tego symbolu.';
    comments.appendChild(empty);
  }

  visibleComments.forEach((comment) => {
    const article = document.createElement('article');
    article.className = 'comment';
    article.innerHTML = `
      <div class="comment-header">
        <strong>${escapeHtml(comment.author || 'Anonim')}</strong>
        <span class="tag ${String(comment.sentimentLabel || 'Neutral').toLowerCase()}">${escapeHtml(comment.sentimentLabel || 'Neutral')}</span>
      </div>
      <div class="comment-meta">Data: ${comment.postedAt ? formatDate(comment.postedAt) : 'brak'}</div>
      <p>${escapeHtml(comment.body || '')}</p>
      <div class="comment-header">
        <span>${escapeHtml(comment.threadTitle || 'Wątek Bankier')}</span>
        <a href="${escapeHtml(comment.url || '#')}" target="_blank" rel="noreferrer">Źródło</a>
      </div>`;
    comments.appendChild(article);
  });

  app.innerHTML = '';
  app.appendChild(node);
}

async function loadReportsIndex() {
  try {
    const response = await fetch('./data/index.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('index');
    const data = await response.json();
    renderReportsIndex(data);
  } catch {
    reportsUpdated.textContent = 'Nie udało się wczytać listy raportów.';
  }
}

async function loadStock(symbol) {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    setMessage('Brak symbolu', 'Wpisz kod spółki, np. EUVIC.', true);
    return;
  }
  setMessage('Ładowanie…', `Pobieram snapshot dla ${normalized}.`);
  try {
    const response = await fetch(`./data/stocks/${normalized}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error('not-found');
    const data = await response.json();
    renderStock(data);
  } catch {
    setMessage(
      'Brak danych',
      `Nie znaleziono wygenerowanego pliku dla ${normalized}. Dodaj ticker do config/stocks.json i uruchom workflow refresh.`,
      true
    );
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  loadStock(input.value);
});

loadStock('EUVIC');
loadReportsIndex();
