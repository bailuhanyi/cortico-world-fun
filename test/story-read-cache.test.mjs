/**
 * 六个只读故事查询的记忆化：短回执、`full:true` 逃生门、写操作失效。
 *
 * 为什么要钉住：这几个工具的回执是常驻开销里唯一「重复问」的大头
 *（`fun_story_places` / `fun_story_candidates` 各约 1.8k 字符）。
 * 记忆化一旦漏了「写后失效」，她会拿着过期的故事进度继续走；
 * 一旦把失败也缓存住，一次临时错误会钉十分钟。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULTS } from '../src/config.js';
import { FunWorld } from '../src/world.js';

const TZ = 'Asia/Shanghai';
const MIN = 60 * 1000;

async function boot(cfg = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-read-cache-'));
  let now = Date.parse('2026-11-23T10:47:00+08:00');
  const world = new FunWorld({
    cfg: { ...DEFAULTS, enabled: true, funStoryTextOn: true, ...cfg },
    dataDir: dir,
    timezone: TZ,
    now: () => now,
    random: () => 0,
    persist: () => {},
  });
  await world.start({ log: { info() {}, warn() {}, error() {} } });
  return {
    world,
    dir,
    advance: (ms) => { now += ms; },
    tool: (name) => world.tools().find((t) => t.name === name).handler,
    call: (name, args) => world.tools().find((t) => t.name === name).handler(args ?? {}),
    close: () => rm(dir, { recursive: true, force: true }),
  };
}

test('同一查询第二次只回短回执，不再重发整份 JSON', async () => {
  const b = await boot();
  try {
    const first = await b.call('fun_story_candidates');
    assert.equal(first.ok, true);
    assert.ok(Array.isArray(first.candidates) && first.candidates.length, '第一次是完整候选清单');
    assert.ok(first.text.length > 300, `第一次回执应该不短（实际 ${first.text.length}）`);

    const second = await b.call('fun_story_candidates');
    assert.equal(second.ok, true);
    assert.equal(second.unchanged, true);
    assert.equal(second.candidates, undefined, '短回执不该再带整份 candidates');
    assert.match(second.since, /^\d{2}:\d{2}$/, 'since 是 HH:MM');
    assert.ok(second.text.length < 260, `短回执要短（实际 ${second.text.length}）`);
    assert.equal(JSON.parse(second.text).unchanged, true);
  } finally {
    await b.close();
  }
});

test('full:true 穿透记忆化，重取一份完整结果并刷新缓存', async () => {
  const b = await boot();
  try {
    await b.call('fun_story_places');
    const short = await b.call('fun_story_places');
    assert.equal(short.unchanged, true);

    const full = await b.call('fun_story_places', { full: true });
    assert.equal(full.ok, true);
    assert.equal(full.unchanged, undefined);
    assert.ok(Array.isArray(full.places) && full.places.length, 'full:true 拿到完整地点索引');

    // 穿透之后缓存里是新的完整结果，紧接着再问还是短回执。
    assert.equal((await b.call('fun_story_places')).unchanged, true);
  } finally {
    await b.close();
  }
});

test('写操作让缓存失效：出门后 fun_story_current 立刻反映新行程', async () => {
  const b = await boot();
  try {
    const before = await b.call('fun_story_current');
    assert.equal(before.state, 'none');
    assert.equal((await b.call('fun_story_current')).unchanged, true, '没写之前命中缓存');

    await b.call('fun_go', { place: '江边' });
    const after = await b.call('fun_story_current');
    assert.equal(after.unchanged, undefined, '写之后必须重取');
    assert.equal(after.state, 'none', '普通出游不是故事行程');
    assert.ok(after.trip === null || after.trip === undefined);
  } finally {
    await b.close();
  }
});

test('面板写操作同样让缓存失效（不只有工具写）', async () => {
  const b = await boot();
  try {
    await b.call('fun_story_places');
    assert.equal((await b.call('fun_story_places')).unchanged, true);

    // 面板改一处地点：走 venues 的 save 口，不改 state。
    const saved = await b.world.webUi().invoke('places', 'save', [{ id: 'park', name: '江边公园', areas: ['步道'] }]);
    assert.equal(saved.ok, true, saved.error);

    const after = await b.call('fun_story_places');
    assert.equal(after.unchanged, undefined, '面板写完不能继续回旧缓存');
    assert.equal(after.ok, true, '重取仍然成功');
    assert.ok(after.places.length > 0);
  } finally {
    await b.close();
  }
});

test('10 分钟后自然过期', async () => {
  const b = await boot();
  try {
    await b.call('fun_story_candidates');
    assert.equal((await b.call('fun_story_candidates')).unchanged, true);

    b.advance(11 * MIN);
    const again = await b.call('fun_story_candidates');
    assert.equal(again.unchanged, undefined, '过了 TTL 要重取');
    assert.ok(Array.isArray(again.candidates));
  } finally {
    await b.close();
  }
});

test('失败不缓存：临时错误不会钉住十分钟', async () => {
  const b = await boot();
  try {
    const missing = await b.call('fun_story_detail', { id: 'no-such-story' });
    assert.equal(missing.ok, false);
    const again = await b.call('fun_story_detail', { id: 'no-such-story' });
    assert.equal(again.unchanged, undefined, '失败结果不进缓存');
    assert.equal(again.code, 'NOT_FOUND');
  } finally {
    await b.close();
  }
});