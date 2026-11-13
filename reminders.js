/* Calendar handoff and editable on-device reminders for To-Do items.
   No calendar access is granted to Running Tab: the user reviews the event in
   their chosen calendar. Background alerts are scheduled by the native APK. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const STORE='running-tab-todo-v1';
const native=()=>window.RunningTabAndroid;
const hasAlerts=()=>typeof native()?.enableNotifications==='function';
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
 if(!btn||!label)return;
 if(!hasAlerts()){
  btn.hidden=true;
  label.textContent='Phone alerts work in the Android APK (version 1.7 or later). The browser version can add events to Google Calendar, which can send its own alerts.';
  return;
 }
 btn.hidden=false;
 let allowed=false;
 try{allowed=!!native().notificationPermissionGranted();}catch(e){}
 label.textContent=allowed
  ?'🔔 Notifications allowed. Dated To-Dos with phone alerts enabled can notify you when Running Tab is closed.'
  :'🔕 Notifications are off. Enable them here so dated To-Dos can alert you when the app is closed.';
 btn.textContent=allowed?'Notifications enabled':'Enable phone notifications';
 btn.disabled=allowed;
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
 if(task.dueType!=='day'||!validDay(task.due)){message('Set an exact day before adding an event to your calendar.',true);return;}
 const time=validTime(task.remindTime||'')?task.remindTime:'08:00';
 if(typeof native()?.addCalendarEvent==='function'){
  try{native().addCalendarEvent(task.title,task.due,time,task.body||'');message('Opening your calendar. Review and save the event there.');return;}
  catch(e){message('Could not open the device calendar.',true);return;}
 }
 // The Google Calendar event editor also works without calendar OAuth scopes.
 const start=new Date(task.due+'T'+time+':00');
 const end=new Date(start.getTime()+30*60000);
 const toUtc=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const params=new URLSearchParams({
  action:'TEMPLATE',text:task.title,dates:toUtc(start)+'/'+toUtc(end),
  details:(task.body||'')?.slice(0,700)||'Created from Running Tab'
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
 }
});
document.addEventListener('submit',event=>{
 const form=event.target.closest?.('[data-reminder-form]');
 if(!form)return;
 event.preventDefault();
 const day=form.querySelector('[data-reminder-date]').value;
 const time=form.querySelector('[data-reminder-time]').value;
 const notify=form.querySelector('[data-reminder-notify]').checked&&hasAlerts();
 if(!validDay(day)||!validTime(time)){message('Choose a valid date and time.',true);return;}
 if(notify&&new Date(day+'T'+time).getTime()<=Date.now()){
  message('Choose a future date and time for the phone alert.',true);return;
 }
 const all=tasks(),index=all.findIndex(t=>t.id===form.dataset.reminderForm);
 if(index<0){message('This To-Do could not be found.',true);return;}
 all[index]={...all[index],dueType:'day',due:day,remindTime:time,notify,updatedAt:new Date().toISOString()};
 try{localStorage.setItem(STORE,JSON.stringify(all));}
 catch(e){message('Could not save the reminder.',true);return;}
 window.dispatchEvent(new Event('runningtab:todo-changed'));
 message(notify?'Date and phone alert saved.':'Date saved. Phone alert is off.');
 if(notify)requestPermission();
});
$('enablePhoneAlerts')?.addEventListener('click',requestPermission);
window.RunningTabReminders={requestPermission,onPermissionChanged:permissionState};
window.addEventListener('pageshow',permissionState);
permissionState();
})();