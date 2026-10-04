import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { sceneState, scrollProgress, clamp } from '../src/story.js';

// Execute the production controller, substituting only its renderer import.
// The real story functions remain under test; no browser or WebGL is required.
const source = (await readFile(new URL('../src/main.js', import.meta.url), 'utf8'))
  .replace(/^import .+ from ['"].+['"];\r?\n/gm, '');

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn, options = {}) {
    if (options.signal?.aborted) return;
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(fn); this.listeners.set(type, listeners);
    options.signal?.addEventListener('abort', () => listeners.delete(fn), { once: true });
  }
  dispatch(type, properties = {}) {
    const event = { type, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...properties };
    for (const fn of [...(this.listeners.get(type) || [])]) fn(event);
    return event;
  }
}

class Element extends Target {
  constructor(parent = null) {
    super(); this.parent = parent; this.dataset = {}; this.attributes = new Map();
    this.textContent = ''; this.hidden = false;
    this.style = { setProperty(name, value) { this[name] = value; } };
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle(name, force) {
        const on = force === undefined ? !classes.has(name) : force;
        if (on) classes.add(name); else classes.delete(name);
        return on;
      },
    };
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  contains(element) {
    for (let current = element; current; current = current.parent) if (current === this) return true;
    return false;
  }
}

function harness({ reduced = false, stored = null, storageBlocked = false,
  createFails = false, deferredScene = false, width = 1280 } = {}) {
  const document = new Target(), window = new Target(), media = new Target();
  document.hidden = false; document.body = new Element();
  document.documentElement = new Element(); document.documentElement.clientWidth = width;
  document.activeElement = document.body;
  media.matches = reduced;
  const world = new Element(), canvas = new Element(), controls = new Element();
  controls.hidden = true;
  const button = new Element(), label = new Element(), icon = new Element();
  button.querySelector = selector => selector === '.motion-label' ? label : icon;
  const copies = Array.from({ length: 4 }, () => new Element());
  const links = copies.map(copy => new Element(copy));
  const sceneLabels = copies.map(() => new Element());
  const chapterLinks = copies.map(() => new Element());
  const frames = new Map(), renders = [], warnings = [], errors = [], writes = [];
  let nextFrame = 1, clock = 0, disposed = 0, builds = 0, resolveScene;
  const pendingScene = deferredScene ? new Promise(resolve => { resolveScene = resolve; }) : null;
  const renderer = {
    resize() {}, dispose() { disposed++; },
    render(state, time, pointer) { renders.push({ state: { ...state }, time, pointer: { ...pointer } }); },
  };
  const context = {
    document, window, innerWidth: width, innerHeight: 800, scrollY: 0,
    AbortController, sceneState, scrollProgress, clamp,
    console: { warn: (...args) => warnings.push(args) },
    matchMedia: () => media,
    requestAnimationFrame(fn) { const id = nextFrame++; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    createScene() {
      builds++;
      if (createFails) throw new Error('WebGL unavailable');
      return pendingScene || renderer;
    },
    localStorage: {
      getItem() { if (storageBlocked) throw new Error('Storage denied'); return stored; },
      setItem(key, value) {
        if (storageBlocked) throw new Error('Storage denied');
        stored = value; writes.push([key, value]);
      },
    },
  };
  const chapters = copies.map((copy, index) => ({
    querySelector: selector => selector === '.chapter-copy' ? copy : sceneLabels[index],
    getBoundingClientRect: () => ({ top: index * 1000 - context.scrollY }),
  }));
  const apps = { getBoundingClientRect: () => ({ top: 4000 - context.scrollY }) };
  const selectors = { '#world': world, '#scene': canvas, '.experience-controls': controls,
    '.motion-control': button, '#apps': apps };
  document.querySelector = selector => selectors[selector];
  document.querySelectorAll = selector => selector === '[data-scene]' ? chapters : chapterLinks;
  vm.runInNewContext(source, context, { filename: 'src/main.js' });

  async function microtasks() { await Promise.resolve(); await Promise.resolve(); }
  async function frame(milliseconds = 20) {
    clock += milliseconds;
    // Snapshot: callbacks scheduled by this frame execute on the next frame.
    for (const id of [...frames.keys()]) {
      const callback = frames.get(id);
      if (!callback) continue;
      frames.delete(id);
      const result = callback(clock);
      result?.catch(error => errors.push(error));
      await microtasks();
    }
    assert.deepEqual(errors, [], 'No unhandled async controller errors');
  }
  return {
    document, window, media, world, canvas, controls, button, label, copies, links,
    sceneLabels, chapterLinks, frames, renders, warnings, writes, frame, microtasks,
    get disposed() { return disposed; }, get builds() { return builds; },
    last: () => renders.at(-1),
    scroll(y) { context.scrollY = y; window.dispatch('scroll'); },
    toggle() { button.dispatch('click'); },
    reduce(value) { media.matches = value; media.dispatch('change'); },
    hide(value) { document.hidden = value; document.dispatch('visibilitychange'); },
    focus(element) { document.activeElement = element; document.dispatch('focusin'); },
    blur() { document.activeElement = document.body; document.dispatch('focusout'); },
    resolveScene: () => resolveScene(renderer),
  };
}

test('Pause freezes time and pointer motion; resume restarts exactly one animation loop', async () => {
  const h = harness(); await h.frame(); await h.frame();
  assert.equal(h.world.dataset.renderer, 'webgl');
  assert.equal(h.controls.hidden, false); assert.equal(h.frames.size, 1);
  const initialTime = h.last().time;
  h.toggle(); await h.frame();
  assert.equal(h.button.getAttribute('aria-pressed'), 'true');
  assert.equal(h.label.textContent, 'Activar movimiento');
  assert.ok(h.document.documentElement.classList.contains('motion-paused'));
  assert.equal(h.frames.size, 0);
  const pausedTime = h.last().time;
  h.scroll(1100); await h.frame(); const firstSnapshot = h.last();
  h.scroll(1400); await h.frame();
  assert.equal(h.last().state.p, 1, 'Scroll inside a paused chapter does not interpolate geometry');
  assert.deepEqual(h.last().state, firstSnapshot.state);
  assert.equal(h.last().time, pausedTime);
  assert.deepEqual(h.last().pointer, { x: 0, y: 0 });
  assert.equal(h.frames.size, 0);
  h.toggle(); await h.frame(); await h.frame();
  assert.equal(h.button.getAttribute('aria-pressed'), 'false');
  assert.ok(h.last().time > initialTime); assert.equal(h.frames.size, 1);
  assert.deepEqual(h.writes, [['angeldlo-motion', 'paused'], ['angeldlo-motion', 'active']]);
});

test('Reduced motion starts paused and follows system changes until an explicit choice', async () => {
  const h = harness({ reduced: true }); await h.frame();
  assert.equal(h.button.getAttribute('aria-pressed'), 'true'); assert.equal(h.frames.size, 0);
  h.scroll(1200); await h.frame(); const snapshot = h.last();
  h.scroll(1450); await h.frame();
  assert.deepEqual(h.last(), snapshot, 'Reduced motion uses an unchanged chapter snapshot');
  h.reduce(false); await h.frame(); assert.equal(h.frames.size, 1);
  h.reduce(true); await h.frame(); assert.equal(h.frames.size, 0);
  h.toggle(); await h.frame();
  h.reduce(false); h.reduce(true); await h.frame();
  assert.equal(h.button.getAttribute('aria-pressed'), 'false', 'Explicit opt-in survives OS changes');
});

test('Stored choices survive reload and override the current system preference', async () => {
  const paused = harness({ stored: 'paused', reduced: false }); await paused.frame();
  assert.equal(paused.frames.size, 0); assert.equal(paused.button.getAttribute('aria-pressed'), 'true');
  paused.reduce(true); paused.reduce(false); await paused.frame();
  assert.equal(paused.button.getAttribute('aria-pressed'), 'true');
  paused.toggle(); await paused.frame();
  const saved = paused.writes.at(-1)[1];
  const reload = harness({ stored: saved, reduced: true }); await reload.frame();
  assert.equal(reload.button.getAttribute('aria-pressed'), 'false'); assert.equal(reload.frames.size, 1);
});

test('Denied storage does not prevent pausing, resuming, or preserving the in-memory choice', async () => {
  const h = harness({ storageBlocked: true }); await h.frame();
  h.toggle(); await h.frame(); assert.equal(h.frames.size, 0);
  h.reduce(true); h.reduce(false); await h.frame();
  assert.equal(h.button.getAttribute('aria-pressed'), 'true');
  h.toggle(); await h.frame(); assert.equal(h.frames.size, 1);
  assert.equal(h.button.getAttribute('aria-pressed'), 'false');
});

test('Renderer creation failure is terminal and leaves every chapter readable', async () => {
  const h = harness({ createFails: true }); h.scroll(900); await h.frame();
  assert.equal(h.world.dataset.renderer, 'fallback'); assert.equal(h.controls.hidden, true);
  assert.equal(h.warnings.length, 1); assert.equal(h.frames.size, 0);
  for (const copy of h.copies) {
    assert.equal(copy.style.opacity, '1'); assert.equal(copy.style.transform, 'none');
  }
  h.scroll(2200); h.window.dispatch('resize'); h.focus(h.links[0]);
  h.reduce(true); h.reduce(false); h.hide(true); h.hide(false);
  await h.frame();
  assert.equal(h.frames.size, 0); assert.equal(h.builds, 1); assert.equal(h.renders.length, 0);
  assert.ok(h.sceneLabels.every(label => label.style.opacity === '1'));
});

test('Losing a WebGL context disposes once and never restarts its animation loop', async () => {
  const h = harness(); await h.frame();
  const event = h.canvas.dispatch('webglcontextlost');
  assert.equal(event.defaultPrevented, true); assert.equal(h.disposed, 1);
  assert.equal(h.controls.hidden, true); assert.equal(h.frames.size, 0);
  const count = h.renders.length;
  h.canvas.dispatch('webglcontextlost'); h.scroll(1500); h.hide(true); h.hide(false);
  await h.frame();
  assert.equal(h.disposed, 1); assert.equal(h.renders.length, count); assert.equal(h.frames.size, 0);
});

test('Hidden tabs stop drawing, and visibility restoration respects the paused state', async () => {
  const h = harness(); await h.frame();
  h.hide(true); const count = h.renders.length;
  h.scroll(1700); h.window.dispatch('resize'); await h.frame(10000);
  assert.equal(h.frames.size, 0); assert.equal(h.renders.length, count);
  h.hide(false); await h.frame(); assert.equal(h.frames.size, 1);
  assert.ok(h.last().time < 1, 'Background time does not cause an animation jump');
  h.toggle(); await h.frame(); h.hide(true); h.hide(false); await h.frame();
  assert.equal(h.frames.size, 0); assert.equal(h.button.getAttribute('aria-pressed'), 'true');
});

test('Keyboard focus restores faded chapter content and focusout restores the intended scene', async () => {
  const h = harness({ stored: 'paused' }); await h.frame();
  h.scroll(900); await h.frame(); assert.equal(h.copies[0].style.opacity, '0');
  h.focus(h.links[0]); await h.frame();
  assert.equal(h.copies[0].style.opacity, '1'); assert.equal(h.sceneLabels[0].style.opacity, '1');
  h.blur(); await h.frame(); assert.equal(h.copies[0].style.opacity, '0');
  assert.equal(h.frames.size, 0);
});

test('Leaving the story stops drawing; returning restores the active scene', async () => {
  const h = harness(); await h.frame(); const count = h.renders.length;
  h.scroll(4000); await h.frame();
  assert.equal(h.document.body.dataset.outside, 'true');
  assert.equal(h.world.style.opacity, '0'); assert.equal(h.frames.size, 0);
  assert.equal(h.renders.length, count);
  h.scroll(1500); await h.frame();
  assert.equal(h.document.body.dataset.outside, 'false');
  assert.ok(h.renders.length > count); assert.equal(h.frames.size, 1);
});

test('Back-forward cache resumes safely; final page disposal removes listeners and RAF', async () => {
  const h = harness(); await h.frame();
  h.window.dispatch('pagehide', { persisted: true });
  assert.equal(h.frames.size, 0); assert.equal(h.disposed, 0);
  h.window.dispatch('pageshow', { persisted: true }); await h.frame(); assert.equal(h.frames.size, 1);
  h.window.dispatch('pagehide', { persisted: false });
  assert.equal(h.disposed, 1); assert.equal(h.frames.size, 0);
  h.scroll(1900); h.toggle(); h.hide(false); await h.frame();
  assert.equal(h.frames.size, 0); assert.equal(h.disposed, 1);
});

test('A renderer that finishes loading after navigation is disposed without rendering', async () => {
  const h = harness({ deferredScene: true }); await h.frame();
  h.window.dispatch('pagehide', { persisted: false });
  h.resolveScene(); await h.microtasks();
  assert.equal(h.disposed, 1); assert.equal(h.renders.length, 0);
  assert.equal(h.frames.size, 0); assert.equal(h.controls.hidden, true);
});

test('Mobile rendering is capped while scroll still reaches its requested chapter', async () => {
  const h = harness({ width: 390 }); await h.frame(16);
  const initial = h.renders.length;
  await h.frame(16); assert.equal(h.renders.length, initial, 'Skip frames above the mobile 30 FPS cap');
  await h.frame(18); assert.equal(h.renders.length, initial + 1);
  h.scroll(2000);
  for (let i = 0; i < 45; i++) await h.frame(34);
  assert.ok(Math.abs(h.last().state.p - 2) < .001);
  assert.equal(h.document.body.dataset.chapter, '2');
});
