/// <reference lib="webworker" />
import {precacheAndRoute,cleanupOutdatedCaches} from 'workbox-precaching';
import {registerRoute,setCatchHandler} from 'workbox-routing';
import {NetworkFirst,CacheFirst,StaleWhileRevalidate} from 'workbox-strategies';
import {openDB} from 'idb';
declare const self:ServiceWorkerGlobalScope & {__WB_MANIFEST:{url:string;revision:string}[]};
precacheAndRoute(self.__WB_MANIFEST);cleanupOutdatedCaches();
registerRoute(({request,url})=>url.origin===self.location.origin&&request.mode==='navigate',new NetworkFirst({cacheName:'io-pages-v2',networkTimeoutSeconds:3}));
registerRoute(({url})=>url.origin===self.location.origin&&url.pathname.startsWith('/_next/static/'),new CacheFirst({cacheName:'io-static-v2'}));
registerRoute(({url})=>url.origin===self.location.origin&&url.pathname.startsWith('/icons/'),new StaleWhileRevalidate({cacheName:'io-icons-v2'}));
self.addEventListener('install',event=>{event.waitUntil(caches.open('io-pages-v2').then(cache=>cache.add('/pos')));});
setCatchHandler(async ({request})=>{if(request.mode==='navigate')return (await caches.match('/pos'))||Response.error();return Response.error();});
async function flush(){
 const db=await openDB('insideout-v1',1,{upgrade(db){db.createObjectStore('kv');db.createObjectStore('outbox',{keyPath:'id'});}});
 const state=await fetch('/api/state',{credentials:'same-origin',cache:'no-store'});if(!state.ok)return;
 const current=await state.json();const all=await db.getAll('outbox');
 for(const item of all.filter(x=>x.shop_id===current.shop_id&&x.actor_id===current.user.id&&x.status==='pending').sort((a,b)=>a.created_at.localeCompare(b.created_at))){
  const response=await fetch('/api/command',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'checkout',payload:item.payload})});
  if(response.ok)await db.delete('outbox',item.id);
  else if(response.status===401)return;
  else if(response.status>=500)throw Error('Retry sync');
  else{const result=await response.json();await db.put('outbox',{...item,status:'attention',error:result.error});return;}
 }
 const clients=await self.clients.matchAll({type:'window'});for(const client of clients)client.postMessage({type:'OUTBOX_SYNCED'});
}
self.addEventListener('sync',((event:Event & {tag:string;waitUntil:(promise:Promise<unknown>)=>void})=>{if(event.tag==='insideout-orders')event.waitUntil(flush());}) as EventListener);
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
