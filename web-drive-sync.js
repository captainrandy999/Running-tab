/* Shared browser/PWA and authorized native Android appDataFolder synchronization.
   The three lists remain local-first, even if a cloud operation fails.
   Merge uses a three-way baseline to recognize edits and deletions.
   Google access tokens are never persisted. */
(()=>{
 'use strict';
 if(!window.RunningTabWebAuth?.isEnabled)return;
 const label=document.getElementById('webSyncStatus');
 const button=document.getElementById('webSyncNow');
 const reconnect=document.getElementById('webGoogleReconnect');
 if(!label||!button)return;
 const KEYS={money:'running-tab-simple-v1',todos:'running-tab-todo-v1',shopping:'running-tab-shopping-v1',stores:'running-tab-stores-v1'};
 const NAMES=Object.keys(KEYS);
 const FILENAME='running-tab-cloud-v1.json';
 const BASE_KEY='running-tab-google-sync-base-v1:';
 const URL='https://www.googleapis.com/drive/v3/files';
 const UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
 const MAX=10000000;
 let running=false,pending=false,changed=0,silent=false,timer=null;
 const blank=()=>({money:[],todos:[],shopping:[],stores:[]});
 const account=()=>window.RunningTabWebAuth?.getAccount?.();
 const token=()=>window.RunningTabWebAuth?.getAccessToken?.();
 function status(message,error=false){
  label.textContent=message;
  label.classList.toggle('sync-error',error);
 }
 function canonical(v){
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  return JSON.stringify(v);
 }
 const same=(a,b)=>canonical(a)===canonical(b);
 function check(kind,items){
  if(!Array.isArray(items)||items.length>100000)throw Error('Invalid '+kind+' records.');
  const ids=new Set();
  for(const item of items){
   if(!item||typeof item!=='object'||typeof item.id!=='string'
    ||!item.id||item.id.length>160||ids.has(item.id))
    throw Error('Duplicate or invalid '+kind+' entry ID.');
   ids.add(item.id);
   if(kind==='money'&&!(typeof item.person==='string'&&
     ['to_me','i_owe'].includes(item.direction)&&
     (item.cents===null||(Number.isSafeInteger(item.cents)&&item.cents>0))))
    throw Error('Invalid Money entry.');
   if(kind==='todos'&&!(typeof item.title==='string'&&
     ['day','month','none'].includes(item.dueType)&&
     typeof item.due==='string'&&typeof item.done==='boolean'))
    throw Error('Invalid To-Do entry.');
   if(kind==='stores'&&!(typeof item.name==='string'&&item.name.trim()&&item.name.length<=100&&
      (item.lat===undefined||(typeof item.lat==='number'&&Math.abs(item.lat)<=90))&&
      (item.lon===undefined||(typeof item.lon==='number'&&Math.abs(item.lon)<=180))))
    throw Error('Invalid Store entry.');
   if(kind==='shopping'&&!(typeof item.name==='string'&&typeof item.done==='boolean'))
    throw Error('Invalid Shopping entry.');
  }
  return items;
 }
 function normalize(value,cloudFile=false){
  if(!value||typeof value!=='object')throw Error('Invalid synchronization file.');
  if(cloudFile&&(value.format!=='running-tab-cloud-sync'||value.version!==1))
   throw Error('Google Drive has an unfamiliar MyDay sync file.');
  const copy=blank();
  for(const name of NAMES)copy[name]=check(name,value[name]??(name==='stores'?[]:undefined));
  return copy;
 }
 function readLocal(){
  const copy=blank();
  for(const name of NAMES){
   const raw=localStorage.getItem(KEYS[name]);
   copy[name]=check(name,raw?JSON.parse(raw):[]);
  }
  return copy;
 }
 function readBase(sub){
  const text=localStorage.getItem(BASE_KEY+sub);
  return text?normalize(JSON.parse(text)):blank();
 }
 function changedCount(a,b){
  let n=0;
  for(const name of NAMES){
   const x=new Map(a[name].map(v=>[v.id,v]));
   const y=new Map(b[name].map(v=>[v.id,v]));
   for(const id of new Set([...x.keys(),...y.keys()]))
    if(!same(x.get(id),y.get(id)))n++;
  }
  return n;
 }
 function merge(base,local,remote,choices=new Map()){
  const output=blank(),conflicts=[];
  for(const name of NAMES){
   const b=new Map(base[name].map(v=>[v.id,v]));
   const l=new Map(local[name].map(v=>[v.id,v]));
   const r=new Map(remote[name].map(v=>[v.id,v]));
   for(const id of new Set([...l.keys(),...r.keys(),...b.keys()])){
    const old=b.get(id),mine=l.get(id),theirs=r.get(id);
    const localChanged=!same(old,mine),remoteChanged=!same(old,theirs);
    if(localChanged&&remoteChanged&&!same(mine,theirs)){
     const key=name+':'+id;
     const withoutTimestamp=v=>{
      if(!v)return v;
      const copy={...v};delete copy.updatedAt;return copy;
     };
     if(mine&&theirs&&same(withoutTimestamp(mine),withoutTimestamp(theirs))){
      output[name].push((Date.parse(mine.updatedAt||'')||0)>=(Date.parse(theirs.updatedAt||'')||0)?mine:theirs);
      continue;
     }
     const choice=choices.get(key);
     if(choice==='device'||choice==='drive'){
      const chosen=choice==='device'?mine:theirs;
      if(chosen!==undefined)output[name].push(chosen);
     }else conflicts.push({key,name,id,mine,theirs});
     continue;
    }
    const keep=localChanged?mine:theirs;
    if(keep!==undefined)output[name].push(keep);
   }
  }
  return {output,conflicts};
 }
 // A conflict suspends sync until the user reviews each competing version.
 const reviewPanel=document.createElement('div');
 reviewPanel.className='myday-sync-review';
 reviewPanel.hidden=true;
 label.closest('.web-sync-bar')?.insertAdjacentElement('afterend',reviewPanel);
 let reviewState=null,reviewOpen=false;
 const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fieldNames={
  stores:{name:'Store tag'},
  money:{person:'Person',direction:'Who owes whom',cents:'Amount',reason:'Description',date:'Date',settled:'Settled',body:'Notes'},
  todos:{title:'Task',due:'Date',remindTime:'Time',notify:'Phone alert',repeat:'Repeat',repeatPaused:'Paused',done:'Completed',body:'Notes'},
  shopping:{name:'Item',done:'Purchased'}
 };
 function asText(key,value){
  if(value===undefined||value===null||value==='')return '—';
  if(key==='cents')return '$'+(Number(value)/100).toFixed(2);
  if(key==='direction')return value==='to_me'?'They owe me':'I owe them';
  if(typeof value==='boolean')return value?'Yes':'No';
  return typeof value==='object'?JSON.stringify(value):String(value);
 }
 function formatVersion(kind,item,other,heading){
  if(item===undefined)return '<div class="myday-sync-version"><h5>'+heading+'</h5><p>Deleted on this side. Choosing it removes the entry.</p></div>';
  const fields=Object.entries(fieldNames[kind]).map(([key,label])=>
   '<div class="myday-sync-field'+(!same(item[key],other?.[key])?' changed':'')+'"><b>'+label+'</b><span>'+
   escapeHTML(asText(key,item[key]))+'</span></div>').join('');
  return '<div class="myday-sync-version"><h5>'+heading+'</h5>'+fields+
   '<details><summary>Show complete record</summary><pre>'+escapeHTML(JSON.stringify(item,null,2))+'</pre></details></div>';
 }
 function reviewTitle(c){
  const v=c.mine||c.theirs||{};
  return v.title||v.name||[v.person,v.reason].filter(Boolean).join(' — ')||'Entry '+c.id.slice(0,8);
 }
 function closeReview(){
  reviewState=null;reviewOpen=false;reviewPanel.hidden=true;reviewPanel.innerHTML='';
  button.textContent='Sync now';
 }
 function presentConflicts(owner,file,base,local,remote,items){
  const prev=reviewState;
  const existing=prev&&prev.owner===owner.sub&&setsEqual(prev.base,base)
   &&setsEqual(prev.local,local)&&setsEqual(prev.remote,remote)
   &&String(prev.file?.version)===String(file?.version);
  reviewState={owner:owner.sub,file,base,local,remote,items,choices:existing?prev.choices:new Map()};
  if(!existing)reviewOpen=false;
  status('Sync paused: '+items.length+' conflict'+(items.length===1?'':'s')+
   '. Nothing overwritten. Review below.',true);
  button.textContent='Check again';
  renderReview();
 }
 function renderReview(){
  const s=reviewState;
  if(!s){reviewPanel.hidden=true;return;}
  reviewPanel.hidden=false;
  let html='<h3>'+s.items.length+' sync conflict'+(s.items.length===1?'':'s')+' to review</h3>'+
   '<p>Choose what to keep for each entry. Nothing is replaced until you confirm.</p>'+
   '<div class="myday-sync-controls"><button type="button" class="secondary small" data-sync-control="expand">'+
   (reviewOpen?'Hide comparisons':'Compare records')+'</button>'+
   '<button type="button" class="outline small" data-sync-control="backup">Save both copies</button></div>';
  if(reviewOpen){
   for(const item of s.items){
    const choice=s.choices.get(item.key)||'';
    html+='<article class="myday-sync-record"><h4>'+escapeHTML(
     ({money:'Money',todos:'To-Do / Notes',shopping:'Shopping',stores:'Stores'}[item.name]||item.name)+' · '+reviewTitle(item))+
     '</h4><div class="myday-sync-versions">'+
     formatVersion(item.name,item.mine,item.theirs,'This device')+
     formatVersion(item.name,item.theirs,item.mine,'Google Drive')+'</div>'+
     '<label class="myday-sync-choice">Keep which version?<select data-sync-key="'+escapeHTML(item.key)+'">'+
     '<option value=""'+(choice===''?' selected':'')+'>Select a version…</option>'+
     '<option value="device"'+(choice==='device'?' selected':'')+'>Keep this device</option>'+
     '<option value="drive"'+(choice==='drive'?' selected':'')+'>Keep Google Drive</option>'+
     '</select></label></article>';
   }
   const selected=s.items.filter(item=>s.choices.has(item.key)).length;
   html+='<div class="myday-sync-bottom"><p>'+selected+' of '+s.items.length+
    ' selected. Unselected versions will be replaced after confirmation.</p>'+
    '<button type="button" class="primary small" data-sync-control="apply"'+
    (selected!==s.items.length||running?' disabled':'')+'>Resolve conflicts</button></div>';
  }else html+='<p class="myday-sync-hint">You can save a recovery file containing both copies before choosing. That file is for reference and cannot be directly imported with Restore backup.</p>';
  reviewPanel.innerHTML=html;
 }
 function exportReview(){
  const s=reviewState;if(!s)return;
  try{
   const content=JSON.stringify({format:'myday-sync-recovery',version:1,
    exportedAt:new Date().toISOString(),thisDevice:s.local,googleDrive:s.remote,commonBase:s.base},null,2);
   if(content.length>8000000)throw Error('File too large. Export a normal backup from Backup & restore.');
   const filename='myday-sync-recovery-'+new Date().toISOString().slice(0,10)+'.json';
   if(typeof window.RunningTabAndroid?.exportBackup==='function')
    window.RunningTabAndroid.exportBackup(content,filename);
   else{
    const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=filename;
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
   }
   status('Sync paused: recovery export requested. Verify it was saved; no changes applied.',true);
  }catch(err){status('Recovery export failed: '+String(err?.message||err),true);}
 }
 reviewPanel.addEventListener('click',event=>{
  const action=event.target.closest('[data-sync-control]')?.dataset.syncControl;
  if(action==='expand'){reviewOpen=!reviewOpen;renderReview();}
  if(action==='backup')exportReview();
  if(action==='apply')resolveReview();
 });
 reviewPanel.addEventListener('change',event=>{
  const key=event.target.dataset?.syncKey;
  if(!key||!reviewState)return;
  const value=event.target.value;
  if(value==='device'||value==='drive')reviewState.choices.set(key,value);
  else reviewState.choices.delete(key);
  renderReview();
 });
 async function resolveReview(){
  const s=reviewState;
  if(!s||running||s.items.some(item=>!s.choices.has(item.key)))return;
  if(!confirm('Apply all '+s.items.length+' choices to this device and Google Drive? Unchosen versions will be replaced. Save both copies first if you are unsure.'))return;
  if(!token()||account()?.sub!==s.owner){status('Reconnect Google before resolving.',true);return;}
  running=true;button.disabled=true;status('Verifying both copies before resolving…');
  try{
   const access=token(),owner=account(),base=readBase(s.owner),local=readLocal();
   const file=await list(access),remote=await download(access,file);
   const sameFile=String(file?.id)===String(s.file?.id)&&String(file?.version)===String(s.file?.version);
   if(!sameFile||!setsEqual(base,s.base)||!setsEqual(local,s.local)||!setsEqual(remote,s.remote)){
    const latest=merge(base,local,remote);
    if(latest.conflicts.length)presentConflicts(owner,file,base,local,remote,latest.conflicts);
    else closeReview();
    throw Error('One copy changed during review. Check the refreshed records; nothing overwritten.');
   }
   const selected=merge(base,local,remote,s.choices);
   if(selected.conflicts.length)throw Error('Choose a version for every conflict.');
   if(!token()||account()?.sub!==s.owner)throw Error('Google account changed.');
   if(!setsEqual(remote,selected.output)||!file){
    if(!await unchanged(access,file))throw Error('Google Drive changed; tap Check again.');
    if(!setsEqual(local,readLocal()))throw Error('Local records changed; tap Check again.');
    await upload(access,file,selected.output);
   }
   if(!token()||account()?.sub!==s.owner||!setsEqual(local,readLocal()))
    throw Error('Data changed while saving. Tap Check again.');
   refreshUI(selected.output);
   localStorage.setItem(BASE_KEY+s.owner,JSON.stringify(selected.output));
   closeReview();
   status('✓ '+s.items.length+' conflicts resolved · Synced with Google Drive');
  }catch(err){status('Sync paused: '+String(err?.message||err),true);}
  finally{running=false;button.disabled=false;if(reviewState)renderReview();if(pending){pending=false;queue(650);}}
 }
 function setsEqual(a,b){
  return NAMES.every(name=>{
   if(a[name].length!==b[name].length)return false;
   const m=new Map(b[name].map(x=>[x.id,x]));
   return a[name].every(x=>m.has(x.id)&&same(x,m.get(x.id)));
  });
 }
 async function get(url,access,options={}){
  const res=await fetch(url,{...options,cache:'no-store',
   headers:{Authorization:'Bearer '+access,...(options.headers||{})}});
  if(!res.ok){
   let details='';
   try{const body=await res.json();details=body?.error?.message||'';}catch(e){}
   if(res.status===401)throw Error('Google sign-in expired. Tap Reconnect Google.');
   if(res.status===403)throw Error('Google Drive access denied. Check that the API is enabled and permission was granted.');
   throw Error('Google Drive error '+res.status+(details?': '+details:''));
  }
  return res;
 }
 async function list(access){
  const q=new URLSearchParams({
   spaces:'appDataFolder',
   q:"name = '"+FILENAME+"' and 'appDataFolder' in parents and trashed = false",
   pageSize:'100',
   fields:'nextPageToken,files(id,name,version,modifiedTime)'
  });
  const data=await (await get(URL+'?'+q.toString(),access)).json();
  if(data.nextPageToken)throw Error('Too many cloud sync files. Manual review needed.');
  if(!Array.isArray(data.files))throw Error('Google Drive returned an invalid file list.');
  if(data.files.length>1)throw Error('Multiple MyDay cloud files found. No changes uploaded.');
  return data.files[0]||null;
 }
 async function download(access,file){
  if(!file)return blank();
  const response=await get(URL+'/'+encodeURIComponent(file.id)+'?alt=media',access);
  const contents=await response.text();
  if(contents.length>MAX)throw Error('Cloud file exceeds the 10 MB safety limit.');
  return normalize(JSON.parse(contents),true);
 }
 async function unchanged(access,file){
  if(!file)return !(await list(access));
  const meta=await (await get(URL+'/'+encodeURIComponent(file.id)+'?fields=id,version',access)).json();
  return !!file.version&&!!meta.version&&String(file.version)===String(meta.version);
 }
 async function upload(access,file,merged){
  const body=JSON.stringify({format:'running-tab-cloud-sync',version:1,updatedAt:new Date().toISOString(),...merged});
  if(body.length>MAX)throw Error('Cloud backup exceeds the 10 MB safety limit.');
  if(file){
   await get(UPLOAD+'/'+encodeURIComponent(file.id)+'?uploadType=media&fields=id,version',access,{
    method:'PATCH',headers:{'Content-Type':'application/json'},body
   });
   return;
  }
  const boundary='runningtab_'+Date.now()+'_'+Math.random().toString(36).slice(2);
  const meta=JSON.stringify({name:FILENAME,mimeType:'application/json',parents:['appDataFolder']});
  const data='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'
   +meta+'\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'
   +body+'\r\n--'+boundary+'--\r\n';
  await get(UPLOAD+'?uploadType=multipart&fields=id,version',access,{
   method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:data
  });
 }
 function refreshUI(value){
  const applied=[];
  silent=true;
  try{
   for(const name of NAMES){
    const next=JSON.stringify(value[name]);
    // Avoid rerendering an open note or entry editor when Drive reports no
    // actual change for that list (e.g., a sync of the Shopping list).
    if(localStorage.getItem(KEYS[name])!==next){
     localStorage.setItem(KEYS[name],next);
     applied.push(name);
    }
   }
  }finally{silent=false;}
  // The cloud list key is plural ("todos") but the To-Do panel and Android
  // widget intentionally subscribe to the singular "runningtab:todo-changed".
  for(const name of applied)window.dispatchEvent(new Event(
   'runningtab:'+(name==='todos'?'todo':name)+'-changed'
  ));
  if(applied.length)window.RunningTabView?.adjust?.();
 }
 function waiting(){
  const user=account();
  let n=0;
  if(user?.sub)try{n=changedCount(readBase(user.sub),readLocal());}catch(e){}
  status((navigator.onLine===false?'Offline':'Google Drive disconnected')+
   ' · Entries saved locally'+(n?' · '+n+' changes waiting':''));
  if(reconnect&&navigator.onLine!==false&&window.RunningTabWebAuth?.isUnlocked?.())
   reconnect.hidden=false;
 }
 function queue(ms=850){
  if(timer!==null)clearTimeout(timer);
  timer=setTimeout(()=>{timer=null;sync();},ms);
 }
 async function sync(){
  if(running){pending=true;return;}
  if(navigator.onLine===false||!token()||!account()?.sub){waiting();return;}
  running=true;
  const owner=account(),access=token(),revision=changed;
  status('Syncing with Google Drive…');
  try{
   const base=readBase(owner.sub),local=readLocal();
   const file=await list(access);
   const remote=await download(access,file);
   if(revision!==changed)throw Error('Local entries changed during sync.');
   const {output,conflicts}=merge(base,local,remote);
   if(conflicts.length){presentConflicts(owner,file,base,local,remote,conflicts);return;}
   if(!token()||account()?.sub!==owner.sub)throw Error('Signed out while synchronizing.');
   if(!setsEqual(remote,output)||!file){
    if(!await unchanged(access,file))throw Error('Drive changed during sync. Retrying.');
    if(revision!==changed)throw Error('Local entries changed during sync.');
    await upload(access,file,output);
   }
   if(revision!==changed||!token()||account()?.sub!==owner.sub)
    throw Error('Entries or login changed during sync.');
   refreshUI(output);
   localStorage.setItem(BASE_KEY+owner.sub,JSON.stringify(output));
   closeReview();
   status('✓ Synced with Google Drive · '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}));
  }catch(error){
   const msg=String(error?.message||error);
   if(/changed during sync|changed during sync|Drive changed|Entries or login changed/.test(msg)){
    status('New changes detected · Retrying safely…');
    pending=true;
   }else if(navigator.onLine===false)status('Offline · Changes saved locally');
   else status('Sync paused: '+msg,true);
  }finally{
   running=false;
   if(reviewState)renderReview();
   if(pending){pending=false;queue(600);}
  }
 }
 // Only intercept this origin's localStorage, not sessionStorage.
 const oldSet=Storage.prototype.setItem,oldRemove=Storage.prototype.removeItem;
 Storage.prototype.setItem=function(k,v){
  if(this!==localStorage)return oldSet.call(this,k,v);
  const tracked=NAMES.some(n=>KEYS[n]===k);
  const before=tracked?this.getItem(k):null;
  const value=oldSet.call(this,k,v);
  if(tracked&&!silent&&before!==String(v)){
   changed++;
   if(token())queue();
   else waiting();
  }
  return value;
 };
 Storage.prototype.removeItem=function(k){
  if(this!==localStorage)return oldRemove.call(this,k);
  const tracked=NAMES.some(n=>KEYS[n]===k);
  const existed=tracked&&this.getItem(k)!==null;
  const result=oldRemove.call(this,k);
  if(tracked&&existed&&!silent){
   changed++;
   if(token())queue();
   else waiting();
  }
  return result;
 };
 button.addEventListener('click',sync);
 window.addEventListener('runningtab:google-auth-changed',e=>{
  if(e.detail?.connected)queue(200);
  else waiting();
 });
 window.addEventListener('online',()=>{if(token())queue(500);else waiting();});
 window.addEventListener('offline',waiting);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token())queue(300);});
 window.addEventListener('pageshow',()=>{if(token())queue(350);});
 window.RunningTabDriveSync={syncNow:sync};
 if(token())queue(200);
 else waiting();
})();
