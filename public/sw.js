/* Kiver service worker: keeps the app installable. Network-first for pages; never caches API calls, scripts or styles. */
const CACHE="kiver-shell-v4";
self.addEventListener("install",e=>{e.waitUntil(self.skipWaiting())});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const r=e.request;
  if(r.method!=="GET"||new URL(r.url).origin!==self.location.origin)return;
  if(r.mode==="navigate"){e.respondWith(fetch(r).catch(()=>Response.error()))}
});
