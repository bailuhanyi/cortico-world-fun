import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FunWorld } from '../src/world.js';
import { cleanup } from './tmp.mjs';

const now = () => Date.parse('2026-11-24T14:00:00+08:00');
const prose = '他轻声说：“来看看这盏灯。”\n' + '灯'.repeat(1484);
const narration = '两人沿着岸边缓缓走去，纸灯在石阶旁晃了两下。';
async function setup(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'fun-actions-'));
  cleanup(t, dir);
  const replies = [];
  const requests = [];
  const cfg = { enabled: true, ...options.cfg };
  const host = { cognition: { async request({ brief }) {
    requests.push(JSON.parse(brief.split('\n').at(-1)));
    return { text: replies.length ? replies.shift() : JSON.stringify({ narration }) };
  } } };
  async function boot() {
    const world = new FunWorld({ dataDir: dir, cfg, now, storySecretsFactory: options.storySecretsFactory });
    await world.start(host);
    const tool = (name, args = {}) => world.tools().find((r) => r.name === name).handler(args);
    const json = async (name, args) => JSON.parse((await tool(name, args)).text);
    const panel = (method, payload = {}) => world.webUi().invoke('story', method, [payload]);
    return { world, tool, json, panel, disk: async () => JSON.parse(await readFile(world.stateFile(), 'utf8')) };
  }
  return { ...await boot(), boot, replies, requests, cfg };
}

async function start(b) {
  const status = await b.panel('status');
  const free = status.catalog.filter(({ mode }) => mode === 'free');
  assert.equal(free.length, 4);
  assert.ok(free.every(({ available }) => available));
  const { id: packId, revision } = free[0];
  const started = await b.json('fun_story_start', { packId, revision, startStamp: status.startStamp, confirm: true });
  assert.equal(started.ok, true);
  return started;
}

test('party defaults, immutable run snapshot, restart replay and failed redo preserve story progress', async (t) => {
  const b = await setup(t);
  const party = [{ who: '阿枫', tag: '谨慎' }, { who: '小汐', tag: '勇敢' }];
  assert.equal((await b.panel('saveParty', { party })).ok, true);
  assert.equal((await b.panel('status')).showFreeDefault, true);
  assert.equal((await b.panel('ackFreeDefault')).ok, true);
  assert.equal((await b.panel('status')).showFreeDefault, false);
  const started = await start(b);
  assert.deepEqual(started.party, party);
  assert.equal((await b.panel('saveParty', { party: [{ who: '新人' }] })).ok, true);
  assert.deepEqual((await b.json('fun_story_current')).party, party);
  const actions = [{ who: '阿枫', say: '甲'.repeat(500) }, { who: '小汐', say: '乙'.repeat(500) }, { who: '客人', say: '丙'.repeat(500) }];
  const args = { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '应被忽略', actions };
  b.replies.push(prose);
  const first = await b.json('fun_story_act', args);
  assert.equal(first.recorded, 3);
  assert.equal(first.narration, prose);
  assert.deepEqual(b.requests[0].party, party);
  assert.equal(b.requests[0].player.say.length, 1500);
  assert.deepEqual(b.requests[0].player.actions, [...actions.slice(0, 2), { ...actions[2], who: '路人' }]);
  const disk = await b.disk();
  assert.equal(disk.session.storyRun.free.log[0].narration, prose);
  await b.world.stop();
  const restarted = await b.boot();
  const replay = await restarted.json('fun_story_act', args);
  assert.deepEqual(replay, { ...first, alreadyCommitted: true });
  assert.equal(b.requests.length, 1);
  assert.deepEqual((await restarted.json('fun_story_current')).trip.free.log[0].actions, b.requests[0].player.actions);
  const wrongIntent = await restarted.tool('fun_story_act', { ...args, intent: 'redo' });
  assert.match(wrongIntent.text, /STALE/);
  b.replies.push('{bad', '[bad');
  const redoArgs = { ...args, stamp: first.stamp, intent: 'redo' };
  const failed = await restarted.tool('fun_story_act', redoArgs);
  assert.equal(failed.failed, true);
  const afterFailure = (await restarted.disk()).session.storyRun;
  assert.deepEqual(afterFailure.free, disk.session.storyRun.free);
  assert.deepEqual(afterFailure.checkpoints, disk.session.storyRun.checkpoints);
  assert.equal(afterFailure.freeCalls, 3);
  const redo = await restarted.json('fun_story_act', redoArgs);
  assert.equal(redo.turn, 1);
  assert.notEqual(redo.stamp, first.stamp);
  const afterRedo = (await restarted.disk()).session.storyRun;
  assert.equal(afterRedo.free.redo, 1);
  assert.deepEqual(afterRedo.checkpoints.slice(0, -1), afterFailure.checkpoints);
  const close = { tripId: started.tripId, stamp: redo.stamp, intent: 'close', confirm: true };
  const closed = await restarted.json('fun_story_act', close);
  assert.ok(closed.closed && closed.stamp && closed.memoryId);
  assert.deepEqual(await restarted.json('fun_story_act', close), { ...closed, alreadyCommitted: true });
  assert.equal((await restarted.disk()).trips[0].storyRun.free.turn, 1);
  await restarted.world.stop();
});

test('external DM failure falls back to the host once, without changing the setting', async (t) => {
  let directCalls = 0;
  const b = await setup(t, { cfg: { funStoryDM: true }, storySecretsFactory: () => ({
    status: { available: true }, load() {},
    cognition: () => ({ storyDmDirect: true, async request() { directCalls++; throw new Error('mock provider failure'); } }),
  }) });
  const started = await start(b);
  const reply = await b.json('fun_story_act', { tripId: started.tripId, stamp: started.stamp, intent: 'say', say: '听听江声。' });
  assert.equal(directCalls, 1);
  assert.equal(b.requests.length, 1);
  assert.equal(reply.turn, 1);
  assert.match(reply.note, /已回退宿主主持/);
  assert.equal(b.cfg.funStoryDM, true);
  await b.world.stop();
});
