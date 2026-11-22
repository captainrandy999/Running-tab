/* Calendar handoff and editable on-device reminders for To-Do items.
   No calendar access is granted to MyDay: the user reviews the event in
   their chosen calendar. Background alerts are scheduled by the native APK. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const STORE='running-tab-todo-v1';
const native=()=>window.RunningTabAndroid;
const hasAlerts=()=>typeof native()?.enableNotifications==='function';
const hasSwitch=()=>typeof native()?.setRemindersEnabled==='function';
const repeat=()=>window.MyDayRepeat;
function tasks(){
 try{const value=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(value)?value:[];}
 catch(e){return [];}
}
function message(value,bad=false){
 const el=$('todoStatus');
 if(el){el.textContent=value;el.className=value?'notice'+(bad?' bad':''):'';}
}
function permissionState(){
 const btn=$('enablePhoneAlerts'),label=$('reminderPermissionStatus');
 const row=$('phoneAlertsSwitchRow'),switcher=$('phoneAlertsSwitch'),info=$('phoneAlertsSwitchInfo');
 if(!btn||!label)return;
 if(!hasAlerts()){
  btn.hidden=true;
  if(row)row.hidden=true;if(info)info.hidden=true;
  label.textContent='Phone alerts work in the Android APK (version 1.7 or later). The browser version can add events to Google Calendar, which can send its own alerts.';
  return;
 }
 btn.hidden=false;
 if(row)row.hidden=!hasSwitch();if(info)info.hidden=!hasSwitch();
 let allowed=false;
 try{allowed=!!native().notificationPermissionGranted();}catch(e){}
 let enabled=true;
 try{enabled=!!native().remindersEnabled();}catch(e){}
 if(switcher)switcher.checked=enabled;
 label.textContent=!enabled?'⏸ MyDay phone alerts are paused on this device. Your To-Dos are safe.' : allowed
  ?'🔔 Notifications allowed. Dated To-Dos with phone alerts enabled can notify you when MyDay is closed.'
  :'🔕 Notifications are off. Enable them here so dated To-Dos can alert you when the app is closed.';
 btn.textContent=allowed?'Notifications enabled':'Enable phone notifications';
 btn.disabled=allowed||!enabled;
}
function requestPermission(){
 if(!hasAlerts()){message('Install the updated Android APK for background phone alerts. Calendar events can also send alerts.',true);return;}
 try{native().enableNotifications();}catch(e){message('Could not open phone notification permissions.',true);}
}
function validDay(day){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
 const d=new Date(day+'T12:00:00');
 const [y,m,n]=day.split('-').map(Number);
 return !Number.isNaN(d.getTime())&&d.getFullYear()===y&&d.getMonth()+1===m&&d.getDate()===n;
}
function validTime(time){return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);}
function calendar(task){
 const due=repeat().currentOrNext(task);
 if(task.dueType!=='day'||!validDay(due)){message('Set an exact day before adding an event to your calendar.',true);return;}
 const time=validTime(task.remindTime||'')?task.remindTime:'08:00';
 if(typeof native()?.addCalendarEvent==='function'){
  try{native().addCalendarEvent(task.title,due,time,task.body||'');message('Opening your calendar. Review and save the event there.');return;}
  catch(e){message('Could not open the device calendar.',true);return;}
 }
 // The Google Calendar event editor also works without calendar OAuth scopes.
 const start=new Date(due+'T'+time+':00');
 const end=new Date(start.getTime()+30*60000);
 const toUtc=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const params=new URLSearchParams({
  action:'TEMPLATE',text:task.title,dates:toUtc(start)+'/'+toUtc(end),
  details:(task.body||'')?.slice(0,700)||'Created from MyDay'
 });
 const url='https://calendar.google.com/calendar/render?'+params;
 const w=window.open(url,'_blank');
 if(w)w.opener=null;
 else window.location.href=url;
 message('Review the event in Google Calendar and tap Save there.');
}
document.addEventListener('click',event=>{
 const target=event.target;
 if(!(target instanceof Element))return;
 const add=target.closest('[data-calendar]');
 if(add){
  const item=tasks().find(t=>t.id===add.dataset.calendar);
  if(item)calendar(item);
  return;
 }
 const edit=target.closest('[data-reminder-edit]');
 if(edit){
  const panel=edit.closest('.todo-item');
  const form=panel?.querySelector('[data-reminder-form]');
  if(!form)return;
  form.hidden=false;edit.hidden=true;
  const checkbox=form.querySelector('[data-reminder-notify]');
  if(!hasAlerts()){checkbox.checked=false;checkbox.disabled=true;}
  form.querySelector('[data-reminder-date]').focus();
  return;
 }
 const cancel=target.closest('[data-reminder-cancel]');
 if(cancel){
  const panel=cancel.closest('.todo-item');
  const form=panel?.querySelector('[data-reminder-form]');
  if(form){form.hidden=true;panel.querySelector('[data-reminder-edit]').hidden=false;}
  return;
 }
 const pause=target.closest('[data-repeat-pause]');
 const stop=target.closest('[data-repeat-stop]');
 if(pause||stop){
  const id=pause?.dataset.repeatPause||stop?.dataset.repeatStop;
  const all=tasks(),index=all.findIndex(t=>t.id===id&&t.repeat);
  if(index<0)return;
  const original=all[index];
  if(stop&&!confirm('Stop repeating "'+original.title+'"? The To-Do stays on your list with its current date.'))return;
  all[index]=stop?{...original,repeat:null,repeatPaused:false,updatedAt:new Date().toISOString()}
   :{...original,repeatPaused:!original.repeatPaused,updatedAt:new Date().toISOString()};
  if(!storeTasks(all))return;
  message(stop?'Repeating stopped. This To-Do was kept.':all[index].repeatPaused?'Repeating alerts paused.':'Repeating alerts resumed.');
 }
});
function storeTasks(all){
 try{localStorage.setItem(STORE,JSON.stringify(all));}
 catch(e){message('Could not save the reminder.',true);return false;}
 window.dispatchEvent(new Event('runningtab:todo-changed'));
 return true;
}
function repeatFields(form,day,original){
 const type=form.querySelector('[data-reminder-repeat]').value;
 if(type==='none')return null;
 const r={type};
 if(type==='weekly'||type==='monthly-weekday')r.weekday=Number(form.querySelector('[data-repeat-weekday]').value);
 if(type==='monthly-weekday')r.week=Number(form.querySelector('[data-repeat-week]').value);
 if(type==='months')r.interval=Number(form.querySelector('[data-repeat-months]').value);
 if(type==='minutes')r.interval=Number(form.querySelector('[data-repeat-minutes]').value);
 if((type==='monthly-day'||type==='months')&&original?.repeat?.type===type
    &&day===repeat().currentOrNext(original)&&original.repeat.day){
  r.day=original.repeat.day;
 }
 return repeat().withAnchor(r,day);
}
document.addEventListener('change',event=>{
 if(!event.target.matches?.('[data-reminder-repeat]'))return;
 const form=event.target.closest('[data-reminder-form]');if(!form)return;
 const type=event.target.value;
 for(const [selector,show] of [['[data-repeat-weekday-row]',type==='weekly'||type==='monthly-weekday'],['[data-repeat-week-row]',type==='monthly-weekday'],['[data-repeat-months-row]',type==='months'],['[data-repeat-minutes-row]',type==='minutes']]){
  const el=form.querySelector(selector);if(el)el.hidden=!show;
 }
 if(type==='minutes'){
  const day=form.querySelector('[data-reminder-date]'),time=form.querySelector('[data-reminder-time]');
  if(!validDay(day.value)||new Date(day.value+'T'+time.value).getTime()<=Date.now()){
   const first=repeat().firstMinuteAlert(Number(form.querySelector('[data-repeat-minutes]').value));
   day.value=first.due;time.value=first.time;
  }
 }
 const date=form.querySelector('[data-reminder-date]')?.value;
 if(date){const d=new Date(date+'T12:00:00');if(!Number.isNaN(d.getTime())){
  form.querySelector('[data-repeat-weekday]').value=String(d.getDay());
  form.querySelector('[data-repeat-week]').value=String(Math.min(4,Math.ceil(d.getDate()/7)));
 }}
});
document.addEventListener('submit',event=>{
 const form=event.target.closest?.('[data-reminder-form]');
 if(!form)return;
 event.preventDefault();
 const day=form.querySelector('[data-reminder-date]').value;
 const time=form.querySelector('[data-reminder-time]').value;
 const notify=form.querySelector('[data-reminder-notify]').checked&&hasAlerts();
 if(!validDay(day)||!validTime(time)){message('Choose a valid date and time.',true);return;}
 const all=tasks(),index=all.findIndex(t=>t.id===form.dataset.reminderForm);
 if(index<0){message('This To-Do could not be found.',true);return;}
 const r=repeatFields(form,day,all[index]);
 if(r?.type==='months'&&(!Number.isInteger(r.interval)||r.interval<1||r.interval>120)){
  message('Repeat interval must be 1–120 months.',true);return;
 }
 if(r?.type==='minutes'&&(!Number.isInteger(r.interval)||r.interval<1||r.interval>1440)){
  message('Repeat interval must be 1–1440 minutes.',true);return;
 }
 if(notify&&new Date(day+'T'+time).getTime()<=Date.now()){
  message('Choose a future date and time for the phone alert.',true);return;
 }
 all[index]={...all[index],dueType:'day',due:day,remindTime:time,notify,repeat:r,repeatPaused:r?!!all[index].repeatPaused:false,updatedAt:new Date().toISOString()};
 if(!storeTasks(all))return;
 message(notify?'Date and phone alert saved.':'Date saved. Phone alert is off.');
 if(notify)requestPermission();
});
$('enablePhoneAlerts')?.addEventListener('click',requestPermission);
$('phoneAlertsSwitch')?.addEventListener('change',event=>{
 if(!hasAlerts())return;
 try{native().setRemindersEnabled(!!event.target.checked);}
 catch(e){message('Could not change phone reminder settings.',true);event.target.checked=!event.target.checked;return;}
 // Android applies the switch on its UI thread, then calls onPermissionChanged.
});
window.RunningTabReminders={requestPermission,onPermissionChanged:permissionState};
window.addEventListener('pageshow',permissionState);
permissionState();
})();
