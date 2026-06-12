import { collectStock, writeStockFile, rebuildIndexFile } from './bankier.js';

const symbol = (process.argv[2] || process.env.STOCK_SYMBOL || '').trim().toUpperCase();
const days = Number(process.argv[3] || process.env.WINDOW_DAYS || 7);
const minComments = Number(process.argv[4] || process.env.MIN_COMMENTS || 30);
const maxComments = Number(process.argv[5] || process.env.MAX_COMMENTS || 200);

if (!symbol) {
  console.error('Usage: npm run refresh:one -- EUVIC 7 30 200   (symbol, days back, min comments, max comments)');
  process.exit(1);
}

const stock = await collectStock(symbol, { days, minComments, maxComments });
await writeStockFile(stock);
await rebuildIndexFile(); // keep the kiosk index in sync with single-symbol refreshes
console.log(`Saved data/stocks/${symbol}.json (${stock.analysis.commentCount} comments, ${stock.analysis.signal}, window ${stock.report.windowDays}d)`);
