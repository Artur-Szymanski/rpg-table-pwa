// Dice notation parser and roller.
// Supported: NdM, dM, d%, NdMkhK / NdMklK (keep highest/lowest), NdMdlK / NdMdhK (drop lowest/highest),
// constants, + and - between terms. Example: "2d20kh1+5", "4d6dl1", "8d6 - 2", "d%".
(function () {
  'use strict';

  // Unbiased integer in [1, sides] using crypto RNG with rejection sampling.
  function rollDie(sides) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / sides) * sides;
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return (x % sides) + 1;
  }

  const TERM = /^(\d*)d(\d+|%)(?:(kh|kl|dh|dl)(\d+))?$|^(\d+)$/;

  function parse(input) {
    const src = String(input).toLowerCase().replace(/\s+/g, '');
    if (!src) throw new Error('Pusty rzut');
    const parts = src.match(/[+-]?[^+-]+/g);
    if (!parts || parts.join('') !== src) throw new Error('Nieprawidłowa notacja: ' + input);

    return parts.map((raw) => {
      const sign = raw[0] === '-' ? -1 : 1;
      const body = raw.replace(/^[+-]/, '');
      const m = body.match(TERM);
      if (!m) throw new Error('Nieznany element: ' + body);
      if (m[5] !== undefined) return { sign, constant: parseInt(m[5], 10), text: body };

      const count = m[1] === '' ? 1 : parseInt(m[1], 10);
      const sides = m[2] === '%' ? 100 : parseInt(m[2], 10);
      const mod = m[3] || null;
      const modN = m[4] !== undefined ? parseInt(m[4], 10) : 0;
      if (count < 1 || count > 200) throw new Error('Liczba kości poza zakresem 1–200');
      if (sides < 2 || sides > 1000) throw new Error('Liczba ścianek poza zakresem 2–1000');
      if (mod && (modN < 1 || modN > count)) throw new Error('Nieprawidłowy modyfikator: ' + body);
      return { sign, count, sides, mod, modN, text: body };
    });
  }

  function roll(input) {
    const terms = parse(input);
    let total = 0;
    const details = [];
    let natural = null; // single kept d20 value, for crit / fumble highlighting

    for (const t of terms) {
      if (t.constant !== undefined) {
        total += t.sign * t.constant;
        details.push((t.sign < 0 ? '− ' : '+ ') + t.constant);
        continue;
      }
      const rolls = Array.from({ length: t.count }, () => rollDie(t.sides));
      const order = rolls.map((v, i) => i).sort((a, b) => rolls[a] - rolls[b]);
      let kept = new Set(order);
      if (t.mod === 'kh') kept = new Set(order.slice(-t.modN));
      if (t.mod === 'kl') kept = new Set(order.slice(0, t.modN));
      if (t.mod === 'dh') kept = new Set(order.slice(0, t.count - t.modN));
      if (t.mod === 'dl') kept = new Set(order.slice(t.modN));

      let sum = 0;
      const shown = rolls.map((v, i) => {
        if (kept.has(i)) { sum += v; return String(v); }
        return '~' + v + '~';
      });
      total += t.sign * sum;
      details.push((t.sign < 0 ? '− ' : '+ ') + t.text + ' [' + shown.join(', ') + ']');

      const keptVals = rolls.filter((v, i) => kept.has(i));
      if (t.sides === 20 && keptVals.length === 1 && terms.filter((x) => x.sides).length === 1) {
        natural = keptVals[0];
      }
    }

    const detail = details.join(' ').replace(/^\+ /, '');
    return { input: String(input).trim(), total, detail, crit: natural === 20, fumble: natural === 1 };
  }

  window.Dice = { roll, parse, rollDie };
})();
