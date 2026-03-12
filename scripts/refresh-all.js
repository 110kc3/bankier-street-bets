import fs from 'node:fs/promises';
import { collectStock, writeStockFile } from './bankier.js';

const TOP20_SYMBOLS = [
  'PKNORLEN', 'PKOBP', 'PEKAO', 'PZU', 'DINOPL', 'ALLEGRO', 'KGHM', 'LPP', 'CDPROJEKT', 'MBANK',
  'SANTANDER', 'KRUK', 'CCC', 'CYFRPLSAT', 'BUDIMEX', 'ORANGEPL', 'JSW', 'TAURONPE', 'PGE', 'PLAY'
];

const preset = String(process.argv[3] || process.env.STOCK_PRESET || 'configured').trim().toLowerCase();
const symbols = preset === 'top20'
  ? TOP20_SYMBOLS
  : JSON.parse(await fs.readFile('config/stocks.json', 'utf8'));
const reports = [];
const commentLimit = Number(process.argv[2] || process.env.COMMENT_LIMIT || 5);

for (const rawSymbol of symbols) {
  const symbol = String(rawSymbol).trim().toUpperCase();
  if (!symbol) continue;
  try {
    const stock = await collectStock(symbol, { commentLimit });
    await writeStockFile(stock);
    reports.push({
      symbol: stock.symbol,
      companyName: stock.companyName,
      updatedAt: stock.report?.fetchedAt || stock.updatedAt,
      signal: stock.analysis.signal,
      commentCount: stock.analysis.commentCount,
      commentLimit: stock.report?.commentLimit || commentLimit
    });
    console.log(`Refreshed ${symbol}`);
  } catch (error) {
    console.error(`Failed to refresh ${symbol}:`, error.message);
  }
}

await fs.writeFile('data/index.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  preset,
  reports
}, null, 2) + '\n');
