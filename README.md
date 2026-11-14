# Bankier Street Bets

[![Status: complete](https://img.shields.io/badge/status-complete%2C%20not%20maintained-lightgrey)](#project-status)
[![Tests](https://github.com/110kc3/bankier-street-bets/actions/workflows/test.yml/badge.svg)](https://github.com/110kc3/bankier-street-bets/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Satirical **Buy / Hold / Sell** signal generator for Warsaw Stock Exchange (GPW) equities, driven by sentiment analysis of retail investor comments on the Bankier.pl forums.

> ⚠️ **Not investment advice.** This is a tongue-in-cheek experiment in measuring forum "hopium".

![Bankier Street Bets Screenshot](docs/screenshot.png)

## Highlights

- **Sentiment Engine:** Stem-based Polish lexicon scoring with inflection tolerance, slang detection, and community upvote weighting
- **Dynamic Window Escalation:** Automatically widens sampling windows for low-liquidity forum threads
- **Static Architecture:** Automated GitHub Actions scraping pipeline publishing static JSON to a vintage tabloid-styled GitHub Pages frontend
- **Native Tests:** `node:test` suite (jsdom for the frontend) covering collector pagination, scoring heuristics, the data contract, and frontend rendering

## Project status

The project is feature-complete and **no longer actively developed**. The scraper depends on Bankier.pl's unofficial mobile endpoints and markup; if those change, the collector needs updating, and `tests/data-contract.test.js` stops a broken scrape from being committed. Sentiment is a heuristic lexicon, not an ML model.

## Quick Start

```bash
npm install
npm test
npm run lint
npm run serve
```

Visit `http://localhost:4173` (`serve` uses Python's `http.server`).

## Refreshing Data

```bash
# Refresh a single ticker:
node scripts/refresh-stock.js EUVIC 7 30 200

# Refresh all configured equities:
npm run refresh
```

## Documentation

- [Portfolio Audit (2026-11-07)](docs/REPO-AUDIT-2026-11-07.md)

## License

MIT — see [`LICENSE`](LICENSE).
