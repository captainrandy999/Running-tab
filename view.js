/* Running Tab view controller: static header/entry, sliding Money & To-Do panels. */
(()=>{
 'use strict';
 const viewport=document.getElementById('viewViewport');
 const track=document.getElementById('viewTrack');
 const panels={
  money:document.getElementById('moneyPanel'),
  todo:document.getElementById('todoPanel')
 };
 const tabs=[...document.querySelectorAll('.tab-switch')];
 if(!viewport||!track||!panels.money||!panels.todo||tabs.length!==2)return;
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
  if(name!=='money'&&name!=='todo')return;
  active=name;
  track.style.transform=name==='todo'?'translate3d(-100%,0,0)':'translate3d(0,0,0)';
  for(const key of ['money','todo']){
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
   const dest=location.pathname+location.search+(name==='todo'?'#todo':'');
   history.replaceState(null,'',dest);
  }
  adjust();
 }
 tabs.forEach(tab=>{
  tab.addEventListener('click',()=>show(tab.dataset.view));
  tab.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
   event.preventDefault();
   const target=event.key==='ArrowRight'?'todo':'money';
   show(target);
   tabs.find(t=>t.dataset.view===target)?.focus();
  });
 });
 let start=null;
 viewport.addEventListener('touchstart',event=>{
  if(event.touches.length!==1){start=null;return;}
  const touch=event.touches[0];start={x:touch.clientX,y:touch.clientY};
 },{passive:true});
 viewport.addEventListener('touchend',event=>{
  if(!start||event.changedTouches.length!==1){start=null;return;}
  const touch=event.changedTouches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;
  start=null;
  if(Math.abs(dx)>75&&Math.abs(dx)>Math.abs(dy)*1.5){
   if(dx<0&&active==='money')show('todo');
   else if(dx>0&&active==='todo')show('money');
  }
 },{passive:true});
 if('ResizeObserver' in window){
  const observer=new ResizeObserver(()=>adjust());
  observer.observe(panels.money);
  observer.observe(panels.todo);
 }else window.addEventListener('resize',adjust);
 window.addEventListener('hashchange',()=>{
  if(location.hash==='#todo')show('todo',{updateUrl:false});
  else if(location.hash===''||location.hash==='#money')show('money',{updateUrl:false});
 });
 window.addEventListener('load',adjust);
 window.RunningTabView={show,adjust};
 show(location.hash==='#todo'?'todo':'money',{updateUrl:false});
})();
