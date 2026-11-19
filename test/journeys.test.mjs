import test from 'node:test';
import assert from 'node:assert/strict';
import { addMoment, normalizeTimeline, timelineFor, normalizeRoute, normalizeRoutes, storeRoute, routeText } from '../src/journeys.js';
import { normalizeState, newState, closeSession, enterVenue } from '../src/state.js';
import { VENUES } from '../src/venues.js';
const time = Date.parse('2026-11-19T18:00:00+08:00');
const route = { id: 'route-1', stops: [{placeId:'market',placeName:'夜市'}, {placeId:'riverside',placeName:'江边'}], nextIndex:0, status:'planned', tripIds:[] };

test('路线双向记录缺失可修复，显式取消不会从历史里复活', () => {
  const active = normalizeState({ day: '2026-11-19', route }, '2026-11-19', time);
  assert.equal(active.routes[0].id, route.id);
  const recovered = normalizeState({ day: '2026-11-19', routes: [route] }, '2026-11-19', time);
  assert.equal(recovered.route.id, route.id);
  assert.equal(normalizeState({ day: '2026-11-19', route: null, routes: [route] }, '2026-11-19', time).route, null);
});

test('长时间线保留进门与最新活动，收摊不会被截掉', () => {
  const timeline = [{ kind: 'enter', text: '进门', at: time }, ...Array.from({length:260}, (_,i)=>({kind:'area',text:'第'+i+'次活动',at:time+i+1}))];
  const normalized = normalizeTimeline(timeline);
  assert.equal(normalized.length, 240);
  assert.equal(normalized[0].kind, 'enter');
  assert.equal(normalized.at(-1).text, '第259次活动');
  const state = normalizeState({day:'2026-11-19',session:{placeId:'riverside',placeName:'江边',enteredAt:time,lastAt:time,timeline}},'2026-11-19',time);
  const {trip}=closeSession(state,time+1000,'回家','2026-11-19');
  assert.equal(timelineFor(trip).at(-1).kind,'close');
  assert.equal(trip.timelineTruncated,true);
});

test('缺失旧计数器时从长期序号恢复，后续出游不会误判为重复', () => {
  const st=normalizeState({day:'2026-11-19',exploration:[{placeId:'park',placeName:'公园',visits:500,lastSequence:500,tripIds:[]}]},'2026-11-19',time);
  assert.equal(st.tripSeq,500);
  enterVenue(st,VENUES.find((x)=>x.id==='park'),time);
  const {trip}=closeSession(st,time+1000,'回家','2026-11-19');
  assert.equal(trip.sequence,501);
  assert.equal(st.exploration[0].visits,501);
  assert.deepEqual(st.exploration[0].tripIds,[]);
});

test('两站路线拒绝缺失重复地点，往返归一化不丢状态', () => {
  assert.equal(normalizeRoute({...route,stops:[route.stops[0]]}),null);
  assert.equal(normalizeRoute({...route,stops:[route.stops[0],route.stops[0]]}),null);
  assert.equal(normalizeRoutes([route, route]).length,1);
  const st = newState('2026-11-19');
  storeRoute(st, route);
  assert.match(routeText(st.route), /夜市 → 江边/);
  storeRoute(st, {...st.route, status:'cancelled'});
  assert.equal(st.route,null);
  assert.equal(st.routes[0].status,'cancelled');
});

test('时间线只显示真实时间，旧事件保持未知而不配造项目', () => {
  const legacy = {placeId:'market',placeName:'夜市',enteredAt:time,visited:[{area:'糖水铺',at:time+1000}],events:['远处传来笑声'],souvenirs:['书签'],photos:[],choices:[],leftAt:time+2000};
  const timeline = timelineFor(legacy);
  assert.equal(timeline[0].hm,'18:00');
  const event = timeline.find((x) => x.kind==='event');
  assert.equal(event.at,null);
  assert.equal(event.area,'');
  assert.equal(event.hm,'');
  const state = normalizeState({day:'2026-11-19',session:legacy,trips:[]},'2026-11-19',time+2000);
  assert.ok(state.session.timeline.some((x) => x.text==='远处传来笑声'));
});

test('新时间线保留事件和选择的关联，过滤坏数据', () => {
  const outing = {};
  addMoment(outing,'event','鲸影经过',time,'海底隧道','鲸影经过');
  addMoment(outing,'choice','等了一会儿',time+1000,'海底隧道','鲸影经过');
  const timeline = timelineFor(outing);
  assert.equal(timeline[0].event,timeline[1].event);
  assert.equal(timeline[1].area,'海底隧道');
  assert.deepEqual(normalizeTimeline([null,{kind:'wrong',text:'a'}]),[]);
  assert.doesNotThrow(() => timelineFor({visited:{},events:12,choices:[null]}));
});

test('跨天草稿保留路线和时间线，收摊进永久探索', () => {
  const state = newState('2026-11-19');
  enterVenue(state,VENUES.find((x)=>x.id==='riverside'),time);
  state.session.routeId=route.id; state.session.routeOrder=1;
  state.session.phases=['傍晚'];
  addMoment(state.session,'enter','进了江边',time);
  const next=normalizeState(state,'2026-11-20',time+86400000);
  assert.equal(next.draft.routeId,route.id);
  assert.equal(next.draft.timeline[0].text,'进了江边');
  next.session=next.draft; next.draft=null;
  const {trip}=closeSession(next,time,'回家','2026-11-19');
  assert.equal(trip.routeOrder,1);
  assert.deepEqual(trip.phases,['傍晚']);
  assert.ok(trip.timeline.some((x)=>x.kind==='close'));
  assert.equal(next.exploration[0].visits,1);
});
