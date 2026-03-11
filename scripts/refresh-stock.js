import { collectStock, writeStockFile } from './bankier.js';

const symbol = (process.argv[2] || process.env.STOCK_SYMBOL || '').trim().toUpperCase();

if (!symbol) {
  console.error('Usage: npm run refresh:one -- EUVIC');
  process.exit(1);
}

const stock = await collectStock(symbol);
await writeStockFile(stock);
console.log(`Saved data/stocks/${symbol}.json`);
