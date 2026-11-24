/* Shared bottom-sheet store tag picker; existing data semantics are unchanged. */
(()=>{
'use strict';
let active=null,origin=null;
function shell(){
 let root=document.getElementById('mydayTagSheet');if(root)return root;
 root=document.createElement('div');root.id='mydayTagSheet';root.className='myday-tag-sheet';root.hidden=true;
 root.innerHTML='<div class="myday-tag-scrim" data-tag-dismiss></div>'+
 '<section class="myday-tag-drawer" role="dialog" aria-modal="true" aria-labelledby="mydayTagTitle">'+
 '<div class="myday-tag-handle" aria-hidden="true"></div>'+
 '<div class="myday-tag-header"><div><h2 id="mydayTagTitle">Store tags</h2><p>Select stores; changes save as you tap</p></div>'+
 '<button type="button" class="myday-tag-close" data-tag-dismiss aria-label="Close store tags">×</button></div>'+
 '<div id="mydayTagOptions" class="myday-tag-options"></div>'+
 '<div class="myday-tag-footer"><button type="button" class="myday-tag-done" data-tag-dismiss>Done</button>'+
 '<button type="button" class="myday-tag-danger" id="mydayTagDelete" hidden>Delete item</button></div></section>';
 document.body.append(root);
 root.addEventListener('click',e=>{
  const button=e.target.closest('[data-tag-choice]');
  if(button&&active){
   const chosen=!button.classList.contains('is-selected');
   if(active.onToggle?.(button.dataset.tagChoice,chosen)!==false){
    button.classList.toggle('is-selected',chosen);
    button.setAttribute('aria-pressed',String(chosen));
    button.querySelector('.myday-tag-check').textContent=chosen?'✓':'';
   }
   return;
  }
  if(e.target.closest('#mydayTagDelete')){const fn=active?.onDelete;close();fn?.();return;}
  if(e.target.closest('[data-tag-dismiss]'))close();
 });
 document.addEventListener('keydown',e=>{
  if(!active)return;
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key!=='Tab')return;
  const controls=[...root.querySelectorAll('button:not([hidden])')].filter(x=>x.getClientRects().length);
  if(!controls.length)return;
  if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus();}
  else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus();}
 });
 return root;
}
function close(){
 if(!active)return;
 const root=shell(),callback=active.onClose;
 active=null;root.hidden=true;root.setAttribute('aria-hidden','true');document.body.classList.remove('myday-tag-sheet-open');
 callback?.();
 if(origin?.isConnected)origin.focus({preventScroll:true});
 origin=null;
}
function open({title='Store tags',choices=[],selected=[],onToggle,onDelete,onClose}){
 if(active)close();
 const root=shell();origin=document.activeElement instanceof HTMLElement?document.activeElement:null;
 origin?.blur();active={onToggle,onDelete,onClose};
 root.querySelector('#mydayTagTitle').textContent=title;
 root.querySelector('#mydayTagDelete').hidden=typeof onDelete!=='function';
 const holder=root.querySelector('#mydayTagOptions');holder.replaceChildren();
 const picked=new Set(selected);
 for(const choice of choices){
  if(!choice||typeof choice.value!=='string')continue;
  const button=document.createElement('button');button.type='button';button.className='myday-tag-pill';
  button.dataset.tagChoice=choice.value;
  const yes=picked.has(choice.value);
  button.classList.toggle('is-selected',yes);button.setAttribute('aria-pressed',String(yes));
  const mark=document.createElement('span');mark.className='myday-tag-check';mark.textContent=yes?'✓':'';
  button.append(mark,document.createTextNode(choice.label||choice.value));holder.append(button);
 }
 if(!choices.length){
  const label=document.createElement('p');label.className='info';
  label.textContent='No stores yet. Add stores under Manage store tags.';holder.append(label);
 }
 root.hidden=false;root.setAttribute('aria-hidden','false');document.body.classList.add('myday-tag-sheet-open');
 root.querySelector('.myday-tag-done').focus({preventScroll:true});
}
window.MyDayTagPicker={open,close,isOpen:()=>!!active};
})();
