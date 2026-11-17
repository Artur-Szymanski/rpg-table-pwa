(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('stage');
  const ui = $('ui');
  const select = $('scene-select');
  const errorBox = $('error');
  const HISTORY_KEY = 'rpg-table.dice-history';
  const SCENE_KEY = 'rpg-table.scene';

  let renderer;
  let scenes = [];
  let current = 0;
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

  async function showScene(index) {
    if (!scenes.length) return;
    current = (index + scenes.length) % scenes.length;
    const scene = scenes[current];
    select.value = String(current);
    store(SCENE_KEY, scene.id);
    clearError();
    try {
      const [src] = await Promise.all([fetchText(scene.shader), renderer.setImage(scene.image || null)]);
      renderer.setShader(src);
      if (typeof scene.intensity === 'number') {
        renderer.intensity = scene.intensity;
        $('intensity').value = scene.intensity;
      }
    } catch (e) {
      showError(scene.name + ': ' + (e.message || e));
    }
  }

  // --- UI visibility: tap empty screen to toggle -----------------------------------------
  let tapStart = null;
  canvas.addEventListener('pointerdown', (e) => { tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!tapStart) return;
    const moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y);
    if (moved < 12 && performance.now() - tapStart.t < 400) ui.classList.toggle('hidden');
    tapStart = null;
  });

  // Swipe left / right on the canvas switches scenes.
  let swipe = null;
  canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; swipe = { x: t.clientX, y: t.clientY }; }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!swipe) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipe.x;
    const dy = t.clientY - swipe.y;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) showScene(current + (dx < 0 ? 1 : -1));
    swipe = null;
  });

  $('btn-prev').addEventListener('click', () => showScene(current - 1));
  $('btn-next').addEventListener('click', () => showScene(current + 1));
  select.addEventListener('change', () => showScene(parseInt(select.value, 10)));
  $('intensity').addEventListener('input', (e) => { renderer.intensity = parseFloat(e.target.value); });

  // --- Fullscreen + keep screen awake -------------------------------------------------------
  let wakeLock = null;
  async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* not allowed */ }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && wakeLock !== null) requestWakeLock(); });

  $('btn-fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('any').catch(() => {});
      }
    } catch (e) { /* fullscreen not available */ }
    requestWakeLock();
  });

  // --- Dice ---------------------------------------------------------------------------------
  const history = load(HISTORY_KEY, []);
  const historyList = $('dice-history');
  const result = $('roll-result');

  function renderHistory() {
    historyList.replaceChildren(...history.slice(0, 30).map((r) => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.textContent = r.input + ': ' + r.detail;
      const right = document.createElement('b');
      right.textContent = r.total;
      li.append(left, right);
      return li;
    }));
  }

  function doRoll(notation) {
    let r;
    try { r = Dice.roll(notation); } catch (e) { showError(e.message); return; }
    clearError();
    history.unshift({ input: r.input, total: r.total, detail: r.detail.replace(/~/g, '') });
    history.length = Math.min(history.length, 100);
    store(HISTORY_KEY, history);
    renderHistory();

    const total = result.querySelector('.roll-total');
    total.textContent = r.total;
    total.classList.toggle('crit', r.crit);
    total.classList.toggle('fumble', r.fumble);
    result.querySelector('.roll-detail').textContent = r.input + ' → ' + r.detail.replace(/~(\d+)~/g, '($1)');
    result.hidden = false;
    result.classList.remove('show');
    void result.offsetWidth; // restart animation
    result.classList.add('show');
    if (navigator.vibrate) navigator.vibrate(r.crit ? [40, 60, 40] : 30);
  }

  document.querySelectorAll('[data-roll]').forEach((b) => b.addEventListener('click', () => doRoll(b.dataset.roll)));
  $('dice-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('dice-input').value.trim();
    if (v) doRoll(v);
  });
  renderHistory();

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
    const savedId = load(SCENE_KEY, null);
    const savedIndex = scenes.findIndex((s) => s.id === savedId);
    showScene(savedIndex >= 0 ? savedIndex : 0);
  }
  boot();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
})();
