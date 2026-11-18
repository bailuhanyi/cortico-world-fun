import test from 'node:test';
import assert from 'node:assert/strict';
import { VENUES } from '../src/venues.js';
import { filterEventsForArea } from '../src/events.js';
const venue = (id) => VENUES.find((v) => v.id === id);

test('项目事件不串到其他项目，环境事件仍可出现', () => {
  const pool = ['过山车冲下去那一下喊得嗓子发干，下来喝了半瓶水', '旋转木马转到第三圈的时候音乐卡了一下', '放烟花的场次正好赶上，全场的人都停下来了'];
  assert.deepEqual(filterEventsForArea(pool, '旋转木马', venue('amusement')), pool.slice(1));
});

test('项目简称也受明确映射约束', () => {
  const pool = ['山顶风大到站不稳', '在凉亭里歇了十分钟才继续', '山道上遇到往回走的人，说了句还有多远'];
  assert.deepEqual(filterEventsForArea(pool, '半山腰的凉亭', venue('hiking')), pool.slice(1));
});

test('购买事件只有相应正名收获存在才出现，不自动生成奖励', () => {
  const event = '在纪念品店犹豫了很久，最后挑了那个鲸鱼挂件';
  assert.deepEqual(filterEventsForArea([event], '纪念品店', venue('aquarium')), []);
  assert.deepEqual(filterEventsForArea([event], '纪念品店', venue('aquarium'), { souvenirs: ['鲸鱼挂件'] }), [event]);
  assert.deepEqual(filterEventsForArea([event], '企鹅馆', venue('aquarium'), { souvenirs: ['鲸鱼挂件'] }), []);
});

test('无法核实的数量、赠品和熟人前置事件不凭空发生', () => {
  assert.deepEqual(filterEventsForArea(['在套圈摊套中了一个歪歪的小熊', '气球摊的老板认出了你，说上次那个没给你打折'], '套圈摊位', venue('amusement')), []);
  assert.deepEqual(filterEventsForArea(['吧唧挑了半天，最后把一整组都买了'], '同人展台', venue('con'), { souvenirs: ['吧唧'] }), []);
});

test('饮食事件要求真实品类记录', () => {
  const event = '手冲等得有点久，但端上来的时候正好';
  assert.deepEqual(filterEventsForArea([event], '吧台', venue('cafe')), []);
  assert.deepEqual(filterEventsForArea([event], '吧台', venue('cafe'), { ate: [{ item: '拿铁' }] }), []);
  assert.deepEqual(filterEventsForArea([event], '吧台', venue('cafe'), { ate: [{ item: '手冲' }] }), [event]);
});

test('空池与自填环境事件保持原语义', () => {
  assert.deepEqual(filterEventsForArea([], '茶亭', { areas: ['茶亭'] }), []);
  assert.deepEqual(filterEventsForArea(['雨落在屋檐上', '书架角有人翻书'], '茶亭', { areas: ['茶亭', '书架角'] }), ['雨落在屋檐上']);
});
