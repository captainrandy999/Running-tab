/* Private, on-device exports: one file includes both lists. Nothing is uploaded. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const M='running-tab-simple-v1',T='running-tab-todo-v1',notice=$('backupStatus');
if(!$('downloadBackup')||!$('restoreBackup'))return;
if(window.location.hash==='#dataTools'){const details=$('settingsDetail');if(details)details.open=true;}
function say(msg,err=false){if(!notice)return;notice.textContent=msg;notice.style.color=err?'#9b3741':'#14745b';}
function parseList(key){const raw=localStorage.getItem(key);if(!raw)return [];const list=JSON.parse(raw);if(!Array.isArray(list))throw new Error('Stored data is not a list');return list;}
function safeMoney(r){return r&&typeof r.id==='string'&&typeof r.person==='string'&&['to_me','i_owe'].includes(r.direction)&&(r.cents===null||(Number.isSafeInteger(r.cents)&&r.cents>0))&&typeof r.reason==='string'&&typeof r.date==='string';}
function safeTodo(r){return r&&typeof r.id==='string'&&typeof r.title==='string'&&['none','month','day'].includes(r.dueType)&&typeof r.due==='string'&&typeof r.done==='boolean';}
$('downloadBackup').addEventListener('click',()=>{
 try{
  const money=parseList(M),todos=parseList(T);
  if(!money.every(safeMoney)||!todos.every(safeTodo))throw new Error('One or more saved entries need attention');
  const payload={format:'running-tab-backup',version:1,exportedAt:new Date().toISOString(),money,todos};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='running-tab-backup-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  say('Backup downloaded: '+money.length+' money entries and '+todos.length+' reminders.');
 }catch(e){say('Could not create backup: '+e.message,true);}
});
$('restoreBackup').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>15_000_000)throw new Error('Backup file is too large');
  const d=JSON.parse(await file.text());
  if(!d||d.format!=='running-tab-backup'||d.version!==1||!Array.isArray(d.money)||!Array.isArray(d.todos))throw new Error('This is not a Running Tab backup');
  if(d.money.length>100000||d.todos.length>100000||!d.money.every(safeMoney)||!d.todos.every(safeTodo))throw new Error('The backup contains invalid entries');
  if(!confirm('Restore '+d.money.length+' money entries and '+d.todos.length+' reminders? This REPLACES the existing lists on this phone.'))return;
  const oldMoney=localStorage.getItem(M),oldTodo=localStorage.getItem(T);
  try{localStorage.setItem(M,JSON.stringify(d.money));localStorage.setItem(T,JSON.stringify(d.todos));}
  catch(err){try{oldMoney===null?localStorage.removeItem(M):localStorage.setItem(M,oldMoney);oldTodo===null?localStorage.removeItem(T):localStorage.setItem(T,oldTodo);}catch(e2){}throw err;}
  say('Restore complete. Reloading your lists…');window.location.reload();
 }catch(err){say('Restore failed: '+err.message,true);}
 finally{e.target.value='';}
});
})();
