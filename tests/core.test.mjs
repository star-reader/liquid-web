import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createEnvironment } from './helpers.mjs';

const { default: LiquidWeb } = await import(
  process.env.LIQUID_WEB_TEST_ENTRY || '../src/core/core.mjs'
);

test('preserves host animation APIs through construction and destruction', (t) => {
  const { window, createElement } = createEnvironment(t, LiquidWeb);
  const request = window.requestAnimationFrame;
  const cancel = window.cancelAnimationFrame;
  const instance = new LiquidWeb(createElement());
  assert.equal(window.requestAnimationFrame, request);
  assert.equal(window.cancelAnimationFrame, cancel);
  instance.destroy();
  assert.equal(window.requestAnimationFrame, request);
  assert.equal(window.cancelAnimationFrame, cancel);
});

test('host animation frames still receive timestamps and support cancellation', async (t) => {
  const { window, createElement } = createEnvironment(t, LiquidWeb, { fakeFrames: false });
  const instance = new LiquidWeb(createElement());
  const timestamp = await new Promise(resolve => window.requestAnimationFrame(resolve));
  assert.equal(typeof timestamp, 'number');
  let ran = false;
  const id = window.requestAnimationFrame(() => { ran = true; });
  window.cancelAnimationFrame(id);
  await new Promise(resolve => window.setTimeout(resolve, 40));
  assert.equal(ran, false);
  instance.destroy();
});

test('cancels queued updates and ignores callbacks delivered after destruction', (t) => {
  const { frames, flush, createElement } = createEnvironment(t, LiquidWeb);
  const instance = new LiquidWeb(createElement());
  flush();
  let effects = 0;
  instance.updateEffects = () => { effects++; };
  instance.update();
  const staleCallbacks = [...frames.values()];
  assert.equal(staleCallbacks.length, 1);
  instance.destroy();
  assert.equal(frames.size, 0);
  for (const callback of staleCallbacks) callback(100);
  assert.equal(effects, 0);
  instance.update();
  assert.equal(frames.size, 0);
});

test('ignores old callbacks when the same instance is initialized again', (t) => {
  const { frames, flush, createElement } = createEnvironment(t, LiquidWeb);
  const el = createElement();
  const instance = new LiquidWeb(el);
  const staleCallbacks = [...frames.values()];
  instance.destroy();
  instance.init();
  let effects = 0;
  instance.updateEffects = () => { effects++; };
  for (const callback of staleCallbacks) callback(100);
  assert.equal(effects, 0);
  flush();
  assert.equal(effects, 2);
  assert.equal(el.liquidweb, instance);
});

test('removes every owned DOM listener while preserving consumer listeners', (t) => {
  const { window, flush, createElement } = createEnvironment(t, LiquidWeb);
  const el = createElement();
  let consumerClicks = 0;
  el.addEventListener('click', () => { consumerClicks++; });
  const instance = new LiquidWeb(el);
  flush();
  const eventMethods = {
    mouseenter: 'handleMouseEnter', mouseleave: 'handleMouseLeave',
    mousedown: 'handleMouseDown', mouseup: 'handleMouseUp',
    mousemove: 'handleMouseMove', click: 'handleClick', resize: 'handleResize',
  };
  let calls = 0;
  for (const method of Object.values(eventMethods)) {
    instance[method] = () => { calls++; };
  }
  instance.destroy();
  for (const type of Object.keys(eventMethods)) {
    const target = type === 'resize' ? window : el;
    target.dispatchEvent(new window.Event(type));
  }
  assert.equal(calls, 0);
  assert.equal(consumerClicks, 1);
});

test('does not retain resize handlers after repeated mount/unmount cycles', (t) => {
  const { window, flush, createElement } = createEnvironment(t, LiquidWeb);
  let destroyedResizeCalls = 0;
  for (let i = 0; i < 25; i++) {
    const el = createElement();
    const instance = new LiquidWeb(el);
    flush();
    instance.destroy();
    instance.handleResize = () => { destroyedResizeCalls++; };
    el.remove();
  }
  window.dispatchEvent(new window.Event('resize'));
  assert.equal(destroyedResizeCalls, 0);
  assert.equal(LiquidWeb.__instances__.size, 0);
});

test('reinitialization installs exactly one set of active handlers', (t) => {
  const { window, flush, createElement } = createEnvironment(t, LiquidWeb);
  const instance = new LiquidWeb(createElement());
  flush();
  instance.destroy();
  instance.init();
  instance.attachEventListeners();
  flush();
  let resizeCalls = 0;
  instance.handleResize = () => { resizeCalls++; };
  window.dispatchEvent(new window.Event('resize'));
  assert.equal(resizeCalls, 1);
});

test('fallback scheduling stays local and can be cancelled on destruction', async (t) => {
  const { window, createElement } = createEnvironment(t, LiquidWeb, { fakeFrames: false });
  window.requestAnimationFrame = undefined;
  window.cancelAnimationFrame = undefined;
  const instance = new LiquidWeb(createElement());
  assert.equal(window.requestAnimationFrame, undefined);
  assert.equal(window.cancelAnimationFrame, undefined);
  let updates = 0;
  instance.on('afterUpdate', () => { updates++; });
  await new Promise(resolve => window.setTimeout(resolve, 40));
  assert.equal(updates, 2);
  let effects = 0;
  instance.updateEffects = () => { effects++; };
  instance.update();
  instance.destroy();
  await new Promise(resolve => window.setTimeout(resolve, 40));
  assert.equal(effects, 0);
});

test('destroy releases instance references and is safe before init and when repeated', (t) => {
  const { createElement } = createEnvironment(t, LiquidWeb);
  const el = createElement();
  const instance = new LiquidWeb(el);
  const content = instance.$content;
  instance.destroy();
  instance.destroy();
  assert.equal(el.liquidweb, undefined);
  assert.equal(content.liquidweb, undefined);
  assert.equal(el.children.length, 1);
  const deferred = new LiquidWeb(createElement(), { init: false });
  assert.doesNotThrow(() => deferred.destroy());
});

test('preserves the upstream SVG filter and effect parameters', (t) => {
  const { flush, createElement } = createEnvironment(t, LiquidWeb);
  const instance = new LiquidWeb(createElement(), {
    scale: 34, blur: 3, saturation: 145, aberration: 64,
  });
  flush();
  const svg = instance.$svg.outerHTML.replaceAll(instance.filterId, 'FILTER_ID');
  // Captured from unmodified upstream adfe361 before the lifecycle fixes.
  assert.equal(createHash('sha256').update(svg).digest('hex'),
    'ef4a9ff5aa1dfa1779c549dc22a046d137a9efba2716af57a39224e356ae4928');
  assert.equal(instance.$backdrop.style.backdropFilter, 'blur(3px) saturate(145%)');
  assert.equal(instance.$backdrop.style.filter, `url(#${instance.filterId})`);
});
