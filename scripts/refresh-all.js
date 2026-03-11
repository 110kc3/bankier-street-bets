import fs from 'node:fs/promises';
import { collectStock, writeStockFile } from './bankier.js';

const symbols = JSON.parse(await fs.readFile('config/stocks.json', 'utf8'));
const reports = [];

for (const rawSymbol of symbols) {
  const symbol = String(rawSymbol).trim().toUpperCase();
  if (!symbol) continue;
  try {
    const stock = await collectStock(symbol);
    await writeStockFile(stock);
    reports.push({
      symbol: stock.symbol,
      companyName: stock.companyName,
      updatedAt: stock.report?.fetchedAt || stock.updatedAt,
      signal: stock.analysis.signal,
      commentCount: stock.analysis.commentCount
    });
    console.log(`Refreshed ${symbol}`);
  } catch (error) {
    console.error(`Failed to refresh ${symbol}:`, error.message);
  }
}

await fs.writeFile('data/index.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  reports
}, null, 2) + '\n');
