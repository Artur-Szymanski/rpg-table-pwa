(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('stage');
  const ui = $('ui');
  const select = $('scene-select');
  const errorBox = $('error');
  const activateBtn = $('btn-activate');
  const SCENE_KEY = 'rpg-table.scene';

  let renderer;
  let scenes = [];
  let selected = 0; // shown in the picker
  let active = -1;  // currently rendered
  const shaderCache = new Map();

  function showError(err) {
    errorBox.textContent = String(err && err.message ? err.message : err);
    errorBox.hidden = false;
  }
  function clearError() { errorBox.hidden = true; }

  function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ } }
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  }

  async function fetchText(url) {
    if (shaderCache.has(url)) return shaderCache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Nie można wczytać ' + url + ' (' + res.status + ')');
    const text = await res.text();
    shaderCache.set(url, text);
    return text;
  }

  // --- Scenes: browsing only changes the selection; "Aktywuj" applies it ---------------------
  function selectScene(index) {
    if (!scenes.length) return;
    selected = (index + scenes.length) % scenes.length;
    select.value = String(selected);
    activateBtn.classList.toggle('pending', selected !== active);
  }

  async function activateScene(index) {
    const scene = scenes[index];
    clearError();
    try {
      const [src] = await Promise.all([fetchText(scene.shader), renderer.setImage(scene.image || null)]);
      renderer.setShader(src);
      active = index;
      store(SCENE_KEY, scene.id);
      const intensity = typeof scene.intensity === 'number' ? scene.intensity : 1;
      renderer.intensity = intensity;
      $('intensity').value = intensity;
      document.body.className = 'theme-' + (scene.theme || 'glitch');
    } catch (e) {
      showError(scene.name + ': ' + (e.message || e));
    }
    selectScene(selected);
  }

  $('btn-prev').addEventListener('click', () => selectScene(selected - 1));
  $('btn-next').addEventListener('click', () => selectScene(selected + 1));
  select.addEventListener('change', () => selectScene(parseInt(select.value, 10)));
  activateBtn.addEventListener('click', () => {
    enterFullscreen();
    activateScene(selected);
  });
  $('intensity').addEventListener('input', (e) => { renderer.intensity = parseFloat(e.target.value); });

  // --- UI visibility: tap empty screen to toggle -----------------------------------------
  let tapStart = null;
  canvas.addEventListener('pointerdown', (e) => { tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!tapStart) return;
    const moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y);
    if (moved < 12 && performance.now() - tapStart.t < 400) ui.classList.toggle('hidden');
    tapStart = null;
  });

  // --- Fullscreen + keep screen awake (on first activation) --------------------------------
  let wakeLock = null;
  async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* not allowed */ }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && wakeLock !== null) requestWakeLock(); });

  function enterFullscreen() {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
    requestWakeLock();
  }

  // --- Dice: pick a die, then a modifier, then roll -----------------------------------------
  const pickRow = $('dice-pick');
  const modRow = $('dice-mod');
  const result = $('roll-result');
  const totalEl = result.querySelector('.roll-total');
  const detailEl = result.querySelector('.roll-detail');
  let die = 20;
  let mod = 0;
  let rollTimer = null;

  pickRow.querySelectorAll('[data-die]').forEach((b) => b.addEventListener('click', () => {
    die = parseInt(b.dataset.die, 10);
    $('roll-die').textContent = 'd' + die;
    pickRow.hidden = true;
    modRow.hidden = false;
  }));
  modRow.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => {
    mod = parseInt(b.dataset.mod, 10);
    modRow.querySelectorAll('[data-mod]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  $('btn-back').addEventListener('click', () => { modRow.hidden = true; pickRow.hidden = false; });
  $('btn-roll').addEventListener('click', () => doRoll());

  function setTotal(text) {
    totalEl.textContent = text;
    totalEl.dataset.text = text;
  }

  function signed(n) { return n > 0 ? '+' + n : n < 0 ? '−' + -n : ''; }

  function doRoll() {
    const notation = '1d' + die + (mod > 0 ? '+' + mod : mod < 0 ? String(mod) : '');
    let r;
    try { r = Dice.roll(notation); } catch (e) { showError(e.message); return; }
    clearError();
    const natural = r.total - mod;

    // Flicker random values for a moment, slowing down, then settle on the result.
    clearTimeout(rollTimer);
    result.hidden = false;
    result.className = 'rolling';
    totalEl.classList.remove('crit', 'fumble');
    detailEl.textContent = 'd' + die + ' ' + signed(mod);
    const start = performance.now();
    const duration = 750;
    const tick = () => {
      const elapsed = performance.now() - start;
      if (elapsed < duration) {
        setTotal(String(Dice.rollDie(die) + mod));
        rollTimer = setTimeout(tick, 35 + 110 * (elapsed / duration) ** 2);
        return;
      }
      setTotal(String(r.total));
      totalEl.classList.toggle('crit', r.crit);
      totalEl.classList.toggle('fumble', r.fumble);
      detailEl.textContent = 'd' + die + ' [' + natural + ']' + (mod ? ' ' + signed(mod) : '');
      result.className = '';
      void result.offsetWidth; // restart animations
      result.className = 'settled fade';
      if (navigator.vibrate) navigator.vibrate(r.crit ? [40, 60, 40] : 30);
      rollTimer = setTimeout(() => { result.hidden = true; }, 3300);
    };
    tick();
  }

  // --- Boot ---------------------------------------------------------------------------------
  async function boot() {
    try {
      renderer = new Renderer(canvas, showError);
    } catch (e) { showError(e); return; }

    try {
      const res = await fetch('scenes.json');
      scenes = (await res.json()).scenes;
    } catch (e) { showError('Nie można wczytać scenes.json: ' + e.message); return; }

    select.replaceChildren(...scenes.map((s, i) => new Option(s.name, String(i))));
    const savedIndex = scenes.findIndex((s) => s.id === load(SCENE_KEY, null));
    selected = savedIndex >= 0 ? savedIndex : 0;
    activateScene(selected);
  }
  boot();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
})();
