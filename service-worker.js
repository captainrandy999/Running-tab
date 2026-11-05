// Offline shell. Transactions stay in this browser's localStorage.
const CACHE='running-tab-review-scroll-v9';
const SHELL=['./','./index.html','./todo.html','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./app.css','./install.js','./backup.js','./todo-panel.js','./view.js','./shopping-panel.js','./calendar.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name!==CACHE).map(name=>caches.delete(name)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request).then(found=>found||caches.match('./index.html'))));});
