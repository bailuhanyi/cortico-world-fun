import test from 'node:test';
import assert from 'node:assert/strict';
import { aquariumDetail, aquariumEventDetail } from '../src/aquarium.js';
import { VENUES } from '../src/venues.js';

test('海洋馆每个区域都有不同的专属空间句', () => {
  const aquarium = VENUES.find((v) => v.id === 'aquarium');
  const details = aquarium.areas.map((area) => aquariumDetail(area));
  assert.equal(details.filter(Boolean).length, aquarium.areas.length);
  assert.equal(new Set(details).size, details.length);
  assert.ok(details.every((x) => x.length >= 12 && x.length <= 70));
});

test('海洋馆专属事件细节仅跟随对应项目显示', () => {
  const event = '一条大鲸从头顶慢慢游过去，影子把整条隧道盖了一下';
  assert.match(aquariumEventDetail(event, '海底隧道'), /水面的亮纹/);
  assert.equal(aquariumEventDetail(event, '鲸豚湾'), '');
  assert.equal(aquariumEventDetail('未配置事件', '水母缸'), '');
});
