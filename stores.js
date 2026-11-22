/* Store definitions and lightweight shopping voice routing. */
(()=>{
'use strict';
const K='running-tab-stores-v1',S='running-tab-shopping-v1',P='running-tab-store-alerts-v1';
const read=()=>{try{const v=JSON.parse(localStorage.getItem(K)||'[]');return Array.isArray(v)?v:[];}catch(e){return [];}};
const items=()=>{try{const v=JSON.parse(localStorage.getItem(S)||'[]');return Array.isArray(v)?v:[];}catch(e){return [];}};
const notify=()=>window.dispatchEvent(new Event('runningtab:stores-changed'));
const save=v=>{localStorage.setItem(K,JSON.stringify(v));notify();};
const find=name=>read().find(s=>s.name.trim().toLowerCase()===String(name||'').trim().toLowerCase());
const id=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random();
function ensure(name){
 name=String(name||'').replace(/\s+/g,' ').trim().slice(0,100);
 if(!name)return null;
 const old=find(name);if(old)return old;
 const store={id:id(),name,radius:200,enabled:false,arrivalMode:'arrival',created:new Date().toISOString()};
 save([...read(),store]);return store;
}
function update(id,patch){
 const now=new Date().toISOString();
 const v=read();if(!v.some(s=>s.id===id))return;
 save(v.map(s=>s.id===id?{...s,...patch,updatedAt:now}:s));
}
function remove(id){
 const s=read().find(x=>x.id===id);if(!s||!confirm('Delete '+s.name+'? Its shopping items will move to General.'))return;
 localStorage.setItem(S,JSON.stringify(items().map(x=>x.storeId===id?{...x,storeId:null}:x)));
 save(read().filter(x=>x.id!==id));window.dispatchEvent(new Event('runningtab:shopping-changed'));
}
function parseDestination(raw){
 const text=String(raw||'').trim();
 const m=text.match(/^(.*?)\s+(?:to|for|at)\s+(?:(?:my|the)\s+)?(.+?)\s+(?:shopping\s+)?list\s*$/i);
 if(m&&m[2]&&!/^(?:shopping|general)$/i.test(m[2]))return {text:m[1],storeName:m[2].trim()};
 for(const store of read()){
  for(const prefix of [' to ',' for ',' at ']){
   const tail=prefix+store.name;
   if(text.toLowerCase().endsWith(tail.toLowerCase()))
    return {text:text.slice(0,-tail.length),storeName:store.name};
  }
 }
 return {text,storeName:null};
}
function fillSelect(el,selected='',newName=null){
 if(!el)return;
 el.replaceChildren();el.add(new Option('General Shopping',''));
 for(const s of read())el.add(new Option(s.name,s.id));
 if(newName){
  const found=find(newName);
  selected=found?found.id:'new:'+newName;
  if(!found)el.add(new Option('Create '+newName,selected));
 }
 el.value=selected||'';if(el.selectedIndex<0)el.value='';
}
function onCurrentLocation(storeId,lat,lon){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return;
 update(storeId,{lat,lon});
 const el=document.getElementById('shopStatus');if(el)el.textContent='Store pin saved.';
}
function locationError(message){const el=document.getElementById('shopStatus');if(el)el.textContent=String(message);}
function permission(){try{return !!window.RunningTabAndroid?.storeLocationPermissionGranted?.();}catch(e){return false;}}
function setAlerts(value){
 localStorage.setItem(P,value?'true':'false');
 window.__rtWidgetSnapshot?.();notify();
 if(value&&!permission())window.RunningTabAndroid?.enableStoreLocations?.();
}
window.MyDayStores={read,items,notify,save,find,ensure,update,remove,parseDestination,fillSelect,
 label:id=>read().find(x=>x.id===id)?.name||'General Shopping',
 selected:()=>window.RunningTabShopping?.selectedStore?.()||'',
 onCurrentLocation,locationError,permission,
 alerts:()=>localStorage.getItem(P)==='true',setAlerts};
})();