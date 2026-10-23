import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createEnvironment } from './helpers.mjs';

for (const entry of ['../dist/liquid-core.mjs', '../dist/core/core.mjs']) {
  test(`published ESM entry ${entry} preserves scheduling and cleans up listeners`, async (t) => {
    const { default: LiquidWeb } = await import(entry);
    const { window, frames, flush, createElement } = createEnvironment(t, LiquidWeb);
    const request = window.requestAnimationFrame;
    const instance = new LiquidWeb(createElement());
    assert.equal(window.requestAnimationFrame, request);
    flush();
    instance.update();
    instance.destroy();
    assert.equal(frames.size, 0);
    let calls = 0;
    instance.handleResize = () => { calls++; };
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(calls, 0);
  });
}

for (const entry of ['liquid-core.js', 'liquid-core.min.js']) {
  test(`published browser bundle ${entry} preserves scheduling and cleans up listeners`, async (t) => {
    const dom = new JSDOM('<!doctype html><html><head></head><body><div id="glass"><div>Glass</div></div></body></html>', {
      pretendToBeVisual: true, runScripts: 'outside-only',
    });
    t.after(() => dom.window.close());
    const { window } = dom;
    const request = window.requestAnimationFrame;
    window.eval(await readFile(new URL(`../dist/${entry}`, import.meta.url), 'utf8'));
    const instance = new window.LiquidWeb(window.document.getElementById('glass'));
    assert.equal(window.requestAnimationFrame, request);
    instance.destroy();
    let calls = 0;
    instance.handleResize = () => { calls++; };
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(calls, 0);
  });
}

test('published metadata exposes existing ESM, React, Vue and type entry points', async () => {
  const pkg = JSON.parse(await readFile(new URL('../dist/package.json', import.meta.url), 'utf8'));
  for (const entry of Object.values(pkg.exports)) {
    await readFile(new URL(`../dist/${entry.import}`, import.meta.url));
    await readFile(new URL(`../dist/${entry.types}`, import.meta.url));
  }
  const react = await readFile(new URL('../dist/react/components/LiquidWeb.mjs', import.meta.url), 'utf8');
  const vue = await readFile(new URL('../dist/vue/components/LiquidWeb.mjs', import.meta.url), 'utf8');
  assert.match(react, /core\/core\.mjs/);
  assert.match(vue, /core\/core\.mjs/);
});
