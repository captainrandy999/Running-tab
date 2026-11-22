/* Store lists preserve all existing unassigned shopping items. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),api=()=>window.MyDayStores;
const K='running-tab-shopping-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],selected='',moveId=null;
const status=(s,bad=false)=>{const el=$('shopStatus');if(el){el.textContent=s;el.className=s?'notice'+(bad?' bad':''):'';}};
function read(){try{const a=JSON.parse(localStorage.getItem(K)||'[]');return Array.isArray(a)?a.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.done==='boolean'):[];}catch(e){return [];}}
function write(a){try{localStorage.setItem(K,JSON.stringify(a));window.dispatchEvent(new Event('runningtab:shopping-changed'));return true;}catch(e){status('Unable to save shopping.',true);return false;}}
function row(item){
 const destinations=[{id:'',name:'General Shopping'},...api().read()];
 const choices=destinations.filter(x=>x.id!==(item.storeId||''));
 const expanded=moveId===item.id;
 const id=esc(item.id);
 const options=choices.length?choices.map(x=>
  '<button type="button" class="shop-move-option" data-shop-destination="'+esc(x.id)+'" data-shop-item="'+id+'">'+
  '🛒 '+esc(x.name)+'</button>').join(''):
  '<span class="info">Create another store list above to move this item.</span>';
 return '<div class="shop-item-wrap" data-shop-entry-id="'+id+'">'+
 '<div class="task shop-item shop-item--'+(item.done?'purchased done':'needed')+'">'+
 '<input type="checkbox" data-shop-toggle="'+id+'"'+(item.done?' checked':'')+
 ' aria-label="'+esc(item.done?'Mark '+item.name+' needed again':'Mark '+item.name+' purchased')+'">'+
 '<div class="task-main"><div class="task-name">'+esc(item.name)+'</div></div>'+
 '<button class="secondary small shop-move-trigger" type="button" data-shop-move="'+id+
 '" aria-expanded="'+expanded+'" aria-controls="shop-move-picker-'+id+'">Move</button>'+
 '<button class="danger small" type="button" data-shop-delete="'+id+'">Delete</button></div>'+
 '<div class="shop-move-panel" id="shop-move-picker-'+id+'"'+(expanded?'':' hidden')+'>'+
 '<div class="shop-move-heading">Move to which list?</div>'+
 '<div class="shop-move-options">'+options+'</div>'+
 '<button type="button" class="shop-move-cancel secondary small" data-shop-move-cancel="'+id+'">Cancel</button>'+
 '</div></div>';
}
function section(store){
 const key=store?.id||'',list=rows.filter(x=>(x.storeId||'')===key),needed=list.filter(x=>!x.done),done=list.filter(x=>x.done);
 let html='<details class="shop-store-group" data-shop-store-id="'+esc(key)+'"'+(selected===key?' open':'')+'>'+
 '<summary><strong>🛒 '+esc(store?.name||'General Shopping')+'</strong> <span>'+needed.length+' to buy</span></summary>'+
 '<div class="shop-store-body">'+(needed.length?needed.map(row).join(''):'<p class="info">No items to buy.</p>')+
 (done.length?'<details><summary>Purchased ('+done.length+')</summary>'+done.map(row).join('')+'</details>':'');
 if(store){
  html+='<div class="shop-store-tools" data-store-id="'+esc(key)+'">'+
  '<strong>Store location & reminders</strong><p class="info">Pin: '+(Number.isFinite(store.lat)&&Number.isFinite(store.lon)?store.lat.toFixed(5)+', '+store.lon.toFixed(5):'Not set')+'</p>'+
  '<label class="reminder-check"><input type="checkbox" data-store-enabled'+(store.enabled?' checked':'')+'> Notify me when I arrive with items to buy</label>'+
  '<div class="shop-store-grid"><label>Radius (m)<input data-store-radius type="number" min="150" max="1000" step="50" value="'+esc(store.radius||200)+'"></label>'+
  '<label>Arrival<select data-store-mode><option value="arrival"'+(store.arrivalMode==='dwell'?'':' selected')+'>On arrival</option>'+
  '<option value="dwell"'+(store.arrivalMode==='dwell'?' selected':'')+'>After a few minutes</option></select></label></div>'+
  '<div class="shop-store-buttons"><button type="button" class="secondary small" data-store-pin="'+esc(key)+'">📍 Pin current location</button>'+
  '<button type="button" class="secondary small" data-store-coords="'+esc(key)+'">Enter coordinates</button>'+
  '<button type="button" class="danger small" data-store-delete="'+esc(key)+'">Delete store</button></div></div>';
 }
 return html+'</div></details>';
}
function render(){
 const opened=[...document.querySelectorAll('#shopPending .shop-store-group[open]')].map(x=>x.dataset.shopStoreId);
 const stores=api().read(),needed=rows.filter(x=>!x.done).length,done=rows.filter(x=>x.done).length;
 $('shopCount').textContent=needed+' to buy';
 $('shopDoneCount').textContent='Purchased ('+done+')';
 $('shopPending').innerHTML=[null,...stores].map(section).join('');
 for(const id of opened){const group=[...document.querySelectorAll('#shopPending .shop-store-group')].find(x=>x.dataset.shopStoreId===id);if(group)group.open=true;}
 $('shopCompleted').innerHTML='';
 $('shopDoneCount').closest('details').hidden=true;
 $('shopClearChecked').hidden=done===0;
 const toggle=$('shopArrivalToggle');
 toggle.checked=api().alerts();toggle.disabled=!window.RunningTabAndroid?.shoppingStores;
 $('shopLocationStatus').textContent=!window.RunningTabAndroid?.shoppingStores?
  'Arrival alerts require the updated Android APK. Shopping lists work on both devices.':
  api().permission()?'Location access ready; only enabled stores with unpurchased items are monitored.':
  'Location access not yet allowed. Enable alerts and follow the Android permission steps.';
 window.RunningTabView?.adjust?.();
}
function refresh(){rows=read();if(moveId&&!rows.some(x=>x.id===moveId))moveId=null;render();}
$('shopPending').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 const del=b.dataset.shopDelete,move=b.dataset.shopMove;
 if(del){const rec=rows.find(x=>x.id===del);if(rec&&confirm('Remove '+rec.name+'?'))write(rows.filter(x=>x.id!==del));return;}
 if(move){
  moveId=moveId===move?null:move;
  render();
  const picker=moveId&&[...document.querySelectorAll('#shopPending .shop-move-panel')].find(x=>x.id==='shop-move-picker-'+moveId);
  if(picker)picker.querySelector('.shop-move-option')?.focus({preventScroll:true});
  return;
 }
 if(b.dataset.shopMoveCancel){moveId=null;render();return;}
 if(b.hasAttribute('data-shop-destination')){
  const itemId=b.dataset.shopItem;
  const destination=b.dataset.shopDestination;
  const rec=rows.find(x=>x.id===itemId);
  const allowed=destination===''||api().read().some(x=>x.id===destination);
  if(!rec||!allowed){status('That shopping list is no longer available.',true);return;}
  const destName=api().label(destination);
  moveId=null;
  selected=destination;
  if(write(rows.map(x=>x.id===itemId?{...x,storeId:destination||null}:x)))
   status('Moved "'+rec.name+'" to '+destName+'.');
  return;
 }
 if(b.dataset.storePin){if(window.RunningTabAndroid?.pinStoreHere)window.RunningTabAndroid.pinStoreHere(b.dataset.storePin);
  else status('Pinning requires the updated Android app.',true);return;}
 if(b.dataset.storeCoords){
  const store=api().read().find(x=>x.id===b.dataset.storeCoords);if(!store)return;
  const input=prompt('Latitude, longitude from Google Maps',Number.isFinite(store.lat)?store.lat+', '+store.lon:'');
  if(input===null)return;
  const coords=input.split(/[,;\s]+/).filter(Boolean).map(Number);
  if(coords.length!==2||!Number.isFinite(coords[0])||!Number.isFinite(coords[1])||Math.abs(coords[0])>90||Math.abs(coords[1])>180){status('Invalid coordinates.',true);return;}
  api().update(store.id,{lat:coords[0],lon:coords[1]});status('Store pin updated.');return;
 }
 if(b.dataset.storeDelete)api().remove(b.dataset.storeDelete);
});
$('shopPending').addEventListener('change',e=>{
 const el=e.target;
 if(el.dataset.shopToggle){write(rows.map(x=>x.id===el.dataset.shopToggle?{...x,done:el.checked,completedAt:el.checked?new Date().toISOString():null}:x));return;}
 const group=el.closest('[data-store-id]');if(!group)return;
 const id=group.dataset.storeId,radius=Number(group.querySelector('[data-store-radius]').value);
 if(!Number.isFinite(radius)||radius<150||radius>1000){status('Radius must be 150–1000 metres.',true);return;}
 const enabled=group.querySelector('[data-store-enabled]').checked;
 api().update(id,{radius,enabled,arrivalMode:group.querySelector('[data-store-mode]').value});
 if(enabled&&!api().permission())window.RunningTabAndroid?.enableStoreLocations?.();
});
$('shopCreateStore').addEventListener('click',()=>{
 const name=$('shopNewStore').value.trim();
 if(!name||name.length>100){status('Enter a store name.',true);return;}
 selected=api().ensure(name).id;$('shopNewStore').value='';render();status('Store list ready. Set a pin for arrival alerts.');
});
$('shopArrivalToggle').addEventListener('change',e=>{api().setAlerts(e.target.checked);render();});
// Keep the purchased-items cleanup accessible even though purchases are grouped by store.
$('shopPending').insertAdjacentElement('afterend',$('shopClearChecked'));
$('shopClearChecked').addEventListener('click',()=>{const n=rows.filter(x=>x.done).length;if(n&&confirm('Remove '+n+' purchased items?'))write(rows.filter(x=>!x.done));});
$('shopReset').addEventListener('click',()=>{if(rows.length&&confirm('Delete all shopping items? Store lists will remain.'))write([]);});
function openStore(id){selected=id||'';render();const x=[...document.querySelectorAll('[data-shop-store-id]')].find(x=>x.dataset.shopStoreId===selected);if(x)x.open=true;return x;}
window.RunningTabShopping={selectedStore:()=>selected,openStore,refresh};
window.addEventListener('runningtab:shopping-changed',refresh);
window.addEventListener('runningtab:stores-changed',refresh);
window.addEventListener('storage',e=>{if([K,'running-tab-stores-v1'].includes(e.key))refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
refresh();
})();