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
// Compatibility: older items use storeId, while new items can have many storeIds.
// We deliberately do not bulk-rewrite old entries: this avoids unnecessary sync conflicts.
function tags(item){
 if(!item||typeof item!=='object')return [];
 if(Array.isArray(item.storeIds))return [...new Set(item.storeIds.filter(x=>typeof x==='string'&&x))];
 return typeof item.storeId==='string'&&item.storeId?[item.storeId]:[];
}
function setTags(item,storeIds){
 const ids=[...new Set(storeIds.filter(x=>typeof x==='string'&&x))];
 return {...item,storeIds:ids,storeId:null,updatedAt:new Date().toISOString()};
}
function remove(id){
 const s=read().find(x=>x.id===id);
 if(!s||!confirm('Delete '+s.name+'? Its tags will be removed from shopping items.'))return;
 const oldItems=items();
 const next=oldItems.map(item=>{
  const before=tags(item);
  return before.includes(id)?setTags(item,before.filter(x=>x!==id)):item;
 });
 if(next.some((item,i)=>item!==oldItems[i])){
  try{localStorage.setItem(S,JSON.stringify(next));}
  catch(e){window.alert?.('Could not update shopping tags. Store was not deleted.');return;}
 }
 save(read().filter(x=>x.id!==id));
 if(next.some((item,i)=>item!==oldItems[i]))window.dispatchEvent(new Event('runningtab:shopping-changed'));
}
const cleanName=name=>String(name||'').replace(/\s+/g,' ').trim().replace(/[.!?]+$/,'').trim();
function parseDestination(raw){
 const text=cleanName(raw);
 // Generic shopping always means no new store tags.
 const generic=text.match(/^(.*?)\s+(?:to|on|for|at)\s+(?:(?:my|the)\s+)?(?:general(?:\s+shopping)?|shopping)\s+list\s*$/i);
 if(generic)return {text:generic[1].trim(),storeNames:[],storeName:null};
 const names=read().map(x=>x.name);
 const split=tail=>tail.split(/\s+(?:and|or)\s+|\s*&\s*|,\s*/i).map(cleanName).filter(Boolean);
 const known=name=>names.find(s=>s.toLocaleLowerCase()===cleanName(name).toLocaleLowerCase());
 const result=(prefix,rawNames,allowCreate=false)=>{
  const parts=split(rawNames).map(n=>n.replace(/^(?:my|the|a|an)\s+/i,''));
  if(!parts.length)return null;
  const found=parts.map(n=>known(n)||n);
  // Don't create stores accidentally from a phrase such as 'materials and tools'.
  if(parts.length>1&&!parts.every(n=>known(n)))return null;
  if(!allowCreate&&!parts.every(n=>known(n)))return null;
  return {text:prefix.trim(),storeNames:found,storeName:found[0]||null};
 };
 // "Add bread to Costco and Local Grocery lists" (names may be new if singular).
 const listMatch=text.match(/^(.*?)\s+(?:to|for|at)\s+(?:(?:my|the)\s+)?(.+?)\s+(?:shopping\s+)?lists?\s*$/i);
 if(listMatch){
  const parsed=result(listMatch[1],listMatch[2],true);
  if(parsed)return parsed;
 }
 // "Add bread to Costco", "Add lumber to Home Hardware or Challenger".
 for(const word of [' to ',' for ',' at ']){
  const idx=text.toLocaleLowerCase().lastIndexOf(word);
  if(idx<1)continue;
  const parsed=result(text.slice(0,idx),text.slice(idx+word.length),false);
  if(parsed)return parsed;
 }
 return {text,storeNames:[],storeName:null};
}
function fillTagChoices(element,selectedNames=[]){
 if(!element)return;
 element.replaceChildren();
 const selection=new Set(selectedNames.map(s=>cleanName(s).toLocaleLowerCase()));
 const stores=read();
 for(const s of stores){
  const l=document.createElement('label');
  l.className='shop-tag-choice';
  const input=document.createElement('input');input.type='checkbox';input.value=s.id;
  input.checked=selection.has(s.name.toLocaleLowerCase());
  l.append(input,document.createTextNode(s.name));
  element.appendChild(l);
 }
 for(const unknown of selectedNames){
  const name=cleanName(unknown);
  if(!name||stores.some(s=>s.name.toLowerCase()===name.toLowerCase()))continue;
  const l=document.createElement('label');l.className='shop-tag-choice';
  const input=document.createElement('input');input.type='checkbox';input.value='new:'+name;input.checked=true;
  l.append(input,document.createTextNode('Create '+name));
  element.appendChild(l);
 }
}
function resolveTagValues(values){
 return [...new Set(values.map(value=>{
  if(typeof value!=='string'||!value)return '';
  return value.startsWith('new:')?ensure(value.slice(4))?.id||'':value;
 }).filter(Boolean))];
}
// A geocoder may return a region (such as "Alberta, Canada") for a shop name.
// Never allow such broad results to become geofence pins. Prefer a street number
// and a recognizable road type in the SAME address segment.
function isPreciseAddress(label){
 if(typeof label!=='string'||label.length>600)return false;
 const road=/\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|boulevard|blvd\.?|lane|ln\.?|trail|tr\.?|crescent|cres\.?|court|ct\.?|way|place|pl\.?|highway|hwy\.?|parkway|pkwy\.?|close)\b/i;
 const streetSegment=/^\s*(?:unit\s*[a-z0-9-]+[ ,]+|suite\s*[a-z0-9-]+[ ,]+)?\d{1,6}[a-z]?(?:\s*[-/]\s*\d{1,6})?\s+\S+\s+\S+/i;
 return label.split(',').some(segment=>streetSegment.test(segment)&&road.test(segment));
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
window.MyDayStores={read,items,notify,save,find,ensure,update,remove,parseDestination,tags,setTags,fillTagChoices,resolveTagValues,
 label:id=>read().find(x=>x.id===id)?.name||'General Shopping',
 selected:()=>window.RunningTabShopping?.selectedStore?.()||'',
 onCurrentLocation,locationError,permission,isPreciseAddress,
 alerts:()=>localStorage.getItem(P)==='true',setAlerts};
})();