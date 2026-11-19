import test from 'node:test';
import assert from 'node:assert/strict';
import { branchChoiceFor, branchFollowup } from '../src/branches.js';

test('江边选择只在真实项目提供，略过不会生成后续',()=>{
  assert.equal(branchChoiceFor('riverside','不存在',{},1000),null);
  const choice=branchChoiceFor('riverside','栏杆边',{events:[],choices:[]},1000);
  assert.ok(choice.options.some((x)=>x.id==='lights'));
  assert.equal(branchFollowup('riverside','步道',{choices:[{event:choice.event,option:'skip'}]},1100),null);
  const session={choices:[{event:choice.event,option:'lights'}],branchSeen:[],events:[]};
  assert.equal(branchFollowup('riverside','步道',session,1000),null,'没有到傍晚不提前亮灯');
  const next=branchFollowup('riverside','步道',session,1100);
  assert.ok(next?.event.includes('灯亮'));
  session.branchSeen.push(next.id);
  assert.equal(branchFollowup('riverside','步道',session,1100),null);
});

test('夜市不同选择只在对应目的项目产生回应，不擅自移动',()=>{
  const choice=branchChoiceFor('market','烧烤摊',{},21*60);
  assert.equal(choice.options.length,2);
  const picked=choice.options[0]; const area=picked.id.slice(3);
  const session={choices:[{event:choice.event,option:picked.id}],events:[]};
  assert.equal(branchFollowup('market','烧烤摊',session,21*60),null);
  const follow=branchFollowup('market',area,session,21*60);
  assert.ok(follow?.event); assert.equal(follow.area,undefined);
  assert.equal(branchChoiceFor('market','烧烤摊',{events:[choice.event]},21*60),null);
});

test('海洋馆既有决定能影响后面场所的回应',()=>{
  const event='一条大鲸从头顶慢慢游过去，影子把整条隧道盖了一下';
  const walk={choices:[{event,option:'walk'}]};
  assert.ok(branchFollowup('aquarium','水母缸',walk,14*60));
  assert.equal(branchFollowup('aquarium','水母缸',{choices:[{event,option:'wait'}]},14*60),null);
});
