# RPG Table

Aplikacja PWA wspierająca sesje papierowego RPG w klimacie Cyberpunk: pełnoekranowe grafiki, efekty oparte na shaderach
i rzuty kośćmi. Działa w Chrome na Androidzie; po instalacji („Dodaj do ekranu głównego”) startuje
na pełnym ekranie i działa offline.

## Obsługa
- **Stuknięcie w ekran**: pokaż / ukryj paski UI.
- **Górny pasek**: przycisk **PHOTOS / EFFECTS** przełącza listę między zdjęciami (sceny z `image`) a efektami, żeby efekty-przerywniki były zawsze pod ręką; ‹ / lista / › tylko wybierają efekt (ekran się nie zmienia), **AKTYWUJ** go włącza
  (przy pierwszym użyciu także pełny ekran i blokada wygaszania). Migający przycisk = wybrany efekt jest inny niż aktywny.
- **Suwak INT**: parametr `uIntensity` aktywnego efektu; ustawienie jest zapamiętywane osobno dla każdego efektu.
- **Dolny pasek (kości)**: wybierz kość (d4–d100), potem modyfikator −2…+6 i **RZUĆ**; ↩ wraca do wyboru kości.
  Przez chwilę migają losowe liczby, potem wynik, który zostaje na ekranie do ↩, kolejnego rzutu albo aktywacji
  innego efektu. Krój i efekt cyfr zależą od motywu aktywnego efektu (czcionki w `fonts/`, licencja SIL OFL).
  Na k20 naturalna 20 pokazuje **CRIT!**, a naturalna 1 czerwony neon **FAIL!**. Opis rzutu (np. `d20 [14] +4 = 18`)
  jest tuż nad dolnym paskiem, żeby środek ekranu był czysty.

Losowanie: `crypto.getRandomValues` z odrzucaniem, więc bez przekłamań rozkładu.

## Dodawanie scen
1. Grafikę wrzuć do `images/` (JPG / PNG / WebP, najlepiej ≤ 2048 px po dłuższym boku).
   Dla zwykłego zdjęcia wystarczy shader `shaders/photo_glitch.frag` (co kilka sekund delikatny glitch
   z rozjeżdżającą się aberracją; INT = siła i częstotliwość, 0 = czyste zdjęcie), np. scena `02_Car`; zdjęcia nazywamy `NN_Nazwa` (plik `images/nn_nazwa.webp`) w kolejności pojawiania się na sesji (z `"aberration": 0`, żeby
   stała aberracja nie rozmywała detali).
2. Własny shader dodaj do `shaders/` jako plik `.frag` w konwencji Shadertoy:
   ```glsl
   void mainImage(out vec4 fragColor, in vec2 fragCoord) { ... }
   ```
   Dostępne: `iResolution`, `iTime`, `iTimeDelta`, `iFrame`, `iMouse`, `iChannel0` (grafika sceny),
   `iChannel0Size`, `uIntensity` oraz funkcja `sampleCover(uv)` (grafika dopasowana do ekranu).
3. Dopisz scenę do `scenes.json` (`id`, `name`, `shader`, opcjonalnie `image`, `intensity`,
   `theme`: `glitch` | `neon` | `rain` | `lamp` — motyw kolorów UI i animacji wyniku rzutu,
   `scanlines` i `aberration` — siła interlinii i aberracji chromatycznej, domyślnie 0.22 i 1, 0 wyłącza;
   `renderScale` — ułamek rozdzielczości dla ciężkich shaderów, np. 0.6, domyślnie 1).

Shadery z Shadertoy działają zwykle bez zmian. Shadery HLSL trzeba przetłumaczyć na GLSL ES 3.0
(`float2` → `vec2`, `lerp` → `mix`, `frac` → `fract`, `saturate(x)` → `clamp(x, 0.0, 1.0)`, `mul(a, b)` → `a * b`
z uwagą na kolejność macierzy).

## Uruchomienie lokalne
```
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```
Potem `http://localhost:8080/`. Serwer ma wbudowane automatyczne odświeżanie: po zapisaniu dowolnego pliku strona przeładowuje się sama (ostatnia scena jest zapamiętana).

## Publikacja
Wdrożenie robimy tylko przy kamieniach milowych, ręcznie: `gh workflow run pages.yml` (albo przycisk „Run workflow” w zakładce Actions). Push na `main` niczego nie wdraża. Workflow (`.github/workflows/pages.yml`) robi: sprawdzenie `scenes.json`,
a potem wdrożenie na GitHub Pages. Wersja cache service workera zmienia się przy każdym wdrożeniu.
