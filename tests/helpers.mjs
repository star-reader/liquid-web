import { JSDOM } from 'jsdom';

export function createEnvironment(t, LiquidWeb, { fakeFrames = true } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  for (const key of ['window', 'document', 'Element', 'MutationObserver', 'navigator']) {
    const value = key === 'window' ? window : window[key];
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  LiquidWeb.__instances__.clear();
  LiquidWeb.__stylesInjected__ = false;
  LiquidWeb.__styleElement__ = null;

  let nextId = 1;
  const frames = new Map();
  if (fakeFrames) {
    window.requestAnimationFrame = (callback) => {
      const id = nextId++;
      frames.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id) => frames.delete(id);
  }
  const flush = () => {
    for (const [id, callback] of [...frames]) {
      if (!frames.delete(id)) continue;
      callback(window.performance.now());
    }
  };
  const createElement = () => {
    const el = window.document.createElement('div');
    el.innerHTML = '<div style="border-radius:20px">Glass</div>';
    window.document.body.appendChild(el);
    return el;
  };
  t.after(() => {
    for (const instance of [...LiquidWeb.__instances__.values()]) {
      try { instance.destroy(); } catch { /* Preserve the original test failure. */ }
    }
    dom.window.close();
  });
  return { window, frames, flush, createElement };
}
