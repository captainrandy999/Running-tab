/* MyDay recurring To-Dos: local-calendar arithmetic, voice schedule parsing,
   and the same completion rule for the list and Android notification actions. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MyDayRepeat=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const DAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
 const ORDINAL={first:1,second:2,third:3,fourth:4,last:-1};
 const NUMBERS={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twelve:12};
 const pad=n=>String(n).padStart(2,'0');
 const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
 function dateOf(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return null;const [y,m,d]=s.split('-').map(Number);const a=new Date(y,m-1,d,12);return a.getFullYear()===y&&a.getMonth()===m-1&&a.getDate()===d?a:null;}
 function atTime(day,time){const parts=String(time||'08:00').split(':').map(Number);return new Date(day.getFullYear(),day.getMonth(),day.getDate(),parts[0]||0,parts[1]||0);}
 function monthDay(y,m,day){return new Date(y,m,Math.min(day,new Date(y,m+1,0).getDate()),12);}
 function nthWeekday(y,m,weekday,week){
  if(week===-1){const last=new Date(y,m+1,0,12);return new Date(y,m,last.getDate()-(last.getDay()-weekday+7)%7,12);}
  const first=new Date(y,m,1,12);const day=1+(weekday-first.getDay()+7)%7+(week-1)*7;
  return day>new Date(y,m+1,0).getDate()?null:new Date(y,m,day,12);
 }
 function describe(r){
  if(!r)return '';
  if(r.type==='daily')return 'Every day';
  if(r.type==='weekly')return 'Every '+DAYS[r.weekday??0].replace(/^./,c=>c.toUpperCase());
  if(r.type==='monthly-day')return 'Every month on day '+r.day;
  if(r.type==='monthly-weekday')return (Object.keys(ORDINAL).find(k=>ORDINAL[k]===r.week)||'first')+' '+DAYS[r.weekday??1]+' of each month';
  if(r.type==='months')return 'Every '+(r.interval||3)+' months';
  return '';
 }
 function next(task,reference=new Date()){
  const r=task?.repeat,day=dateOf(task?.due);
  if(!r||!day)return null;
  const time=task.remindTime||'08:00',boundary=Math.max(atTime(day,time).getTime(),reference.getTime());
  if(r.type==='daily'||r.type==='weekly'){
   const step=r.type==='daily'?1:7,first=new Date(day);
   if(r.type==='weekly'&&Number.isInteger(r.weekday))first.setDate(first.getDate()+(r.weekday-first.getDay()+7)%7);
   for(let i=0;i<4000;i++){if(atTime(first,time).getTime()>boundary)return dateKey(first);first.setDate(first.getDate()+step);}
  }
  if(['monthly-day','monthly-weekday','months'].includes(r.type)){
   const step=r.type==='months'?Math.max(1,Math.min(120,Number(r.interval)||3)):1;
   for(let k=0;k<1500;k++){
    const month=day.getMonth()+k*step,y=day.getFullYear()+Math.floor(month/12),m=((month%12)+12)%12;
    const candidate=r.type==='monthly-weekday'?nthWeekday(y,m,r.weekday,r.week):monthDay(y,m,r.day||day.getDate());
    if(candidate&&atTime(candidate,time).getTime()>boundary)return dateKey(candidate);
   }
  }
  return null;
 }
 function firstDue(repeat,time='08:00',reference=new Date()){
  const base=new Date(reference.getFullYear(),reference.getMonth(),reference.getDate(),12);
  if(repeat?.type==='months')return dateKey(monthDay(base.getFullYear(),base.getMonth()+Math.max(1,Number(repeat.interval)||3),base.getDate()));
  const anchored=withAnchor(repeat,dateKey(base));
  const previous=new Date(base);
  if(anchored?.type==='daily')previous.setDate(previous.getDate()-1);
  else if(anchored?.type==='weekly')previous.setDate(previous.getDate()-7);
  else previous.setMonth(previous.getMonth()-1,1);
  const result=next({repeat:anchored,due:dateKey(previous),remindTime:time},reference);
  return result||dateKey(base);
 }
 function extract(input){
  let text=String(input||''),repeat=null,match;
  match=text.match(/\b(?:on\s+)?(?:the\s+)?(first|second|third|fourth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+of\s+(?:every|each)\s+month\b/i);
  if(match)repeat={type:'monthly-weekday',week:ORDINAL[match[1].toLowerCase()],weekday:DAYS.indexOf(match[2].toLowerCase())};
  if(!repeat){match=text.match(/\bevery\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+months?\b/i);
   if(match)repeat={type:'months',interval:Number(match[1])||NUMBERS[match[1].toLowerCase()]||1};}
  if(!repeat){match=text.match(/\b(?:every|each)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
   if(match)repeat={type:'weekly',weekday:DAYS.indexOf(match[1].toLowerCase())};}
  if(!repeat){match=text.match(/\b(?:every|each)\s+day\b|\bdaily\b/i);if(match)repeat={type:'daily'};}
  if(!repeat){match=text.match(/\b(?:every|each)\s+week\b|\bweekly\b/i);if(match)repeat={type:'weekly'};}
  if(!repeat){match=text.match(/\b(?:every|each)\s+month\b|\bmonthly\b/i);if(match)repeat={type:'monthly-day'};}
  if(repeat&&match){text=(text.slice(0,match.index)+' '+text.slice(match.index+match[0].length)).replace(/\s+/g,' ').trim();
   text=text.replace(/^(remind\s+me)\s+(?:to|about)\s+/i,'$1 to ');}
  return {text,repeat};
 }
 function withAnchor(repeat,due){
  if(!repeat)return null;
  const d=dateOf(due)||new Date();const r={...repeat};
  if(r.type==='weekly'&&!Number.isInteger(r.weekday))r.weekday=d.getDay();
  if(['monthly-day','months'].includes(r.type)&&!r.day)r.day=d.getDate();
  if(r.type==='monthly-weekday'){
   if(!Number.isInteger(r.weekday))r.weekday=d.getDay();
   if(!r.week)r.week=Math.min(4,Math.ceil(d.getDate()/7));
  }
  if(r.type==='months')r.interval=Math.max(1,Math.min(120,Number(r.interval)||3));
  return r;
 }
 function complete(task,at=new Date()){
  if(!task||task.done)return task;
  const stamp=at.toISOString();
  if(task.repeat){
   const due=next(task,at);
   if(due)return {...task,due,done:false,lastCompletedAt:stamp,completedOccurrences:(task.completedOccurrences||0)+1,updatedAt:stamp};
  }
  return {...task,done:true,completedAt:stamp,updatedAt:stamp};
 }
 function completeId(id,source){
  if(typeof localStorage==='undefined')return false;
  const store='running-tab-todo-v1';let tasks;
  try{tasks=JSON.parse(localStorage.getItem(store)||'[]');}catch(e){return false;}
  if(!Array.isArray(tasks))return false;
  const index=tasks.findIndex(t=>t?.id===id&&!t.done);
  if(index<0)return false;
  const task=tasks[index],day=dateOf(task.due);
  if(!day)return false;
  const timestamp=atTime(day,task.remindTime||'08:00').getTime();
  if(source!=null&&Number(source)!==timestamp)return false;
  tasks[index]=complete(task);
  try{localStorage.setItem(store,JSON.stringify(tasks));}catch(e){return false;}
  if(typeof window!=='undefined')window.dispatchEvent(new Event('runningtab:todo-changed'));
  return true;
 }
 return {DAYS,describe,next,firstDue,extract,withAnchor,complete,completeId,dateKey,dateOf};
});
