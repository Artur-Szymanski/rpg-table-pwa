# RPG Table — kontekst dla Claude

PWA na telefon z Androidem (Chrome) do sesji papierowego RPG w klimacie Cyberpunk: pełnoekranowe grafiki, efekty shaderowe i rzuty kośćmi. Użytkownik prowadzi sesje i rozmawia po polsku.

- Repo: https://github.com/Artur-Szymanski/rpg-table-pwa (publiczne), lokalnie `C:\_DATA\Repos\rpg-table-pwa` (celowo poza OneDrive).
- Strona: https://artur-szymanski.github.io/rpg-table-pwa/

## Konwencje
- Nazwy plików, kod i komentarze po angielsku; README, dokumentacja i rozmowa po polsku.
- Czysty JS bez bundlera i bez Node (Node i Python nie są zainstalowane lokalnie).
- Shadery HLSL od użytkownika tłumaczymy na GLSL ES 3.0.

## Architektura
- `renderer.js` — WebGL2, shadery w konwencji Shadertoy (`void mainImage(out vec4, in vec2)`). Nagłówek dokleja uniformy: `iResolution`, `iTime`, `iTimeDelta`, `iFrame`, `iMouse`, `iChannel0` (obraz sceny), `iChannel0Size`, `uIntensity` (suwak w UI) i helper `sampleCover(uv)` (dopasowanie „cover”). Nie deklaruj ich ponownie w `.frag`. Scena renderuje się do tekstury (FBO), a globalny post-process (`POST_FRAG`) dodaje do każdego ekranu chromatyczną aberrację i delikatną interlinię (domyślne w `POST_DEFAULTS`; scena może nadpisać polami `scanlines` i `aberration` w scenes.json, 0 = wyłączone). Nie dodawaj własnych scanline w shaderach scen. Unikaj słów zarezerwowanych GLSL jako nazw zmiennych (np. `active`, `input`, `output`, `filter`, `sample`).
- `shaders/photo_glitch.frag` — wspólny shader dla zdjęć (`images/`, sceny `PHOTO_*`): okresowy delikatny glitch i rozjazd RGB, INT = siła.
- `shaders/*.frag` — każdy samodzielny (WebGL nie ma `#include`); `shaders/common_noise.glsl` to tylko kopia wzorcowa funkcji szumu do wklejania.
- `scenes.json` — lista scen: `id` (unikalne), `name`, `shader`, opcjonalnie `image`, `intensity`, `theme` (`glitch` | `neon` | `rain` | `lamp`; klasa `theme-*` na body steruje kolorami UI i animacją cyfr w `style.css`).
- `app.js` — UI: wybór efektu (‹ › lista) nie zmienia ekranu, dopiero AKTYWUJ; kości: kość → modyfikator −2…+6 → RZUĆ, animacja migających cyfr. Aktywna scena i intensywność każdego efektu (`rpg-table.intensity`, mapa id → wartość) w localStorage. `dice.js` — notacja NdM, d%, kh/kl/dh/dl, stałe; crypto RNG z odrzucaniem.
- `service-worker.js` — network-first z cache offline; nazwa cache `rpg-table-v1` podmieniana w CI na SHA.
- UI: styl cyberpunk — zero zaokrągleń, pełnoszerokie paski góra/dół, dolny pasek w jednej linii (musi mieścić się na 375 px). Czcionki w `fonts/` (OFL, offline, także w precache SW): UI i motyw glitch — Share Tech Mono, neon — Tilt Neon, rain — Orbitron. Wynik rzutu zostaje na ekranie do „cofnij”, kolejnego rzutu albo aktywacji innego efektu.

## Workflow
1. Edycja.
2. Test lokalny: panel podglądu w aplikacji Claude — `preview_start` z konfiguracją `rpg-table` (`.claude/launch.json`, port 8090), ewentualnie preset mobile 375×812. Serwer (`tools\serve.ps1`) wstrzykuje do index.html skrypt live reload (odpytuje `/__livereload`), więc po każdej zmianie pliku strona sama się przeładowuje. Sprawdzaj konsolę pod kątem błędów kompilacji shaderów. Port 8080 bywa zajęty przez stary serwer.
3. Commit (z atrybucją Co-Authored-By) → push na `main` (push NIE wdraża).
4. Wdrożenie tylko przy znaczącym kamieniu milowym i na prośbę użytkownika: `gh workflow run pages.yml`, potem `gh run watch`. Workflow: walidacja `scenes.json`, kopiowanie do `_site`, podmiana wersji cache SW, wdrożenie Pages. `gh` jest w `C:\Program Files\GitHub CLI\gh.exe` (może nie być w PATH). Nie trzeba testować każdej wersji na telefonie.

Uwaga: nowy plik lub katalog najwyższego poziomu trzeba dopisać do kroku `cp` w `pages.yml`.

## Znane drobiazgi
- Ostrzeżenie Actions o przestarzałym Node 20 w akcjach (checkout@v4, configure-pages@v5, upload-pages-artifact@v3, deploy-pages@v4) — zaktualizować przy okazji.
- Na fizycznym telefonie jeszcze nietestowane.
