import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoryController } from './controller.js';
import { mountPanel } from './webui.js';
import client from './webui.js';
import { validateImageBytes, MAX_IMAGE_BYTES } from './resources.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const copy = (value) => structuredClone(value);
function snapshot() {
  return {
    ok: true, startStamp: 'start-0',
    catalog: [{ id: 'letter', title: '自建溪边故事', description: '在旧木桥边，遇见一封信。', placeId: 'creek', placeName: '傍晚溪边', placeDescription: '溪水绕过旧桥。', style: '柔和水彩', revision: 'r1', available: true }],
    trip: { id: 'trip-1', title: '溪边的漂流信', placeName: '傍晚溪边', placeId: 'creek', area: '旧木桥', state: 'active', packId: 'letter', revision: 'r1', stamp: 'stamp-1', step: 'choose', complete: false,
      pending: { id: 'choice-1', event: '发现漂流信', prompt: '接下来，想去哪里？', options: [{ id: 'follow', label: '沿溪寻找' }, { id: 'keep', label: '先把信收好' }] }, events: ['桥边有一封旧信。'], choices: [], timeline: [{ kind: 'event', text: '桥边有一封旧信。', area: '旧木桥' }] },
    memories: [], autonomy: { available: true, enabled: false, remaining: 8, token: 'token-0' }, autoplay: false,
  };
}
class TinyElement extends EventTarget {
  constructor(tag, doc) { super(); this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.childNodes = []; this.attributes = new Map(); this.disabled = false; this.open = false; this.checked = false; this._text = ''; this._value = ''; this.className = ''; this.parentNode = null; this.classList = { add: (...names) => { this.className = [...new Set((this.className + ' ' + names.join(' ')).trim().split(/\s+/))].join(' '); } }; }
  get value() { if (this.tagName === 'SELECT') { const options = this.querySelectorAll('option'); return (options.find((option) => option.selected) ?? (this._noSelection ? null : options[0]))?.value ?? ''; } return this._value; }
  set value(value) { this._value = String(value); if (this.tagName === 'SELECT') { const options = this.querySelectorAll('option'); for (const option of options) option.selected = option.value === this._value; this._noSelection = !options.some((option) => option.selected); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'class') this.className = String(value); if (name === 'value') this.value = value; }
  scrollIntoView(options) { this.lastScroll = options; }
  getAttribute(name) { return name === 'class' ? this.className : this.attributes.get(name) ?? null; }
  get textContent() { return this._text + this.childNodes.map((child) => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.childNodes = []; }
  // 没有真实排版：滚动量由测试统一给，用来验证「重建 DOM 后回到原位」。
  get scrollHeight() { return TinyElement.metrics.scrollHeight; }
  get clientHeight() { return TinyElement.metrics.clientHeight; }
  set innerHTML(value) { this._html = value; }
  appendChild(child) { if (child.parentNode) child.remove(); this.childNodes.push(child); child.parentNode = this; return child; }
  append(...children) { for (const child of children) this.appendChild(typeof child === 'string' ? this.ownerDocument.createTextNode(child) : child); }
  replaceChildren(...children) { for (const child of this.childNodes) child.parentNode = null; this.childNodes = []; this._text = ''; this.append(...children); }
  remove() { if (this.parentNode) { const siblings = this.parentNode.childNodes; siblings.splice(siblings.indexOf(this), 1); this.parentNode = null; } }
  contains(element) { return this === element || this.childNodes.some((child) => child.contains?.(element)); }
  focus() { this.ownerDocument.activeElement = this; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  matches(selector) {
    const match = /^([a-z]+)?(?:\.([\w-]+))?(?:\[([\w-]+)(?:="?([^\]"]+)"?)?\])?$/i.exec(selector);
    if (!match) return false;
    return (!match[1] || this.tagName === match[1].toUpperCase()) && (!match[2] || this.className.split(/\s+/).includes(match[2]))
      && (!match[3] || this.attributes.has(match[3]) && (match[4] === undefined || this.attributes.get(match[3]) === match[4]));
  }
  querySelectorAll(selector) { const result = []; for (const child of this.childNodes) { if (child.matches?.(selector)) result.push(child); if (child.querySelectorAll) result.push(...child.querySelectorAll(selector)); } return result; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}
TinyElement.metrics = { scrollHeight: 0, clientHeight: 0 };
class TinyDocument extends EventTarget {  constructor() { super(); this.visibilityState = 'visible'; this.activeElement = null; }
  createElement(tag) { return new TinyElement(tag, this); }
  createElementNS(_ns, tag) { return this.createElement(tag); }
  createTextNode(value) { const element = new TinyElement('#text', this); element.textContent = value; return element; }
}
function environment() { return { document: new TinyDocument(), window: new EventTarget(), pacingMs: 0 }; }
function harness(handler, initial = snapshot()) {
  const env = environment();
  const aborter = new AbortController();
  const calls = [];
  const current = copy(initial);
  const ctx = { signal: aborter.signal, storyCall: async (method, payload, options) => {
    calls.push({ method, payload: copy(payload), options });
    if (handler) { const result = await handler(method, payload, current); if (result !== undefined) return result; }
    if (method === 'mode') { current.autonomy.enabled = payload.enabled; current.autonomy.token = payload.enabled ? 'token-on' : 'token-off'; current.autoplay = payload.enabled; }
    if (method === 'pause') { current.autonomy.enabled = false; current.autonomy.token = 'token-paused'; }
    return copy(current);
  } };
  return { ctx, calls, current, env, aborter };
}

// A tiny DOM checks actual mountPanel interactions without introducing a package.
// It deliberately does not pretend to validate real browser layout or rendering.
test('native bundle exposes only its own story panel', () => {
  assert.deepEqual(Object.keys(client.panels), ['story']);
  assert.equal(typeof client.panels.story.mount, 'function');
});
test('manual first mount reads status, renders real choices, stores no progress', async () => {
  const h = harness();
  globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const stored = [];
  h.ctx.memo = { get: (_key, fallback) => fallback, set: (...args) => stored.push(args) };
  const mounted = mountPanel(root, h.ctx); await flush();
  assert.match(root.textContent, /故事工坊/);
  assert.equal(h.calls[0].method, 'status'); assert.equal(h.calls.length, 1);
  root.querySelector('[data-focus="nav-play"]').click();
  assert.match(root.textContent, /接下来，想去哪里/);
  assert.equal(root.querySelector('[data-focus="option-follow"]').disabled, false);
  assert.equal(root.querySelector('[data-focus="trip-mode"]').getAttribute('aria-checked'), 'false');
  assert.deepEqual(stored, []);
  mounted.dispose();
  assert.equal(root.childNodes.length, 0);
});
test('a delayed decide is invalidated immediately by mode off; manual can take over', async () => {
  const decision = deferred();
  const h = harness(async (method, payload, current) => {
    if (method === 'decide') return decision.promise;
    if (method === 'choose') { current.trip.stamp = 'stamp-2'; current.trip.pending = null; current.trip.step = 'move'; return copy(current); }
  });
  const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  await controller.setMode(true); await flush();
  const oldDecision = { ...copy(h.current), ticket: 'late-ticket', reason: '沿着溪边看看。' };
  await controller.setMode(false);
  await controller.mutate('choose', { choiceId: 'choice-1', optionId: 'keep' });
  assert.equal(h.calls.filter((call) => call.method === 'choose').length, 1, 'manual takeover should not wait for the stale model');
  decision.resolve(oldDecision); await flush();
  assert.equal(h.calls.filter((call) => call.method === 'auto').length, 0);
  assert.equal(controller.state.snapshot.trip.stamp, 'stamp-2');
  controller.dispose();
});
test('decide snapshot with a changed stamp never reaches auto', async () => {
  const h = harness((method, _payload, current) => method === 'decide'
    ? { ...copy(current), trip: { ...copy(current.trip), stamp: 'other-window' }, ticket: 'wrong-stamp' } : undefined);
  const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  await controller.setMode(true); await flush();
  assert.equal(h.calls.some((call) => call.method === 'auto'), false);
  assert.match(controller.state.error, /实际进度或游玩模式已改变/);
  assert.ok(h.calls.filter((call) => call.method === 'status').length >= 2);
  controller.dispose();
});
// 服务端会把共同决定的视图算好放在 trip.joint（见 src/joint.js）；这里只仿一份给面板用。
function jointPayload(votes = {}) {
  const label = (id) => ({ follow: '沿溪寻找', keep: '先把信收好' })[id] ?? '';
  const stage = votes.owner && votes.fish ? (votes.owner === votes.fish ? 'agreed' : 'disagree')
    : votes.owner ? 'waiting-fish' : votes.fish ? 'waiting-owner' : 'empty';
  const headline = { empty: '两席各选一项', 'waiting-fish': '现在轮到鱼', 'waiting-owner': '现在轮到你了', disagree: '两边票不一样', agreed: '两票一致' }[stage];
  return {
    stage, seat: stage === 'waiting-fish' ? 'fish' : 'owner', resolution: 'require-agreement', votes: { ...votes },
    canVote: { owner: stage === 'empty' || stage === 'waiting-owner' || stage === 'disagree', fish: stage === 'empty' || stage === 'waiting-fish' || stage === 'disagree' },
    seats: [
      { seat: 'owner', name: '你这一席', voted: Boolean(votes.owner), optionId: votes.owner ?? null, label: label(votes.owner) },
      { seat: 'fish', name: '鱼那一席', voted: Boolean(votes.fish), optionId: votes.fish ?? null, label: label(votes.fish) },
    ],
    headline, hint: '两席各投一票，同票才出发：谁先投都行；两票一致才前进。', note: '共同决定：等待与超时都不算同意。',
    resolutionNote: '双方必须明确同意；分歧保持待定',
    seatsText: `你${votes.owner ? `已选「${label(votes.owner)}」` : '还没投'}，鱼${votes.fish ? `已选「${label(votes.fish)}」` : '还没投'}`,
  };
}
test('共同决定：用户投完票后，面板说清轮到鱼、并摆出两席的票', async () => {
  const initial = snapshot();
  initial.trip.actor = 'fish';
  initial.trip.pending = { id: 'choice-joint', event: '两处都可以去', prompt: '两席各自明确选一项。', actor: 'joint', jointResolution: 'require-agreement',
    votes: { owner: 'follow' }, options: [{ id: 'follow', label: '沿溪寻找' }, { id: 'keep', label: '先把信收好' }] };
  initial.trip.joint = jointPayload({ owner: 'follow' });
  const h = harness(null, initial);
  globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div');
  const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="nav-play"]').click();
  assert.match(root.textContent, /现在轮到鱼/);
  assert.match(root.textContent, /等鱼提交/);
  assert.equal(root.querySelector('[data-focus="option-follow"]').disabled, true, '鱼那一票不能在这里代投');
  assert.match(root.textContent, /沿溪寻找/);
  assert.match(root.textContent, /还没投/, '鱼那一席要显示还没投');
  assert.ok(root.querySelector('[data-focus="joint-refresh"]'), '可以手动刷新看鱼投了没');
  mounted.dispose();
});
test('unmount pauses with keepalive and cannot submit a late decide', async () => {
  const decision = deferred(); const h = harness((method) => method === 'decide' ? decision.promise : undefined);
  const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  await controller.setMode(true); await flush();
  const result = { ...copy(h.current), ticket: 'late' };
  h.aborter.abort(); decision.resolve(result); await flush();
  const pause = h.calls.find((call) => call.method === 'pause');
  assert.equal(pause.options.keepalive, true);
  assert.equal(pause.options.signal, undefined);
  assert.equal(h.calls.some((call) => call.method === 'auto'), false);
  controller.dispose();
});
test('visibility hidden pauses; visible re-arms the persistent autoplay preference', async () => {
  const decision = deferred(); const h = harness((method) => method === 'decide' ? decision.promise : undefined);
  const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  await controller.setMode(true); await flush();
  const result = { ...copy(h.current), ticket: 'late' };
  h.env.document.visibilityState = 'hidden'; h.env.document.dispatchEvent(new Event('visibilitychange')); await flush();
  decision.resolve(result); await flush();
  assert.equal(h.calls.some((call) => call.method === 'auto'), false);
  h.env.document.visibilityState = 'visible'; h.env.document.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.ok(h.calls.filter((call) => call.method === 'status').length >= 2);
  assert.ok(h.calls.filter((call) => call.method === 'mode' && call.payload.enabled === true).length >= 2, '重新可见时按持久偏好续上');
  controller.dispose();
});
test('persisted autoplay auto-arms without a click and stays on during owner turns', async () => {
  const initial = snapshot(); initial.autoplay = true;
  const h = harness(null, initial); const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  assert.equal(controller.state.autoplay, true);
  assert.ok(h.calls.some((call) => call.method === 'mode' && call.payload.enabled === true), '不需要手点就会续上');
  controller.dispose();

  const owner = snapshot(); owner.autoplay = true; owner.trip.actor = 'owner';
  const ownerHarness = harness(null, owner); const ownerController = createStoryController(ownerHarness.ctx, () => {}, ownerHarness.env); await flush();
  assert.equal(ownerHarness.calls.some((call) => call.method === 'mode'), false, '用户回合不抢选择');
  assert.equal(ownerController.state.autoplay, true, '偏好保持开着');
  ownerController.dispose();
});
test('reopening an enabled mode pauses instead of resuming', async () => {
  const initial = snapshot(); initial.autonomy.enabled = true;
  const h = harness(null, initial); const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  assert.deepEqual(h.calls.slice(0, 2).map((call) => call.method), ['status', 'pause']);
  assert.equal(controller.state.loading, false);
  assert.equal(controller.state.autoAuthorized, false);
  controller.dispose();
});
test('an uncertain mutation is never replayed and refreshes actual state', async () => {
  const h = harness((method) => { if (method === 'choose') throw new Error('transport lost after save'); });
  const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  await controller.mutate('choose', { choiceId: 'choice-1', optionId: 'follow' });
  assert.equal(h.calls.filter((call) => call.method === 'choose').length, 1);
  assert.ok(h.calls.some((call) => call.method === 'pause'));
  assert.equal(h.calls.filter((call) => call.method === 'status').length, 2);
  assert.match(controller.state.error, /不会自动重试/);
  controller.dispose();
});
test('double-clicking a manual choice submits only once', async () => {
  const pending = deferred(); const h = harness((method) => method === 'choose' ? pending.promise : undefined);
  const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  const first = controller.mutate('choose', { choiceId: 'choice-1', optionId: 'follow' });
  const second = controller.mutate('choose', { choiceId: 'choice-1', optionId: 'follow' });
  pending.resolve(copy(h.current)); await Promise.all([first, second]);
  assert.equal(h.calls.filter((call) => call.method === 'choose').length, 1);
  controller.dispose();
});
test('auto performs one ordered action per fresh stamp, including ticket on choose', async () => {
  let step = 0; let inFlight = 0;
  const h = harness(async (method, payload, current) => {
    if (method === 'decide') return { ...copy(current), ticket: 'ticket-verified', reason: '我想沿溪看看。' };
    if (method === 'auto') {
      inFlight++; assert.equal(inFlight, 1);
      if (step === 0) { assert.equal(payload.ticket, 'ticket-verified'); assert.equal(payload.stamp, 'stamp-1'); current.trip.pending = null; current.trip.step = 'move'; }
      if (step === 1) { assert.equal(payload.ticket, undefined); assert.equal(payload.stamp, 'stamp-2'); current.trip.step = 'close'; current.trip.complete = true; }
      if (step === 2) { current.trip = null; current.autonomy.enabled = false; }
      step++;
      if (current.trip) current.trip.stamp = `stamp-${step + 1}`;
      current.autonomy.remaining--;
      await flush(); inFlight--; return copy(current);
    }
  });
  const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  await controller.setMode(true);
  for (let index = 0; index < 8; index++) await flush();
  assert.equal(step, 3);
  assert.equal(controller.state.snapshot.trip, null);
  assert.deepEqual(h.calls.filter((call) => ['decide', 'auto'].includes(call.method)).map((call) => call.method), ['decide', 'auto', 'auto', 'auto']);
  controller.dispose();
});
test('explicit start carries pack revision and fresh startStamp', async () => {
  const initial = snapshot(); initial.trip = null;
  const h = harness(null, initial); const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  await controller.mutate('start', { packId: 'letter', revision: 'r1' });
  assert.deepEqual(h.calls.find((call) => call.method === 'start').payload, { packId: 'letter', revision: 'r1', startStamp: 'start-0' });
  assert.equal(h.calls.some((call) => call.method === 'mode'), false);
  controller.dispose();
});
test('image failures fall back locally and preserve story controls', async () => {
  const h = harness(); globalThis.document = h.env.document; globalThis.window = h.env.window;
  h.ctx.memo = { get: (key, fallback) => key.endsWith('home-day') ? 'data:image/png;base64,iVBORw==' : fallback };
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  const image = root.querySelector('img'); assert.ok(image); image.dispatchEvent(new Event('error'));
  assert.equal(root.querySelector('img'), null);
  assert.match(root.textContent, /图片未能加载/);
  root.querySelector('[data-focus="nav-play"]').click();
  assert.equal(root.querySelector('[data-focus="option-follow"]').disabled, false);
  mounted.dispose();
});
test('user story endings do not inherit removed sample artwork', async () => {
  for (const [packId, endingNodeId, expectedSlot, imageExpected] of [
    ['letter', 'reeds-ending', null, false],
    ['letter', 'bench-ending', null, false],
    ['custom-pack', 'reeds-ending', null, false],
  ]) {
    const initial = snapshot(); initial.trip.packId = packId; initial.trip.complete = true; initial.trip.endingNodeId = endingNodeId; initial.trip.pending = null; initial.trip.step = 'close';
    const h = harness(null, initial); globalThis.document = h.env.document; globalThis.window = h.env.window;
    h.ctx.memo = { get: (_key, _fallback) => 'data:image/png;base64,iVBORw==' };
    const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
    root.querySelector('[data-focus="nav-play"]').click();
    assert.equal(root.querySelector('.sw-scene').getAttribute('data-resource-slot'), expectedSlot);
    assert.equal(Boolean(root.querySelector('img')), imageExpected);
    mounted.dispose();
  }
});
test('late enable response after dispose is revoked with its returned token', async () => {
  const mode = deferred(); const h = harness((method, payload) => method === 'mode' && payload.enabled ? mode.promise : undefined);
  const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  const enabling = controller.setMode(true); controller.dispose();
  const late = snapshot(); late.autonomy.enabled = true; late.autonomy.token = 'new-token-after-unmount';
  mode.resolve(late); await enabling; await flush();
  assert.ok(h.calls.some((call) => call.method === 'pause' && call.payload.token === 'new-token-after-unmount' && call.options.keepalive));
  assert.equal(h.calls.some((call) => call.method === 'auto'), false);
});
test('mode off cancels the inter-step pacing timer before another action', async () => {
  const h = harness((method, _payload, current) => {
    if (method === 'decide') return { ...copy(current), ticket: 'approved' };
    if (method === 'auto') { current.trip.stamp = 'stamp-2'; current.trip.step = 'move'; current.trip.pending = null; return copy(current); }
  });
  const timers = []; h.env.pacingMs = 650;
  h.ctx.timeout = (fn, ms) => { const timer = { fn, ms, cancelled: false, dispose() { this.cancelled = true; } }; timers.push(timer); return timer; };
  const controller = createStoryController(h.ctx, () => {}, h.env); await flush();
  await controller.setMode(true); await flush();
  assert.equal(timers.length, 1); assert.equal(timers[0].ms, 650);
  await controller.setMode(false); await flush();
  assert.equal(timers[0].cancelled, true);
  assert.equal(h.calls.filter((call) => call.method === 'auto').length, 1);
  controller.dispose();
});
test('start UI preset defaults to on and enables autonomy only after start', async () => {
  const initial = snapshot(); initial.trip = null;
  const h = harness((method, _payload, current) => {
    if (method === 'start') { current.trip = copy(snapshot().trip); current.trip.step = 'blocked'; current.trip.blocked = 'test stop'; return copy(current); }
  }, initial);
  globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="nav-stories"]').click();
  const preset = root.querySelector('[data-focus="auto-preset"]');
  assert.equal(preset.getAttribute('aria-checked'), 'true', '鱼自己游玩默认开启');
  assert.equal(h.calls.some((call) => call.method === 'mode'), false);
  root.querySelector('[data-focus="start-letter"]').click();
  for (let index = 0; index < 4; index++) await flush();
  assert.deepEqual(h.calls.filter((call) => ['start', 'mode'].includes(call.method)).map((call) => call.method), ['start', 'mode']);
  mounted.dispose();
});
test('回忆可以移到回收站，也能从回收站恢复', async () => {
  const initial = snapshot();
  initial.memories = [{ id: 'memory-1', title: '旧故事', summary: '实际发生的片段', complete: false, endedAt: '2026-11-22T10:50:00+08:00', placeName: '江边', choices: [], timeline: [], checkpoints: [] }];
  initial.trash = [{ id: 'trash-1', title: '删掉的旧故事', placeName: '江边', deletedAt: '2026-11-22T10:40:00+08:00', complete: true, tripId: 'old-trip' }];
  const h = harness(null, initial);
  globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="nav-memories"]').click();
  assert.match(root.textContent, /移到回收站/);
  assert.match(root.textContent, /回收站（1）/);
  globalThis.confirm = () => true;
  root.querySelector('[data-focus="delete-memory-1"]').click();
  await flush();
  assert.ok(h.calls.some((call) => call.method === 'deleteMemory' && call.payload.memoryId === 'memory-1'));
  root.querySelector('[data-focus="restore-trash-1"]').click();
  await flush();
  assert.ok(h.calls.some((call) => call.method === 'restoreMemory' && call.payload.trashId === 'trash-1'));
  delete globalThis.confirm;
  mounted.dispose();
});

test('image validation rejects active formats, MIME spoofing and excessive bytes', () => {
  assert.throws(() => validateImageBytes('image/svg+xml', new Uint8Array([60, 115, 118, 103]).buffer), /PNG/);
  assert.throws(() => validateImageBytes('image/png', new Uint8Array([60, 115, 118, 103]).buffer), /不一致/);
  assert.throws(() => validateImageBytes('image/jpeg', new ArrayBuffer(MAX_IMAGE_BYTES + 1)), /2 MB/);
  assert.equal(validateImageBytes('image/png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer), true);
});


test('double-player panel shows actor, keeps owner choices explicit and disables fish choices', async () => {
  const initial = snapshot(); initial.trip.actor = 'fish';
  initial.trip.pending.actor = 'joint'; initial.trip.pending.jointResolution = 'require-agreement';
  initial.trip.pending.votes = { owner: 'follow' };
  initial.trip.joint = jointPayload({ owner: 'follow' });
  const h = harness(null, initial); globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="nav-play"]').click();
  assert.match(root.textContent, /当前行动者：鱼/);
  assert.match(root.textContent, /双方必须明确同意/);
  assert.equal(root.querySelector('[data-focus="option-follow"]').disabled, true);
  root.querySelector('[data-focus="option-follow"]').click(); await flush();
  assert.equal(h.calls.some(call => call.method === 'choose'), false);
  mounted.dispose();
});

test('when the fish cannot decide, the panel offers an explicit substitute and a new segment', async () => {
  const initial = snapshot();
  initial.trip.actor = 'fish';
  initial.trip.pending.actor = 'fish';
  initial.autonomy = { available: true, enabled: false, remaining: 11, remainingCalls: 0, stop: 'calls', canSubstitute: true, canContinue: true,
    segment: 1, segmentsLeft: 2, limit: { steps: 20, calls: 6 } };
  const h = harness(null, initial); globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="nav-play"]').click();
  assert.match(root.textContent, /鱼这一步没法自己决定/);
  assert.match(root.textContent, /还能 2 段/);
  const option = root.querySelector('[data-focus="option-follow"]');
  assert.equal(option.disabled, false, '鱼走不动时选项要能点');
  globalThis.confirm = () => true;
  option.click(); await flush();
  const chosen = h.calls.find((call) => call.method === 'choose');
  assert.equal(chosen.payload.substitute, true);
  assert.equal(chosen.payload.optionId, 'follow');
  root.querySelector('[data-focus="segment"]').click(); await flush();
  const segment = h.calls.find((call) => call.method === 'segment');
  assert.ok(segment);
  assert.equal(segment.payload.confirm, true, '新的一段必须显式确认');
  delete globalThis.confirm;
  mounted.dispose();
});

test('free mode closes its input when the segment is spent and offers another segment', async () => {
  const initial = snapshot();
  initial.trip = { ...initial.trip, mode: 'free', step: 'say', actor: null, pending: null, choices: [], ends: [], maxTurns: 2,
    free: { turn: 2, maxTurns: 2, limit: 2, turnsLeft: 0, segment: 1, segmentsLeft: 2, canContinue: true,
      summary: '', facts: {}, flags: {}, counters: {}, goals: [], log: [], ended: null } };
  const h = harness(null, initial); globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="nav-play"]').click();
  assert.match(root.textContent, /这段说完了/);
  assert.equal(root.querySelector('[data-focus="free-say"]').disabled, true, '说完了就不再收新的一句');
  assert.match(root.textContent, /还能 2 段/);
  root.querySelector('[data-focus="free-segment"]').click(); await flush();
  const segment = h.calls.find((call) => call.method === 'segment');
  assert.ok(segment);
  assert.equal(segment.payload.confirm, true);
  mounted.dispose();
});

test('chat layout pins the current step and folds long history', async () => {
  const initial = snapshot();
  initial.trip.events = ['片段一', '片段二', '片段三', '片段四', '片段五', '片段六'];
  initial.trip.choices = [
    { event: 'e1', option: 'a', result: '第一次', actor: 'owner', label: '选择甲' },
    { event: 'e2', option: 'b', result: '第二次', actor: 'fish', label: '选择乙' },
    { event: 'e3', option: 'c', result: '第三次', actor: 'owner', label: '选择丙' },
  ];
  const h = harness(null, initial); globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="nav-play"]').click();
  assert.ok(root.querySelector('[data-focus="play-reading"]'), '中间那段自己滚');
  assert.match(root.textContent, /更早的 3 条片段/);
  assert.match(root.textContent, /这趟的 3 次选择/);
  const action = root.querySelector('.sw-play-action');
  assert.ok(action, '当前这一步钉在底部');
  assert.match(action.textContent, /现在轮到你了/);
  assert.ok(action.querySelector('[data-focus="option-follow"]'), '选项就在这一块里，不用先滚到底');
  assert.ok(root.querySelector('.sw-play-foot'), '状态与次要按钮在页脚');
  mounted.dispose();
});

test('a refresh that changes nothing keeps the reading scroll position', async () => {
  const h = harness(null, snapshot()); globalThis.document = h.env.document; globalThis.window = h.env.window;
  TinyElement.metrics = { scrollHeight: 1000, clientHeight: 300 };
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="nav-play"]').click();
  const reading = root.querySelector('[data-focus="play-reading"]');
  reading.scrollTop = 420;
  await mounted.refresh(); await flush();
  const next = root.querySelector('[data-focus="play-reading"]');
  assert.equal(next.scrollTop, 420, '重建 DOM 后回到原来的位置');
  TinyElement.metrics = { scrollHeight: 0, clientHeight: 0 };
  mounted.dispose();
});

test('the immersive toggle shows one scene, its choices and a review drawer', async () => {
  const initial = snapshot();
  initial.trip.events = ['桥边有一封旧信。', '风把纸吹开了一点。'];
  const h = harness(null, initial); globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="nav-play"]').click();
  root.querySelector('[data-focus="immersive"]').click();
  assert.ok(root.querySelector('.sw-imm'), '切到一屏一幕');
  assert.equal(root.querySelector('[data-focus="play-reading"]'), null, '沉浸模式没有滚动区');
  assert.match(root.textContent, /风把纸吹开了一点/);
  assert.ok(root.querySelector('.sw-imm-choices'), '选项排成一屏');
  assert.ok(root.querySelector('[data-focus="option-follow"]'));
  root.querySelector('[data-focus="imm-history"]').click();
  assert.ok(root.querySelector('.sw-drawer'), '历史收在回看里');
  assert.match(root.querySelector('.sw-drawer').textContent, /回看 · 2 个片段/);
  root.querySelector('[data-focus="imm-drawer-close"]').click();
  assert.equal(root.querySelector('.sw-drawer'), null);
  root.querySelector('[data-focus="immersive"]').click();
  assert.ok(root.querySelector('[data-focus="play-reading"]'), '切回对话式');
  mounted.dispose();
});

test('a stopped segment never re-opens autoplay on its own; it states the reason instead', async () => {
  const initial = snapshot();
  initial.trip.actor = 'fish';
  initial.autoplay = true;
  initial.autonomy = { available: true, enabled: false, remaining: 0, remainingCalls: 0, stop: 'steps', canContinue: true,
    segment: 1, segmentsLeft: 2, limit: { steps: 20, calls: 6 }, reason: '这一趟的自主步数已经用满（20 步）。' };
  const h = harness(null, initial); globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  assert.equal(h.calls.some((call) => call.method === 'mode'), false, '不会反复发注定失败的开启请求');
  root.querySelector('[data-focus="nav-play"]').click();
  assert.match(root.textContent, /自主步数已经用满/);
  mounted.dispose();
});

test('public resumable checkpoint exposes a branch button without private graph data', async () => {
  const initial = snapshot(); initial.trip = null;
  initial.memories = [{ id: 'memory-1', title: '旧故事', summary: '实际发生的片段', complete: true,
    checkpoints: [{ id: 'checkpoint-1', resumable: true, revision: 'r1' }], timeline: [], choices: [] }];
  const h = harness(null, initial); globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="nav-memories"]').click();
  const fork = root.querySelector('[data-focus="fork-memory-1"]'); assert.ok(fork);
  fork.click(); await flush();
  const call = h.calls.find(call => call.method === 'fork'); assert.ok(call);
  assert.equal(call.payload.memoryId, 'memory-1'); assert.equal(call.payload.checkpointId, 'checkpoint-1');
  assert.match(call.payload.forkToken, /^[A-Za-z0-9_-]{16,80}$/);
  mounted.dispose();
});

async function settingsHarness(handler, options = {}) {
  const initial = snapshot();
  if (options.trip === null) initial.trip = null;
  initial.images = { enabled: true, masterOn: true, auto: true, sourceKind: 'plugin', source: '',
    generationAvailable: true, message: '图片开关已开', ...options.images };
  const stored = { dmSaved: false };
  const h = harness(async (method, payload, current) => {
    const result = await handler?.(method, payload, current);
    if (result !== undefined) return result;
    if (method === 'storySettings') {
      return { ok: true, dm: { saved: stored.dmSaved, supported: true }, imageSource: '', imageWorkflow: '', nodeLimit: 16, imagesEnabled: true };
    }
    if (method === 'saveStorySettings') {
      if (typeof payload?.apiKey === 'string' && payload.apiKey) stored.dmSaved = true;
      return { ok: true, dm: { saved: stored.dmSaved, supported: true }, imageWorkflow: payload?.workflow ?? '', imagesEnabled: true };
    }
    if (method === 'clearStoryKey') {
      stored.dmSaved = false;
      return { ok: true, dm: { saved: false, supported: true }, imageWorkflow: '', imagesEnabled: true };
    }
    if (method === 'saveStoryAutoImages') { current.images.auto = payload.auto; return { ok: true, autoImages: payload.auto }; }
  }, initial);
  h.ctx.language = options.language ?? 'zh';
  globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="nav-settings"]').click(); await flush();
  const control = (name) => root.querySelector(`[data-focus="settings-${name}"]`);
  const enter = (name, value) => { const input = control(name); assert.ok(input, name); input.value = value; input.dispatchEvent(new Event('input')); return input; };
  return { ...h, root, mounted, control, enter, stored };
}

test('settings page is only the advanced section: key, direct-only workflow, and where things live', async () => {
  const h = await settingsHarness();
  assert.match(h.root.textContent, /高级设置/);
  assert.ok(h.control('apiKey'), '密钥输入还在');
  assert.equal(h.root.querySelector('[data-focus="settings-apiUrl"]'), null, '接口地址不在面板');
  assert.equal(h.root.querySelector('[data-focus="settings-model"]'), null, '模型名不在面板');
  assert.equal(h.root.querySelector('[data-focus="settings-imageSource"]'), null, '图片来源不在面板');
  assert.equal(h.root.querySelector('[data-focus="story-node-limit"]'), null, '故事长度不在面板');
  assert.match(h.root.textContent, /配置 → 从0开始的肥鱼大冒险/);
  assert.match(h.root.textContent, /地点册 → 本地插画/);
  assert.doesNotMatch(h.root.textContent, /故事节点上限|生成／委派当前场景图片/);
  assert.equal(h.root.querySelector('.sw-settings-manual').hidden, true, '委派来源不显示直连出图');
  h.mounted.dispose();
});

test('R1 API key is a password, masks on blur/save, and only the key is submitted', async () => {
  const stored = []; const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => null, setItem: (...args) => stored.push(args) };
  try {
    const h = await settingsHarness((method, payload) => {
      if (method === 'saveStorySettings') {
        assert.deepEqual(payload, { apiKey: 'offline-test-private-value' });
        return { ok: true, dm: { saved: true, supported: true }, imageWorkflow: '', imagesEnabled: true };
      }
    });
    const key = h.enter('apiKey', 'offline-test-private-value');
    assert.equal(key.getAttribute('type'), 'password');
    assert.equal(h.root.querySelectorAll('.sw-settings-help').length, 1, '只剩一段可展开说明');
    assert.ok(h.root.querySelector('.sw-settings-actions'), '设置动作集中在底部操作条');
    assert.equal(h.root.querySelectorAll('.sw-settings-card-head').length, 1);
    key.dispatchEvent(new Event('blur'));
    assert.equal(key.value, '••••••••');
    h.control('save').click(); await flush();
    const call = h.calls.find((item) => item.method === 'saveStorySettings');
    assert.deepEqual(call.payload, { apiKey: 'offline-test-private-value' });
    assert.equal(key.value, '••••••••'); assert.match(h.root.textContent, /已保存/);
    key.dispatchEvent(new Event('focus')); assert.equal(key.value, '', '重获焦点不回显保存值');
    assert.doesNotMatch(h.root.textContent, /offline-test-private-value/);
    const saveCalls = h.calls.filter((call) => call.method === 'saveStorySettings').length;
    assert.equal(h.control('save').disabled, true, '保存后无修改时操作条安静禁用');
    h.control('save').click(); await flush();
    assert.equal(h.calls.filter((call) => call.method === 'saveStorySettings').length, saveCalls, '无改动时不重发');
    assert.deepEqual(stored, []);
    h.mounted.dispose();
  } finally { globalThis.localStorage = previousStorage; }
});

test('R1 loading failure keeps the masked draft and a retry; clear calls immediately', async () => {
  const read = deferred(); const removal = deferred();
  let firstRead = true;
  const h = await settingsHarness((method) => {
    if (method === 'storySettings' && firstRead) { firstRead = false; return read.promise; }
    if (method === 'clearStoryKey') return removal.promise;
  });
  const key = h.enter('apiKey', 'retry-private-value');
  assert.equal(h.control('save').disabled, true);
  read.reject(new Error('transport must not echo retry-private-value')); await flush();
  assert.match(h.root.textContent, /读取设置失败/);
  assert.doesNotMatch(h.root.textContent, /retry-private-value/);
  h.control('reload').click(); await flush();
  assert.equal(h.control('apiKey'), key);
  h.stored.dmSaved = true;
  await h.mounted.refresh(); await flush();
  h.control('reload').click(); await flush();
  h.control('clear').click();
  assert.equal(h.calls.filter((call) => call.method === 'clearStoryKey').length, 1, '清除按钮立即发请求');
  removal.resolve({ ok: true, dm: { saved: false, supported: true }, imageWorkflow: '', imagesEnabled: true }); await flush();
  assert.equal(h.control('apiKey').value, '');
  assert.match(h.root.textContent, /密钥已立即清除/);
  h.mounted.dispose();
});

test('R1 unsupported encryption disables the key input but keeps the page usable', async () => {
  const h = await settingsHarness((method) => {
    if (method === 'storySettings') return { ok: true, dm: { saved: false, supported: false }, imageSource: '', imageWorkflow: '', nodeLimit: 16, imagesEnabled: true };
  });
  assert.equal(h.control('apiKey').disabled, true);
  assert.match(h.root.textContent, /Windows.*DPAPI/);
  h.mounted.dispose();
});

test('direct source shows the manual image button and custom workflow; delegation hides them', async () => {
  const delegated = await settingsHarness();
  assert.equal(delegated.root.querySelector('.sw-settings-manual').hidden, true);
  delegated.mounted.dispose();

  const direct = await settingsHarness(null, { images: { sourceKind: 'comfyui', enabled: true } });
  assert.equal(direct.root.querySelector('.sw-settings-manual').hidden, false);
  direct.enter('workflow', '{"1":{"class_type":"CLIPTextEncode","inputs":{"text":"{{prompt}}"}}}');
  direct.control('save').click(); await flush();
  const call = direct.calls.find((item) => item.method === 'saveStorySettings');
  assert.equal(Object.hasOwn(call.payload, 'apiKey'), false, '只改工作流时不再提交密钥');
  assert.match(call.payload.workflow, /\{\{prompt\}\}/);
  direct.mounted.dispose();
});

test('R2 a manual image request never blocks text play and renders only a read-back data URL', async () => {
  const pending = deferred();
  const h = await settingsHarness((method, payload) => {
    if (method === 'storyImage') return pending.promise;
    if (method === 'storyImageRead') { assert.deepEqual(payload, { id: 'image-local-1' }); return { ok: true, image: { dataUrl: 'data:image/png;base64,iVBORw===' } }; }
  }, { images: { sourceKind: 'comfyui' } });
  h.root.querySelector('[data-focus="story-image"]').click();
  assert.equal(h.root.querySelector('[data-focus="story-image"]').disabled, true);
  h.root.querySelector('[data-focus="nav-play"]').click();
  assert.equal(h.root.querySelector('[data-focus="option-follow"]').disabled, false);
  pending.resolve({ ok: true, image: { status: 'ready', imageId: 'image-local-1' } }); await flush(); await flush();
  h.root.querySelector('[data-focus="nav-settings"]').click();
  const image = h.root.querySelector('.sw-generated-image'); assert.ok(image);
  image.dispatchEvent(new Event('error'));
  assert.equal(h.root.querySelector('.sw-generated-image'), null);
  assert.match(h.root.textContent, /图片请求失败/);
  h.mounted.dispose();

  const failed = await settingsHarness((method) => { if (method === 'storyImage') throw new Error('private transport'); }, { images: { sourceKind: 'comfyui' } });
  failed.root.querySelector('[data-focus="story-image"]').click(); await flush();
  assert.match(failed.root.textContent, /图片请求失败.*文字故事照常继续/);
  failed.mounted.dispose();
});

test('R2 a failed regeneration retains the last successfully displayed image', async () => {
  let fail = false;
  const h = await settingsHarness((method) => {
    if (method === 'storyImage') return fail ? { ok: false } : { ok: true, image: { status: 'ready', imageId: 'old-image' } };
    if (method === 'storyImageRead') return { ok: true, image: { dataUrl: 'data:image/png;base64,iVBORw==' } };
  }, { images: { sourceKind: 'comfyui' } });
  h.root.querySelector('[data-focus="story-image"]').click(); await flush(); await flush();
  const previous = h.root.querySelector('.sw-generated-image'); assert.ok(previous);
  fail = true; h.root.querySelector('[data-focus="story-image"]').click(); await flush();
  assert.equal(h.root.querySelector('.sw-generated-image'), previous);
  assert.match(h.root.textContent, /图片请求失败/);
  h.mounted.dispose();
});

test('a partial save reports the saved key and keeps the workflow draft', async () => {
  let partial = true;
  const h = await settingsHarness((method, payload) => {
    if (method === 'storySettings') return { ok: true, dm: { saved: false, supported: true }, imageSource: '', imageWorkflow: '', nodeLimit: 16, imagesEnabled: true };
    if (method === 'saveStorySettings') return partial
      ? { ok: false, partial: 'dm', dm: { saved: true, supported: true }, imageWorkflow: '', error: 'private backend detail' }
      : { ok: true, dm: { saved: true, supported: true }, imageWorkflow: payload.workflow, imagesEnabled: true };
  }, { images: { sourceKind: 'comfyui' } });
  h.enter('apiKey', 'submitted-secret');
  h.enter('workflow', '{"1":{"class_type":"X","inputs":{"text":"{{prompt}}"}}}');
  h.control('save').click(); await flush();
  assert.match(h.root.textContent, /密钥已保存.*工作流没保存/);
  assert.doesNotMatch(h.root.textContent, /submitted-secret|private backend detail/);
  assert.equal(h.control('apiKey').value, '••••••••');
  partial = false; h.control('save').click(); await flush();
  assert.deepEqual(h.calls.filter((call) => call.method === 'saveStorySettings').at(-1).payload, { workflow: '{"1":{"class_type":"X","inputs":{"text":"{{prompt}}"}}}' });
  h.mounted.dispose();
});

test('top-bar auto-image switch sits in sw-top-actions and writes funStoryAutoImages', async () => {
  const h = await settingsHarness();
  const sw = h.root.querySelector('[data-focus="auto-images"]');
  assert.ok(sw);
  assert.ok(h.root.querySelector('.sw-top-actions').contains(sw), '开关在顶栏');
  assert.equal(sw.getAttribute('role'), 'switch');
  assert.equal(sw.getAttribute('aria-checked'), 'true');
  assert.equal(sw.disabled, false);
  sw.click(); await flush();
  const call = h.calls.find((item) => item.method === 'saveStoryAutoImages');
  assert.deepEqual(call.payload, { auto: false });
  assert.equal(h.root.querySelector('[data-focus="auto-images"]').getAttribute('aria-checked'), 'false');
  assert.match(h.root.textContent, /自动配图已关闭/);
  h.mounted.dispose();
});

test('top-bar auto-image switch is disabled with an aria-live reason without a trip or with the master off', async () => {
  const noTrip = await settingsHarness(null, { trip: null });
  const offTrip = noTrip.root.querySelector('[data-focus="auto-images"]');
  assert.equal(offTrip.disabled, true);
  assert.match(noTrip.root.textContent, /有进行中的行程时才能自动准备配图/);
  assert.ok(noTrip.root.querySelector('[aria-live="polite"]'), '禁用原因用 aria-live 说出来');
  noTrip.mounted.dispose();

  const masterOff = await settingsHarness(null, { images: { masterOn: false, enabled: false } });
  const offMaster = masterOff.root.querySelector('[data-focus="auto-images"]');
  assert.equal(offMaster.disabled, true);
  assert.equal(offMaster.getAttribute('aria-checked'), 'false');
  assert.match(masterOff.root.textContent, /总闸关着/);
  masterOff.mounted.dispose();
});

test('a failed auto-image save rolls back and says so in aria-live', async () => {
  const h = await settingsHarness((method) => method === 'saveStoryAutoImages'
    ? { ok: false, autoImages: true, error: 'disk full' }
    : undefined);
  const sw = h.root.querySelector('[data-focus="auto-images"]');
  assert.equal(sw.getAttribute('aria-checked'), 'true');
  sw.click(); await flush();
  assert.equal(h.root.querySelector('[data-focus="auto-images"]').getAttribute('aria-checked'), 'true', '失败回滚');
  assert.match(h.root.textContent, /没保存成功.*恢复原来的设置/);
  h.mounted.dispose();
});

test('R4 自由场景包表单：切过去填完就能产出 v3 场景包', async () => {
  const initial = snapshot(); initial.catalog = []; initial.trip = null;
  const places = [{ id: 'riverside', name: '江边', areas: ['步道'] }];
  const h = harness((method) => method === 'authorList' ? { ok: true, packs: [], places }
    : method === 'authorImport' ? { ok: true, id: 'user-free' } : undefined, initial);
  globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  root.querySelector('[data-focus="home-write"]').click(); await flush();
  const freeTab = [...root.querySelectorAll('.fun-story-mode-tab')].find((node) => /自由场景包/.test(node.textContent));
  assert.ok(freeTab);
  freeTab.click(); await flush();
  assert.equal(root.querySelector('.fun-story-free-form').getAttribute('aria-label'), '自由场景包表单');
  assert.equal(root.querySelector('.fun-story-free-form').hidden, false);
  assert.equal(root.querySelectorAll('.fun-story-free-group').length, 4);
  const set = (key, value) => {
    const field = root.querySelector(`[data-free-field="${key}"]`);
    assert.ok(field, key);
    field.value = value;
    field.dispatchEvent(new Event('input'));
  };
  set('place', 'riverside');
  set('title', '折潮港的雨夜');
  set('synopsis', '雨夜里的一封信');
  set('author', '本地作者');
  set('genre', '悬疑');
  set('premise', '弄清楚那封信为什么没寄出去');
  set('opening', '雨把港口泡得发亮');
  set('canon', '钟停在 23:40\n写信的人三年前离开了\n潮水在 01:00 漫过栈桥');
  set('cast-name', '看灯人');
  set('loc-name', '栈桥');
  set('fact-initial', '还在邮筒里');
  root.querySelector('.fun-story-free-save').click();
  await flush();
  const call = h.calls.filter((item) => item.method === 'authorImport').at(-1);
  assert.ok(call, '表单保存会走 authorImport');
  const pack = JSON.parse(call.payload.json);
  assert.equal(pack.version, 3);
  assert.equal(pack.metadata.mode, 'free');
  assert.equal(pack.metadata.maxTurns, 20);
  assert.equal(pack.setting.canon.length, 3);
  assert.deepEqual(pack.setting.ends[0].when.all[1], { counter: 'trust', gte: 2 });
  mounted.dispose();
});

test('R4 no-sample empty state enters the full author panel through same-world RPC aliases', async () => {
  const initial = snapshot(); initial.catalog = []; initial.trip = null;
  const h = harness((method) => method === 'authorList' ? { ok: true, packs: [], places: [] } : undefined, initial);
  globalThis.document = h.env.document; globalThis.window = h.env.window;
  const root = document.createElement('div'); const mounted = mountPanel(root, h.ctx); await flush();
  assert.match(root.textContent, /还没有故事.*编写故事/s);
  assert.doesNotMatch(root.textContent, /样章|漂流信|导入样章/);
  root.querySelector('[data-focus="home-write"]').click(); await flush();
  assert.equal(h.calls.filter((call) => call.method === 'authorList').length, 1);
  assert.equal(root.querySelector('.fun-story-editor-toggle').getAttribute('aria-expanded'), 'true');
  const modes = root.querySelectorAll('.fun-story-mode-tab');
  assert.equal(modes.length, 3, 'author form offers both story kinds plus file import');
  assert.deepEqual([...modes].map((node) => node.textContent), ['选项式故事', '自由场景包', '从文件导入']);
  const groups = root.querySelectorAll('.fun-story-static-group');
  assert.equal(groups.length, 4, 'author form is divided into four sections');
  assert.equal(groups[0].getAttribute('open'), ''); assert.equal(groups[1].getAttribute('open'), '');
  assert.equal(groups[2].getAttribute('open'), null, 'branches start folded');
  assert.equal(groups[3].getAttribute('open'), null, 'optional time window starts folded');
  assert.ok(root.querySelector('.fun-story-sticky-actions'));
  assert.ok(root.querySelector('.fun-story-group-progress'));
  const draft = root.querySelector('.fun-story-json'); draft.value = 'unfinished'; draft.dispatchEvent(new Event('input'));
  root.querySelector('[data-focus="nav-home"]').click(); root.querySelector('[data-focus="nav-author"]').click();
  assert.equal(root.querySelector('.fun-story-json'), draft); assert.equal(draft.value, 'unfinished');
  assert.equal(h.calls.some((call) => call.method === 'installSample'), false);
  mounted.dispose();
});

test('R1/R2 English copy covers the advanced page, auto-image switch and where things live', async () => {
  const h = await settingsHarness(null, { language: 'en', images: { sourceKind: 'comfyui' } });
  assert.match(h.root.textContent, /Advanced settings/);
  assert.match(h.root.textContent, /Text DM key/);
  assert.match(h.root.textContent, /OpenAI-compatible/);
  assert.match(h.root.textContent, /Configuration → Adventures of Fat Fish from Scratch/);
  assert.match(h.root.textContent, /Place Book → Local artwork/);
  assert.match(h.root.textContent, /Direct image generation/);
  assert.match(h.root.textContent, /DPAPI CurrentUser/);
  assert.equal(h.control('apiKey').getAttribute('type'), 'password');
  assert.equal(h.control('save').textContent, 'Save settings');
  assert.match(h.root.textContent, /Auto images/);
  h.mounted.dispose();
});
