/* Saved GPS pins belong to this device; sharing coordinates happens only when opening Maps. */
(()=>{
 'use strict';
 const KEY='running-tab-pins-v1';
 const MAX_PINS=500;
 const $=id=>document.getElementById(id);
 const dropPattern=/^(?:please\s+)?(?:drop\s+(?:a\s+)?pin\s+here|save\s+(?:my\s+)?(?:current\s+)?location|pin\s+(?:my\s+)?(?:current\s+)?location)(?:\s*,?\s*please)?[.!?]*$/i;
 const lastPattern=/^(?:please\s+)?(?:navigate\s+(?:me\s+)?to|take\s+me\s+to|get\s+me\s+to|drive\s+to|(?:get\s+)?directions?\s+to)\s+(?:my\s+)?(?:last|latest|most\s+recent)\s+(?:saved\s+)?pin(?:\s*,?\s*please)?[.!?]*$/i;
 const validPin=p=>p&&typeof p.id==='string'&&typeof p.label==='string'
  &&Number.isFinite(p.lat)&&p.lat>=-90&&p.lat<=90
  &&Number.isFinite(p.lng)&&p.lng>=-180&&p.lng<=180
  &&typeof p.created==='string';
 const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
 })[c]);
 function loadPins(){
  try{
   const parsed=JSON.parse(localStorage.getItem(KEY)||'[]');
   return Array.isArray(parsed)?parsed.filter(validPin).slice(0,MAX_PINS):[];
  }catch(e){return [];}
 }
 let pins=loadPins();
 function status(message,error=false){
  const element=$('pinsStatus');
  if(!element)return;
  element.textContent=message;
  element.classList.toggle('pin-error',error);
 }
 function savePins(next){
  try{
   localStorage.setItem(KEY,JSON.stringify(next));
   pins=next;
   render();
   return true;
  }catch(e){
   status('Could not save the pin on this phone. Check available storage.',true);
   return false;
  }
 }
 function createdText(pin){
  const date=new Date(pin.created);
  return Number.isNaN(date.getTime())?'Saved pin':date.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
 }
 function directions(pin){
  if(!pin){status('No pins saved yet. Say “Drop a pin here” first.',true);return;}
  const destination=pin.lat.toFixed(6)+','+pin.lng.toFixed(6);
  const query=new URLSearchParams({api:'1',destination,travelmode:'driving',dir_action:'navigate'});
  status('Opening Google Maps to '+pin.label+'…');
  window.location.assign('https://www.google.com/maps/dir/?'+query.toString());
 }
 function dropPin(){
  if(!navigator.geolocation){
   status('Location is unavailable here. Try opening Running Tab in Chrome or the latest Android app.',true);
   return;
  }
  status('Getting your current GPS location…');
  navigator.geolocation.getCurrentPosition(position=>{
   const coords=position.coords;
   const accuracy=Math.round(coords.accuracy);
   if(!Number.isFinite(coords.latitude)||!Number.isFinite(coords.longitude)
      ||!Number.isFinite(accuracy)||accuracy<0||accuracy>500){
    status('Could not get a reliable pin (accuracy is about '+(Number.isFinite(accuracy)?accuracy+' metres':'unknown')+'). Turn on Precise location and try again outdoors.',true);
    return;
   }
   const now=new Date();
   const id=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'
    ?crypto.randomUUID():'pin-'+now.getTime()+'-'+Math.random().toString(36).slice(2);
   const pin={
    id,label:'Pin · '+now.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}),
    lat:Number(coords.latitude.toFixed(6)),lng:Number(coords.longitude.toFixed(6)),
    accuracy,created:now.toISOString()
   };
   if(savePins([pin,...pins].slice(0,MAX_PINS))){
    status('Saved '+pin.label+' (±'+accuracy+' m). Say “Navigate to my last pin” to return.');
   }
  },error=>{
   const message=error.code===1
    ?'Location permission was denied. Allow Location (and Precise location) for Running Tab in phone settings and try again.'
    :error.code===3
     ?'Getting your GPS location timed out. Try again with Location enabled.'
     :'Could not get your current location. Check GPS and try again.';
   status(message,true);
  },{enableHighAccuracy:true,timeout:20000,maximumAge:0});
 }
 function render(){
  const list=$('pinsList');
  if(!list)return;
  const count=$('pinsCount');
  if(count)count.textContent='('+pins.length+')';
  if(!pins.length){
   list.innerHTML='<p class="info">No saved pins yet.</p>';
   return;
  }
  list.innerHTML=pins.map((pin,index)=>{
   const accuracy=Number.isFinite(pin.accuracy)?' · ±'+Math.round(pin.accuracy)+' m':'';
   return '<article class="pin-item" data-pin-id="'+escapeHtml(pin.id)+'">'
    +'<div class="pin-heading"><span>'+escapeHtml(pin.label)+'</span>'+(index===0?'<span class="pin-badge">Latest</span>':'')+'</div>'
    +'<div class="pin-meta">'+escapeHtml(createdText(pin)+accuracy)+'</div>'
    +'<div class="pin-actions">'
    +'<button type="button" class="secondary small" data-pin-action="navigate">🧭 Navigate</button>'
    +'<button type="button" class="secondary small" data-pin-action="rename">Rename</button>'
    +'<button type="button" class="danger small" data-pin-action="delete">Delete</button>'
    +'</div>'
    +'<form class="pin-rename-form" hidden>'
    +'<label>Pin name<input type="text" name="label" maxlength="100" required value="'+escapeHtml(pin.label)+'"></label>'
    +'<button type="submit" class="secondary small">Save name</button>'
    +'<button type="button" class="secondary small" data-pin-action="cancel">Cancel</button>'
    +'</form></article>';
  }).join('');
 }
 function isCommand(text){
  const command=String(text||'').trim();
  return dropPattern.test(command)||lastPattern.test(command);
 }
 function handleCommand(text){
  const command=String(text||'').trim();
  if(dropPattern.test(command)){dropPin();return true;}
  if(lastPattern.test(command)){directions(pins[0]);return true;}
  return false;
 }
 $('dropPinButton')?.addEventListener('click',dropPin);
 $('pinsList')?.addEventListener('click',event=>{
  const button=event.target.closest('button[data-pin-action]');
  if(!button)return;
  const row=button.closest('[data-pin-id]');
  const pin=pins.find(item=>item.id===row?.dataset.pinId);
  if(!pin)return;
  const action=button.dataset.pinAction;
  if(action==='navigate'){directions(pin);return;}
  if(action==='rename'){
   row.querySelector('.pin-rename-form').hidden=false;
   row.querySelector('.pin-actions').hidden=true;
   row.querySelector('input[name="label"]').focus();
   return;
  }
  if(action==='cancel'){
   row.querySelector('.pin-rename-form').hidden=true;
   row.querySelector('.pin-actions').hidden=false;
   return;
  }
  if(action==='delete'&&confirm('Delete saved pin “'+pin.label+'”?')){
   if(savePins(pins.filter(item=>item.id!==pin.id)))status('Pin deleted.');
  }
 });
 $('pinsList')?.addEventListener('submit',event=>{
  if(!event.target.matches('.pin-rename-form'))return;
  event.preventDefault();
  const row=event.target.closest('[data-pin-id]');
  const pin=pins.find(item=>item.id===row?.dataset.pinId);
  const label=event.target.elements.label.value.trim();
  if(!pin||!label){status('Enter a pin name.',true);return;}
  if(savePins(pins.map(item=>item.id===pin.id?{...item,label:label.slice(0,100)}:item))){
   status('Pin renamed.');
  }
 });
 window.RunningTabPins={isCommand,handleCommand,dropPin,refresh:()=>{pins=loadPins();render();}};
 render();
})();