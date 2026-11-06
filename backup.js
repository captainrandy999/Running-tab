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
 function makeBackup(){
  const money=readList('money'),todos=readList('todos'),shopping=readList('shopping');
  const payload={format:'running-tab-backup',version:2,exportedAt:new Date().toISOString(),money,todos,shopping};
  const name='running-tab-backup-'+new Date().toISOString().slice(0,10)+'.json';
  return {text:JSON.stringify(payload,null,2),name,counts:[money.length,todos.length,shopping.length]};
 }
 function showBackupText(text){
  const panel=$('backupTextPanel');
  const field=$('backupText');
  if(!panel||!field)return;
  field.value=text;
  panel.hidden=false;
  panel.open=true;
 }
 // The Android wrapper uses a native "Save as" picker. Older wrappers must use
 // copy-to-Notes: Android WebView does not reliably download Blob URLs.
 $('downloadBackup').addEventListener('click',()=>{
  try{
   const backup=makeBackup();
   if(window.RunningTabAndroid){
    if(typeof window.RunningTabAndroid.exportBackup==='function'){
     say('Choose a location and filename to save your backup…');
     window.RunningTabAndroid.exportBackup(backup.text,backup.name);
    }else{
     showBackupText(backup.text);
     say('This Android app version cannot save a backup file directly. Use Copy backup text and save it to Samsung Notes or another app. Confirm you have the copy before uninstalling.',true);
    }
    return;
   }
   const blob=new Blob([backup.text],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;
   link.download=backup.name;
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
   say('Download requested: '+backup.name+'. Check Downloads to make sure the file exists before uninstalling.');
  }catch(e){say('Could not create backup: '+e.message,true);}
 });
 $('copyBackup').addEventListener('click',async()=>{
  try{
   const backup=makeBackup();
   showBackupText(backup.text);
   let copied=false;
   try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
     await navigator.clipboard.writeText(backup.text);
     copied=true;
    }
   }catch(e){}
   if(!copied){
    const field=$('backupText');
    field.select();
    try{copied=document.execCommand('copy');}catch(e){}
   }
   say(copied
     ? 'Backup copied. Paste it into Samsung Notes or another saved document. Do not uninstall until you verify the copy.'
     : 'Backup text is shown below. Select all, copy, and save it in Samsung Notes or another document.',!copied);
  }catch(e){say('Could not copy backup: '+e.message,true);}
 });
 let incomingParts=null, incomingLength=0;
 window.RunningTabBackup={
  onNativeExportResult:(ok,details)=>{
   say(ok?'Backup file saved successfully: '+details:'Backup not saved: '+details,!ok);
  },
  onNativeImportBegin:()=>{
   incomingParts=[];
   incomingLength=0;
   say('Reading backup file from Android…');
  },
  onNativeImportChunk:part=>{
   if(!incomingParts)return;
   const chunk=String(part||'');
   incomingLength+=chunk.length;
   if(incomingLength>15000000){
    incomingParts=null;
    say('Restore failed: Backup is too large.',true);
    return;
   }
   incomingParts.push(chunk);
  },
  onNativeImportEnd:async()=>{
   if(!incomingParts)return;
   const text=incomingParts.join('');
   incomingParts=null;
   incomingLength=0;
   try{await restoreFromRaw(text);}
   catch(e){say('Restore failed: '+e.message,true);}
  },
  onNativeImportError:reason=>{
   incomingParts=null;
   incomingLength=0;
   say('Restore failed: '+reason,true);
  }
 };
 // In the native app, read the selected JSON through Android itself rather
 // than through WebView's file input and its provider-specific restrictions.
 if(typeof window.RunningTabAndroid?.importBackup==='function'){
  $('restoreNativeBackup').hidden=false;
  $('restoreBrowserField').hidden=true;
 }
 $('restoreNativeBackup').addEventListener('click',()=>{
  if(typeof window.RunningTabAndroid?.importBackup!=='function'){
   say('Native restore is unavailable. Try Restore a copied backup.',true);
   return;
  }
  say('Select your Running Tab .json backup in the Android file picker…');
  try{window.RunningTabAndroid.importBackup();}
  catch(e){say('Could not open the Android file picker: '+e.message,true);}
 });
 async function restoreFromRaw(text){
  let d;
  try{d=JSON.parse(String(text||'').replace(/^\uFEFF/,'').trim());}
  catch(e){throw Error('Not a valid JSON backup. Select a running-tab-backup-*.json file, not an APK or ZIP.');}
  return restorePayload(d);
 }
 function restorePayload(d){
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
 }
 $('restorePastedBackup').addEventListener('click',async()=>{
  const text=$('pastedBackup').value.trim();
  if(!text){say('Paste a Running Tab backup first.',true);return;}
  try{await restoreFromRaw(text);}
  catch(e){say('Restore failed: '+e.message,true);}
 });
 $('restoreBackup').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
   if(file.size>15000000)throw Error('Backup file is too large.');
   // APKs and GitHub build artifacts are ZIP files (PK), not Running Tab data.
   const header=new Uint8Array(await file.slice(0,4).arrayBuffer());
   if(header[0]===0x50&&header[1]===0x4b&&
      ((header[2]===0x03&&header[3]===0x04)||
       (header[2]===0x05&&header[3]===0x06)||
       (header[2]===0x07&&header[3]===0x08))){
    throw Error('This is a ZIP/APK archive, not a Running Tab data backup. Open Running Tab where your entries are stored, tap Data & backup → Download backup, then select the .json file.');
   }
   await restoreFromRaw(await file.text());
  }catch(e){say('Restore failed: '+e.message,true);}
  finally{event.target.value='';}
 });
})();