import fs from 'node:fs/promises';
import { collectStock, writeStockFile } from './bankier.js';

// CCC -> MODIVO, PLAY -> delisted (removed); SANTANDER -> ERSTEPL (renamed)
const TOP20_SYMBOLS = [
  'PKNORLEN', 'PKOBP', 'PEKAO', 'PZU', 'DINOPL', 'ALLEGRO', 'KGHM', 'LPP', 'CDPROJEKT', 'MBANK',
  'ERSTEPL', 'KRUK', 'CYFRPLSAT', 'BUDIMEX', 'ORANGEPL', 'JSW', 'TAURONPE', 'PGE'
];

const preset = String(process.argv[3] || process.env.STOCK_PRESET || 'configured').trim().toLowerCase();
const symbols = preset === 'top20'
  ? TOP20_SYMBOLS
  : JSON.parse(await fs.readFile('config/stocks.json', 'utf8'));
const reports = [];
const days = Number(process.argv[2] || process.env.WINDOW_DAYS || 7);

for (const rawSymbol of symbols) {
  const symbol = String(rawSymbol).trim().toUpperCase();
  if (!symbol) continue;
  try {
    const stock = await collectStock(symbol, { days });
    await writeStockFile(stock);
    reports.push({
      symbol: stock.symbol,
      companyName: stock.companyName,
      updatedAt: stock.report?.fetchedAt || stock.updatedAt,
      signal: stock.analysis.signal,
      score: stock.analysis.score,
      trendDirection: stock.analysis.trendDirection,
      commentCount: stock.analysis.commentCount,
      windowDays: stock.report?.windowDays || days
    });
    console.log(`Refreshed ${symbol}: ${stock.analysis.signal} (${stock.analysis.commentCount} comments)`);
  } catch (error) {
    console.error(`Failed to refresh ${symbol}:`, error.message);
  }
}

await fs.writeFile('data/index.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  preset,
  reports
}, null, 2) + '\n');
