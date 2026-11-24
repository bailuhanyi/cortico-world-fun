import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_STORY_PACKS } from '../src/story-examples.js';
import { freePromptPayload, freeTurn, freeTurnsLeft, newFreeState, parseFreeOutput } from '../src/story-free.js';

test('200 turns retain canon, at most six recent turns, and a local rolling summary', () => {
  const { setting } = BUILTIN_STORY_PACKS.find(({ version }) => version === 3);
  let free = newFreeState(setting);
  for (let i = 0; i < 200; i++) {
    const payload = freePromptPayload(setting, free, { turn: i, say: '说'.repeat(1500) });
    assert.deepEqual(payload.canon, setting.canon);
    assert.equal(payload.recent.length, Math.min(i, 6));
    assert.equal(payload.player.say.length, 1500);
    if (i >= 6) assert.ok(payload.summary.length > 0 && payload.summary.length <= 200);
    const prose = parseFreeOutput('他说“等等”，雨声里有人应答，灯影从石阶上移了过去。');
    const result = freeTurn(setting, free, prose, { now: i + 1, say: payload.player.say });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.free.log.at(-1).unstructured, true);
    free = result.free;
  }
  assert.equal(free.log.length, 40);
  assert.equal(free.turn, 200);
  assert.equal(freeTurnsLeft(free, 200), 0);
  assert.equal(free.ended, null);
});
