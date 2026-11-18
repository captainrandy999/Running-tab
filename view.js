/* MyDay view controller: shared entry with swipeable Money, To-Do, Shopping lists. */
(()=>{
'use strict';
const viewport=document.getElementById('viewViewport');
const track=document.getElementById('viewTrack');
const order=['money','todo','shopping'];
const panels=Object.fromEntries(order.map(name=>[name,document.getElementById(name+'Panel')]));
const tabs=[...document.querySelectorAll('.tab-switch')];
if(!viewport||!track||order.some(key=>!panels[key])||tabs.length!==3)return;
let active='money',scheduled=false,navigationSequence=0;
function adjust(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(()=>{
  scheduled=false;
  viewport.style.height=Math.ceil(panels[active].scrollHeight)+'px';
 });
}
function show(name,opts={}){
 if(!order.includes(name))return;
 navigationSequence++;
 active=name;
 const idx=order.indexOf(name);
 track.style.transform='translate3d(-'+(idx*100)+'%,0,0)';
 for(const key of order){
  const selected=key===name;
  panels[key].inert=!selected;
  panels[key].setAttribute('aria-hidden',String(!selected));
 }
 for(const tab of tabs){
  const selected=tab.dataset.view===name;
  tab.classList.toggle('active',selected);
  tab.setAttribute('aria-selected',String(selected));
  tab.tabIndex=selected?0:-1;
 }
 if(opts.updateUrl!==false){
  history.replaceState(null,'',location.pathname+location.search+(name==='money'?'':'#'+name));
 }
 adjust();
 window.dispatchEvent(new CustomEvent('runningtab:view-changed',{detail:{view:name}}));
}
// Android widget rows carry the saved item's identity, not just its tab.
// Reveal its entry after switching tabs; retry briefly if a list is still rendering.
function openItem(name,itemKey){
 if(!order.includes(name))return;
 show(name);
 const key=String(itemKey||'');
 if(!key)return;
 const thisNavigation=navigationSequence;
 const personKey=value=>String(value||'').trim()
  .replace(/\b(cordi|cordy)\b/gi,'Cody').replace(/\s+/g,' ').toLocaleLowerCase();
 let attempts=0;
 const reveal=()=>{
  if(thisNavigation!==navigationSequence)return;
  let item=null;
  if(name==='money'){
   item=[...document.querySelectorAll('#personList > details.person')]
    .find(el=>el.dataset.personKey===personKey(key));
   if(item)item.open=true;
  }else if(name==='todo'){
   const checkbox=[...document.querySelectorAll('#todoPanel input[data-toggle]')]
    .find(el=>el.dataset.toggle===key);
   if(checkbox){
    item=checkbox.closest('.todo-item');
    const details=item?.querySelector('details.note-details');
    if(details)details.open=true;
    const completedGroup=item?.closest('#completed');
    if(completedGroup)document.querySelector('#todoPanel #doneCount')?.closest('details')?.setAttribute('open','');
   }
  }else{
   const checkbox=[...document.querySelectorAll('#shoppingPanel input[data-shop-toggle]')]
    .find(el=>el.dataset.shopToggle===key);
   if(checkbox){
    item=checkbox.closest('.shop-item');
    if(item.closest('#shopCompleted'))document.querySelector('#shoppingPanel #shopDoneCount')?.closest('details')?.setAttribute('open','');
   }
  }
  if(!item){if(attempts++<12)setTimeout(reveal,200);return;}
  item.classList.add('widget-jump-highlight');
  adjust();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(thisNavigation===navigationSequence)item.scrollIntoView({behavior:'smooth',block:'center'});
  }));
  setTimeout(()=>item.classList.remove('widget-jump-highlight'),4500);
 };
 reveal();
}
tabs.forEach(tab=>{
 tab.addEventListener('click',()=>show(tab.dataset.view));
 tab.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();
  const idx=order.indexOf(active)+(event.key==='ArrowRight'?1:-1);
  if(idx>=0&&idx<order.length){
   show(order[idx]);
   tabs.find(t=>t.dataset.view===order[idx])?.focus();
  }
 });
});
let start=null;
viewport.addEventListener('touchstart',event=>{
 if(event.touches.length!==1){start=null;return;}
 const touch=event.touches[0];start={x:touch.clientX,y:touch.clientY};
},{passive:true});
viewport.addEventListener('touchend',event=>{
 if(!start||event.changedTouches.length!==1){start=null;return;}
 const t=event.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
 start=null;
 if(Math.abs(dx)>75&&Math.abs(dx)>Math.abs(dy)*1.5){
  const idx=order.indexOf(active)+(dx<0?1:-1);
  if(idx>=0&&idx<order.length)show(order[idx]);
 }
},{passive:true});
if('ResizeObserver' in window){
 const observer=new ResizeObserver(adjust);
 order.forEach(name=>observer.observe(panels[name]));
}else window.addEventListener('resize',adjust);
window.addEventListener('hashchange',()=>{
 const hash=location.hash.slice(1);
 if(hash===''||hash==='money'||order.includes(hash))show(hash||'money',{updateUrl:false});
});
window.addEventListener('load',adjust);
window.RunningTabView={show,openItem,adjust,current:()=>active};
const fromHash=location.hash.slice(1);
show(order.includes(fromHash)?fromHash:'money',{updateUrl:false});
})();
