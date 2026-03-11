import fs from 'node:fs/promises';
import path from 'node:path';

const POSITIVE_WORDS = [
  'wzrost', 'rosnie', 'rośnie', 'zysk', 'wyniki', 'mocny', 'mocne', 'dobry', 'dobra', 'kupuje', 'kupuję',
  'kontrakt', 'strategia', 'gpw', 'rozwój', 'potencjał', 'premium'
];

const NEGATIVE_WORDS = [
  'spadek', 'spada', 'strata', 'slaby', 'słaby', 'slabe', 'słabe', 'sprzedaj', 'ryzyko', 'zadłużenie',
  'dlug', 'dług', 'problem', 'zagrozenie', 'zagrożenie', 'zmienność'
];

const STOPWORDS = new Set(['oraz', 'ktory', 'który', 'spolka', 'spółka', 'forum', 'bankier', 'jest', 'dla', 'sie', 'się', 'czy']);
const DEFAULT_COMMENT_LIMIT = 5;

function stripTags(input) {
  return input.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

function decodeHtml(input) {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeText(input) {
  return decodeHtml(stripTags(input)).replace(/\s+/g, ' ').trim();
}

function normalizeCommentHtml(input) {
  return decodeHtml(input)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 BankierStreetBets/0.1' }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }
  return await response.text();
}

function makeForumUrl(symbol, quoteHtml) {
  const mobileCanonical = quoteHtml.match(/https:\/\/m\.bankier\.pl\/forum\/spolka\/([A-Z0-9-]+)/i);
  if (mobileCanonical) return `https://m.bankier.pl/forum/spolka/${mobileCanonical[1].toUpperCase()}`;
  return `https://m.bankier.pl/forum/spolka/${symbol.toUpperCase()}`;
}

function extractCanonicalForumUrl(forumHtml, fallback) {
  return forumHtml.match(/<link rel="canonical" href="([^"]+)"/i)?.[1] || fallback;
}

function extractThreadLinks(forumHtml) {
  return [...new Set([...forumHtml.matchAll(/href="(\/forum\/temat_[^"]+?\.html)"/gi)].map((m) => `https://www.bankier.pl${m[1]}`))];
}

function extractMobilePostLinks(forumHtml) {
  return [...new Set([...forumHtml.matchAll(/href="(\/forum\/post\/\d+)"/gi)].map((m) => `https://m.bankier.pl${m[1]}`))];
}

function extractThreadTitle(html) {
  return normalizeText(
    html.match(/<td class="threadTitle">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/td>/i)?.[1]
      || html.match(/<title>(.*?)<\/title>/is)?.[1]
      || 'Wątek Bankier'
  );
}

function extractPosts(html, fallbackUrl, fallbackTitle) {
  const blocks = [...html.matchAll(/<span class="author name">([\s\S]*?)<\/span>[\s\S]*?<time class="entry-date"[^>]*datetime="([^"]+)"[^>]*>[\s\S]*?<\/time>[\s\S]*?<div class="p">([\s\S]*?)<\/div>/gi)];

  return blocks.map((match, index) => {
    const authorRaw = normalizeText(match[1]);
    const postedAt = normalizeText(match[2]);
    const body = normalizeCommentHtml(match[3]);
    const author = authorRaw.replace(/^Autor:\s*/i, '').replace(/^~/, '').trim() || 'Anonim';
    return {
      id: `${fallbackUrl}#post-${index + 1}`,
      author,
      postedAt,
      body,
      threadTitle: fallbackTitle,
      url: fallbackUrl
    };
  }).filter((post) => post.body.length > 30);
}

function sentimentScore(text) {
  const source = text.toLowerCase();
  let positive = 0;
  let negative = 0;
  for (const word of POSITIVE_WORDS) if (source.includes(word)) positive += 1;
  for (const word of NEGATIVE_WORDS) if (source.includes(word)) negative += 1;
  const raw = positive - negative;
  const score = Math.max(-1, Math.min(1, raw / 4));
  const label = score > 0.2 ? 'Positive' : score < -0.2 ? 'Negative' : 'Neutral';
  return { score, label, positiveHits: positive, negativeHits: negative };
}

function keywordStats(comments) {
  const counts = new Map();
  for (const comment of comments) {
    for (const token of comment.body.toLowerCase().match(/[a-ząćęłńóśźż]{4,}/gi) || []) {
      if (STOPWORDS.has(token)) continue;
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));
}

function aggregate(comments) {
  const total = comments.reduce((sum, item) => sum + item.sentimentScore, 0);
  const score = comments.length ? total / comments.length : 0;
  const signal = score > 0.25 ? 'BUY' : score < -0.25 ? 'SELL' : 'HOLD';
  const confidence = Math.min(0.95, 0.35 + comments.length * 0.08 + Math.abs(score) * 0.4);
  const topKeywords = keywordStats(comments);
  const bias = score > 0.15 ? 'umiarkowanie pozytywne' : score < -0.15 ? 'umiarkowanie negatywne' : 'mieszane';
  const summary = `Ostatnie zebrane komentarze są ${bias}; sygnał wynika z pełnej treści wpisów, słów kluczowych i proporcji komentarzy dodatnich do ujemnych.`;
  return { signal, score, confidence, commentCount: comments.length, summary, topKeywords };
}

async function collectStock(symbol, options = {}) {
  const commentLimit = Math.max(1, Number(options.commentLimit) || DEFAULT_COMMENT_LIMIT);
  const quoteUrl = `https://www.bankier.pl/inwestowanie/profile/quote.html?symbol=${symbol}`;
  const quoteHtml = await fetchText(quoteUrl);
  const companyName = normalizeText(quoteHtml.match(/<title>(.*?)\(/i)?.[1] || symbol);
  const mobileForumUrl = makeForumUrl(symbol, quoteHtml);
  const forumHtml = await fetchText(mobileForumUrl);
  const forumUrl = extractCanonicalForumUrl(forumHtml, mobileForumUrl);
  const threadLinks = extractThreadLinks(forumHtml);
  const mobilePostLinks = extractMobilePostLinks(forumHtml);
  const seeds = [...threadLinks, ...mobilePostLinks].slice(0, 8);

  const comments = [];
  for (const url of seeds) {
    try {
      const html = await fetchText(url);
      const threadTitle = extractThreadTitle(html);
      for (const post of extractPosts(html, url, threadTitle).slice(0, 3)) {
        const predictionText = `${post.threadTitle}. ${post.body}`;
        const sentiment = sentimentScore(predictionText);
        comments.push({
          id: post.id,
          author: post.author,
          postedAt: post.postedAt,
          threadTitle: post.threadTitle,
          url: post.url,
          body: post.body,
          sentimentScore: sentiment.score,
          sentimentLabel: sentiment.label
        });
      }
    } catch {
      // ignore single thread failure
    }
  }

  const uniqueComments = comments
    .filter((item, index, array) => array.findIndex((other) => other.body === item.body) === index)
    .sort((a, b) => new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime())
    .slice(0, commentLimit);
  const analysis = aggregate(uniqueComments);
  return {
    symbol,
    companyName,
    quoteUrl,
    forumUrl,
    updatedAt: new Date().toISOString(),
    report: {
      available: true,
      source: 'Bankier.pl forum',
      fetchedAt: new Date().toISOString(),
      commentLimit
    },
    analysis,
    comments: uniqueComments
  };
}

async function writeStockFile(stock) {
  const target = path.join('data', 'stocks', `${stock.symbol}.json`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(stock, null, 2) + '\n');
}

export { collectStock, writeStockFile };
