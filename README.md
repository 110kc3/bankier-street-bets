# Bankier Street Bets

Prosty MVP bet makera dla polskich akcji. Aplikacja publikuje statyczną stronę na GitHub Pages i pokazuje sygnał **Buy / Hold / Sell** na podstawie heurystycznej analizy komentarzy z forum Bankier.pl dla wybranego tickera GPW.

## Jak działa

- użytkownik wpisuje symbol, np. `EUVIC`
- frontend ładuje gotowy plik `data/stocks/EUVIC.json`
- plik JSON jest odświeżany przez GitHub Actions skryptem Node.js
- skrypt zbiera **wszystkie komentarze z forum Bankier z ostatnich N dni** (domyślnie 7, do 200 komentarzy), paginując listę wątków i pobierając pełną treść postów wraz z głosami społeczności (+/−)
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

Jedna spółka (drugi argument = ile dni wstecz, domyślnie 7):

```bash
npm run refresh:one -- EUVIC 7
```

Wszystkie spółki z `config/stocks.json`:

```bash
npm run refresh
```

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
