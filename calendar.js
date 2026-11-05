/* A tappable, in-page calendar for Reviewing To-Do reminders. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const trigger=$('todoDateButton'),popup=$('dueCalendar'),grid=$('calDays');
const heading=$('calMonth'),type=$('todoDueType'),day=$('todoDueDay'),month=$('todoDueMonth');
if(!trigger||!popup||!grid||!heading||!type||!day||!month)return;
const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const pad=n=>String(n).padStart(2,'0');
const dateIso=(y,m,d)=>y+'-'+pad(m+1)+'-'+pad(d);
const dateLocal=iso=>new Date(iso+'T12:00:00');
let showing=new Date();showing.setDate(1);
let lastFocus=trigger;
function label(){
 if(type.value==='none')return '📅 No deadline — tap to choose';
 if(type.value==='month'&&month.value){
  const d=dateLocal(month.value+'-01');
  return '📅 '+d.toLocaleDateString('en-CA',{month:'long',year:'numeric'})+' (no specific day)';
 }
 if(type.value==='day'&&day.value){
  const d=dateLocal(day.value);
  return '📅 '+d.toLocaleDateString('en-CA',{weekday:'short',month:'long',day:'numeric',year:'numeric'});
 }
 return '📅 Choose a due date';
}
function sync(){
 trigger.textContent=label();
 const chosen=type.value==='day'?day.value:type.value==='month'?month.value+'-01':'';
 if(chosen){const d=dateLocal(chosen);if(!Number.isNaN(d.getTime()))showing=new Date(d.getFullYear(),d.getMonth(),1);}
 if(!popup.hidden)render();
}
function save(kind,value){
 type.value=kind;
 day.value=kind==='day'?value:'';
 month.value=kind==='month'?value:'';
 type.dispatchEvent(new Event('change',{bubbles:true}));
 close();
 sync();
}
function render(){
 const y=showing.getFullYear(),m=showing.getMonth();
 heading.textContent=showing.toLocaleDateString('en-CA',{month:'long',year:'numeric'});
 const now=new Date(),today=dateIso(now.getFullYear(),now.getMonth(),now.getDate());
 const selected=type.value==='day'?day.value:'';
 const first=new Date(y,m,1).getDay(),length=new Date(y,m+1,0).getDate();
 let html=weekdays.map(x=>'<div class="calendar-weekday" aria-hidden="true">'+x+'</div>').join('');
 for(let i=0;i<first;i++)html+='<div aria-hidden="true"></div>';
 for(let n=1;n<=length;n++){
  const id=dateIso(y,m,n);
  html+='<button type="button" data-date="'+id+'" class="calendar-day'+(id===today?' calendar-today':'')+(id===selected?' calendar-selected':'')+
   '" aria-label="'+new Date(y,m,n,12).toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric',year:'numeric'})+
   '" aria-pressed="'+(id===selected?'true':'false')+'">'+n+'</button>';
 }
 grid.innerHTML=html;
 grid.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>save('day',b.dataset.date)));
}
function open(){
 lastFocus=document.activeElement||trigger;
 const chosen=type.value==='day'?day.value:type.value==='month'?month.value+'-01':'';
 const source=chosen?dateLocal(chosen):new Date();
 showing=new Date(source.getFullYear(),source.getMonth(),1);
 popup.hidden=false;
 trigger.setAttribute('aria-expanded','true');
 render();
 const current=grid.querySelector('[aria-pressed="true"]')||grid.querySelector('.calendar-today')||grid.querySelector('[data-date]');
 (current||$('calClose')).focus({preventScroll:true});
}
function close(){
 popup.hidden=true;trigger.setAttribute('aria-expanded','false');
 // Return focus to the date button rather than a text field (no keyboard).
 if(popup.contains(document.activeElement))trigger.focus({preventScroll:true});
}
trigger.addEventListener('click',()=>popup.hidden?open():close());
$('calPrev').addEventListener('click',()=>{showing.setMonth(showing.getMonth()-1);render();});
$('calNext').addEventListener('click',()=>{showing.setMonth(showing.getMonth()+1);render();});
$('calNone').addEventListener('click',()=>save('none',''));
$('calMonthOnly').addEventListener('click',()=>save('month',showing.getFullYear()+'-'+pad(showing.getMonth()+1)));
$('calClose').addEventListener('click',close);
popup.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
document.addEventListener('pointerdown',e=>{if(!popup.hidden&&!popup.contains(e.target)&&e.target!==trigger)close();});
window.RunningTabCalendar={sync,close};
sync();
})();