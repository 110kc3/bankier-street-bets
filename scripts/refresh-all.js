import fs from 'node:fs/promises';
import { collectStock, writeStockFile, rebuildIndexFile } from './bankier.js';

// CCC -> MODIVO, PLAY -> delisted (removed); SANTANDER -> ERSTEPL (renamed)
const TOP20_SYMBOLS = [
  'PKNORLEN', 'PKOBP', 'PEKAO', 'PZU', 'DINOPL', 'ALLEGRO', 'KGHM', 'LPP', 'CDPROJEKT', 'MBANK',
  'ERSTEPL', 'KRUK', 'CYFRPLSAT', 'BUDIMEX', 'ORANGEPL', 'JSW', 'TAURONPE', 'PGE'
];

const preset = String(process.argv[3] || process.env.STOCK_PRESET || 'configured').trim().toLowerCase();
const symbols = preset === 'top20'
  ? TOP20_SYMBOLS
  : JSON.parse(await fs.readFile('config/stocks.json', 'utf8'));
const days = Number(process.argv[2] || process.env.WINDOW_DAYS || 7);
const minComments = Number(process.env.MIN_COMMENTS || 30);
const maxComments = Number(process.env.MAX_COMMENTS || 200);

const failed = [];
let refreshed = 0;

for (const rawSymbol of symbols) {
  const symbol = String(rawSymbol).trim().toUpperCase();
  if (!symbol) continue;
  try {
    const stock = await collectStock(symbol, { days, minComments, maxComments });
    await writeStockFile(stock);
    refreshed += 1;
    console.log(`Refreshed ${symbol}: ${stock.analysis.signal} (${stock.analysis.commentCount} comments)`);
  } catch (error) {
    failed.push(symbol);
    console.error(`Failed to refresh ${symbol}:`, error.message);
  }
}

// Index is rebuilt from data/stocks/* — failed symbols keep their previous
// entry instead of silently disappearing from the kiosk.
const reports = await rebuildIndexFile({ preset });
console.log(`Index rebuilt: ${reports.length} stocks (${refreshed} refreshed, ${failed.length} failed)`);

if (failed.length) {
  console.error(`Stale data kept for: ${failed.join(', ')}`);
}
if (!refreshed && symbols.length) {
  console.error('Every refresh failed — marking run as failed.');
  process.exitCode = 1;
}
