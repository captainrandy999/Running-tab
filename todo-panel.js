/* To-Do list lives inside the Money/To-Do sliding view; records use the existing independent localStorage key. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const STORE='running-tab-todo-v1';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const repeat=()=>window.MyDayRepeat;
function repeatEditor(t){
 const r=t.repeat||{},type=r.type||'none',selected=v=>type===v?' selected':'';
 const weekday=Number.isInteger(r.weekday)?r.weekday:new Date((t.dueType==='day'?t.due:'2026-01-01')+'T12:00').getDay();
 return '<label>Repeat<select data-reminder-repeat>'
  +'<option value="none"'+selected('none')+'>Does not repeat</option><option value="daily"'+selected('daily')+'>Every day</option>'
  +'<option value="weekly"'+selected('weekly')+'>Every week</option><option value="monthly-day"'+selected('monthly-day')+'>Every month (same day)</option>'
  +'<option value="monthly-weekday"'+selected('monthly-weekday')+'>Monthly on a weekday</option><option value="months"'+selected('months')+'>Every few months</option>'
  +'<option value="minutes"'+selected('minutes')+'>Every few minutes (until stopped)</option></select></label>'
  +'<label data-repeat-minutes-row'+(type!=='minutes'?' hidden':'')+'>Every how many minutes?<input type="number" inputmode="numeric" min="1" max="1440" step="1" data-repeat-minutes value="'+esc(r.interval||5)+'"></label>'
  +'<label data-repeat-weekday-row'+(!['weekly','monthly-weekday'].includes(type)?' hidden':'')+'>Weekday<select data-repeat-weekday>'
  +repeat().DAYS.map((d,i)=>'<option value="'+i+'"'+(weekday===i?' selected':'')+'>'+d[0].toUpperCase()+d.slice(1)+'</option>').join('')+'</select></label>'
  +'<label data-repeat-week-row'+(type!=='monthly-weekday'?' hidden':'')+'>Week of month<select data-repeat-week>'
  +[[1,'First'],[2,'Second'],[3,'Third'],[4,'Fourth'],[-1,'Last']].map(([n,name])=>'<option value="'+n+'"'+((r.week||1)===n?' selected':'')+'>'+name+'</option>').join('')+'</select></label>'
  +'<label data-repeat-months-row'+(type!=='months'?' hidden':'')+'>Every how many months?<input type="number" inputmode="numeric" min="1" max="120" step="1" data-repeat-months value="'+esc(r.interval||3)+'"></label>';
}
let tasks=[];
try{const r=JSON.parse(localStorage.getItem(STORE)||'[]');if(Array.isArray(r))tasks=r.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&['day','month','none'].includes(x.dueType));}catch(e){}
function label(t){
 if(t.dueType==='none')return 'No date';
 if(t.dueType==='month'){const mm=Number(String(t.due).slice(5,7));return (months[mm-1]||'Unknown month')+' '+String(t.due).slice(0,4)+' (no specific day)';}
 const d=new Date((repeat().currentOrNext(t)||t.due)+'T12:00:00');
 return Number.isNaN(d.getTime())?'Check date':d.toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
let statusTimer=null;
function status(message,bad=false){
 const el=$('todoStatus');if(!el)return;
 clearTimeout(statusTimer);statusTimer=null;
 el.textContent=message;el.className=message?'notice'+(bad?' bad':''):'';
 if(message&&!bad)statusTimer=setTimeout(()=>{
  if(el.textContent===message){el.textContent='';el.className='';}
  statusTimer=null;
 },4000);
}
function persist(next){try{localStorage.setItem(STORE,JSON.stringify(next));tasks=next;return true;}catch(e){status('Could not save the change on this device.',true);return false;}}
const cleanup=()=>window.MyDayTodoCleanup;
function retention(){
 let saved=null;try{saved=localStorage.getItem(cleanup().KEY);}catch(e){}
 return cleanup().normalize(saved===null?cleanup().DEFAULT:saved);
}
const GRACE_KEY='myday-completed-todo-cleanup-activated-v1';
function firstEnabled(){
 try{
  const previous=Number(localStorage.getItem(GRACE_KEY));
  if(Number.isFinite(previous)&&previous>0)return previous;
  const start=Date.now();localStorage.setItem(GRACE_KEY,String(start));return start;
 }catch(e){return Date.now();} // storage unavailable: never bulk-delete old history
}
function pruneCompleted(){
 const {keep,removed}=cleanup().prune(tasks,retention(),Date.now(),firstEnabled());
 if(!removed.length)return 0;
 return persist(keep)?removed.length:0;
}
function notifyChange(){window.dispatchEvent(new Event('runningtab:todo-changed'));}
function sortKey(t){return t.dueType==='none'?'9999-12-31':t.dueType==='month'?t.due+'-32':repeat().currentOrNext(t);}
function taskAppearance(t){
 if(t.done)return {tone:'complete',text:'Completed'};
 if(t.kind==='note')return {tone:'note',text:'Note'};
 if(t.dueType==='day'){
  const now=new Date();
  const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  if(t.repeat?.type==='minutes')return {tone:'today',text:'Repeating'};
  const due=repeat().currentOrNext(t);
  if(due<today)return {tone:'overdue',text:'Overdue'};
  if(due===today)return {tone:'today',text:'Due today'};
 }
 return {tone:'open',text:'To do'};
}
function rows(items,completed=false,expandedNoteId=null){
 return items.map(t=>{
  const isNote=t.kind==='note';
  const hasBody=typeof t.body==='string'&&t.body.trim().length>0;
  const body=hasBody?t.body:'';
  const title=esc(t.title);
  const appearance=taskAppearance(t);
  // All entries expand. A normal To-Do retains its title and remains a To-Do
  // when a note is attached, instead of becoming a separate Note.
  const content=
   '<details class="note-details todo-details"'+(expandedNoteId===t.id?' open':'')+'>'
   +'<summary class="task-name">'+title+'</summary>'
   +(hasBody?'<div class="note-body" data-note-body>'+esc(body)+'</div>'
      :'<div class="note-empty" data-note-body>No details added yet.</div>')
   +'<button type="button" class="secondary small note-edit-trigger" data-edit-note="'+esc(t.id)+'">'+(hasBody?'Edit note':'Add note')+'</button>'
   +'<form class="note-edit-form" data-note-edit-form="'+esc(t.id)+'" hidden>'
   +'<label>Note details<textarea maxlength="12000" data-note-editor aria-label="Edit note for '+title+'" placeholder="Add details, follow-up information, or updates…">'+esc(body)+'</textarea></label>'
   +'<div class="note-edit-actions"><button type="button" class="secondary small" data-note-dictate>🎤 Dictate</button>'
   +'<button type="submit" class="primary small">Save changes</button>'
   +'<button type="button" class="secondary small" data-cancel-note="'+esc(t.id)+'">Cancel</button></div>'
   +'<div class="edit-dictation-status" data-edit-dictation-status role="status" aria-live="polite" hidden></div></form>'
   +'</details><div class="task-meta"><span class="task-status-pill task-status-pill--'+appearance.tone+'">'+appearance.text+'</span>'
   +'<span class="task-date-label">'+esc(label(t))+(t.dueType==='day'&&t.notify&&!t.repeatPaused?' · 🔔 '+esc(t.remindTime||'08:00'):'')+(t.repeat?' · 🔁 '+esc(repeat().describe(t.repeat))+(t.repeatPaused?' (paused)':''):'')+'</span></div>'
   +(!t.done?'<div class="task-reminder-actions task-quick-actions'+(t.dueType==='day'?' has-calendar':'')+'">'
     +'<button type="button" class="secondary small" data-reminder-edit="'+esc(t.id)+'">🔔 Date & alert</button>'
     +(t.dueType==='day'?'<button type="button" class="secondary small" data-calendar="'+esc(t.id)+'">📅 Add to calendar</button>':'')
     +'</div>'
     +(t.repeat?'<div class="task-repeat-actions"><button type="button" class="secondary small" data-repeat-pause="'+esc(t.id)+'">'+(t.repeatPaused?'▶ Resume repeating':'⏸ Pause reminders')+'</button>'
       +'<button type="button" class="secondary small" data-repeat-stop="'+esc(t.id)+'">⏹ Stop repeating</button></div>':'')
     +'<form class="task-reminder-form" data-reminder-form="'+esc(t.id)+'" hidden>'
     +'<label>Due date<input type="date" data-reminder-date required value="'+(t.dueType==='day'?esc(repeat().currentOrNext(t)):'' )+'"></label>'
     +'<label>Time<input type="time" data-reminder-time required value="'+esc(t.remindTime||'08:00')+'"></label>'
     +'<label class="reminder-check"><input type="checkbox" data-reminder-notify '+(t.notify?'checked':'')+'> Phone notification</label>'
     +repeatEditor(t)
     +'<div class="info">Calendar events are added separately. Phone alerts require the updated Android app.</div>'
     +'<div class="task-reminder-actions"><button type="submit" class="primary small">Save date & alert</button>'
     +'<button type="button" class="secondary small" data-reminder-cancel="'+esc(t.id)+'">Cancel</button></div></form>':'');
  const deleteButton='<button type="button" class="danger small" data-remove="'+esc(t.id)+'">Delete</button>';
  return '<div class="task todo-item todo-item--'+appearance.tone+(t.done?' done':'')+' note-task'+(isNote?' saved-note':'')+'"><input type="checkbox" data-toggle="'+esc(t.id)+'" '+(t.done?'checked':'')+' aria-label="Mark '+title+(t.done?' not done':' complete')+'"><div class="task-main">'+content+'</div>'+deleteButton+'</div>';
 }).join('');
}
function render(expandedNoteId=null){
 const open=tasks.filter(t=>!t.done).sort((a,b)=>sortKey(a).localeCompare(sortKey(b))||String(a.created).localeCompare(String(b.created)));
 const done=tasks.filter(t=>t.done).sort((a,b)=>String(b.completedAt||'').localeCompare(String(a.completedAt||'')));
 $('count').textContent=open.length+' remaining';
 $('doneCount').textContent='Completed ('+done.length+')';
 $('todoClearCompleted').hidden=done.length===0;
 $('todoClearCompleted').textContent='Clear all ('+done.length+')';
 $('pending').innerHTML=open.length?rows(open,false,expandedNoteId):'<p class="empty">Nothing outstanding.</p>';
 $('completed').innerHTML=done.length?rows(done,true,expandedNoteId):'<p class="info">No completed items.</p>';
 for(const root of ['pending','completed']){
  $(root).querySelectorAll('[data-edit-note]').forEach(el=>el.addEventListener('click',()=>{
    const detail=el.closest('.note-details');
    if(!detail)return;
    const body=detail.querySelector('[data-note-body]');
    const form=detail.querySelector('[data-note-edit-form]');
    if(!body||!form)return;
    body.hidden=true;
    el.hidden=true;
    form.hidden=false;
    form.querySelector('[data-note-editor]').focus();
  }));
  $(root).querySelectorAll('[data-note-dictate]').forEach(el=>el.addEventListener('click',()=>{
    const form=el.closest('[data-note-edit-form]');
    window.RunningTabFlow?.dictateInto(form?.querySelector('[data-note-editor]'),form?.querySelector('[data-edit-dictation-status]'));
  }));
  $(root).querySelectorAll('[data-cancel-note]').forEach(el=>el.addEventListener('click',()=>{
    const detail=el.closest('.note-details');
    if(!detail)return;
    detail.querySelector('[data-note-body]').hidden=false;
    detail.querySelector('[data-edit-note]').hidden=false;
    detail.querySelector('[data-note-edit-form]').hidden=true;
    const original=tasks.find(t=>t.id===el.dataset.cancelNote);
    detail.querySelector('[data-note-editor]').value=original&&typeof original.body==='string'?original.body:'';
    status('Changes discarded.');
  }));
  $(root).querySelectorAll('[data-note-edit-form]').forEach(el=>el.addEventListener('submit',event=>{
    event.preventDefault();
    const id=el.dataset.noteEditForm;
    const old=tasks.find(t=>t.id===id);
    if(!old){status('Could not find this entry to update.',true);return;}
    const body=el.querySelector('[data-note-editor]').value.trim();
    if(body.length>12000||(old.kind==='note'&&!body)){
      status(old.kind==='note'?'Enter note text (12,000 characters maximum).':'Keep the note under 12,000 characters.',true);
      return;
    }
    if(persist(tasks.map(t=>t.id===id?{...t,body,updatedAt:new Date().toISOString()}:t))){
      render(id);
      status(body?'Note details saved.':'Note details cleared.');
      window.dispatchEvent(new Event('runningtab:todo-changed'));
    }
  }));
  $(root).querySelectorAll('[data-toggle]').forEach(el=>el.addEventListener('change',()=>{
    const original=tasks.find(t=>t.id===el.dataset.toggle);
    const next=tasks.map(t=>t.id===el.dataset.toggle?(el.checked?repeat().complete(t):{...t,done:false,completedAt:null}):t);
    if(persist(next)){render();status(el.checked?(original?.repeat?'Occurrence completed; next date scheduled.':'Completed.'):'Moved back to the To-Do list.');window.dispatchEvent(new Event('runningtab:todo-changed'));}
    else el.checked=!el.checked;
  }));
  $(root).querySelectorAll('[data-remove]').forEach(el=>el.addEventListener('click',()=>{
    const task=tasks.find(t=>t.id===el.dataset.remove);
    if(!task||!confirm('Delete "'+task.title+'"?'))return;
    if(persist(tasks.filter(t=>t.id!==task.id))){render();status(task.kind==='note'?'Note deleted.':'To-Do deleted.');notifyChange();}
  }));
 }
}
function deleteEverything(){
 if(!tasks.length){status('There is nothing to delete.');return;}
 const notes=tasks.filter(t=>t.kind==='note').length;
 if(!confirm('Permanently delete ALL '+tasks.length+' To-Dos and Notes'+(notes?' (including '+notes+' saved Notes)':'')+' on this device? These deletions will also sync to Google Drive when connected.'))return;
 if(persist([])){render();status('All To-Dos and Notes deleted.');notifyChange();}
}
$('todoReset').addEventListener('click',deleteEverything);
$('todoClearCompleted').addEventListener('click',()=>{
 const finished=tasks.filter(t=>t.done);
 if(!finished.length)return;
 const notes=finished.filter(t=>t.kind==='note').length;
 if(!confirm('Permanently delete '+finished.length+' completed items'+(notes?' including '+notes+' saved Notes':'')+'? Deletions will sync to Google Drive when connected.'))return;
 if(persist(tasks.filter(t=>!t.done))){render();status('Completed items cleared.');notifyChange();}
});
const retentionSelect=$('todoRetentionDays');
if(retentionSelect){
 retentionSelect.value=retention();
 retentionSelect.addEventListener('change',()=>{
  const value=cleanup().normalize(retentionSelect.value);
  try{localStorage.setItem(cleanup().KEY,value);}
  catch(e){status('Could not save cleanup setting.',true);retentionSelect.value=retention();return;}
  const count=pruneCompleted();
  render();
  status(value==='off'?'Automatic cleanup turned off.':'Completed To-Dos will be removed after '+value+' days.'+
   (count?' '+count+' older To-Do'+(count===1?' was':'s were')+' removed.':''));
 });
}
window.addEventListener('storage',e=>{if(e.key!==STORE)return;try{const x=JSON.parse(e.newValue||'[]');if(Array.isArray(x)){tasks=x;pruneCompleted();render();}}catch(err){}});
function refreshFromStorage(){
 try {
  const found=JSON.parse(localStorage.getItem(STORE)||'[]');
  if(Array.isArray(found)){
   tasks=found.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&['day','month','none'].includes(x.dueType));
   pruneCompleted();
   render();
  }
 } catch(e){status('Could not refresh reminders from local storage.',true);}
}
window.addEventListener('runningtab:todo-changed',refreshFromStorage);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden || document.querySelector('.note-edit-form:not([hidden]), .task-reminder-form:not([hidden])'))return;
 const expanded=document.querySelector('#pending .note-details[open] [data-edit-note]');
 pruneCompleted();
 render(expanded?.dataset.editNote||null);
});
window.addEventListener('focus',()=>{
 if(document.querySelector('.note-edit-form:not([hidden]), .task-reminder-form:not([hidden])'))return;
 if(pruneCompleted())render();
});
setInterval(()=>{if(!document.hidden&&pruneCompleted())render();},60*60*1000);
pruneCompleted();
render();
})();
