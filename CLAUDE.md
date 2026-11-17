# RPG Table — kontekst dla Claude

PWA na telefon z Androidem (Chrome) do sesji papierowego RPG: pełnoekranowe grafiki, efekty shaderowe i rzuty kośćmi. Użytkownik prowadzi sesje i rozmawia po polsku.

- Repo: https://github.com/Artur-Szymanski/rpg-table-pwa (publiczne), lokalnie `C:\_DATA\Repos\rpg-table-pwa` (celowo poza OneDrive).
- Strona: https://artur-szymanski.github.io/rpg-table-pwa/

## Konwencje
- Nazwy plików, kod i komentarze po angielsku; README, dokumentacja i rozmowa po polsku.
- Czysty JS bez bundlera i bez Node (Node i Python nie są zainstalowane lokalnie).
- Shadery HLSL od użytkownika tłumaczymy na GLSL ES 3.0.

## Architektura
- `renderer.js` — WebGL2, shadery w konwencji Shadertoy (`void mainImage(out vec4, in vec2)`). Nagłówek dokleja uniformy: `iResolution`, `iTime`, `iTimeDelta`, `iFrame`, `iMouse`, `iChannel0` (obraz sceny), `iChannel0Size`, `uIntensity` (suwak w UI) i helper `sampleCover(uv)` (dopasowanie „cover”). Nie deklaruj ich ponownie w `.frag`.
- `shaders/*.frag` — każdy samodzielny (WebGL nie ma `#include`); `shaders/common_noise.glsl` to tylko kopia wzorcowa funkcji szumu do wklejania.
- `scenes.json` — lista scen: `id` (unikalne), `name`, `shader`, opcjonalnie `image`, `intensity`.
- `app.js` — UI, przełączanie scen (swipe / select), localStorage. `dice.js` — notacja NdM, d%, kh/kl/dh/dl, stałe; crypto RNG z odrzucaniem.
- `service-worker.js` — network-first z cache offline; nazwa cache `rpg-table-v1` podmieniana w CI na SHA.
- `images/tavern.svg` to tylko placeholder.

## Workflow
1. Edycja.
2. Test lokalny: `powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8080]` i podgląd w przeglądarce wbudowanej z presetem mobile 375×812 (sprawdź konsolę pod kątem błędów kompilacji shaderów). Jeśli port 8080 zajęty, użyj innego.
3. Commit (z atrybucją Co-Authored-By) → push na `main`.
4. GitHub Actions (`.github/workflows/pages.yml`): walidacja `scenes.json` (istnienie plików, unikalne id), kopiowanie do `_site`, podmiana wersji cache SW, wdrożenie Pages. Sprawdź: `gh run list` / `gh run watch`. `gh` jest w `C:\Program Files\GitHub CLI\gh.exe` (może nie być w PATH).

Uwaga: nowy plik lub katalog najwyższego poziomu trzeba dopisać do kroku `cp` w `pages.yml`.

## Znane drobiazgi
- Ostrzeżenie Actions o przestarzałym Node 20 w akcjach (checkout@v4, configure-pages@v5, upload-pages-artifact@v3, deploy-pages@v4) — zaktualizować przy okazji.
- Na fizycznym telefonie jeszcze nietestowane.
