# Bankier Street Bets

Prosty MVP bet makera dla polskich akcji. Aplikacja publikuje statyczną stronę na GitHub Pages i pokazuje sygnał **Buy / Hold / Sell** na podstawie heurystycznej analizy komentarzy z forum Bankier.pl dla wybranego tickera GPW.

## Jak działa

- użytkownik wpisuje symbol, np. `EUVIC`
- frontend ładuje gotowy plik `data/stocks/EUVIC.json`
- plik JSON jest odświeżany przez GitHub Actions skryptem Node.js
- skrypt zbiera **wszystkie komentarze z forum Bankier z ostatnich N dni** (domyślnie 7, do 200 komentarzy łącznie i do 200 postów na wątek), paginując listę wątków i posty w wątkach oraz pobierając pełną treść postów wraz z głosami społeczności (+/−)
- ciche fora automatycznie rozszerzają okno (7 → 30 → 90 → 365 dni), aż uzbiera się minimum komentarzy (domyślnie 30; sterowane przez `MIN_COMMENTS` / `MAX_COMMENTS` lub argumenty CLI)
- sentyment liczony jest heurystycznie: leksykon polskich rdzeni słów (odmiany i brak ogonków nie przeszkadzają), obsługa negacji („nie kupuj"), frazy wielowyrazowe, emoji oraz slang forumowy
- sygnał Buy/Hold/Sell to średnia ważona: świeższe komentarze i komentarze z dodatnim saldem głosów ważą więcej
- wynik zawiera też dzienny trend sentymentu, rozbicie pozytywne/negatywne/neutralne i słowa kluczowe

## Ograniczenia MVP

- to nie jest model ML ani rekomendacja inwestycyjna
- parser opiera się na aktualnym HTML Bankier.pl i może wymagać zmian, jeśli serwis zmieni markup
- część stron może być trudna do scrapowania; dlatego repo zawiera też przykładowy snapshot dla `EUVIC`

## Lokalne uruchomienie

```bash
npm run serve
```

Potem otwórz `http://localhost:4173`.

## Odświeżenie danych lokalnie

Jedna spółka (argumenty: dni wstecz, min komentarzy, max komentarzy):

```bash
npm run refresh:one -- EUVIC 7 30 200
```

Wszystkie spółki z `config/stocks.json`:

```bash
npm run refresh
```

Albo gotowy preset top-20 GPW (bez `config/stocks.json`):

```bash
node scripts/refresh-all.js 7 top20
```

### Zmienne środowiskowe

Skrypty czytają też konfigurację ze zmiennych (przydatne w CI):

| Zmienna | Domyślnie | Znaczenie |
| --- | --- | --- |
| `WINDOW_DAYS` | `7` | ile dni wstecz zbierać komentarze |
| `MIN_COMMENTS` | `30` | minimum komentarzy; poniżej okno rośnie 7 → 30 → 90 → 365 dni |
| `MAX_COMMENTS` | `200` | maksimum zapisanych komentarzy na spółkę |
| `STOCK_PRESET` | `configured` | `configured` (z `config/stocks.json`) albo `top20` |
| `STOCK_SYMBOL` | – | odśwież tylko jeden symbol |

## Testy i lint

```bash
npm test     # testy jednostkowe (kolektor, sentyment, kontrakt danych, frontend w jsdom)
npm run lint # ESLint
```

`tests/data-contract.test.js` waliduje wygenerowane pliki `data/` i jest uruchamiany w
workflow `refresh-data.yml` **przed** commitem — popsuty scrape nie trafi na produkcję.
Workflow `test.yml` uruchamia lint + pełne testy na każdym PR-ze.

## Jak działa scraping (i co go psuje)

Kolektor (`scripts/bankier.js`) korzysta z nieoficjalnych endpointów mobilnego Bankiera:

- `…/profile/quote.html?symbol=SYMBOL` — nazwa spółki i kanoniczny adres forum,
- `m.bankier.pl/forum/spolka/SYMBOL` — `data-forum-id` / `data-far-id` (metadane forum),
- `m.bankier.pl/json/get_threads` — lista wątków (paginowana),
- `m.bankier.pl/json/get_thread` — posty w wątku wraz z głosami (+/−).

Każdy fetch ma limit czasu (`REQUEST_TIMEOUT_MS`) i ponawia próby z backoffem.
Jeśli Bankier zmieni markup lub te endpointy, parser trzeba zaktualizować —
test kontraktu danych wyłapie wtedy puste/uszkodzone wyniki w CI.

## GitHub Pages

1. Utwórz repozytorium GitHub i wypchnij ten kod na branch `main`.
2. W ustawieniach repo włącz **GitHub Pages** z użyciem **GitHub Actions**.
3. Workflow `deploy-pages.yml` opublikuje stronę.
4. Workflow `refresh-data.yml` będzie cyklicznie odświeżał pliki w `data/`.

## Dodawanie nowych tickerów

Edytuj `config/stocks.json`, np.:

```json
[
  "EUVIC",
  "KGHM",
  "PKNORLEN"
]
```

Następnie uruchom workflow refresh albo lokalne `npm run refresh`.

## Licencja

MIT — zobacz [`LICENSE`](LICENSE).
