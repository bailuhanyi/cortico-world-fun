import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FunWorld } from '../src/world.js';
const at=(text)=>Date.parse(text);
async function boot(opts={}) {
 const dir=opts.dir ?? await mkdtemp(join(tmpdir(),'fun-story-'));
 let now=opts.now ?? at('2026-11-19T14:00:00+08:00');
 const world=new FunWorld({cfg:{enabled:true},dataDir:dir,timezone:'Asia/Shanghai',now:()=>now,random:()=>0});
 await world.start({log:{info(){},warn(){}}});
 return {dir,world,tool:(name,args={})=>world.tools().find((x)=>x.name===name).handler(args),panel:(method,args={})=>world.webUi().invoke('stories',method,[args]),invoke:(panel,method,args=[])=>world.webUi().invoke(panel,method,args)};
}
async function custom(b) {
 const saved=await b.invoke('places','save',[{name:'自己的书屋',areas:['窗边','门口'],hours:{open:'00:00',close:'23:59'},randomEvents:[]}]);
 assert.equal(saved.ok,true,saved.error);
 return (await b.invoke('places','list')).places.find((p)=>p.name==='自己的书屋');
}
function pack(venue,id='user-window') {
 return {version:1,id,title:'窗边的一页',placeId:venue.id,start:'start',nodes:[
  {id:'start',area:'窗边',event:'窗边有一页翻开的书',prompt:'想停一会儿还是去门口看看？',choices:[{id:'stay',label:'停一会儿',result:'决定在窗边停一会儿',next:'end-a'},{id:'walk',label:'去门口',result:'决定去门口看看',next:'end-b'}]},
  {id:'end-a',area:'窗边',event:'又看了一会儿窗边的书页'},
  {id:'end-b',area:'门口',event:'从窗边走到门口，回头看了一眼书屋'},
 ]};
}

test('自填地点没有剧情也能完整出游，管理的查看校验预览不写盘',async()=>{
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
 await b.tool('fun_go',{place:venue.id});
 assert.match((await b.tool('fun_wander',{area:'窗边'})).text,/窗边有一页翻开的书/);
 const pending=(await b.invoke('places','list')).session.pendingChoice;
 assert.ok(pending.id.startsWith('story:'));
 const again=await boot({dir:b.dir});
 assert.match((await again.tool('fun_choice',{choiceId:pending.id,optionId:'walk'})).text,/决定去门口/);
 assert.match((await again.tool('fun_wander',{area:'门口'})).text,/回头看了一眼书屋/);
 assert.doesNotMatch((await again.tool('fun_wander',{area:'窗边'})).text,/窗边有一页翻开的书/);
 await again.tool('fun_home');
 const {trips:[trip]}=await again.invoke('book','list');
 assert.ok(trip.choices.some((c)=>c.option==='walk'));
 assert.ok(trip.timeline.some((p)=>p.kind==='event'&&p.text.includes('书屋')));
});

test('更新启动不覆盖用户文件，内置停用与自填剧情都持久保留',async()=>{
 const b=await boot();const venue=await custom(b);
 await b.panel('import',{json:JSON.stringify(pack(venue))});
 const builtin=(await b.panel('list')).packs.find((p)=>p.builtin);
 assert.ok(builtin); await b.panel('disable',{id:builtin.id});
 const before=await readFile(b.world.storiesFile(),'utf8');
 const again=await boot({dir:b.dir});
 assert.equal(await readFile(again.world.storiesFile(),'utf8'),before);
 const listed=await again.panel('list');
 assert.equal(listed.packs.find((p)=>p.id==='user-window').builtin,false);
 assert.equal(listed.packs.find((p)=>p.id===builtin.id).enabled,false);
 const replacement=pack(venue);replacement.title='用户第二稿';
 assert.equal((await again.panel('import',{json:JSON.stringify(replacement)})).ok,false);
 assert.equal(await readFile(again.world.storiesFile(),'utf8'),before);
 assert.equal((await again.panel('import',{json:JSON.stringify(replacement),replace:true})).ok,true);
});

test('未来预设 ID 与已存用户内容重名时仍保留用户版本',async()=>{
 const b=await boot();const venue=await custom(b);
 const builtin=(await b.panel('list')).packs.find((p)=>p.builtin);
 const owned=pack(venue,builtin.id);owned.title='用户原先保存的内容';
 await b.world.stop();
 const source=JSON.stringify({version:1,packs:[owned],disabledIds:[]},null,2);
 await writeFile(b.world.storiesFile(),source,'utf8');
 const again=await boot({dir:b.dir});
 const rows=(await again.panel('list')).packs.filter((p)=>p.id===builtin.id);
 assert.equal(rows.length,1);assert.equal(rows[0].builtin,false);assert.equal(rows[0].title,owned.title);
 assert.equal(await readFile(again.world.storiesFile(),'utf8'),source);
 owned.title='用户继续修改';
 assert.equal((await again.panel('import',{json:JSON.stringify(owned),replace:true})).ok,true);
});

test('清空出游记录不删除用户写的剧情和内置启停设置',async()=>{
 const b=await boot();const venue=await custom(b);
 await b.panel('import',{json:JSON.stringify(pack(venue))});
 const builtin=(await b.panel('list')).packs.find((p)=>p.builtin);
 await b.panel('disable',{id:builtin.id});
 const before=await readFile(b.world.storiesFile(),'utf8');
 await b.world.webUi().storage[0].clear();
 assert.equal(await readFile(b.world.storiesFile(),'utf8'),before);
 const data=await b.panel('list');
 assert.ok(data.packs.some((p)=>p.id==='user-window'));
 assert.equal(data.packs.find((p)=>p.id===builtin.id).enabled,false);
});

test('替换或删除包不破坏已给出的选择，旧版本本趟不重启',async()=>{
 const b=await boot();const venue=await custom(b);let value=pack(venue);
 await b.panel('import',{json:JSON.stringify(value)});await b.tool('fun_go',{place:venue.id});await b.tool('fun_wander',{area:'窗边'});
 const choice=(await b.invoke('places','list')).session.pendingChoice;
 value=pack(venue);value.nodes[0].event='改版后的新开场';
 await b.panel('import',{json:JSON.stringify(value),replace:true});
 assert.equal((await b.tool('fun_choice',{choiceId:choice.id,optionId:'stay'})).failed,undefined);
 assert.doesNotMatch((await b.tool('fun_wander',{area:'窗边'})).text,/改版后的新开场/);
 await b.tool('fun_home');await b.tool('fun_go',{place:venue.id});
 assert.match((await b.tool('fun_wander',{area:'窗边'})).text,/改版后的新开场/);
 const current=(await b.invoke('places','list')).session.pendingChoice;
 await b.panel('remove',{id:value.id});
 assert.equal((await b.tool('fun_choice',{choiceId:current.id,optionId:'walk'})).failed,undefined);
 assert.equal((await b.tool('fun_wander',{area:'门口'})).failed,undefined);
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
 const dir=await mkdtemp(join(tmpdir(),'fun-story-bad-'));await mkdir(join(dir,'fun'));
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
