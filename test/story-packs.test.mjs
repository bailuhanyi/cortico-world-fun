import test from 'node:test';
import assert from 'node:assert/strict';
import { VENUES } from '../src/venues.js';
import { BUILTIN_STORY_PACKS } from '../src/story-examples.js';
import {
  advanceStoryChoice,
  normalizeStoryProgress,
  pickStory,
  storyAvailability,
  validateStoryPack,
} from '../src/story-packs.js';

const venueById = (id) => VENUES.find((venue) => venue.id === id);
const river = venueById('riverside');
const market = venueById('market');
const con = venueById('con');
const row = (pack, enabled = true) => ({ pack, enabled, builtin: false });

function smallPack(overrides = {}) {
  return {
    version: 1,
    id: 'custom-branch',
    title: 'A small original story',
    placeId: 'custom-place',
    start: 'begin',
    nodes: [
      {
        id: 'begin',
        area: 'quiet-corner',
        event: 'A light moves across the wall.',
        choices: [
          { id: 'stay', label: 'Stay a moment', result: 'Listen to the room.', next: 'ending-a' },
          { id: 'walk', label: 'Walk on', result: 'Follow the soft sound.', next: 'ending-b' },
        ],
      },
      { id: 'ending-a', area: 'window', event: 'The room grows still.' },
      { id: 'ending-b', area: 'doorway', event: 'Footsteps fade away.' },
    ],
    ...overrides,
  };
}

const customVenue = {
  id: 'custom-place',
  name: 'Custom Place',
  hours: { open: '18:00', close: '02:00' },
  areas: ['quiet-corner', 'window', 'doorway'],
  phases: [
    { key: 'late', from: '22:00', to: '02:00', areas: ['quiet-corner', 'window', 'doorway'] },
    { key: 'early', from: '18:00', to: '22:00', areas: ['quiet-corner', 'window', 'doorway'] },
  ],
};

test('validates and canonicalizes a small DAG with a stable normalized revision', () => {
  const first = validateStoryPack(smallPack());
  const second = validateStoryPack(JSON.stringify(smallPack()));
  assert.equal(first.ok, true, first.errors.join(', '));
  assert.equal(second.ok, true, second.errors.join(', '));
  assert.match(first.pack.revision, /^[a-f0-9]{32}$/);
  assert.equal(first.pack.revision, second.pack.revision);
  assert.equal(first.pack.nodes.length, 3);
  assert.deepEqual(first.errors, []);
});

test('rejects unsafe or malformed schema, oversized text, missing edges and invalid graphs', () => {
  const extra = smallPack();
  extra.action = { type: 'reward' };
  assert.equal(validateStoryPack(extra).ok, false);
  assert.ok(validateStoryPack(extra).errors.some((error) => error.includes('action')));

  const unsafe = smallPack();
  unsafe.nodes[0].event = 'Go to https://example.invalid';
  assert.equal(validateStoryPack(unsafe).ok, false);

  const tooLong = smallPack();
  tooLong.nodes[0].event = 'x'.repeat(121);
  assert.equal(validateStoryPack(tooLong).ok, false);

  const oversized = JSON.stringify({ ...smallPack(), description: 'x'.repeat(33 * 1024) });
  assert.equal(validateStoryPack(oversized).ok, false);

  const badEdge = smallPack();
  badEdge.nodes[0].choices[0].next = 'missing';
  assert.equal(validateStoryPack(badEdge).ok, false);

  const cycle = smallPack();
  cycle.nodes[1].next = 'begin';
  assert.equal(validateStoryPack(cycle).ok, false);

  const unreachable = smallPack();
  unreachable.nodes.push({ id: 'unseen', area: 'window', event: 'No path reaches this.' });
  assert.equal(validateStoryPack(unreachable).ok, false);
});

test('validates paired midnight windows and checks the current runtime window', () => {
  const midnight = smallPack();
  midnight.nodes[0].when = { from: '00:00', to: '01:00', phases: ['late'], minVisits: 1 };
  assert.equal(validateStoryPack(midnight).ok, true);
  const unpaired = smallPack();
  unpaired.nodes[0].when = { from: '00:00' };
  assert.equal(validateStoryPack(unpaired).ok, false);
  const invalidTime = smallPack();
  invalidTime.nodes[0].when = { from: '24:00', to: '01:00' };
  assert.equal(validateStoryPack(invalidTime).ok, false);

  const pack = validateStoryPack(midnight).pack;
  const catalog = [row(pack)];
  assert.equal(pickStory(catalog, customVenue, 'quiet-corner', 23 * 60 + 59, { storyProgress: [] }, 1), null);
  assert.equal(pickStory(catalog, customVenue, 'quiet-corner', 0, { storyProgress: [] }, 1)?.choice?.id,
    `story:${pack.id}:${pack.revision}:begin`);
  assert.equal(pickStory(catalog, customVenue, 'quiet-corner', 30, { storyProgress: [] }, 0), null);
});

test('availability reports missing venue areas or supported phase keys without corrupting packs', () => {
  const pack = validateStoryPack(smallPack()).pack;
  const unavailable = storyAvailability(pack, [{ ...customVenue, areas: ['quiet-corner', 'window'], phases: [{ key: 'early' }] }]);
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.placeName, 'Custom Place');
  assert.ok(unavailable.warnings.some((warning) => warning.includes('doorway')));
  assert.equal(storyAvailability(pack, []).available, false);
  assert.equal(storyAvailability(pack, [customVenue]).available, true);
});

test('built-ins bind only to existing areas and their requested evening opening windows', () => {
  assert.equal(BUILTIN_STORY_PACKS.length, 3);
  const riversidePack = BUILTIN_STORY_PACKS.find((pack) => pack.placeId === 'riverside');
  const marketPack = BUILTIN_STORY_PACKS.find((pack) => pack.placeId === 'market');
  const conPack = BUILTIN_STORY_PACKS.find((pack) => pack.placeId === 'con');
  assert.equal(riversidePack.nodes[0].area, '桥底下');
  assert.equal(marketPack.nodes[0].area, '街尾的台阶');
  assert.deepEqual([marketPack.nodes[0].when.from, marketPack.nodes[0].when.to], ['00:00', '01:00']);
  assert.equal(conPack.nodes[0].area, '海报墙');
  assert.deepEqual([conPack.nodes[0].when.from, conPack.nodes[0].when.to], ['17:00', '18:00']);
  for (const pack of BUILTIN_STORY_PACKS) {
    assert.equal(storyAvailability(pack, VENUES).available, true, pack.id);
    assert.ok(pack.nodes[0].choices?.length >= 2, pack.id);
    assert.ok(pack.nodes.filter((node) => !node.choices).length >= 2, pack.id);
    for (const node of pack.nodes) assert.ok(venueById(pack.placeId).areas.includes(node.area), `${pack.id}: ${node.area}`);
  }
  assert.equal(river.areas.includes('桥底下'), true);
  assert.equal(market.areas.includes('街尾的台阶'), true);
  assert.equal(con.areas.includes('海报墙'), true);
});

test('pickStory returns independent full progress and waits for a choice across JSON restart', () => {
  const pack = validateStoryPack(smallPack()).pack;
  const catalog = [row(pack)];
  const session = { storyProgress: [] };
  const selected = pickStory(catalog, customVenue, 'quiet-corner', 23 * 60, session, 0);
  assert.ok(selected);
  assert.equal(selected.event, 'A light moves across the wall.');
  assert.equal(selected.choice.area, 'quiet-corner');
  assert.equal(selected.choice.options.length, 2);
  assert.equal(session.storyProgress.length, 0, 'input session must not be mutated');
  assert.equal(selected.progress.length, 1);

  const restored = JSON.parse(JSON.stringify(selected.progress));
  assert.deepEqual(normalizeStoryProgress(restored), selected.progress);
  assert.equal(pickStory(catalog, customVenue, 'quiet-corner', 23 * 60, { storyProgress: restored }, 0), null,
    'an offered choice is not emitted again');

  const advanced = advanceStoryChoice(restored, selected.choice.id, 'stay');
  assert.equal(advanced[0].nodeId, 'ending-a');
  assert.equal(advanced[0].waitingChoiceId, null);
  assert.equal(pickStory(catalog, customVenue, 'window', 23 * 60, { storyProgress: advanced }, 0).event, 'The room grows still.');
});

test('choice advancement uses serialized edges after catalog removal; skip ends the outing story', () => {
  const pack = validateStoryPack(smallPack()).pack;
  const selected = pickStory([row(pack)], customVenue, 'quiet-corner', 23 * 60, { storyProgress: [] }, 0);
  const removedPackProgress = advanceStoryChoice(JSON.parse(JSON.stringify(selected.progress)), selected.choice.id, 'walk');
  assert.equal(removedPackProgress[0].nodeId, 'ending-b');
  assert.equal(pickStory([], customVenue, 'doorway', 23 * 60, { storyProgress: removedPackProgress }, 0), null);

  const skipped = advanceStoryChoice(selected.progress, selected.choice.id, 'skip');
  assert.equal(skipped[0].done, true);
  assert.equal(pickStory([row(pack)], customVenue, 'quiet-corner', 23 * 60, { storyProgress: skipped }, 0), null);
  assert.deepEqual(advanceStoryChoice(selected.progress, 'wrong-choice-id', 'stay'), selected.progress);
});

test('an updated revision pauses existing progress instead of restarting', () => {
  const oldPack = validateStoryPack(smallPack()).pack;
  const initial = pickStory([row(oldPack)], customVenue, 'quiet-corner', 23 * 60, { storyProgress: [] }, 0);
  const progressed = advanceStoryChoice(initial.progress, initial.choice.id, 'stay');
  const changedDraft = smallPack();
  changedDraft.nodes[0].event = 'A revised story should not restart mid-outing.';
  const changedPack = validateStoryPack(changedDraft).pack;
  assert.notEqual(changedPack.revision, oldPack.revision);
  assert.equal(pickStory([row(changedPack)], customVenue, 'quiet-corner', 23 * 60, { storyProgress: progressed }, 0), null);
  assert.equal(pickStory([row(changedPack)], customVenue, 'window', 23 * 60, { storyProgress: progressed }, 0), null);
});

test('unfinished matching stories are selected before fresh catalog entries', () => {
  const activePack = validateStoryPack(smallPack()).pack;
  const freshDraft = smallPack({ id: 'fresh-branch' });
  freshDraft.nodes[0].area = 'window';
  const freshPack = validateStoryPack(freshDraft).pack;
  const initial = pickStory([row(activePack)], customVenue, 'quiet-corner', 23 * 60, { storyProgress: [] }, 0);
  const progressed = advanceStoryChoice(initial.progress, initial.choice.id, 'stay');
  const selected = pickStory(
    [row(freshPack), row(activePack)],
    customVenue,
    'window',
    23 * 60,
    { storyProgress: progressed },
    0,
  );
  assert.equal(selected.event, 'The room grows still.');
  assert.equal(selected.choice, null);
  assert.equal(selected.progress[0].done, true);
  assert.equal(selected.progress.some((entry) => entry.packId === freshPack.id), false);
});

test('normalizeStoryProgress caps rows and removes arbitrary keys and malformed snapshots', () => {
  const entries = Array.from({ length: 40 }, (_, index) => ({
    packId: `pack-${index}`,
    revision: 'abcdef1234567890',
    nodeId: 'node',
    waitingChoiceId: null,
    options: [],
    done: false,
    injected: { code: 'not-preserved' },
  }));
  const normalized = normalizeStoryProgress(entries);
  assert.equal(normalized.length, 32);
  assert.deepEqual(Object.keys(normalized[0]).sort(), ['done', 'nodeId', 'options', 'packId', 'revision', 'waitingChoiceId']);
  assert.equal(normalizeStoryProgress([{ ...entries[0], options: [{ id: 'bad', next: '../path' }] }]).length, 0);
});
