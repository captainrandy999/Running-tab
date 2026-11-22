const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const policy=require('../todo-cleanup.js');
const now=Date.parse('2026-11-22T12:00:00.000Z');
const age=days=>new Date(now-days*86400000).toISOString();
test('seven-day cleanup removes only eligible completed items',()=>{
 const data=[
  {id:'old',title:'Old completed task',done:true,completedAt:age(8)},
  {id:'new',title:'Recent completed task',done:true,completedAt:age(2)},
  {id:'pending',title:'Unfinished task',done:false,completedAt:age(20)},
  {id:'note',kind:'note',title:'Archived note',done:true,completedAt:age(60)},
  {id:'repeat',title:'Recurring reminder',done:true,repeat:{type:'daily'},completedAt:age(30)},
  {id:'minutes',title:'Stopped interval',done:true,repeat:{type:'minutes'},completedAt:age(20)},
  {id:'legacy',title:'Old task without timestamp',done:true}
 ];
 const {keep,removed}=policy.prune(data,'7',now);
 assert.deepEqual(removed.map(x=>x.id),['old','minutes']);
 assert.deepEqual(keep.map(x=>x.id),['new','pending','note','repeat','legacy']);
});
test('off and alternate periods work',()=>{
 const data=[{id:'1',done:true,completedAt:age(15)}];
 assert.equal(policy.prune(data,'off',now).removed.length,0);
 assert.equal(policy.prune(data,'7',now).removed.length,1);
 assert.equal(policy.prune(data,'14',now).removed.length,1);
 assert.equal(policy.prune(data,'30',now).removed.length,0);
 assert.equal(policy.normalize('invalid'),'7');
});
test('completed records without a timestamp stay intact',()=>{
 assert.equal(policy.prune([{id:'x',done:true,created:age(100),due:'2025-01-01'}],'7',now).removed.length,0);
});
test('To-Do and Shopping notices dismiss and list actions exist',()=>{
 const todo=fs.readFileSync(path.join(__dirname,'../todo-panel.js'),'utf8');
 const shop=fs.readFileSync(path.join(__dirname,'../shopping-panel.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(todo,/statusTimer=setTimeout/);
 assert.match(shop,/statusTimer=setTimeout/);
 assert.match(html,/id="todoClearCompleted"/);
 assert.match(html,/id="todoDeleteAll"/);
 assert.match(html,/id="todoRetentionDays"/);
 assert.match(todo,/data-remove/);
});
