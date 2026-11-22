/* One master Shopping list. Store tags are filters, not separate copies. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),api=()=>window.MyDayStores;
const KEY='running-tab-shopping-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],filter='all',editing=null;
const locationResults=new Map();
const status=(message,bad=false)=>{
 const x=$('shopStatus');if(x){x.textContent=message;x.className=message?'notice'+(bad?' bad':''):'';}
};
function read(){
 try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');
  return Array.isArray(x)?x.filter(v=>v&&typeof v.id==='string'&&typeof v.name==='string'&&typeof v.done==='boolean'):[];
 }catch(e){status('Unable to read Shopping items.',true);return [];}
}
function save(value){
 try{
  localStorage.setItem(KEY,JSON.stringify(value));
  rows=value;
  window.dispatchEvent(new Event('runningtab:shopping-changed'));
  return true;
 }catch(e){status('Could not save shopping changes.',true);return false;}
}
function matches(item){
 const tags=api().tags(item);
 return filter==='all'||(filter==='anywhere'?!tags.length:tags.includes(filter));
}
function tagSummary(item){
 const ids=api().tags(item),stores=api().read();
 const names=ids.map(id=>stores.find(x=>x.id===id)?.name).filter(Boolean);
 return names.length?'🏷 '+names.join(' · '):'Any store · no arrival alert';
}
function itemRow(item){
 const key=esc(item.id),expanded=editing===item.id,selectedTags=api().tags(item);
 const choices=api().read().map(store=>{
  const checked=selectedTags.includes(store.id);
  return '<label class="shop-tag-choice"><input type="checkbox" data-shop-item-tag="'+key+
   '" value="'+esc(store.id)+'"'+(checked?' checked':'')+'><span>'+esc(store.name)+'</span></label>';
 }).join('');
 return '<div class="shop-master-item" data-shop-entry-id="'+key+'">'+
  '<div class="task shop-item shop-item--'+(item.done?'purchased done':'needed')+'">'+
  '<input type="checkbox" data-shop-toggle="'+key+'" '+(item.done?'checked ':'')+
  'aria-label="'+esc(item.done?'Mark '+item.name+' needed again':'Mark '+item.name+' purchased')+'">'+
  '<div class="task-main"><div class="task-name">'+esc(item.name)+'</div>'+
  '<div class="shop-tag-summary">'+esc(tagSummary(item))+'</div></div>'+
  '<button type="button" class="secondary small" data-shop-edit-tags="'+key+
  '" aria-expanded="'+String(expanded)+'">Tags</button>'+
  '<button type="button" class="danger small" data-shop-delete="'+key+'">Delete</button></div>'+
  '<div class="shop-tag-editor"'+(expanded?'':' hidden')+'>'+
  '<strong>Where can you buy this?</strong><p class="info">Leave all unchecked for a general item without location alerts.</p>'+
  '<div class="shop-tag-choices">'+(choices||'<p class="info">Add stores in Stores & arrival reminders.</p>')+'</div>'+
  '<button type="button" class="secondary small" data-shop-close-tags="'+key+'">Done</button>'+
  '</div></div>';
}
function storeTools(store){
 const key=esc(store.id),pinned=Number.isFinite(store.lat)&&Number.isFinite(store.lon);
 return '<details class="shop-store-tools" data-store-id="'+key+'"><summary>'+
  '<span>'+esc(store.name)+'</span><span class="shop-store-state">'+
  (store.enabled&&pinned?'📍 On':store.enabled?'Needs pin':pinned?'Pin saved':'No location')+
  '</span></summary><div class="shop-store-config">'+
  '<label class="reminder-check"><input type="checkbox" data-store-enabled'+
  (store.enabled?' checked':'')+'> Notify me when I arrive with tagged items</label>'+
  '<div class="shop-store-grid"><label>Radius (m)<input type="number" data-store-radius min="150" max="1000" step="50" value="'+esc(store.radius||200)+'"></label>'+
  '<label>Notify<select data-store-mode>'+
  '<option value="arrival"'+(store.arrivalMode==='dwell'?'':' selected')+'>On arrival</option>'+
  '<option value="dwell"'+(store.arrivalMode==='dwell'?' selected':'')+'>After a few minutes</option>'+
  '</select></label></div>'+
  '<p class="info">Pin: '+(pinned?store.lat.toFixed(5)+', '+store.lon.toFixed(5):'Not set')+'</p>'+
  '<div class="shop-find-location"><label for="shop-address-'+key+'">Find this store</label>'+
  '<div class="shop-find-row"><input type="search" id="shop-address-'+key+'" data-store-query placeholder="e.g. Home Hardware, Coaldale, AB" maxlength="160" value="'+esc(store.searchQuery||store.name)+'">'+
  '<button type="button" class="secondary small" data-store-search="'+key+'">Find address</button></div>'+
  '<button type="button" class="secondary small shop-google-search" data-store-google="'+key+'">🔎 Search in Google Maps</button>'+
  '<p class="info shop-find-help">Google Maps finds businesses by name. To save a pin in MyDay, enter the full street address above, or use Pin here when at the store.</p>'+
  '<div class="shop-address-results" data-store-results="'+key+'" role="status" aria-live="polite"></div></div>'+
  '<div class="shop-store-buttons">'+
  '<button type="button" class="secondary small" data-store-pin="'+key+'">📍 Pin here instead</button>'+
  '<button type="button" class="danger small" data-store-delete="'+key+'">Delete store</button>'+
  '</div></div></details>';
}
function filterButton(label,value,count){
 return '<button type="button" class="shop-filter-option'+(filter===value?' active':'')+
 '" data-shop-filter="'+esc(value)+'" aria-pressed="'+String(filter===value)+'">'+esc(label)+
 ' <span>'+count+'</span></button>';
}
function render(){
 const settingsOpen=[...document.querySelectorAll('#shopStoreSettings .shop-store-tools[open]')]
  .map(x=>x.dataset.storeId);
 const stores=api().read();
 if(filter!=='all'&&filter!=='anywhere'&&!stores.some(x=>x.id===filter))filter='all';
 const pending=rows.filter(x=>!x.done),finished=rows.filter(x=>x.done);
 $('shopCount').textContent=pending.length+' to buy';
 const visible=pending.filter(matches);
 const visibleDone=finished.filter(matches);
 let chips=filterButton('All','all',pending.length)+
  filterButton('Untagged','anywhere',pending.filter(x=>api().tags(x).length===0).length);
 for(const s of stores)chips+=filterButton(s.name,s.id,pending.filter(x=>api().tags(x).includes(s.id)).length);
 $('shopFilters').innerHTML=chips;
 $('shopPending').innerHTML=visible.length?visible.map(itemRow).join(''):
  '<p class="task-empty">No unpurchased items in this view.</p>';
 $('shopCompleted').innerHTML=visibleDone.length?visibleDone.map(itemRow).join(''):
  '<p class="info">No purchased items in this view.</p>';
 $('shopDoneCount').textContent='Purchased ('+visibleDone.length+')';
 $('shopPurchasedDetails').hidden=visibleDone.length===0;
 $('shopClearChecked').hidden=finished.length===0;
 $('shopClearChecked').textContent='Clear purchased ('+finished.length+')';
 $('shopStoreSettings').innerHTML=stores.length?stores.map(storeTools).join(''):
  '<p class="info">No stores saved. Add a store above to enable location alerts.</p>';
 for(const id of settingsOpen){
  const el=[...document.querySelectorAll('#shopStoreSettings .shop-store-tools')]
   .find(x=>x.dataset.storeId===id);
  if(el)el.open=true;
 }
 const toggle=$('shopArrivalToggle');
 toggle.checked=api().alerts();toggle.disabled=!window.RunningTabAndroid?.shoppingStores;
 $('shopLocationStatus').textContent=!window.RunningTabAndroid?.shoppingStores?
 'Arrival alerts require the latest Android APK. Your list works everywhere.':
 api().permission()?'Location permission enabled. Only stores with tagged items trigger reminders.':
 'Allow all-the-time precise location to receive store arrival alerts.';
 window.RunningTabView?.adjust?.();
}
function refresh(){rows=read();if(editing&&!rows.some(x=>x.id===editing))editing=null;render();}
function selectFilter(next){filter=next;editing=null;render();}
function openStore(id){
 selectFilter(id||'anywhere');
 return [...document.querySelectorAll('#shopFilters [data-shop-filter]')].find(x=>x.dataset.shopFilter===filter)||null;
}
$('shopFilters').addEventListener('click',event=>{
 const b=event.target.closest('[data-shop-filter]');if(b)selectFilter(b.dataset.shopFilter);
});
function onItemClick(event){
 const b=event.target.closest('button');if(!b)return;
 const id=b.dataset.shopDelete||b.dataset.shopEditTags||b.dataset.shopCloseTags;
 const item=rows.find(x=>x.id===id);
 if(b.dataset.shopDelete&&item){
  if(confirm('Delete '+item.name+'?'))save(rows.filter(x=>x.id!==id));
 }else if(b.dataset.shopEditTags&&item){
  editing=editing===id?null:id;render();
 }else if(b.dataset.shopCloseTags){editing=null;render();}
}
function onItemChange(event){
 const el=event.target;
 const id=el.dataset.shopToggle||el.dataset.shopItemTag;
 if(!id)return;
 const item=rows.find(x=>x.id===id);if(!item)return;
 if(el.hasAttribute('data-shop-toggle')){
  const now=new Date().toISOString();
  save(rows.map(x=>x.id===id?{...x,done:el.checked,completedAt:el.checked?now:null,updatedAt:now}:x));
  return;
 }
 if(el.hasAttribute('data-shop-item-tag')){
  const values=api().tags(item);
  const next=el.checked?[...values,el.value]:values.filter(x=>x!==el.value);
  save(rows.map(x=>x.id===id?api().setTags(x,next):x));
 }
}
for(const id of ['shopPending','shopCompleted']){
 $(id).addEventListener('click',onItemClick);
 $(id).addEventListener('change',onItemChange);
}
function storeSearchResults(storeId,results,error){
 const group=[...document.querySelectorAll('#shopStoreSettings [data-store-id]')]
  .find(x=>x.dataset.storeId===storeId);
 if(!group)return;
 const target=group.querySelector('[data-store-results]');
 const button=group.querySelector('[data-store-search]');
 if(button)button.disabled=false;
 if(!target)return;
 const all=Array.isArray(results)?results.filter(x=>x&&typeof x.label==='string'&&
  Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&Math.abs(x.lat)<=90&&Math.abs(x.lon)<=180):[];
 const valid=all.filter(x=>api().isPreciseAddress(x.label));
 locationResults.set(storeId,valid);
 if(!valid.length){
  const broad=all.length?' The lookup returned only broad locations such as "'+
   all[0].label.slice(0,120)+'". These are not safe store pins.':'';
  target.classList.add('shop-address-error');
  target.textContent='⚠ No precise store address found — PIN NOT SAVED.'+
   (error?' '+error:broad)+
   ' Search the business in Google Maps, copy its full street address, and try Find address again. Or use Pin here at the store.';
  return;
 }
 target.classList.remove('shop-address-error');
 target.innerHTML='<p class="info">Choose the exact street address below to save your pin:</p>'+
  valid.map((x,i)=>'<button type="button" class="shop-address-result" data-store-result="'+i+
   '" data-store-pick="'+esc(storeId)+'">📍 '+esc(x.label)+'</button>').join('');
}
$('shopStoreSettings').addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 const key=b.dataset.storePin||b.dataset.storeSearch||b.dataset.storeGoogle||b.dataset.storePick||b.dataset.storeDelete;
 const s=api().read().find(x=>x.id===key);if(!s)return;
 if(b.dataset.storePin){
  if(window.RunningTabAndroid?.pinStoreHere)window.RunningTabAndroid.pinStoreHere(key);
  else status('Pinning requires the Android app.',true);
  return;
 }
 if(b.hasAttribute('data-store-google')){
  const box=b.closest('[data-store-id]'),query=(box?.querySelector('[data-store-query]')?.value||s.name).trim();
  if(!query)return;
  const url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
  const link=document.createElement('a');
  link.href=url;
  // Android WebView opens external pages through its safe URL handler.
  link.target=window.RunningTabAndroid?'_self':'_blank';
  link.rel='noopener noreferrer';
  document.body.appendChild(link);link.click();link.remove();
  return;
 }
 if(b.hasAttribute('data-store-search')){
  const box=b.closest('[data-store-id]'),input=box?.querySelector('[data-store-query]');
  const query=(input?.value||'').trim();
  if(query.length<3){status('Enter a store name and town, or a street address.',true);return;}
  if(!window.RunningTabAndroid?.searchStoreLocations){
   storeSearchResults(key,[],'Store search requires MyDay v3.1 or later on Android.');
   return;
  }
  b.disabled=true;
  const target=box.querySelector('[data-store-results]');
  if(target){target.classList.remove('shop-address-error');target.textContent='Looking for a precise street address…';}
  locationResults.delete(key);
  window.RunningTabAndroid.searchStoreLocations(key,query);
  return;
 }
 if(b.hasAttribute('data-store-pick')){
  const matches=locationResults.get(key)||[];
  const hit=matches[Number(b.dataset.storeResult)];
  if(!hit||!api().isPreciseAddress(hit.label))return;
  locationResults.delete(key);
  api().update(key,{lat:hit.lat,lon:hit.lon,locationLabel:hit.label});
  status('✓ Store pin saved: '+hit.label+'. Arrival reminders are still controlled by your settings.');
  return;
 }
 if(b.dataset.storeDelete)api().remove(key);
});
$('shopStoreSettings').addEventListener('keydown',event=>{
 if(event.key!=='Enter'||!event.target.matches('[data-store-query]'))return;
 event.preventDefault();
 event.target.closest('[data-store-id]')?.querySelector('[data-store-search]')?.click();
});
$('shopStoreSettings').addEventListener('change',event=>{
 const group=event.target.closest('[data-store-id]');if(!group)return;
 const radius=Number(group.querySelector('[data-store-radius]').value);
 if(!Number.isFinite(radius)||radius<150||radius>1000){status('Radius must be 150–1000 metres.',true);return;}
 const enabled=group.querySelector('[data-store-enabled]').checked;
 api().update(group.dataset.storeId,{radius,enabled,
  arrivalMode:group.querySelector('[data-store-mode]').value==='dwell'?'dwell':'arrival'});
 if(enabled&&!api().permission())window.RunningTabAndroid?.enableStoreLocations?.();
});
$('shopCreateStore').addEventListener('click',()=>{
 const value=$('shopNewStore').value.trim();
 if(!value||value.length>100){status('Enter a store name.',true);return;}
 const store=api().ensure(value);
 $('shopNewStore').value='';
 render();status(store.name+' tag is available. Set a pin under Store settings if you want arrival alerts.');
});
$('shopArrivalToggle').addEventListener('change',event=>{api().setAlerts(event.target.checked);render();});
$('shopClearChecked').addEventListener('click',()=>{
 const n=rows.filter(x=>x.done).length;
 if(n&&confirm('Remove '+n+' purchased shopping items from the master list?'))save(rows.filter(x=>!x.done));
});
$('shopReset').addEventListener('click',()=>{
 if(rows.length&&confirm('Delete every shopping item? Store tags and locations will be kept.'))save([]);
});
window.RunningTabShopping={selectedStore:()=>filter,openStore,refresh,storeSearchResults};
window.addEventListener('runningtab:shopping-changed',refresh);
window.addEventListener('runningtab:stores-changed',refresh);
window.addEventListener('storage',e=>{if([KEY,'running-tab-stores-v1'].includes(e.key))refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
refresh();
})();