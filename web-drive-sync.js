/* Browser-only Google Drive appDataFolder synchronization.
   The three lists remain local-first, even if a cloud operation fails.
   Merge uses a three-way baseline to recognize edits and deletions.
   Google access tokens are never persisted. */
(()=>{
 'use strict';
 if(window.RunningTabAndroid||!window.RunningTabWebAuth?.isEnabled)return;
 const label=document.getElementById('webSyncStatus');
 const button=document.getElementById('webSyncNow');
 const reconnect=document.getElementById('webGoogleReconnect');
 if(!label||!button)return;
 const KEYS={money:'running-tab-simple-v1',todos:'running-tab-todo-v1',shopping:'running-tab-shopping-v1'};
 const NAMES=Object.keys(KEYS);
 const FILENAME='running-tab-cloud-v1.json';
 const BASE_KEY='running-tab-google-sync-base-v1:';
 const URL='https://www.googleapis.com/drive/v3/files';
 const UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
 const MAX=10000000;
 let running=false,pending=false,changed=0,silent=false,timer=null;
 const blank=()=>({money:[],todos:[],shopping:[]});
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
   if(kind==='shopping'&&!(typeof item.name==='string'&&typeof item.done==='boolean'))
    throw Error('Invalid Shopping entry.');
  }
  return items;
 }
 function normalize(value,cloudFile=false){
  if(!value||typeof value!=='object')throw Error('Invalid synchronization file.');
  if(cloudFile&&(value.format!=='running-tab-cloud-sync'||value.version!==1))
   throw Error('Google Drive has an unfamiliar Running Tab sync file.');
  const copy=blank();
  for(const name of NAMES)copy[name]=check(name,value[name]);
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
 function merge(base,local,remote){
  const output=blank(),conflicts=[];
  for(const name of NAMES){
   const b=new Map(base[name].map(v=>[v.id,v]));
   const l=new Map(local[name].map(v=>[v.id,v]));
   const r=new Map(remote[name].map(v=>[v.id,v]));
   for(const id of new Set([...l.keys(),...r.keys(),...b.keys()])){
    const old=b.get(id),mine=l.get(id),theirs=r.get(id);
    const localChanged=!same(old,mine),remoteChanged=!same(old,theirs);
    if(localChanged&&remoteChanged&&!same(mine,theirs)){
     conflicts.push(name+':'+id);
     continue;
    }
    const keep=localChanged?mine:theirs;
    if(keep!==undefined)output[name].push(keep);
   }
  }
  return {output,conflicts};
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
  if(data.files.length>1)throw Error('Multiple Running Tab cloud files found. No changes uploaded.');
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
  silent=true;
  try{
   for(const name of NAMES){
    const next=JSON.stringify(value[name]);
    if(localStorage.getItem(KEYS[name])!==next)localStorage.setItem(KEYS[name],next);
   }
  }finally{silent=false;}
  for(const name of NAMES)window.dispatchEvent(new Event('runningtab:'+name+'-changed'));
  window.RunningTabView?.adjust?.();
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
   if(conflicts.length)throw Error('A record was edited differently on two devices ('+conflicts.length+
    ' conflict'+(conflicts.length===1?'':'s')+'). Nothing overwritten. Export JSON backups from both devices to resolve.');
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