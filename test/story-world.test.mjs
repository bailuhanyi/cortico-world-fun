import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { FunWorld } from '../src/world.js';
import { BUILTIN_STORY_PACKS, storyFixtureJson } from './fixtures/story-presets.mjs';
import { cleanupAll, tempDir, trackWorld } from './tmp.mjs';
after(cleanupAll);
const at=(text)=>Date.parse(text);
async function boot(opts={}) {
 const dir=opts.dir ?? await tempDir('fun-story-');
 let now=opts.now ?? at('2026-11-19T14:00:00+08:00');
 const world=trackWorld(new FunWorld({cfg:{enabled:true,funStoryTextOn:true},dataDir:dir,timezone:'Asia/Shanghai',now:()=>now,random:()=>0}));
 await world.start({log:{info(){},warn(){}}});
 return {dir,world,tool:(name,args={})=>world.tools().find((x)=>x.name===name).handler(args),panel:(method,args={})=>world.webUi().invoke('stories',method,[args]),invoke:(panel,method,args=[])=>world.webUi().invoke(panel,method,args)};
}
async function custom(b) {
 const saved=await b.invoke('places','save',[{name:'自己的书屋',areas:['窗边','门口'],hours:{open:'00:00',close:'23:59'},randomEvents:[]}]);
 assert.equal(saved.ok,true,saved.error);
 return (await b.invoke('places','list')).places.find((p)=>p.name==='自己的书屋');
}
async function startStory(b,id) {
 const current=JSON.parse((await b.tool('fun_story_current')).text);
 const {candidates}=await b.tool('fun_story_candidates',{full:true});
 const card=candidates.find((row)=>row.id===id);
 assert.ok(card,id);
 const result=await b.tool('fun_story_start',{packId:id,revision:card.revision,startStamp:current.startStamp,confirm:true});
 assert.equal(result.failed,undefined,result.text);
 return JSON.parse(result.text);
}
async function sayStory(b,tripId,stamp,say) {
 const result=await b.tool('fun_story_act',{tripId,stamp,intent:'say',say});
 assert.equal(result.failed,undefined,result.text);
 return JSON.parse(result.text);
}
function pack(venue,id='user-window') {
 return {version:1,id,title:'窗边的一页',placeId:venue.id,start:'start',nodes:[
  {id:'start',area:'窗边',event:'窗边有一页翻开的书',prompt:'想停一会儿还是去门口看看？',choices:[{id:'stay',label:'停一会儿',result:'决定在窗边停一会儿',next:'end-a'},{id:'walk',label:'去门口',result:'决定去门口看看',next:'end-b'}]},
  {id:'end-a',area:'窗边',event:'又看了一会儿窗边的书页'},
  {id:'end-b',area:'门口',event:'从窗边走到门口，回头看了一眼书屋'},
 ]};
}

test('草稿隔离试玩逐步返回当前节点，但不保存故事、行程或解锁状态', async () => {
 const b=await boot(); const venue=await custom(b); const value=pack(venue);
 const json=JSON.stringify(value);
 const first=await b.panel('playtest',{json,path:[]});
 assert.equal(first.ok,true,first.error); assert.equal(first.playtest,true); assert.equal(first.sideEffects,false);
 assert.equal(first.current.id,'start'); assert.equal(first.current.options.length,2);
 const next=await b.panel('playtest',{json,path:['walk']});
 assert.equal(next.ok,true,next.error); assert.equal(next.current.id,'end-b');
 assert.match(next.current.event,/回头看了一眼/);
 await assert.rejects(readFile(b.world.storiesFile()),{code:'ENOENT'});
 await assert.rejects(readFile(b.world.stateFile()),{code:'ENOENT'});
 assert.equal((await b.invoke('book','list')).trips.length,0);
});

test('地点册为图鉴提供中文分类和故事绑定标记', async () => {
  const b=await boot();
  const list=await b.invoke('locations','list',[]);
  assert.equal(list.ok,true,list.error);
  const byId=new Map(list.places.map((place)=>[place.id,place]));
  assert.equal(byId.get('amusement').kindLabel,'游乐场');
  assert.equal(byId.get('riverside').kindLabel,'户外');
  assert.equal(byId.get('user-ezfvd').kindLabel,'故事地点');
  for (const id of ['user-ezfvd','user-f3u9p','riverside','museum']) {
    assert.equal(byId.get(id).storyBound,true,id);
    assert.equal(byId.get(id).builtinStoryBound,true,id);
    assert.equal(byId.get(id).customStoryBound,false,id);
  }
  assert.equal(byId.get('amusement').storyBound,false);
  assert.equal(byId.get('amusement').userPlace,false);
  const created=await b.invoke('locations','create',[{input:{name:'自己的小屋'},revision:list.revision}]);
  assert.equal(created.ok,true,created.error);
  const fresh=created.places.find((place)=>place.name==='自己的小屋');
  assert.equal(fresh.kindLabel,'');
  assert.equal(fresh.userPlace,true);
  assert.equal(fresh.storyBound,false);
});

test('公共故事查询返回稳定公开字段且不泄露未来分支或写盘', async () => {
 const b=await boot();
 assert.equal((await b.panel('import',{json:storyFixtureJson(BUILTIN_STORY_PACKS.find(({id})=>id==='duo-cafe-date'))})).ok,true);
 const beforePacks=await b.panel('list');
 const beforeStories=await readFile(b.world.storiesFile(),'utf8');
 const candidates=await b.tool('fun_story_candidates');
 assert.equal(candidates.ok,true);
 assert.ok(candidates.candidates.some((card)=>card.id==='duo-cafe-date'));
 assert.ok(candidates.candidates.every((card)=>!('nodes' in card)));
 assert.ok(!JSON.stringify(candidates).includes('鱼把书合上'));
 const detail=await b.tool('fun_story_detail',{id:'duo-cafe-date'});
 assert.equal(detail.ok,true); assert.equal(detail.story.participation,'duo');
 assert.equal(typeof detail.story.duration,'string'); assert.ok(!('nodes' in detail.story));
 const places=await b.tool('fun_story_places');
 assert.equal(places.ok,true); assert.ok(places.places.some((place)=>place.id==='cafe'));
 const current=await b.tool('fun_story_current'); assert.equal(current.state,'none');
 const schedule=await b.tool('fun_story_schedule',{id:'duo-cafe-date'});
 assert.equal(schedule.ok,true); assert.match(schedule.text,/不会开始故事/);
 assert.equal((await b.panel('list')).packs.length,beforePacks.packs.length);
 assert.equal(await readFile(b.world.storiesFile(),'utf8'),beforeStories);
 await assert.rejects(readFile(b.world.stateFile()),{code:'ENOENT'});
});


 test('校验预览与模板只读，未导入的故事不影响普通地点游玩', async () => {
 const b=await boot(); const venue=await custom(b); const value=pack(venue);
 const validated=await b.panel('validate',{json:JSON.stringify(value)}); assert.equal(validated.ok,true,validated.error);
 const preview=await b.panel('preview',{json:JSON.stringify(value)}); assert.equal(preview.ok,true);assert.equal(preview.eligible,true);
 await b.panel('list'); await b.panel('template',{placeId:venue.id});
 await assert.rejects(readFile(b.world.storiesFile()),{code:'ENOENT'});
 await b.tool('fun_go',{place:venue.id});const walked=await b.tool('fun_wander',{area:'窗边'});
 assert.equal(walked.failed,undefined);assert.doesNotMatch(walked.text,/窗边有一页翻开的书/);
 await b.tool('fun_home');assert.equal((await b.invoke('book','list')).trips.length,1);
});

test('自填剧情可导入、选分支、重启续接，完成后不重复触发',async()=>{
 const b=await boot(); const venue=await custom(b);
 assert.equal((await b.panel('import',{json:JSON.stringify(pack(venue))})).ok,true);
 const started=await startStory(b,'user-window');
 const moved=await sayStory(b,started.tripId,started.stamp,'走到窗边');
 assert.ok(moved.pending,'走到故事节点后应给出包内选项');
 await b.world.stop();
 const again=await boot({dir:b.dir});
 const resumed=JSON.parse((await again.tool('fun_story_current')).text).trip;
 const chosen=await sayStory(again,resumed.id,resumed.stamp,'去门口');
 assert.match(chosen.result,/决定去门口/);
 const current=JSON.parse((await again.tool('fun_story_current')).text).trip;
 const ended=await sayStory(again,current.id,current.stamp,'走到门口');
 assert.match(ended.narration,/回头看了一眼书屋/);
 const final=JSON.parse((await again.tool('fun_story_current')).text).trip;
 const closed=await again.tool('fun_story_act',{tripId:final.id,stamp:final.stamp,intent:'close',confirm:true});
 assert.equal(closed.failed,undefined,closed.text);
 const {trips:[trip]}=await again.invoke('book','list');
 assert.ok(trip.choices.some((c)=>c.option==='walk'));
 assert.ok(trip.timeline.some((p)=>p.kind==='event'&&p.text.includes('书屋')));
});

test('更新启动不覆盖用户文件，自填剧情启停与替换保护持久保留',async()=>{
 const b=await boot();const venue=await custom(b);
 await b.panel('import',{json:JSON.stringify(pack(venue))});
 const disabled=pack(venue,'user-disabled');
 assert.equal((await b.panel('import',{json:JSON.stringify(disabled)})).ok,true);
 assert.equal((await b.panel('disable',{id:disabled.id})).ok,true);
 const before=await readFile(b.world.storiesFile(),'utf8');
 const again=await boot({dir:b.dir});
 assert.equal(await readFile(again.world.storiesFile(),'utf8'),before);
 const listed=await again.panel('list');
 assert.equal(listed.packs.find((p)=>p.id==='user-window').builtin,false);
 assert.equal(listed.packs.find((p)=>p.id===disabled.id).enabled,false);
 const replacement=pack(venue);replacement.title='用户第二稿';
 assert.equal((await again.panel('import',{json:JSON.stringify(replacement)})).ok,false);
 assert.equal(await readFile(again.world.storiesFile(),'utf8'),before);
 assert.equal((await again.panel('import',{json:JSON.stringify(replacement),replace:true})).ok,true);
});

test('清理完成后作者新建曾用预设 ID 的作品，重启不再清除或覆盖',async()=>{
 const b=await boot();const venue=await custom(b);
 assert.equal((await b.panel('import',{json:JSON.stringify(pack(venue))})).ok,true);
 const migrations=JSON.parse(await readFile(b.world.storiesFile(),'utf8')).migrations;
 const owned=pack(venue,'duo-cafe-date');owned.title='用户原先保存的内容';
 await b.world.stop();
 const source=JSON.stringify({version:1,packs:[owned],disabledIds:[],migrations},null,2);
 await writeFile(b.world.storiesFile(),source,'utf8');
 const again=await boot({dir:b.dir});
 const rows=(await again.panel('list')).packs.filter((p)=>p.id===owned.id);
 assert.equal(rows.length,1);assert.equal(rows[0].builtin,false);assert.equal(rows[0].title,owned.title);
 assert.equal(await readFile(again.world.storiesFile(),'utf8'),source);
 owned.title='用户继续修改';
 assert.equal((await again.panel('import',{json:JSON.stringify(owned),replace:true})).ok,true);
});

test('清空出游记录不删除用户写的剧情和故事启停设置',async()=>{
 const b=await boot();const venue=await custom(b);
 await b.panel('import',{json:JSON.stringify(pack(venue))});
 const disabled=pack(venue,'user-disabled');
 await b.panel('import',{json:JSON.stringify(disabled)});
 await b.panel('disable',{id:disabled.id});
 const before=await readFile(b.world.storiesFile(),'utf8');
 await b.world.webUi().storage[0].clear();
 assert.equal(await readFile(b.world.storiesFile(),'utf8'),before);
 const data=await b.panel('list');
 assert.ok(data.packs.some((p)=>p.id==='user-window'));
 assert.equal(data.packs.find((p)=>p.id===disabled.id).enabled,false);
});

test('替换或删除包不破坏已给出的选择，旧版本本趟不重启',async()=>{
 const b=await boot();const venue=await custom(b);let value=pack(venue);
 await b.panel('import',{json:JSON.stringify(value)});
 const started=await startStory(b,'user-window');
 const moved=await sayStory(b,started.tripId,started.stamp,'走到窗边');
 assert.ok(moved.pending);
 value=pack(venue);value.nodes[0].event='改版后的新开场';
 await b.panel('import',{json:JSON.stringify(value),replace:true});
 let current=JSON.parse((await b.tool('fun_story_current')).text).trip;
 assert.match((await sayStory(b,current.id,current.stamp,'停一会儿')).result,/决定在窗边停一会儿/);
 current=JSON.parse((await b.tool('fun_story_current')).text).trip;
 assert.equal(current.step,'blocked');
 assert.ok(current.events.every((event)=>!event.includes('改版后的新开场')));
 const closed=await b.tool('fun_story_act',{tripId:current.id,stamp:current.stamp,intent:'close',confirm:true});
 assert.equal(closed.failed,undefined,closed.text);
 const fresh=await startStory(b,'user-window');
 const newOpen=await sayStory(b,fresh.tripId,fresh.stamp,'走到窗边');
 assert.match(newOpen.narration,/改版后的新开场/);
 current=JSON.parse((await b.tool('fun_story_current')).text).trip;
 assert.equal((await b.panel('remove',{id:value.id})).ok,true);
 current=JSON.parse((await b.tool('fun_story_current')).text).trip;
 assert.ok(current.pending,'已发出的包内选项仍可提交');
 assert.match((await sayStory(b,current.id,current.stamp,'去门口')).result,/决定去门口/);
});

test('地点或项目被删除时剧情暂停，已有包和普通出游保持可用',async()=>{
 const b=await boot();const venue=await custom(b);
 await b.panel('import',{json:JSON.stringify(pack(venue))});
 await b.invoke('places','save',[{id:venue.id,name:venue.name,areas:['门口'],hours:{open:'00:00',close:'23:59'}}]);
 let row=(await b.panel('list')).packs.find((p)=>p.id==='user-window');assert.equal(row.available,false);assert.ok(row.warnings.length);
 await b.tool('fun_go',{place:venue.id});assert.equal((await b.tool('fun_wander',{area:'门口'})).failed,undefined);await b.tool('fun_home');
 await b.invoke('places','remove',[{id:venue.id}]);
 row=(await b.panel('list')).packs.find((p)=>p.id==='user-window');assert.equal(row.available,false);
 assert.equal((await b.panel('export',{id:row.id})).ok,true);
});

test('错误包不落盘，只读方法不能通过参数变成导入，重复并发导入只成功一次',async()=>{
 const b=await boot();const venue=await custom(b);const json=JSON.stringify(pack(venue));
 assert.equal((await b.panel('import',{json:'{ broken'})).ok,false);
 assert.equal((await b.panel('validate',{json:JSON.stringify({...pack(venue),script:'throw new Error()'})})).ok,false);
 assert.equal((await b.invoke('stories','preview',[{action:'import',json}])).ok,true);
 await assert.rejects(readFile(b.world.storiesFile()),{code:'ENOENT'});
 const results=await Promise.all([b.panel('import',{json}),b.panel('import',{json})]);
 assert.deepEqual(results.map((r)=>r.ok),[true,false]);
 assert.equal((await b.panel('list')).packs.filter((p)=>!p.builtin).length,1);
});

test('坏文件不影响启动，后续修改先备份；写盘失败保留原剧情设置',async()=>{
 const dir=await tempDir('fun-story-bad-');await mkdir(join(dir,'fun'));
 await writeFile(join(dir,'fun','stories.json'),'{broken','utf8');
 const b=await boot({dir});assert.ok((await b.panel('list')).warnings.length);
 const venue=await custom(b);assert.equal((await b.panel('import',{json:JSON.stringify(pack(venue))})).ok,true);
 const backup=(await readdir(join(dir,'fun'))).find((f)=>f.endsWith('.bak'));
 assert.ok(backup);assert.equal(await readFile(join(dir,'fun',backup),'utf8'),'{broken');
 const before=await readFile(b.world.storiesFile(),'utf8');await mkdir(b.world.storiesFile()+'.tmp');
 assert.equal((await b.panel('disable',{id:'user-window'})).ok,false);
 assert.equal((await b.panel('list')).packs.find((p)=>p.id==='user-window').enabled,true);
 assert.equal(await readFile(b.world.storiesFile(),'utf8'),before);
});
