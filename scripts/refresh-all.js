import fs from 'node:fs/promises';
import { collectStock, writeStockFile } from './bankier.js';

const symbols = JSON.parse(await fs.readFile('config/stocks.json', 'utf8'));
const completed = [];

for (const rawSymbol of symbols) {
  const symbol = String(rawSymbol).trim().toUpperCase();
  if (!symbol) continue;
  try {
    const stock = await collectStock(symbol);
    await writeStockFile(stock);
    completed.push(symbol);
    console.log(`Refreshed ${symbol}`);
  } catch (error) {
    console.error(`Failed to refresh ${symbol}:`, error.message);
  }
}

await fs.writeFile('data/index.json', JSON.stringify({ symbols: completed }, null, 2) + '\n');
