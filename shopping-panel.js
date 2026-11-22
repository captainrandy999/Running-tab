/* Shopping is independent of Money and dated To-Do tasks. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const STORE='running-tab-shopping-v1';
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const valid=r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&typeof r.done==='boolean';
 let items=[];
 function status(message,bad=false){
  const el=$('shopStatus');if(!el)return;
  el.textContent=message;
  el.className=message?'notice'+(bad?' bad':''):'';
 }
 function refresh(){
  try{
   const saved=JSON.parse(localStorage.getItem(STORE)||'[]');
   if(Array.isArray(saved)){items=saved.filter(valid);render();}
  }catch(e){status('Could not load the shopping list.',true);}
 }
 function persist(next){
  try{localStorage.setItem(STORE,JSON.stringify(next));items=next;return true;}
  catch(e){status('Could not save shopping changes on this device.',true);return false;}
 }
 function row(item){
  return '<div class="task shop-item shop-item--'+(item.done?'purchased':'needed')+(item.done?' done':'')+'">'+
   '<input type="checkbox" data-shop-toggle="'+escape(item.id)+'" '+(item.done?'checked':'')+
   ' aria-label="'+escape(item.done?'Mark '+item.name+' needed again':'Mark '+item.name+' purchased')+'">'+
   '<div class="task-main"><div class="task-name">'+escape(item.name)+'</div>'
   +'<div class="task-meta"><span class="task-status-pill task-status-pill--'+(item.done?'complete':'needed')+'">'
   +(item.done?'Purchased':'To buy')+'</span></div></div>'+
   '<button type="button" class="danger small" data-shop-delete="'+escape(item.id)+'" aria-label="Delete '+escape(item.name)+'">Delete</button></div>';
 }
 function render(){
  const needed=items.filter(i=>!i.done),purchased=items.filter(i=>i.done);
  $('shopCount').textContent=needed.length+' to buy';
  $('shopDoneCount').textContent='Purchased ('+purchased.length+')';
  $('shopPending').innerHTML=needed.length?needed.map(row).join(''):'<p class="task-empty">Nothing on your shopping list. Try “I need to buy milk and eggs”.</p>';
  $('shopCompleted').innerHTML=purchased.length?purchased.map(row).join(''):'<p class="info">Nothing checked off yet.</p>';
  $('shopClearChecked').hidden=purchased.length===0;
  for(const root of ['shopPending','shopCompleted']){
   $(root).querySelectorAll('[data-shop-toggle]').forEach(checkbox=>checkbox.addEventListener('change',()=>{
    const next=items.map(item=>item.id===checkbox.dataset.shopToggle?{...item,done:checkbox.checked,completedAt:checkbox.checked?new Date().toISOString():null}:item);
    if(persist(next)){render();status(checkbox.checked?'Marked purchased.':'Back on your shopping list.');window.RunningTabView?.adjust();}
    else checkbox.checked=!checkbox.checked;
   }));
   $(root).querySelectorAll('[data-shop-delete]').forEach(button=>button.addEventListener('click',()=>{
    const item=items.find(x=>x.id===button.dataset.shopDelete);
    if(!item||!confirm('Remove "'+item.name+'" from your shopping list?'))return;
    if(persist(items.filter(x=>x.id!==item.id))){render();status('Item removed.');window.RunningTabView?.adjust();}
   }));
  }
  window.RunningTabView?.adjust();
 }
 $('shopClearChecked').addEventListener('click',()=>{
  const amount=items.filter(x=>x.done).length;
  if(!amount||!confirm('Remove '+amount+' purchased item'+(amount===1?'':'s')+' from the shopping list?'))return;
  if(persist(items.filter(x=>!x.done))){render();status('Purchased items cleared.');}
 });
 $('shopReset').addEventListener('click',()=>{
  if(!items.length)return;
  if(!confirm('Permanently delete the entire shopping list? Money and To-Do records will not be affected.'))return;
  if(persist([])){render();status('Shopping list cleared.');}
 });
 window.addEventListener('runningtab:shopping-changed',refresh);
 window.addEventListener('storage',e=>{if(e.key===STORE)refresh();});
 refresh();
})();