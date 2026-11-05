/* Running Tab view controller: shared entry with swipeable Money, To-Do, Shopping lists. */
(()=>{
'use strict';
const viewport=document.getElementById('viewViewport');
const track=document.getElementById('viewTrack');
const order=['money','todo','shopping'];
const panels=Object.fromEntries(order.map(name=>[name,document.getElementById(name+'Panel')]));
const tabs=[...document.querySelectorAll('.tab-switch')];
if(!viewport||!track||order.some(key=>!panels[key])||tabs.length!==3)return;
let active='money',scheduled=false;
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
window.RunningTabView={show,adjust};
const fromHash=location.hash.slice(1);
show(order.includes(fromHash)?fromHash:'money',{updateUrl:false});
})();