/* To-Do list lives inside the Money/To-Do sliding view; records use the existing independent localStorage key. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const STORE='running-tab-todo-v1';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tasks=[];
try{const r=JSON.parse(localStorage.getItem(STORE)||'[]');if(Array.isArray(r))tasks=r.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&['day','month','none'].includes(x.dueType));}catch(e){}
function label(t){
 if(t.dueType==='none')return 'No date';
 if(t.dueType==='month'){const mm=Number(String(t.due).slice(5,7));return (months[mm-1]||'Unknown month')+' '+String(t.due).slice(0,4)+' (no specific day)';}
 const d=new Date(t.due+'T12:00:00');
 return Number.isNaN(d.getTime())?'Check date':d.toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
function status(message,bad=false){const el=$('todoStatus');if(!el)return;el.textContent=message;el.className=message?'notice'+(bad?' bad':''):'';}
function persist(next){try{localStorage.setItem(STORE,JSON.stringify(next));tasks=next;return true;}catch(e){status('Could not save the change on this device.',true);return false;}}
function sortKey(t){return t.dueType==='none'?'9999-12-31':t.dueType==='month'?t.due+'-32':t.due;}
function rows(items,completed=false,expandedNoteId=null){
 return items.map(t=>{
  const note=t.kind==='note'&&typeof t.body==='string';
  const title=esc(t.title);
  const content=note
   ? '<details class="note-details"'+(expandedNoteId===t.id?' open':'')+'><summary class="task-name">'+title+'</summary>'
     +'<div class="note-body" data-note-body>'+esc(t.body)+'</div>'
     +'<button type="button" class="secondary small note-edit-trigger" data-edit-note="'+esc(t.id)+'">Edit note</button>'
     +'<form class="note-edit-form" data-note-edit-form="'+esc(t.id)+'" hidden>'
     +'<label>Note text<textarea maxlength="12000" required data-note-editor aria-label="Edit text for '+title+'">'+esc(t.body)+'</textarea></label>'
     +'<div class="note-edit-actions"><button type="submit" class="primary small">Save changes</button>'
     +'<button type="button" class="secondary small" data-cancel-note="'+esc(t.id)+'">Cancel</button></div></form>'
     +'</details><div class="task-meta">📝 Note · '+esc(label(t))+'</div>'
   : '<div class="task-name">'+title+'</div><div class="task-meta">'+esc(label(t))+'</div>';
  const deleteButton=completed?'<button type="button" class="danger small" data-remove="'+esc(t.id)+'">Delete</button>':'';
  return '<div class="task'+(t.done?' done':'')+(note?' note-task':'')+'"><input type="checkbox" data-toggle="'+esc(t.id)+'" '+(t.done?'checked':'')+' aria-label="Mark '+title+(t.done?' not done':' complete')+'"><div class="task-main">'+content+'</div>'+deleteButton+'</div>';
 }).join('');
}
function render(expandedNoteId=null){
 const open=tasks.filter(t=>!t.done).sort((a,b)=>sortKey(a).localeCompare(sortKey(b))||String(a.created).localeCompare(String(b.created)));
 const done=tasks.filter(t=>t.done).sort((a,b)=>String(b.completedAt||'').localeCompare(String(a.completedAt||'')));
 $('count').textContent=open.length+' remaining';
 $('doneCount').textContent='Completed ('+done.length+')';
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
    const old=tasks.find(t=>t.id===id&&t.kind==='note');
    if(!old){status('Could not find the note to update.',true);return;}
    const body=el.querySelector('[data-note-editor]').value.trim();
    if(!body||body.length>12000){status('Enter note text (12,000 characters maximum).',true);return;}
    if(persist(tasks.map(t=>t.id===id?{...t,body,updatedAt:new Date().toISOString()}:t))){
      render(id);
      status('Note updated.');
      window.dispatchEvent(new Event('runningtab:todo-changed'));
    }
  }));
  $(root).querySelectorAll('[data-toggle]').forEach(el=>el.addEventListener('change',()=>{
    const next=tasks.map(t=>t.id===el.dataset.toggle?{...t,done:el.checked,completedAt:el.checked?new Date().toISOString():null}:t);
    if(persist(next)){render();status(el.checked?'Completed.':'Moved back to the To-Do list.');}
    else el.checked=!el.checked;
  }));
  if(root==='completed')$(root).querySelectorAll('[data-remove]').forEach(el=>el.addEventListener('click',()=>{
    const task=tasks.find(t=>t.id===el.dataset.remove);
    if(!task||!confirm('Delete "'+task.title+'"?'))return;
    if(persist(tasks.filter(t=>t.id!==task.id))){render();status(task.kind==='note'?'Note deleted.':'Reminder deleted.');}
  }));
 }
}
$('todoReset').addEventListener('click',()=>{
 if(!tasks.length)return;
 if(!confirm('Permanently delete ALL To-Do items stored on this phone? Money entries will not be affected.'))return;
 if(persist([])){render();status('Test To-Dos cleared.');}
});
window.addEventListener('storage',e=>{if(e.key!==STORE)return;try{const x=JSON.parse(e.newValue||'[]');if(Array.isArray(x)){tasks=x;render();}}catch(err){}});
function refreshFromStorage(){
 try {
  const found=JSON.parse(localStorage.getItem(STORE)||'[]');
  if(Array.isArray(found)){
   tasks=found.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&['day','month','none'].includes(x.dueType));
   render();
  }
 } catch(e){status('Could not refresh reminders from local storage.',true);}
}
window.addEventListener('runningtab:todo-changed',refreshFromStorage);
render();
})();
