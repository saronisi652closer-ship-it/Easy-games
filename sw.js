/* すきま脳トレ箱 オフライン用：ネットにつながる時は最新を取りに行き、つながらない時は保存済みを返す */
const CACHE='sukima-box-v8';
const FILES=["./", "index.html", "manifest.webmanifest", "common/base.css", "common/save.js", "common/ui.js", "common/sfx.js", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "games/cardbattle.html", "games/ikusei.html", "games/ito.html", "games/machigai.html", "games/othello.html", "games/picross.html", "games/punch.html", "games/runner.html", "games/slither.html", "games/sudoku.html"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);const same=url.origin===self.location.origin;
  if(!same&&!/fonts\.(googleapis|gstatic)\.com/.test(url.host))return;
  e.respondWith(fetch(req).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return res})
    .catch(()=>caches.match(req,{ignoreSearch:true}).then(hit=>hit||(req.mode==='navigate'?caches.match('index.html'):undefined))));
});
