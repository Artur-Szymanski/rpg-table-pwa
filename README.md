# RPG Table

Aplikacja PWA wspierająca sesje papierowego RPG: pełnoekranowe grafiki, efekty oparte na shaderach
i rzuty kośćmi. Działa w Chrome na Androidzie; po instalacji („Dodaj do ekranu głównego”) startuje
na pełnym ekranie i działa offline.

## Obsługa
- **Stuknięcie w ekran**: pokaż / ukryj panel.
- **Przesunięcie w lewo / prawo**: następna / poprzednia scena.
- **⛶**: pełny ekran i blokada wygaszania ekranu.
- **Suwak Intensywność**: parametr `uIntensity` przekazywany do shadera.
- **Kości**: przyciski szybkich rzutów albo notacja w polu tekstowym.

### Notacja kości
| Zapis | Znaczenie |
|---|---|
| `d20`, `3d6`, `d%` | zwykłe rzuty (`d%` = d100) |
| `2d6+3`, `1d8-1+1d4` | sumy i modyfikatory |
| `2d20kh1` / `2d20kl1` | zachowaj najwyższy / najniższy (przewaga / utrudnienie) |
| `4d6dl1` | odrzuć najniższy |

Losowanie: `crypto.getRandomValues` z odrzucaniem, więc bez przekłamań rozkładu.

## Dodawanie scen
1. Grafikę wrzuć do `images/` (JPG / PNG / WebP, najlepiej ≤ 2048 px po dłuższym boku).
2. Shader dodaj do `shaders/` jako plik `.frag` w konwencji Shadertoy:
   ```glsl
   void mainImage(out vec4 fragColor, in vec2 fragCoord) { ... }
   ```
   Dostępne: `iResolution`, `iTime`, `iTimeDelta`, `iFrame`, `iMouse`, `iChannel0` (grafika sceny),
   `iChannel0Size`, `uIntensity` oraz funkcja `sampleCover(uv)` (grafika dopasowana do ekranu).
3. Dopisz scenę do `scenes.json`.

Shadery z Shadertoy działają zwykle bez zmian. Shadery HLSL trzeba przetłumaczyć na GLSL ES 3.0
(`float2` → `vec2`, `lerp` → `mix`, `frac` → `fract`, `saturate(x)` → `clamp(x, 0.0, 1.0)`, `mul(a, b)` → `a * b`
z uwagą na kolejność macierzy).

## Uruchomienie lokalne
```
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```
Potem `http://localhost:8080/`.

## Publikacja
Każdy push na `main` uruchamia GitHub Actions (`.github/workflows/pages.yml`): sprawdzenie `scenes.json`,
a potem wdrożenie na GitHub Pages. Wersja cache service workera zmienia się przy każdym wdrożeniu.
