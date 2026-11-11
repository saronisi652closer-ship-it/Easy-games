/* すきま脳トレ箱 共通部品：小道具・保存一覧シート・お知らせ表示 */
const $=s=>document.querySelector(s);
const rnd=(a,b)=>a+Math.random()*(b-a);
const ri=(a,b)=>Math.floor(rnd(a,b+1));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
const fmt=s=>{s=Math.floor(s||0);const h=Math.floor(s/3600),m=Math.floor(s/60)%60,ss=String(s%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${ss}`:`${String(m).padStart(2,'0')}:${ss}`};
function css(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()}
const DIFF_JA={easy:'かんたん',normal:'ふつう',hard:'むずかしい'};
const LV_JA={easy:'よわい',normal:'ふつう',hard:'つよい'};
/* 旧版の store と同じ形で使える保存（中身は Save） */
function makeStore(prefix){return {get(k,d){const v=Save.get(prefix+k);return v===undefined||v===null?d:v},set(k,v){Save.set(prefix+k,v)}}}
function makeClock(el){let acc=0,start=null,iv=null;
  const c={get(){return acc+(start?(performance.now()-start)/1000:0)},
    set(v){acc=v||0;if(start)start=performance.now();el.textContent=fmt(acc)},
    run(){if(start)return;start=performance.now();iv=setInterval(()=>el.textContent=fmt(c.get()),500);el.textContent=fmt(c.get())},
    stop(){if(!start)return;acc=c.get();start=null;clearInterval(iv);el.textContent=fmt(acc)},
    running(){return !!start}};
  return c}
function segInit(el,val,onPick){
  const set=v=>{for(const b of el.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.v===String(v)))};
  set(val);el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;set(b.dataset.v);onPick(b.dataset.v)});
  return set}
function ago(t){if(!t)return '';const s=(Date.now()-t)/1000;if(s<60)return 'たった今';if(s<3600)return Math.floor(s/60)+'分前';if(s<86400)return Math.floor(s/3600)+'時間前';if(s<86400*7)return Math.floor(s/86400)+'日前';
  const d=new Date(t);return `${d.getMonth()+1}/${d.getDate()}`}
function dstr(t){if(!t)return '';const d=new Date(t);return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(t){let el=document.querySelector('.stoast');if(!el){el=document.createElement('div');el.className='stoast';document.body.appendChild(el)}
  el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,1800)}
function banner(t){let el=document.querySelector('.sbanner');if(!t){if(el)el.remove();return}
  if(!el){el=document.createElement('div');el.className='sbanner';el.setAttribute('role','alert');document.body.appendChild(el)}el.textContent=t}
Save.on((type,msg)=>{if(type==='error'||type==='warn')banner(msg);if(type==='ok')banner(null)});
function closeLayer(){const l=document.getElementById('layer');if(l)l.innerHTML=''}

/* 保存した問題の一覧。opts: game, currentId, onOpen(rec), onRestart(rec)?, onNew()?, newLabel */
async function openSaveList(opts){
  const layer=document.getElementById('layer');
  let tab='play';
  const list=await Save.listPuzzles(opts.game);
  if(list===null)return;
  const draw=()=>{
    const items=list.filter(r=>tab==='play'?r.status!=='clear':r.status==='clear');
    const nPlay=list.filter(r=>r.status!=='clear').length,nClear=list.length-nPlay;
    layer.innerHTML=`<div class="scrim" id="sl-scrim"><div class="sheet"><h3>${esc(Save.GAME_NAMES[opts.game]||'')}の問題</h3>
      <div class="seg" style="align-self:center"><button type="button" data-tab="play" aria-pressed="${tab==='play'}">途中（${nPlay}）</button><button type="button" data-tab="clear" aria-pressed="${tab==='clear'}">クリア済み（${nClear}）</button></div>
      <div class="slist">${items.length?items.map(r=>{const p=Math.round((r.status==='clear'?1:(r.progress||0))*100);
        return `<div class="sitem ${r.id===opts.currentId?'cur':''}" data-id="${esc(r.id)}"><div class="t"><b>${esc(r.title||'')}</b><span>${ago(r.updated)}</span></div>
        <div class="pbar"><i style="width:${p}%"></i></div>
        <div class="m">${r.status==='clear'?'クリア':'進み具合 '+p+'%'}${r.game==='othello'?'':'・プレイ時間 '+fmt(r.time||0)}・${dstr(r.created)}開始${r.id===opts.currentId?'<br>いま開いている問題':''}</div>
        <div class="a"><button class="btn primary" type="button" data-act="open">${r.status==='clear'?'見る':'続ける'}</button>${opts.onRestart?'<button class="btn" type="button" data-act="restart">最初からやり直す</button>':''}<button class="btn danger" type="button" data-act="del">削除</button></div></div>`}).join(''):
        `<div class="sempty">${tab==='play'?'途中の問題はありません':'クリアした問題はまだありません'}</div>`}</div>
      ${opts.onNew?`<button class="btn primary" type="button" data-act="new" style="padding:12px;font-size:14px">${esc(opts.newLabel||'新しい問題')}</button>`:''}
      <button class="btn" type="button" data-act="close" style="padding:12px;font-size:14px">閉じる</button></div></div>`;
  };
  draw();
  layer.onclick=async e=>{
    if(e.target.id==='sl-scrim'){closeLayer();layer.onclick=null;return}
    const tb=e.target.closest('[data-tab]');if(tb){tab=tb.dataset.tab;draw();return}
    const b=e.target.closest('[data-act]');if(!b)return;
    const act=b.dataset.act,item=b.closest('.sitem'),rec=item&&list.find(r=>r.id===item.dataset.id);
    if(act==='close'){closeLayer();layer.onclick=null;return}
    if(act==='new'){closeLayer();layer.onclick=null;opts.onNew();return}
    if(act==='open'&&rec){closeLayer();layer.onclick=null;opts.onOpen(rec);return}
    if(act==='restart'&&rec){
      if(b.dataset.sure){closeLayer();layer.onclick=null;opts.onRestart(rec);return}
      b.dataset.sure='1';b.textContent='もう一度押すとやり直し';return}
    if(act==='del'&&rec){
      if(!b.dataset.sure){b.dataset.sure='1';b.textContent='本当に削除する';return}
      await Save.delPuzzle(rec.id);list.splice(list.indexOf(rec),1);
      if(rec.id===opts.currentId&&opts.onDeleteCurrent)opts.onDeleteCurrent();
      toast('削除しました');draw();
    }
  };
}
function getParam(k){try{return new URLSearchParams(location.search).get(k)}catch(e){return null}}
function regSW(path){if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register(path).catch(()=>{})}
