import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FunWorld } from '../src/world.js';
import { cleanupAll, tempDir, trackWorld } from './tmp.mjs';
after(cleanupAll);
async function boot(opts={}) {
  const dir=opts.dir ?? await tempDir('fun-journal-');
  let now=opts.now ?? Date.parse('2026-11-19T18:00:00+08:00');
  const world=trackWorld(new FunWorld({cfg:{enabled:true},dataDir:dir,timezone:'Asia/Shanghai',now:()=>now,random:()=>0}));
  await world.start({log:{info(){},warn(){}}});
  return {dir,world,tool:(name,args={})=>world.tools().find((x)=>x.name===name).handler(args),setNow:(n)=>{now=n;},data:(panel='places',method='list',args=[])=>world.webUi().invoke(panel,method,args)};
}

test('合并后的 fun_journal 只提供行程、展示柜与珍藏，旧入口已收起',async()=>{
  const b=await boot();
  const names=b.world.tools().map((x)=>x.name);
  assert.ok(!names.includes('fun_route'));
  assert.ok(!names.includes('fun_view'));
  assert.ok(!names.includes('fun_shelf'));
  await b.tool('fun_go',{place:'漫展',company:'阿岚'});
  await b.tool('fun_wander',{area:'同人展台',buy:'吧唧'});
  await b.tool('fun_home',{note:'逛得很开心'});
  const {trips:[trip]}=await b.data('book');
  assert.ok((await b.tool('fun_journal',{view:'trips'})).text.includes(trip.id));
  assert.match((await b.tool('fun_journal',{view:'shelf'})).text,/吧唧/);
  assert.equal((await b.tool('fun_journal',{view:'keepsake',id:trip.id,keep:true})).failed,undefined);
  assert.ok((await b.tool('fun_journal',{view:'keepsake'})).text.includes(trip.id));
  assert.equal((await b.tool('fun_journal',{view:'keepsake',id:trip.id,keep:false})).failed,undefined);
});

test('检索可组合条件，地点和收藏链接只读真实保留的行程',async()=>{
  const b=await boot(); await b.tool('fun_go',{place:'漫展',company:'阿岚'});
  await b.tool('fun_wander',{area:'同人展台',buy:'吧唧'}); await b.tool('fun_home',{note:'遇到喜欢的航灯图'});
  const {trips:[trip]}=await b.data('book');
  const before=await readFile(b.world.stateFile(),'utf8');
  assert.ok((await b.tool('fun_journal',{view:'trips'})).text.includes(trip.id));
  assert.equal((await b.data('places','history',[{placeId:trip.placeId}])).trips[0].id,trip.id);
  assert.equal((await b.data('shelf','trip',[{id:trip.id}])).trips[0].id,trip.id);
  assert.equal((await b.data('shelf','trip',[{id:'missing'}])).ok,false);
  assert.equal(await readFile(b.world.stateFile(),'utf8'),before);
  assert.ok(trip.timeline.some((x)=>x.kind==='buy'&&x.at&&x.hm));
  assert.equal(trip.timeline[0].kind,'enter'); assert.equal(trip.timeline.at(-1).kind,'close');
});

test('普通游逛事件不再生成分支待选，行程和时间线仍持续记录',async()=>{
  const b=await boot();
  await b.tool('fun_go',{place:'江边'});
  const first=await b.tool('fun_wander',{area:'栏杆边'});
  assert.doesNotMatch(first.text,/choiceId|optionId|fun_choice/);
  const {session}=await b.data(); assert.equal(Object.hasOwn(session,'pendingChoice'),false);
  const again=await boot({dir:b.dir,now:Date.parse('2026-11-19T18:10:00+08:00')});
  const next=await again.tool('fun_wander',{area:'步道'});
  assert.equal(next.failed,undefined,'普通出游不再被旧分支待选卡住');
  await again.tool('fun_home');
  const {trips:[trip]}=await again.data('book');
  assert.deepEqual(trip.visited,['栏杆边','步道']);
  assert.ok(trip.timeline.some((point)=>point.kind==='area'&&point.text.includes('栏杆边')));
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
