/* One master Shopping list. Store tags are filters, not separate copies. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),api=()=>window.MyDayStores;
const KEY='running-tab-shopping-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],filter='all';
let statusTimer=null;
const status=(message,bad=false)=>{
 const x=$('shopStatus');if(!x)return;
 clearTimeout(statusTimer);statusTimer=null;
 x.textContent=message;x.className=message?'notice'+(bad?' bad':''):'';
 if(message&&!bad)statusTimer=setTimeout(()=>{
  if(x.textContent===message){x.textContent='';x.className='';}
  statusTimer=null;
 },4000);
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
 return names.length?'🏷 '+names.join(' · '):'Any store';
}
function itemRow(item){
 const key=esc(item.id);
 return '<div class="shop-master-item" data-shop-entry-id="'+key+'">'+
  '<div class="task shop-item shop-item--'+(item.done?'purchased done':'needed')+'">'+
  '<input type="checkbox" data-shop-toggle="'+key+'" '+(item.done?'checked ':'')+
  'aria-label="'+esc(item.done?'Mark '+item.name+' needed again':'Mark '+item.name+' purchased')+'">'+
  '<div class="task-main"><div class="task-name">'+esc(item.name)+'</div>'+
  '<div class="shop-tag-summary">'+esc(tagSummary(item))+'</div></div>'+
  '<button type="button" class="secondary small" data-shop-edit-tags="'+key+
  '" aria-label="Choose store tags for '+esc(item.name)+'">Tags</button></div></div>';
}
function storeTools(store){
 const key=esc(store.id);
 return '<div class="shop-tag-management-row" data-store-id="'+key+'">'+
  '<span>🏷 '+esc(store.name)+'</span>'+
  '<button type="button" class="danger small" data-store-delete="'+key+'">Delete</button></div>';
}
function filterButton(label,value,count){
 return '<button type="button" class="shop-filter-option'+(filter===value?' active':'')+
 '" data-shop-filter="'+esc(value)+'" aria-pressed="'+String(filter===value)+'">'+esc(label)+
 ' <span>'+count+'</span></button>';
}
function render(){
 const stores=api().read();
 if(filter!=='all'&&filter!=='anywhere'&&!stores.some(x=>x.id===filter))filter='all';
 const pending=rows.filter(x=>!x.done),finished=rows.filter(x=>x.done);
 $('shopCount').textContent=pending.length+' to buy';
 const visible=pending.filter(matches);
 const visibleDone=finished.filter(matches);
 let chips=filterButton('All','all',pending.length);
 const untagged=pending.filter(x=>api().tags(x).length===0).length;
 if(untagged>0||filter==='anywhere')chips+=filterButton('Untagged','anywhere',untagged);
 for(const store of stores){
  const count=pending.filter(x=>api().tags(x).includes(store.id)).length;
  if(count>0||filter===store.id)chips+=filterButton(store.name,store.id,count);
 }
 $('shopFilters').innerHTML=chips;
 $('shopPending').innerHTML=visible.length?visible.map(itemRow).join(''):
  '<p class="task-empty">No unpurchased items in this view.</p>';
 $('shopCompleted').innerHTML=visibleDone.length?visibleDone.map(itemRow).join(''):
  '<p class="info">No purchased items in this view.</p>';
 $('shopDoneCount').textContent='Purchased ('+visibleDone.length+')';
 $('shopPurchasedDetails').hidden=visibleDone.length===0;
 $('shopClearChecked').hidden=finished.length===0;
 $('shopClearChecked').textContent='Clear all purchased ('+finished.length+')';
 $('shopStoreSettings').innerHTML=stores.length?stores.map(storeTools).join(''):
  '<p class="info">No store tags yet. Add one above.</p>';
 window.RunningTabView?.adjust?.();
}
function refresh(){rows=read();render();}
function selectFilter(next){filter=next;render();}
function openStore(id){
 selectFilter(id||'anywhere');
 return [...document.querySelectorAll('#shopFilters [data-shop-filter]')].find(x=>x.dataset.shopFilter===filter)||null;
}
$('shopFilters').addEventListener('click',event=>{
 const b=event.target.closest('[data-shop-filter]');if(b)selectFilter(b.dataset.shopFilter);
});
function onItemClick(event){
 const b=event.target.closest('button');if(!b)return;
 const id=b.dataset.shopEditTags,item=rows.find(x=>x.id===id);
 if(!id||!item)return;
 window.MyDayTagPicker?.open({
  title:'Tags · '+item.name,
  choices:api().read().map(s=>({value:s.id,label:s.name})),
  selected:api().tags(item),
  onToggle:(storeId,on)=>{
   const current=rows.find(x=>x.id===id);if(!current)return false;
   const currentTags=api().tags(current);
   const next=on?[...currentTags,storeId]:currentTags.filter(x=>x!==storeId);
   return save(rows.map(x=>x.id===id?api().setTags(x,next):x));
  },
  onDelete:()=>{
   const current=rows.find(x=>x.id===id);
   if(current&&confirm('Delete '+current.name+'?'))save(rows.filter(x=>x.id!==id));
  }
 });
}
function onItemChange(event){
 const el=event.target;
 const id=el.dataset.shopToggle;
 if(!id)return;
 const item=rows.find(x=>x.id===id);if(!item)return;
 if(el.hasAttribute('data-shop-toggle')){
  const now=new Date().toISOString();
  save(rows.map(x=>x.id===id?{...x,done:el.checked,completedAt:el.checked?now:null,updatedAt:now}:x));
  return;
 }

}
for(const id of ['shopPending','shopCompleted']){
 $(id).addEventListener('click',onItemClick);
 $(id).addEventListener('change',onItemChange);
}
$('shopStoreSettings').addEventListener('click',event=>{
 const b=event.target.closest('[data-store-delete]');
 if(!b)return;
 api().remove(b.dataset.storeDelete);
});
$('shopCreateStore').addEventListener('click',()=>{
 const value=$('shopNewStore').value.trim();
 if(!value||value.length>100){status('Enter a store name.',true);return;}
 const store=api().ensure(value);
 $('shopNewStore').value='';
 render();status(store.name+' tag is available for shopping items.');
});
$('shopClearChecked').addEventListener('click',()=>{
 const n=rows.filter(x=>x.done).length;
 if(n&&confirm('Remove '+n+' purchased shopping items from the master list?'))save(rows.filter(x=>!x.done));
});
$('shopReset').addEventListener('click',()=>{
 if(rows.length&&confirm('Delete every shopping item? Your store tags will be kept.'))save([]);
});
window.RunningTabShopping={selectedStore:()=>filter,openStore,refresh};
window.addEventListener('runningtab:shopping-changed',refresh);
window.addEventListener('runningtab:stores-changed',refresh);
window.addEventListener('storage',e=>{if([KEY,'running-tab-stores-v1'].includes(e.key))refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
refresh();
})();