import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FunWorld } from '../src/world.js';
async function boot(opts={}) {
  const dir=opts.dir ?? await mkdtemp(join(tmpdir(),'fun-journal-'));
  let now=opts.now ?? Date.parse('2026-11-19T18:00:00+08:00');
  const world=new FunWorld({cfg:{enabled:true},dataDir:dir,timezone:'Asia/Shanghai',now:()=>now,random:()=>0});
  await world.start({log:{info(){},warn(){}}});
  return {dir,world,tool:(name,args={})=>world.tools().find((x)=>x.name===name).handler(args),setNow:(n)=>{now=n;},data:(panel='places',method='list',args=[])=>world.webUi().invoke(panel,method,args)};
}

test('两站出门不自动移动，可重启续接、换站并归为同一次出门',async()=>{
  const b=await boot();
  assert.equal((await b.tool('fun_route',{action:'plan',places:['夜市','江边'],company:'阿岚'})).failed,undefined);
  let data=await b.data(); const id=data.route.id;
  assert.equal(data.session,null);
  assert.equal((await b.tool('fun_route',{action:'next',id:'stale'})).failed,true);
  await b.tool('fun_route',{action:'next',id});
  await b.tool('fun_wander'); await b.tool('fun_home',{note:'第一站很热闹'});
  data=await b.data(); assert.equal(data.session,null); assert.equal(data.route.status,'between');
  const again=await boot({dir:b.dir});
  await again.tool('fun_route',{action:'change',id,place:'公园'});
  await again.tool('fun_route',{action:'next',id});
  await again.tool('fun_wander'); await again.tool('fun_home',{note:'第二站很安静'});
  const book=await again.data('book');
  assert.equal(book.trips.length,2);
  assert.ok(book.trips.every((t)=>t.routeId===id&&t.company==='阿岚'));
  assert.deepEqual(book.trips.map((t)=>t.routeOrder).sort(),[1,2]);
  assert.equal(book.routes.find((r)=>r.id===id).status,'completed');
  assert.equal(book.routes.find((r)=>r.id===id).stops[1].placeName,'公园');
  assert.equal((await again.data()).route,null);
});

test('路线可提前结束，重复地点和未收摊的下一站不会隐式移动',async()=>{
  const b=await boot();
  assert.equal((await b.tool('fun_route',{action:'plan',places:['公园','公园']})).failed,true);
  await b.tool('fun_route',{action:'plan',places:['公园','江边']}); const {route}=await b.data();
  await b.tool('fun_route',{action:'next',id:route.id});
  assert.equal((await b.tool('fun_route',{action:'next',id:route.id})).failed,true);
  await b.tool('fun_route',{action:'cancel',id:route.id}); await b.tool('fun_home');
  const book=await b.data('book'); assert.equal(book.trips.length,1); assert.equal(book.routes[0].status,'cancelled');
  assert.equal((await b.tool('fun_route',{action:'next',id:route.id})).failed,true);
});

test('检索可组合条件，地点和收藏链接只读真实保留的行程',async()=>{
  const b=await boot(); await b.tool('fun_go',{place:'漫展',company:'阿岚'});
  await b.tool('fun_wander',{area:'同人展台',buy:'吧唧'}); await b.tool('fun_home',{note:'遇到喜欢的航灯图'});
  const {trips:[trip]}=await b.data('book');
  const before=await readFile(b.world.stateFile(),'utf8');
  assert.ok((await b.tool('fun_view',{query:'航灯',company:'阿岚',from:'2026-11-19',to:'2026-11-19'})).text.includes(trip.id));
  assert.match((await b.tool('fun_view',{company:'别人'})).text,/没有找到/);
  assert.equal((await b.data('places','history',[{placeId:trip.placeId}])).trips[0].id,trip.id);
  assert.equal((await b.data('shelf','trip',[{id:trip.id}])).trips[0].id,trip.id);
  assert.equal((await b.data('shelf','trip',[{id:'missing'}])).ok,false);
  assert.equal(await readFile(b.world.stateFile(),'utf8'),before);
  assert.ok(trip.timeline.some((x)=>x.kind==='buy'&&x.at&&x.hm));
  assert.equal(trip.timeline[0].kind,'enter'); assert.equal(trip.timeline.at(-1).kind,'close');
});

test('事件选择重启后仍会影响后续项目，并写入沿途时间线',async()=>{
  const b=await boot(); await b.tool('fun_go',{place:'江边'});
  await b.tool('fun_wander',{area:'栏杆边'});
  const {session}=await b.data(); const choice=session.pendingChoice;
  assert.ok(choice);
  await b.tool('fun_choice',{choiceId:choice.id,optionId:'lights'});
  const again=await boot({dir:b.dir,now:Date.parse('2026-11-19T18:10:00+08:00')});
  const next=await again.tool('fun_wander',{area:'步道'});
  assert.match(next.text,/沿岸的灯亮/);
  await again.tool('fun_home');
  const {trips:[trip]}=await again.data('book');
  assert.ok(trip.timeline.some((point)=>point.kind==='choice'&&point.event===choice.event));
  assert.ok(trip.timeline.some((point)=>point.kind==='event'&&point.text.includes('灯亮')));
});

test('长期探索不随40趟裁剪倒退，重启仍保留早期项目和拍照点',async()=>{
  const b=await boot(); await b.tool('fun_go',{place:'海洋馆'});
  await b.tool('fun_wander',{area:'鲸豚湾',photo:'鲸豚湾的玻璃幕墙前'}); await b.tool('fun_home');
  for(let i=0;i<41;i++){await b.tool('fun_go',{place:'公园'});await b.tool('fun_home');}
  const again=await boot({dir:b.dir}); const {progress}=await again.data('shelf');
  const aquarium=progress.find((p)=>p.placeName==='海洋馆');
  assert.equal(aquarium.visits,1);assert.equal(aquarium.areas.done,1);assert.equal(aquarium.photos.done,1);
  const returned=await again.tool('fun_go',{place:'海洋馆'}); assert.match(returned.text,/来过这里 1 次/);
});
