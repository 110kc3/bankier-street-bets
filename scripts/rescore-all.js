// Maintenance tool: re-score every committed stock with the CURRENT lexicon
// WITHOUT re-fetching Bankier, then rebuild data/index.json. Run it after editing
// the sentiment lexicon so the static site reflects the change immediately — the
// 6 h refresh cron would otherwise apply the new lexicon only on its next scrape.
//
//   npm run rescore
//
import fs from 'node:fs/promises';
import path from 'node:path';
import { rescoreStock, writeStockFile, rebuildIndexFile } from './bankier.js';

async function main() {
  const dir = path.join('data', 'stocks');
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();

  let changed = 0;
  let posTotal = 0;
  let negTotal = 0;
  let neuTotal = 0;
  for (const file of files) {
    const stock = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    const before = JSON.stringify(stock.analysis?.breakdown || {});
    const rescored = rescoreStock(stock);
    await writeStockFile(rescored);
    const b = rescored.analysis.breakdown;
    posTotal += b.positive;
    negTotal += b.negative;
    neuTotal += b.neutral;
    if (before !== JSON.stringify(b)) changed += 1;
  }

  const reports = await rebuildIndexFile({ rescoredAt: new Date().toISOString() });
  console.log(
    `Rescored ${files.length} stocks (${changed} with changed breakdown). ` +
    `Totals → positive ${posTotal} / negative ${negTotal} / neutral ${neuTotal}. ` +
    `Index has ${reports.length} reports.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
