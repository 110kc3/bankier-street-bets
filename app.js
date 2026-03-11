const app = document.querySelector('#app');
const form = document.querySelector('#symbol-form');
const input = document.querySelector('#symbol-input');
const template = document.querySelector('#result-template');

const signalClass = {
  BUY: 'signal-buy',
  HOLD: 'signal-hold',
  SELL: 'signal-sell'
};

function setMessage(title, message, error = false) {
  app.innerHTML = `<section class="card ${error ? 'error' : ''}"><h2>${title}</h2><p>${message}</p></section>`;
}

function scoreToMeter(score) {
  return `${Math.max(0, Math.min(100, ((score + 1) / 2) * 100))}%`;
}

function renderStock(data) {
  const node = template.content.cloneNode(true);
  const signal = data.analysis.signal;
  node.querySelector('.symbol').textContent = data.symbol;
  node.querySelector('.company-name').textContent = data.companyName || data.symbol;
  const pill = node.querySelector('.signal-pill');
  pill.textContent = signal;
  pill.classList.add(signalClass[signal] || 'signal-hold');
  node.querySelector('.meter-fill').style.width = scoreToMeter(data.analysis.score);
  node.querySelector('.summary-copy').textContent = data.analysis.summary;
  node.querySelector('.score').textContent = data.analysis.score.toFixed(2);
  node.querySelector('.confidence').textContent = `${Math.round(data.analysis.confidence * 100)}%`;
  node.querySelector('.comment-count').textContent = String(data.analysis.commentCount);
  node.querySelector('.updated-at').textContent = new Date(data.updatedAt).toLocaleString('pl-PL');
  node.querySelector('.quote-link').href = data.quoteUrl;
  node.querySelector('.forum-link').href = data.forumUrl;

  const keywords = node.querySelector('.keywords');
  (data.analysis.topKeywords || []).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.word} (${item.count})`;
    keywords.appendChild(li);
  });

  const comments = node.querySelector('.comments');
  data.comments.forEach((comment) => {
    const article = document.createElement('article');
    article.className = 'comment';
    article.innerHTML = `
      <div class="comment-header">
        <strong>${comment.author || 'Anonim'}</strong>
        <span class="tag ${comment.sentimentLabel.toLowerCase()}">${comment.sentimentLabel}</span>
      </div>
      <p>${comment.excerpt}</p>
      <div class="comment-header">
        <span>${comment.threadTitle}</span>
        <a href="${comment.url}" target="_blank" rel="noreferrer">Źródło</a>
      </div>`;
    comments.appendChild(article);
  });

  app.innerHTML = '';
  app.appendChild(node);
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
