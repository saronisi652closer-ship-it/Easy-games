/* すきま脳トレ箱 効果音（音声ファイルは使わず、その場で合成する） */
const Sfx=(()=>{
  let ac=null;
  const on=()=>Save.get('sfx',true)!==false;
  function ctx(){if(!ac){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;ac=new A()}if(ac.state==='suspended')ac.resume();return ac}
  document.addEventListener('pointerdown',()=>{if(on())ctx()},{once:true,capture:true});
  function tone(f,d,type='square',vol=.06,t0=0,slide=0){const a=ctx();if(!a)return;const t=a.currentTime+t0;
    const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f*slide),t+d);
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+d+.02)}
  function noise(d,vol=.08){const a=ctx();if(!a)return;const n=a.createBuffer(1,a.sampleRate*d,a.sampleRate),c=n.getChannelData(0);for(let i=0;i<c.length;i++)c[i]=(Math.random()*2-1)*(1-i/c.length);
    const s=a.createBufferSource(),g=a.createGain();g.gain.value=vol;s.buffer=n;s.connect(g);g.connect(a.destination);s.start()}
  const S={
    tap:()=>tone(880,.04,'square',.03),
    place:()=>tone(520,.07,'triangle',.08),
    ok:()=>{tone(784,.08,'square',.05);tone(1175,.12,'square',.05,.07)},
    ng:()=>tone(160,.18,'sawtooth',.05,0,.6),
    clear:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.16,'square',.05,i*.1)),
    lose:()=>[392,330,262].forEach((f,i)=>tone(f,.2,'triangle',.07,i*.14)),
    jump:()=>tone(330,.14,'square',.04,0,2.2),
    hit:()=>{noise(.18,.1);tone(120,.2,'sawtooth',.05,0,.5)},
    coin:()=>{tone(988,.06,'square',.04);tone(1319,.14,'square',.04,.05)},
    punch:()=>{noise(.08,.12);tone(180,.1,'square',.05,0,.5)},
  };
  return {play(n){if(!on()||!S[n])return;try{S[n]()}catch(e){}},get on(){return on()},set(v){Save.set('sfx',!!v);if(v)ctx()}};
})();
