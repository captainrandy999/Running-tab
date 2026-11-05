/* Running Tab install UI. Voice recognition remains an optional browser feature. */
(()=>{
'use strict';
let deferred=null;
const panel=document.getElementById('installPanel'),button=document.getElementById('installBtn'),message=document.getElementById('installStatus');
if(!panel||!button)return;
// The native Android wrapper is already an installed app; don't prompt to install the PWA again.
if(window.RunningTabAndroid){panel.hidden=true;return;}
const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
const show=()=>{panel.hidden=!!standalone();button.hidden=!deferred;};
show();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;show();});
button.addEventListener('click',async()=>{
 if(!deferred)return;
 const current=deferred;deferred=null;button.hidden=true;
 try{await current.prompt();const result=await current.userChoice;if(result.outcome!=='accepted'&&message)message.textContent='You can install later from Chrome’s menu.';}catch(e){if(message)message.textContent='Use Chrome’s menu → Add to Home screen → Install app.';}
});
window.addEventListener('appinstalled',()=>{deferred=null;show();});
})();
