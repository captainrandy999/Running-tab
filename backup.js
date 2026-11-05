/* Private on-device backups for all three Running Tab lists, including legacy backups. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const KEYS={money:'running-tab-simple-v1',todos:'running-tab-todo-v1',shopping:'running-tab-shopping-v1'};
 const message=$('backupStatus');
 if(!$('downloadBackup')||!$('restoreBackup'))return;
 if(location.hash==='#dataTools'&&$('settingsDetail'))$('settingsDetail').open=true;
 const say=(value,error=false)=>{if(message){message.textContent=value;message.style.color=error?'#9b3741':'#14745b';}};
 const validMoney=x=>x&&typeof x.id==='string'&&typeof x.person==='string'&&['to_me','i_owe'].includes(x.direction)
   &&(x.cents===null||(Number.isSafeInteger(x.cents)&&x.cents>0))
   &&typeof x.reason==='string'&&typeof x.date==='string';
 const validTodo=x=>x&&typeof x.id==='string'&&typeof x.title==='string'
   &&['none','month','day'].includes(x.dueType)&&typeof x.due==='string'&&typeof x.done==='boolean';
 const validShopping=x=>x&&typeof x.id==='string'&&typeof x.name==='string'
   &&x.name.trim().length>0&&x.name.length<=160&&typeof x.done==='boolean';
 function validate(name,items){
  if(!Array.isArray(items)||items.length>100000)throw Error('Invalid '+name+' records.');
  const checks={money:validMoney,todos:validTodo,shopping:validShopping};
  if(!items.every(checks[name]))throw Error('Some '+name+' records are invalid.');
  return items;
 }
 function readList(name){
  const contents=localStorage.getItem(KEYS[name]);
  return validate(name,contents?JSON.parse(contents):[]);
 }
 $('downloadBackup').addEventListener('click',()=>{
  try{
   const money=readList('money'),todos=readList('todos'),shopping=readList('shopping');
   const payload={format:'running-tab-backup',version:2,exportedAt:new Date().toISOString(),money,todos,shopping};
   const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;
   link.download='running-tab-backup-'+new Date().toISOString().slice(0,10)+'.json';
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
   say('Saved a backup of '+money.length+' money entries, '+todos.length+' reminders, and '+shopping.length+' shopping items.');
  }catch(e){say('Could not create backup: '+e.message,true);}
 });
 $('restoreBackup').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
   if(file.size>15000000)throw Error('Backup file is too large.');
   const d=JSON.parse(await file.text());
   if(!d||d.format!=='running-tab-backup'||![1,2].includes(d.version))throw Error('Not a supported Running Tab backup.');
   const money=validate('money',d.money),todos=validate('todos',d.todos);
   const shopping=d.version===2?validate('shopping',d.shopping):null;
   const extra=shopping===null?' Your current shopping list will stay unchanged.':' and '+shopping.length+' shopping items';
   const question='Restore '+money.length+' money entries and '+todos.length+' reminders'+extra+'? This REPLACES those saved lists on this phone.';
   if(!confirm(question))return;
   const names=shopping===null?['money','todos']:['money','todos','shopping'];
   const previous=Object.fromEntries(names.map(name=>[name,localStorage.getItem(KEYS[name])]));
   try{
    const values={money,todos,shopping};
    for(const name of names)localStorage.setItem(KEYS[name],JSON.stringify(values[name]));
   }catch(err){
    for(const name of names){
     try{
      if(previous[name]===null)localStorage.removeItem(KEYS[name]);
      else localStorage.setItem(KEYS[name],previous[name]);
     }catch(e){}
    }
    throw err;
   }
   say('Restore complete. Reloading your lists…');
   location.reload();
  }catch(e){say('Restore failed: '+e.message,true);}
  finally{event.target.value='';}
 });
})();