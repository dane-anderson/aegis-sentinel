/* Playback contract tests without a browser dependency. Browser layout is checked separately. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../public/meeting');
function harness(mode='continuous'){
  const nodes=new Map(),events={},media=[],classes=new Set();let frame,now=0;
  const node=(key)=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:key==='#play-mode'?mode:'',hidden:false,open:false,readyState:4,currentTime:0,duration:600,paused:true,play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;},style:{setProperty(){}},attrs:{},listeners:{},classList:{toggle(){},add(){},remove(){}},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){this.listeners[k]=f;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},click(){this.listeners.click?.();},appendChild(child){this.innerHTML+=child.innerHTML;}});return nodes.get(key);};
  const document={querySelector:node,addEventListener(k,f){events[k]=f;},documentElement:node('html'),body:{classList:{add(c){classes.add(c)},remove(c){classes.delete(c)},toggle(c,b){b?classes.add(c):classes.delete(c)}}} ,createElement:()=>({innerHTML:'',className:''})};
  const sandbox={window:{addEventListener(){}},document,console,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(fn){frame=fn;}};
  vm.createContext(sandbox);['meeting-data.js','evidence.js','audio-timing.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),sandbox));
  sandbox.Audio=class{constructor(src){this.src=src;this.duration=sandbox.window.MEETING_AUDIO_TIMING[src.match(/(\d+)\.mp3/)[1]];this.currentTime=0;this.paused=true;this.ended=false;media.push(this);}load(){this.onloadedmetadata?.();}play(){this.paused=false;this.onplaying?.();return Promise.resolve();}pause(){this.paused=true;this.onpause?.();}};
  vm.runInContext(fs.readFileSync(path.join(root,'meeting.js'),'utf8'),sandbox);
  function step(seconds){for(let i=0;i<seconds*100;i++){for(const a of media){if(!a.paused&&!a.ended){a.currentTime=Math.min(a.duration,a.currentTime+.01);if(a.currentTime>=a.duration){a.ended=true;a.paused=true;a.onended?.();}}}now+=10;frame(now);}}
  function action(action){events.click({target:{closest:()=>({dataset:{action}})}});}
  return {node,step,action,media,classes,events,sandbox,chapter(ci){events.click({target:{closest:()=>({dataset:{chapter:String(ci)}})}});}};
}
let h=harness();h.action('start');h.step(601);
assert.equal(h.node('#clock').textContent,'0:00');assert.match(h.node('.presentation').innerHTML,/Meeting adjourned/);
assert.equal(h.media.length,21);assert.deepEqual(h.media.map(a=>a.src),Array.from({length:21},(_,i)=>`audio/${String(i+1).padStart(2,'0')}.mp3`));
assert(h.media.every(a=>a.ended),'Every narration clip completes before advancing');
console.log('PASS continuous meeting: all 21 clips finish in ten minutes');
h=harness('guided');h.action('start');h.step(60);assert.match(h.node('#stage').innerHTML,/what are we actually teaching/);assert.equal(h.node('#play').attrs['aria-label'],'Play presentation');const held=h.node('#clock').textContent;h.step(30);assert.equal(h.node('#clock').textContent,held);h.action('answer');h.step(2);assert.equal(h.media.at(-1).src,'audio/02.mp3');
console.log('PASS guided question holds until the presenter cues Athena');
h=harness();h.action('start');h.step(4);h.node('#play').click();let paused=h.media[0].currentTime;h.step(20);assert.equal(h.media[0].currentTime,paused);h.node('#play').click();h.step(3);assert(h.media[0].currentTime>paused);
console.log('PASS pause and resume preserve narration position');
h.action('agenda');assert.equal(h.media.at(-1).paused,true);h.node('#close-panel').click();assert.equal(h.media.at(-1).paused,false);h.action('agenda');h.chapter(4);assert.match(h.node('#stage').innerHTML,/Where does the team break down/);h.action('answer');assert.equal(h.media.at(-1).src,'audio/11.mp3');
console.log('PASS dialogs pause/resume and chapter jumps choose the correct segment');
h.media.at(-1).onerror();assert.equal(h.node('#play').attrs['aria-label'],'Play presentation');assert.match(h.node('#status').textContent,/could not load/);h.node('#next').click();assert.equal(h.media.at(-1).src,'audio/12.mp3');
console.log('PASS missing audio pauses visibly and Next recovers');
h=harness();h.action('start');h.chapter(1);h.action('answer');h.step(2);
assert.match(h.node('#stage').innerHTML,/speaker-video/);assert.equal(h.node('#speaker-video').paused,false);
assert(Math.abs(h.node('#speaker-video').currentTime-h.media.at(-1).currentTime)<.16);
h.node('#play').click();assert.equal(h.node('#speaker-video').paused,true);h.node('#play').click();assert.equal(h.node('#speaker-video').paused,false);
h.node('#speaker-video').onerror();assert.equal(h.node('#speaker-video').hidden,true);assert.equal(h.media.at(-1).paused,false);
console.log('PASS Athena video follows narration, pauses, and falls back to a portrait if unavailable');
const e=JSON.parse(fs.readFileSync(path.join(root,'evidence.json'))),source=JSON.parse(fs.readFileSync(path.join(root,'../data/research.json')));
assert.equal(e.snapshot.snapshotHash,source.snapshotHash);const cases=source.cooperation.episodes.filter(x=>x.runId===e.facts.finalEvaluation.runId);assert.equal(cases.length,24);const counts={};cases.forEach(x=>counts[x.stage]=(counts[x.stage]||0)+1);assert.deepEqual(counts,{Recon:5,Regroup:18,OutboundRoute:1});for(const selected of e.selectedEpisodes){const original=source.cooperation.episodes.find(x=>x.episodeId===selected.episodeId);assert(original);assert.deepEqual(selected.record||selected.rawRecord||selected.episode||selected.raw,original);}
console.log('PASS pinned evaluation and raw selected episodes match the recorded source');
