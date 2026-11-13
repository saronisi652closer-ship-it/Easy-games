/* すきま脳トレ箱 共通保存部品
   - 保存先は IndexedDB（使えない環境では localStorage の別名キー）
   - 旧版の localStorage データは初回にコピーし、読み戻して一致を確かめてから「移行済み」にする。旧データは消さない
   - 読み込みに失敗したら保存を止める（空のデータで上書きしない）
   - 値は起動時にメモリへ読み込み、get は同期・set は裏で順番に書き込む */
(function(){
'use strict';
const DB_NAME='sukima-box',DB_VER=1,OLD='sukima_',FB='sukima2_';
const GAME_NAMES={sudoku:'ナンプレ',othello:'オセロ',slither:'スリザーリンク',picross:'ピクロス',runner:'坂道チャリ',ito:'糸通し',machigai:'間違い探し',ikusei:'ドット育成',cardbattle:'カードバトル',punch:'エビワラージャンケン',fifteen:'15パズル',reaction:'反射神経テスト',memory:'神経衰弱',mines:'マインスイーパー',mole:'もぐらたたき',snake:'ヘビゲーム',breakout:'ブロック崩し',batting:'バッティング',penguin:'ペンギン飛ばし'};
const kv=new Map();
let db=null,backend='idb',writable=false,chain=Promise.resolve(),failCount=0;
const listeners=[];
function emit(type,detail){for(const f of listeners)try{f(type,detail)}catch(e){}}

/* ---------- backends ---------- */
function idbOpen(){return new Promise((res,rej)=>{
  if(!('indexedDB' in self))return rej(new Error('IndexedDB なし'));
  let r;try{r=indexedDB.open(DB_NAME,DB_VER)}catch(e){return rej(e)}
  r.onupgradeneeded=()=>{const d=r.result;
    if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv',{keyPath:'k'});
    if(!d.objectStoreNames.contains('puzzles')){const p=d.createObjectStore('puzzles',{keyPath:'id'});p.createIndex('game','game')}};
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error||new Error('open失敗'));r.onblocked=()=>rej(new Error('blocked'));
})}
function req(store,mode,fn){return new Promise((res,rej)=>{
  let t;try{t=db.transaction(store,mode)}catch(e){return rej(e)}
  const s=t.objectStore(store);let out;const r=fn(s);
  if(r)r.onsuccess=()=>{out=r.result};
  t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error||new Error('tx失敗'));t.onabort=()=>rej(t.error||new Error('tx中断'));
})}
const B={
  idb:{
    kvAll:()=>req('kv','readonly',s=>s.getAll()),
    kvPut:(k,v)=>req('kv','readwrite',s=>s.put({k,v})),
    kvDel:k=>req('kv','readwrite',s=>s.delete(k)),
    pzPut:rec=>req('puzzles','readwrite',s=>s.put(rec)),
    pzGet:id=>req('puzzles','readonly',s=>s.get(id)),
    pzAll:game=>req('puzzles','readonly',s=>game?s.index('game').getAll(game):s.getAll()),
    pzDel:id=>req('puzzles','readwrite',s=>s.delete(id)),
  },
  ls:{
    kvAll:async()=>{const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(FB+'kv_'))out.push({k:k.slice(FB.length+3),v:JSON.parse(localStorage.getItem(k))})}return out},
    kvPut:async(k,v)=>localStorage.setItem(FB+'kv_'+k,JSON.stringify(v)),
    kvDel:async k=>localStorage.removeItem(FB+'kv_'+k),
    pzPut:async rec=>localStorage.setItem(FB+'pz_'+rec.id,JSON.stringify(rec)),
    pzGet:async id=>{const v=localStorage.getItem(FB+'pz_'+id);return v?JSON.parse(v):undefined},
    pzAll:async game=>{const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(FB+'pz_')){const r=JSON.parse(localStorage.getItem(k));if(!game||r.game===game)out.push(r)}}return out},
    pzDel:async id=>localStorage.removeItem(FB+'pz_'+id),
  }
};
const be=()=>B[backend];

/* ---------- 進捗などの表示用情報 ---------- */
const DIFF={easy:'かんたん',normal:'ふつう',hard:'むずかしい',oni:'鬼'},LV={easy:'よわい',normal:'ふつう',hard:'つよい'};
function describe(game,d){
  try{
    if(game==='sudoku'){let need=0,ok=0;for(let i=0;i<81;i++)if(!d.puzzle[i]){need++;if(d.cur[i]&&d.cur[i]===d.sol[i])ok++}
      return {title:'ナンプレ '+(DIFF[d.diff]||''),diff:DIFF[d.diff]||'',progress:need?ok/need:1}}
    if(game==='slither'){let need=0,ok=0;for(let e=0;e<d.sol.length;e++)if(d.sol[e]===1){need++;if(d.lines[e]===1)ok++}
      return {title:`スリザーリンク ${d.n}×${d.n}`,diff:`${d.n}×${d.n}`,progress:need?ok/need:0}}
    if(game==='othello'){const n=d.b.filter(Boolean).length;return {title:'オセロ '+(LV[d.level]||''),diff:LV[d.level]||'',progress:(n-4)/60}}
    if(game==='mines'){const safe=d.w*d.h-d.n;const op=d.open.reduce((a,b)=>a+b,0);const L={easy:'初級',normal:'中級',hard:'上級'}[d.lv]||'';return {title:'マインスイーパー '+L,diff:L,progress:d.lost?op/safe:op/safe}}
    if(game==='picross'){let need=0,ok=0;for(let y=0;y<d.sol.length;y++)for(let x=0;x<d.sol[0].length;x++)if(d.sol[y][x]){need++;if(d.marks[y][x]===1)ok++}
      const sz=`${d.sol[0].length}×${d.sol.length}`;return {title:(d.kind==='pic'?'ピクロス 絵の問題 ':'ピクロス 自動生成 ')+sz,diff:sz,progress:need?ok/need:0}}
  }catch(e){}
  return {title:GAME_NAMES[game]||game,diff:'',progress:0};
}

/* ---------- 旧データの移行 ---------- */
async function migrate(){
  if(kv.has('_migrated_v1'))return;
  const old={};
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(OLD))old[k.slice(OLD.length)]=localStorage.getItem(k)}}catch(e){return}
  const toPuzzle={sd:'sudoku',sl:'slither',ot:'othello',px_cur:'picross'};
  const now=Date.now(),kvs=[],pzs=[];
  for(const [k,raw] of Object.entries(old)){
    let v;try{v=JSON.parse(raw)}catch(e){continue}
    if(toPuzzle[k]){
      const game=toPuzzle[k];
      if(v&&typeof v==='object'&&!v.done&&!v.over){const m=describe(game,v);pzs.push({id:game+'-migrated',game,...m,time:v.time||0,status:'play',created:now,updated:now,data:v})}
      continue;
    }
    if(!kv.has(k))kvs.push([k,v]);
  }
  for(const [k,v] of kvs)await be().kvPut(k,v);
  for(const r of pzs){const ex=await be().pzGet(r.id);if(!ex)await be().pzPut(r)}
  // 読み戻して確認
  const back=new Map((await be().kvAll()).map(o=>[o.k,o.v]));
  for(const [k,v] of kvs)if(JSON.stringify(back.get(k))!==JSON.stringify(v))throw new Error('移行の確認に失敗: '+k);
  for(const r of pzs){const g=await be().pzGet(r.id);if(!g)throw new Error('移行の確認に失敗: '+r.id)}
  for(const [k,v] of kvs)kv.set(k,v);
  const mark={at:now,keys:kvs.length,puzzles:pzs.length};
  await be().kvPut('_migrated_v1',mark);kv.set('_migrated_v1',mark);
  if(pzs.length&&!kv.get('last')){const r=pzs[0];const last={game:r.game,id:r.id,title:r.title,at:now};await be().kvPut('last',last);kv.set('last',last)}
}

/* ---------- 起動 ---------- */
async function boot(){
  try{db=await idbOpen();backend='idb'}
  catch(e){
    try{localStorage.setItem(FB+'probe','1');localStorage.removeItem(FB+'probe');backend='ls';
      emit('warn','この端末ではブラウザの簡易保存で動いています')}
    catch(e2){emit('error','保存が使えない環境です。遊べますが記録は残りません');return}
  }
  try{const all=await be().kvAll();for(const o of all)kv.set(o.k,o.v)}
  catch(e){emit('error','保存データを読み込めませんでした。上書きを防ぐため、保存を止めています');return}
  writable=true;
  try{await migrate()}catch(e){emit('warn','旧データの移行を次回もう一度試します（旧データはそのまま残っています）')}
  try{if(navigator.storage&&navigator.storage.persist&&!kv.get('_persist')){const ok=await navigator.storage.persist();queue(()=>be().kvPut('_persist',{ok,at:Date.now()}));kv.set('_persist',{ok})}}catch(e){}
}
const ready=boot();

/* ---------- 書き込み（順番に・失敗したら再試行） ---------- */
function queue(fn){
  if(!writable)return Promise.resolve(false);
  chain=chain.then(async()=>{
    for(let i=0;i<3;i++){try{await fn();if(failCount){failCount=0;emit('ok')}return true}catch(e){await new Promise(r=>setTimeout(r,300*(i+1)))}}
    failCount++;emit('error','保存に失敗しました。ブラウザの空き容量を確認してください');return false;
  });
  return chain;
}
function uid(game){return game+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}

const Save={
  ready,GAME_NAMES,describe,
  get backend(){return backend},get writable(){return writable},
  on(f){listeners.push(f)},
  get(k,def){return kv.has(k)?kv.get(k):def},
  set(k,v){kv.set(k,v);const copy=JSON.parse(JSON.stringify(v));return queue(()=>be().kvPut(k,copy))},
  del(k){kv.delete(k);return queue(()=>be().kvDel(k))},
  newId:uid,
  async getPuzzle(id){await ready;try{return await be().pzGet(id)}catch(e){return undefined}},
  async listPuzzles(game){await ready;try{const a=await be().pzAll(game);return a.sort((x,y)=>(y.updated||0)-(x.updated||0))}catch(e){emit('error','保存一覧を読み込めませんでした');return null}},
  putPuzzle(rec){
    const now=Date.now();const r={...rec,updated:now};if(!r.created)r.created=now;
    const copy=JSON.parse(JSON.stringify(r));return queue(()=>be().pzPut(copy));
  },
  delPuzzle(id){return queue(()=>be().pzDel(id))},
  touch(info){const last={...info,at:Date.now()};this.set('last',last);
    const rec=(this.get('recent',[])||[]).filter(g=>g!==info.game);rec.unshift(info.game);this.set('recent',rec.slice(0,8))},
  async exportAll(){await ready;const k={};for(const [a,b] of kv)k[a]=b;const p=await be().pzAll();
    return {app:'sukima-box',format:1,exportedAt:new Date().toISOString(),kv:k,puzzles:p}},
  async importAll(data,mode){
    await ready;if(!writable)throw new Error('保存が止まっているため読み込めません');
    if(!data||data.app!=='sukima-box'||!data.kv)throw new Error('すきま脳トレ箱のバックアップではありません');
    let added=0,updated=0;
    for(const [k,v] of Object.entries(data.kv)){if(k.startsWith('_'))continue;
      if(mode==='replace'||!kv.has(k)){await queue(()=>be().kvPut(k,v));kv.set(k,v);added++}}
    for(const r of (data.puzzles||[])){const ex=await be().pzGet(r.id);
      if(!ex||mode==='replace'||(r.updated||0)>(ex.updated||0)){await queue(()=>be().pzPut(r));ex?updated++:added++}}
    return {added,updated};
  },
};
self.Save=Save;
})();
