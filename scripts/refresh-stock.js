import { collectStock, writeStockFile } from './bankier.js';

const symbol = (process.argv[2] || process.env.STOCK_SYMBOL || '').trim().toUpperCase();
const commentLimit = Number(process.argv[3] || process.env.COMMENT_LIMIT || 5);

if (!symbol) {
  console.error('Usage: npm run refresh:one -- EUVIC 5');
  process.exit(1);
}

const stock = await collectStock(symbol, { commentLimit });
await writeStockFile(stock);
console.log(`Saved data/stocks/${symbol}.json`);
