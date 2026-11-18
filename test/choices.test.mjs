import test from 'node:test';
import assert from 'node:assert/strict';
import { applyChoice, choiceForEvent, normalizeChoice } from '../src/choices.js';

const whale = '一条大鲸从头顶慢慢游过去，影子把整条隧道盖了一下';

test('已配置事件返回稳定的结构化选项', () => {
  const choice = choiceForEvent(whale, { area: '海底隧道' });
  assert.equal(choice.id, `choice-${whale}`);
  assert.equal(choice.area, '海底隧道');
  assert.equal(choice.options.length, 2);
  assert.ok(choice.options.every((x) => x.id && x.label));
  assert.equal(choiceForEvent('没有配置的事件'), null);
});

test('脏选择数据归一化，选项只能选当前列表', () => {
  const raw = normalizeChoice({ id: 'x', event: whale, prompt: '选', options: [{ id: 'wait', label: '等', result: '等候' }] });
  assert.deepEqual(applyChoice(raw, 'wait').option.result, '等候');
  assert.equal(applyChoice(raw, 'other').ok, false);
  assert.equal(normalizeChoice({ id: 'x', event: whale, options: [] }), null);
});
