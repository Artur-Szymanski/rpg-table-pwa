(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('stage');
  const ui = $('ui');
  const select = $('scene-select');
  const errorBox = $('error');
  const activateBtn = $('btn-activate');
  const SCENE_KEY = 'rpg-table.scene';
  const INTENSITY_KEY = 'rpg-table.intensity'; // { sceneId: value }
  const savedIntensity = load(INTENSITY_KEY, {});

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
  // The picker shows either effects (scenes without an image) or photos (scenes with an image).
  // The mode button names the other list, so effects are always one tap away.
  const modeBtn = $('btn-mode');
  let mode = 'effects';
  const isPhoto = (s) => !!s.image;
  const inMode = (i) => (mode === 'photos') === isPhoto(scenes[i]);
  let list = []; // scene indices in the current mode

  function setMode(next) {
    mode = next;
    list = scenes.map((_, i) => i).filter(inMode);
    select.replaceChildren(...list.map((i) => new Option(scenes[i].name, String(i))));
    select.disabled = !list.length;
    modeBtn.textContent = mode === 'photos' ? 'Effects' : 'Photos';
    if (list.length) selectScene(list.includes(active) ? active : list[0]);
  }

  function selectScene(index) {
    if (!list.length) return;
    selected = index;
    select.value = String(selected);
    activateBtn.classList.toggle('pending', selected !== active);
  }
  function stepScene(dir) {
    if (!list.length) return;
    const pos = list.indexOf(selected);
    selectScene(list[(pos + dir + list.length) % list.length]);
  }

  async function activateScene(index) {
    const scene = scenes[index];
    clearError();
    try {
      const [src] = await Promise.all([fetchText(scene.shader), renderer.setImage(scene.image || null)]);
      renderer.setShader(src);
      renderer.setPost(scene);
      if (index !== active) hideResult();
      active = index;
      store(SCENE_KEY, scene.id);
      const intensity = typeof savedIntensity[scene.id] === 'number' ? savedIntensity[scene.id]
        : typeof scene.intensity === 'number' ? scene.intensity : 1;
      renderer.intensity = intensity;
      $('intensity').value = intensity;
      document.body.className = 'theme-' + (scene.theme || 'glitch');
      updateLampLight();
    } catch (e) {
      showError(scene.name + ': ' + (e.message || e));
    }
    selectScene(selected);
  }

  $('btn-prev').addEventListener('click', () => stepScene(-1));
  $('btn-next').addEventListener('click', () => stepScene(1));
  modeBtn.addEventListener('click', () => setMode(mode === 'photos' ? 'effects' : 'photos'));
  select.addEventListener('change', () => selectScene(parseInt(select.value, 10)));
  activateBtn.addEventListener('click', () => {
    if (!list.length) return;
    enterFullscreen();
    activateScene(selected);
  });
  // Light colour of the Lamp scene (same black-body curve as shaders/lamp.frag), used for the
  // bright rim around the dark result digits.
  function lampLight(I) {
    const k = I < 1 ? 1200 + 1500 * I : 2700 + 3800 * (I - 1);
    const t = k / 100;
    const cl = (v) => Math.min(1, Math.max(0, v));
    const r = t <= 66 ? 1 : cl(1.292936 * Math.pow(t - 60, -0.1332047592));
    const g = t <= 66 ? cl(0.3900815788 * Math.log(t) - 0.6318414438) : cl(1.129890861 * Math.pow(t - 60, -0.0755148492));
    const b = t >= 66 ? 1 : t <= 19 ? 0 : cl(0.5432067891 * Math.log(t - 10) - 1.1962540891);
    const tone = (c) => Math.round(255 * (1 - Math.exp(-c * 2.6))); // like the bright centre of the panel
    return 'rgb(' + tone(r) + ',' + tone(g) + ',' + tone(b) + ')';
  }
  function updateLampLight() {
    document.body.style.setProperty('--lamp-light', lampLight(renderer.intensity));
  }

  $('intensity').addEventListener('input', (e) => {
    renderer.intensity = parseFloat(e.target.value);
    updateLampLight();
    if (active < 0) return;
    savedIntensity[scenes[active].id] = renderer.intensity;
    store(INTENSITY_KEY, savedIntensity);
  });

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
  $('btn-back').addEventListener('click', () => { hideResult(); modRow.hidden = true; pickRow.hidden = false; });

  // The result stays on screen until "Cofnij", the next roll, or activating another scene.
  function hideResult() {
    clearTimeout(rollTimer);
    result.hidden = true;
    result.className = '';
  }
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
    totalEl.classList.remove('crit', 'fumble', 'word');
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
      // Natural 20 / natural 1 on a d20 show a word instead of the number.
      const word = die === 20 ? (natural === 20 ? 'CRIT!' : natural === 1 ? 'FAIL!' : '') : '';
      setTotal(word || String(r.total));
      totalEl.classList.toggle('crit', r.crit);
      totalEl.classList.toggle('fumble', r.fumble);
      totalEl.classList.toggle('word', !!word);
      detailEl.textContent = 'd' + die + ' [' + natural + ']' + (mod ? ' ' + signed(mod) + ' = ' + r.total : '');
      result.className = '';
      void result.offsetWidth; // restart animations
      result.className = 'settled';
      if (navigator.vibrate) navigator.vibrate(r.crit ? [40, 60, 40] : 30);
    };
    tick();
  }

  // Keep the roll breakdown just above the bottom bar, whatever its height.
  const footer = $('dice');
  const syncBarHeight = () => document.body.style.setProperty('--bottom-bar-h', footer.offsetHeight + 'px');
  if ('ResizeObserver' in window) new ResizeObserver(syncBarHeight).observe(footer);
  syncBarHeight();

  // --- Boot ---------------------------------------------------------------------------------
  async function boot() {
    try {
      renderer = new Renderer(canvas, showError);
    } catch (e) { showError(e); return; }

    try {
      const res = await fetch('scenes.json');
      scenes = (await res.json()).scenes;
    } catch (e) { showError('Nie można wczytać scenes.json: ' + e.message); return; }

    // Load bundled fonts up front so the first roll already uses them.
    if (document.fonts) ['Share Tech Mono', 'Tilt Neon', 'Orbitron'].forEach((f) => document.fonts.load('700 40px "' + f + '"', '0123456789').catch(() => {}));

    const savedIndex = scenes.findIndex((s) => s.id === load(SCENE_KEY, null));
    const start = savedIndex >= 0 ? savedIndex : 0;
    setMode(isPhoto(scenes[start]) ? 'photos' : 'effects');
    selectScene(start);
    activateScene(start);
  }
  boot();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
})();
