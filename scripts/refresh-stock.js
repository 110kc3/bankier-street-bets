import { collectStock, writeStockFile } from './bankier.js';

const symbol = (process.argv[2] || process.env.STOCK_SYMBOL || '').trim().toUpperCase();
const days = Number(process.argv[3] || process.env.WINDOW_DAYS || 7);

if (!symbol) {
  console.error('Usage: npm run refresh:one -- EUVIC 7   (symbol, days back)');
  process.exit(1);
}

const stock = await collectStock(symbol, { days });
await writeStockFile(stock);
console.log(`Saved data/stocks/${symbol}.json (${stock.analysis.commentCount} comments, ${stock.analysis.signal})`);
