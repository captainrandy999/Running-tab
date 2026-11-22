/* Safe expiry policy for completed tasks; do not delete notes or active reminders. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MyDayTodoCleanup=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const KEY='myday-completed-todo-retention-v1';
 const OPTIONS=['off','7','14','30','90'];
 const DEFAULT='7';
 const normalize=value=>OPTIONS.includes(String(value))?String(value):DEFAULT;
 function expiry(task,days,now=Date.now()){
  if(!task?.done||task.kind==='note'||(task.repeat&&task.repeat.type!=='minutes'))return false;
  if(!days||days==='off')return false;
  const completed=Date.parse(task.completedAt||'');
  return Number.isFinite(completed)&&completed>0&&completed<=now-Number(days)*86400000;
 }
 function prune(items,days=DEFAULT,now=Date.now()){
  const policy=normalize(days);
  if(!Array.isArray(items)||policy==='off')return {keep:items,removed:[]};
  const keep=[],removed=[];
  for(const task of items)(expiry(task,policy,now)?removed:keep).push(task);
  return {keep,removed};
 }
 return {KEY,OPTIONS,DEFAULT,normalize,expiry,prune};
});
