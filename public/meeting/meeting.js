(() => {
  'use strict';
  const D = window.MEETING, E = window.MEETING_EVIDENCE;
  const $ = s => document.querySelector(s);
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time = s => `${Math.floor(Math.max(0,s)/60)}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
  const state = {started:false, c:0, t:0, phase:'turn', running:false, elapsed:0, mode:'guided', sound:true, captions:true, presenter:false, ended:false, lastSpeaker:null};
  const timings=window.MEETING_AUDIO_TIMING||{};
  const baseSeconds=D.chapters.flatMap(c=>c.turns).reduce((sum,t)=>sum+(timings[t.id]||t.seconds*.8)+.8,0);
  const spareSeconds=Math.max(0,546-baseSeconds);
  const turnBudget=t=>(timings[t.id]||t.seconds*.8)+.8+spareSeconds*t.seconds/600;
  const agenda = D.chapters.flatMap((c,ci) => [...(c.question ? [{c:ci,t:0,phase:'question',seconds:9}] : []), ...c.turns.map((t,ti)=>({c:ci,t:ti,phase:'turn',seconds:turnBudget(t)}))]);
  let audio = null, video = null, mediaReady=false, mediaFailed=false, audioFinished=false, lastTick=0, lastCaption='', toastTimer;
  const currentChapter = () => D.chapters[state.c];
  const currentTurn = () => currentChapter().turns[state.t];
  const index = () => agenda.findIndex(x=>x.c===state.c&&x.t===state.t&&x.phase===state.phase);
  const budget = () => agenda[index()]?.seconds || 0;
  const completed = () => agenda.slice(0,index()).reduce((s,x)=>s+x.seconds,0);
  const duration = () => Math.max(budget(), state.phase==='turn' && audio && Number.isFinite(audio.duration) ? audio.duration+.8 : 0);
  const wave = '<div class="voice-wave" aria-hidden="true">'+Array.from({length:15},()=>'<span></span>').join('')+'</div>';
  function notify(message) { $('#status').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#status').textContent='',6500); }
  function castCards() { return Object.entries(D.people).map(([id,p])=>`<article class="cast-card ${id}"><img src="${esc(p.image)}" alt="${esc(p.name)}"><div><strong>${esc(p.name)}</strong><small>${esc(p.role)}</small></div></article>`).join(''); }
  function lobby() {
    $('#stage').innerHTML=`<section class="lobby"><div class="lobby-copy"><p class="eyebrow">AEGIS Dynamics / Annual shareholder meeting</p><h1>Learning to act.<br><em>Learning together.</em></h1><p class="lobby-intro">Enter the world of AEGIS. Join Athena and her executive team for a ten-minute investigation into reinforcement learning.</p><p class="setup-note"><a href="cinematic/">Watch the complete cinematic annual meeting with real Unity footage ↗</a></p><div class="lobby-actions"><button class="primary" data-action="start">Enter the previous meeting <span>↗</span></button><button class="secondary" data-action="team">Meet the executives</button></div><div class="setup"><label for="play-mode">Presentation</label><select id="play-mode"><option value="guided">Guided · wait for our questions</option><option value="continuous">Continuous · ten-minute run</option></select><button class="quiet" data-action="test-audio">Test sound ▷</button></div><p class="setup-note">Six prepared questions. Four executive voices. <a href="guide.html" target="_blank" rel="noopener">Presenter guide ↗</a><br>Guided mode waits for your cue. Continuous mode gives you nine seconds per question.</p></div><div><div class="cast">${castCards()}</div><div class="lobby-footer"><span>Fictional executives · Recorded performances and illustrated calls · Real research evidence from 29 Oct 2026</span><span>10:00 planned / pauses add time</span></div></div></section>`;
  }
  const principleList = rows => `<div class="principles">${rows.map((r,i)=>`<article class="principle"><span>0${i+1}</span><div><h3>${esc(r[0])}</h3><p>${esc(r[1])}</p></div></article>`).join('')}</div>`;
  function visual(kind) {
    const f=E.facts.finalEvaluation;
    const note = t => `<p class="callout">${t}</p>`;
    const visuals={
      opening:()=>`<p class="intro-mark">PROJECT SENTINEL</p><p class="large-line">One shared mission.<br>Many decisions.<br>A test of what was learned.</p><div class="intro-rule"></div><p class="mini-label">Independent reinforcement learning research<br>Unity ML-Agents · Days Gone Quiet</p>`,
      loop:()=>`<div class="loop">${[['Observe','What information is available?'],['Act','What does the policy choose?'],['Receive feedback','What reward follows?'],['Update','How should the policy change?']].map((r,i)=>`<article><span>0${i+1} →</span><h3>${r[0]}</h3><p>${r[1]}</p></article>`).join('')}</div>${note('The update happens during training. A frozen policy is evaluated without further learning.')}`,
      reward:()=>principleList([['Observations','The information the agent receives.'],['Actions','The choices the environment allows.'],['Reward','Feedback we design to shape behavior.']])+note('A higher training reward is a signal to investigate, not proof of mission success.'),
      team:()=>`<div class="role-list">${[['S','Scout','Reports the safer route.'],['R','Rick','Navigates and retrieves the supplies.'],['N','Negan','Protects the team from nearby threats.']].map(r=>`<div class="role-row"><span class="role-icon">${r[0]}</span><h3>${r[1]}</h3><p>${r[2]}</p></div>`).join('')}</div>${note('Three distinct learned policies. Shared mission rewards. All three must return.')}`,
      mission:()=>`<div class="mission-flow">${['Report and follow the route','Regroup at the waystation','Collect three supply units','Follow the return route','Bring all three survivors home'].map((s,i)=>`<div class="mission-step"><span>0${i+1}</span><strong>${s}</strong></div>`).join('')}</div>${note('Mission schematic · illustrative structure, not agent movement footage.')}`,
      comparison:()=>`<div class="contrast"><div class="comparison-card"><span>SCRIPTED PRACTICE</span><strong>${E.facts.scriptedPractice.successes}<small style="font-size:.4em">/${E.facts.scriptedPractice.completed}</small></strong><p>Successful demonstrations.<br>These show the intended behavior.</p></div><div class="comparison-card"><span>FINAL LEARNED TEAM</span><strong>${f.successes}<small style="font-size:.4em">/${f.completed}</small></strong><p>Successful test deliveries.<br>These assess the saved policy.</p></div></div>${note('500,047 saved training steps per role · PPO + behavior cloning<br>These evidence categories do not establish a controlled improvement.')}`,
      failures:()=>`<div class="big-result"><strong>${f.successes} / ${f.completed}</strong><span>successful deliveries</span></div><div>${[['Regroup',18],['Recon',5],['Outbound route',1]].map(([n,v])=>`<div class="bar-row"><span>${n}</span><div class="bar-track"><i style="width:${v/24*100}%"></i></div><strong>${v}</strong></div>`).join('')}</div>${note('Where failed tests ended · Final saved team only<br>24 recorded configurations; a diagnostic suite, not broad reliability.')}`,
      timeline:()=>`<div class="event-row"><span class="event-time">00:00.08</span><div><strong>Route reported</strong><small>Scout provides a route report.</small></div></div><div class="event-row"><span class="event-time">00:39.68</span><div><strong>Outbound checkpoint reached</strong><small>Progress toward the shared objective.</small></div></div><div class="event-row"><span class="event-time">04:00.01</span><div><strong>Time expires at regrouping</strong><small>All three survive. The regroup milestone remains incomplete.</small></div></div><p class="unreached">Not reached: regroup → collect → return → deliver.</p>${note('Recorded event timeline · case-01-road-speed0-health0-layout0<br>No movement trajectory or video is inferred.')}`,
      diagnosis:()=>principleList([['Observation','Most final tests stop at regrouping.'],['Hypothesis','Focused practice may improve this handoff.'],['Test','Repeat the diagnostic suite; keep independent tests.']])+note('Failure location is measured. The cause and remedy still need investigation.'),
      applications:()=>`<div>${[['COORDINATION','Warehouse teams','Complete a shared job without blocking one another.'],['LONG-TERM TRADEOFFS','Inspection robots','Balance coverage, battery, and the return journey.'],['PARTIAL INFORMATION','Response logistics','Plan around changing routes and limited observations.']].map(r=>`<article class="application-row"><small>${r[0]}</small><h3>${r[1]}</h3><p>${r[2]}</p></article>`).join('')}</div>${note('Potential applications of sequential decision-making methods. No transfer from these game policies has been demonstrated.')}`,
      transfer:()=>principleList([['A suitable objective','Choose measurable behavior and appropriate constraints.'],['A different environment','Real sensors, physics, people, and costs change the task.'],['Evidence before use','Validate under relevant conditions with human oversight.']])+note('Explore independently published RL examples in the Evidence panel.'),
      next:()=>principleList([['Practice','Target regrouping and missing protective actions.'],['Evaluate','Freeze the team. Repeat tests. Check unseen conditions.'],['Compare','Measure deliveries and failure stages, not reward alone.']])+note('Proposed next experiment · not yet run as part of this presentation.'),
      ownership:()=>`<p class="large-line">Choose the question.<br>Direct the tools.<br>Check the result.<br>Decide what comes next.</p><div class="intro-rule"></div><p class="mini-label">Dane + project partner / Research direction</p>`,
      closing:()=>`<ol class="takeaway-list"><li>Behavior changes through experience.</li><li>Reward and practice shape the learning.</li><li>Evaluation decides whether it worked.</li></ol><div><a class="resource-link" href="https://aegis-sentinel-6u5m.onrender.com/#runs" target="_blank" rel="noopener">Explore the evidence ↗</a><button class="quiet" data-action="resources">Continue exploring ↗</button></div>`
    };
    return (visuals[kind]||visuals.opening)();
  }
  function stopAudio() {if(audio){audio.pause();audio.onended=null;audio.onerror=null;audio.onloadedmetadata=null;audio.onplaying=null;audio.onpause=null;audio.onwaiting=null;}if(video){video.pause();video.onloadeddata=null;video.onerror=null;}audio=null;video=null;document.body.classList.remove('speaking');}
  function syncVideo(){
    if(!video||!audio||video.readyState<2)return;
    if(audio.readyState!==undefined&&audio.readyState<3){video.pause();return;}
    if(Math.abs(video.currentTime-audio.currentTime)>.15)video.currentTime=Math.min(audio.currentTime,video.duration||audio.currentTime);
    if(!audio.paused&&!audioFinished){const attempt=video.play();if(attempt)attempt.catch(()=>{});}else video.pause();
  }
  function audioProblem(message){mediaFailed=true;mediaReady=true;audioFinished=true;state.running=false;syncControls();notify(message);}
  function playAudio(){if(!audio || audioFinished || state.phase!=='turn')return;audio.muted=!state.sound;const attempt=audio.play();if(attempt)attempt.catch(()=>{state.running=false;syncControls();notify('Playback is paused. Press Play to enable audio in this browser.');});}
  function prepareAudio(){
    mediaReady=false;mediaFailed=false;audioFinished=false;
    video=currentTurn().video?$('#speaker-video'):null;
    if(video){const thisVideo=video;video.muted=true;video.onloadeddata=()=>{if(video===thisVideo){video.classList.add('ready');syncVideo();}};video.onerror=()=>{if(video===thisVideo){video.hidden=true;video=null;}};}
    const thisAudio=new Audio(`audio/${currentTurn().id}.mp3`);audio=thisAudio;audio.preload='auto';audio.muted=!state.sound;
    audio.onloadedmetadata=()=>{if(audio===thisAudio)mediaReady=true;};
    audio.onplaying=()=>{if(audio===thisAudio){document.body.classList.add('speaking');syncVideo();}};
    audio.onpause=()=>{if(audio===thisAudio){video?.pause();document.body.classList.remove('speaking');}};
    audio.onwaiting=()=>{if(audio===thisAudio)video?.pause();};
    audio.onended=()=>{if(audio===thisAudio){audioFinished=true;video?.pause();document.body.classList.remove('speaking');}};
    audio.onerror=()=>{if(audio===thisAudio)audioProblem('This audio clip could not load. The full script is in Presenter → Transcript. Use Next to continue.');};
    audio.load();if(state.running)playAudio();
  }
  function render(){
    stopAudio();lastCaption='';state.elapsed=0;state.ended=false;
    const c=currentChapter(),t=currentTurn(),p=D.people[t.speaker];
    document.documentElement.style.setProperty('--accent',p.color);
    if(state.phase==='question'){
      if(state.mode==='guided')state.running=false;
      $('#stage').innerHTML=`<section class="question-scene"><p class="eyebrow">${esc(c.short)} · Shareholder question</p><h1>“${esc(c.question)}”</h1><p class="question-meta">${esc(c.asker)} asks Athena · ${state.mode==='guided'?'Read aloud, then start the response.':'Nine-second question cue.'}</p><button class="primary" data-action="answer">Athena, take it from here <span>↗</span></button><div class="mini-cast"><img src="${esc(D.people.athena.image)}" alt=""><span>Athena will introduce the appropriate executive.</span></div><p class="setup-note">Prepared meeting · the microphone is not listening.</p></section>`;
    }else{
      const incoming=state.lastSpeaker!==t.speaker&&t.speaker!=='athena';
      $('#stage').innerHTML=`<section class="presentation"><div class="speaker-scene" data-speaker="${esc(t.speaker)}"><img class="speaker-image" src="${esc(p.image)}" alt="${esc(p.name)} at ${esc(p.location)}">${t.video?`<video id="speaker-video" class="speaker-video" src="${esc(t.video)}" muted playsinline preload="auto" aria-hidden="true"></video>`:''}<div class="speaker-shade"></div><div class="call-strip"><span><i></i>${t.speaker==='athena'?'MEETING CHAIR':'EXECUTIVE LINK'}</span><span>${t.speaker==='athena'?'HQ / 01':t.speaker==='field'?'RANGE / 03':t.speaker==='operations'?'GRAYHAVEN / 04':'RESEARCH / 02'}</span></div><div class="speaker-identity">${wave}<p class="eyebrow">${esc(p.role)}</p><h2>${esc(p.name)}</h2><p>${esc(p.location)}</p><div class="speaker-note">FICTIONAL EXECUTIVE · ${t.video?'RECORDED PERFORMANCE':'ILLUSTRATED CALL · RECORDED VOICE'}</div></div><span class="scene-count">SEGMENT ${t.id} / 21</span>${incoming?`<div class="call-toast" aria-hidden="true"><div class="ring">⌁</div><p>CONNECTING TO ${esc(p.name.toUpperCase())}</p></div>`:''}</div><article class="story"><p class="eyebrow">${esc(t.eyebrow)}</p><h1>${esc(t.title)}</h1><div class="visual">${visual(t.visual)}</div><div class="caption-box ${state.captions?'':'hidden'}"><p id="caption-text">${esc(t.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.[0]||t.text)}</p></div></article></section>`;
      state.lastSpeaker=t.speaker;prepareAudio();
    }
    $('#transport').hidden=false;syncControls();updatePresenter();updateClock();
  }
  function syncControls(){
    $('#play').textContent=state.running?'Ⅱ':'▷';$('#play').setAttribute('aria-label',state.running?'Pause presentation':'Play presentation');
    $('#sound').textContent=state.sound?'Sound on':'Muted';$('#sound').setAttribute('aria-pressed',String(state.sound));
    $('#captions').setAttribute('aria-pressed',String(state.captions));$('#presenter').setAttribute('aria-expanded',String(state.presenter));
    $('#segment-label').textContent=`${currentChapter().short} · ${state.phase==='question'?'Your question':D.people[currentTurn().speaker].name}`;
    $('#previous').disabled=index()===0;$('#next').disabled=state.ended;
    document.body.classList.toggle('body-paused',!state.running);
  }
  function go(i,run=true){if(i<0)return;if(i>=agenda.length){finish();return;}const a=agenda[i];Object.assign(state,{c:a.c,t:a.t,phase:a.phase,running:run});render();}
  function begin(){state.mode=$('#play-mode')?.value||state.mode;state.started=true;state.lastSpeaker=null;go(0,true);}
  function toggle(){if(!state.started){begin();return;}if(state.ended){go(0,true);return;}if(state.phase==='question'&&state.mode==='guided'){go(index()+1,true);return;}state.running=!state.running;if(state.running){playAudio();}else audio?.pause();syncControls();}
  function updateClock(){
    const done=Math.min(D.targetSeconds,completed()+Math.min(state.elapsed,budget()));
    $('#clock').textContent=time(D.targetSeconds-done);$('#progress').style.width=`${Math.min(100,done/D.targetSeconds*100)}%`;
  }
  function updateCaption(){
    if(state.phase!=='turn'||!$('#caption-text'))return;
    const text=currentTurn().text;
    const sentences=text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[text];
    const mediaTime=audio&&Number.isFinite(audio.duration)&&audio.duration>0?audio.currentTime/audio.duration:state.elapsed/duration();
    let pos=0, chosen=sentences[sentences.length-1];
    for(const sentence of sentences){pos+=sentence.length/text.length;if(mediaTime<=pos){chosen=sentence.trim();break;}}
    if(chosen!==lastCaption){$('#caption-text').textContent=chosen;lastCaption=chosen;}
  }
  function tick(now){
    const delta=lastTick?Math.min((now-lastTick)/1000,.5):0;lastTick=now;
    if(state.started&&state.running&&!state.ended){
      // Count only after the clip is ready, and never advance while narration is still playing.
      if(state.phase==='question'||mediaReady)state.elapsed+=delta;
      updateClock();updateCaption();syncVideo();
      if(state.elapsed>=duration()&&(state.phase==='question'||audioFinished||mediaFailed))go(index()+1,true);
    }
    requestAnimationFrame(tick);
  }
  function finish(){state.running=false;state.ended=true;stopAudio();$('#clock').textContent='0:00';$('#progress').style.width='100%';syncControls();
    const end=document.createElement('div');end.className='ending';end.innerHTML=`<div><p class="eyebrow">Meeting adjourned</p><h2>The discussion continues.</h2><p>Explore the actual research, revisit a question, or restart the meeting. The complete script and source notes are available below.</p><button class="primary" data-action="resources">Explore the research ↗</button><button class="secondary" data-action="agenda">Revisit a question</button><button class="quiet" data-action="restart">Restart</button></div>`;$('.presentation')?.appendChild(end);}
  function updatePresenter(){
    const panel=$('#presenter-panel');panel.hidden=!state.presenter;if(!state.presenter)return;
    const c=currentChapter();panel.innerHTML=`<p class="eyebrow">Presenter notes</p><p class="warning">This panel is visible on this screen. Close it before projecting.</p><h3>${esc(c.question||c.name)}</h3><p><strong>${esc(c.asker)}:</strong> ${state.phase==='question'?'Ask the displayed question, then start Athena’s response.':'Let the executive finish. Next skips to the following segment.'}</p><p><strong>Takeaway:</strong> ${esc(c.takeaway)}</p><label for="live-mode">Question cues</label><select id="live-mode"><option value="guided" ${state.mode==='guided'?'selected':''}>Wait for our cue</option><option value="continuous" ${state.mode==='continuous'?'selected':''}>Continue automatically after 9 seconds</option></select><p class="mono">Space · pause/play<br>← / → · previous/next<br>R · replay this segment<br>F · fullscreen<br>P · presenter notes<br>M · mute<br>Esc · close panel / exit fullscreen</p><button class="secondary" data-action="transcript">Read transcript</button>`;
  }
  let panelWasRunning=false;
  function openPanel(title,body){panelWasRunning=state.running;state.running=false;audio?.pause();syncControls();$('#panel-title').textContent=title;$('#panel-body').innerHTML=body;$('#panel').showModal();}
  function closePanel(){ $('#panel').close(); }
  function team(){openPanel('The executive team',`<p class="panel-copy">Four fictional voices. One shared research record.</p><div class="team-grid">${Object.entries(D.people).map(([id,p])=>`<article class="team-detail"><img src="${esc(p.image)}" alt="${esc(p.name)}"><h3>${esc(p.name)}</h3><p><strong>${esc(p.role)}</strong><br>${esc(p.location)}</p><p>${({athena:'Chairs the meeting, challenges conclusions, and connects the evidence to the research decision.',research:'Explains how learning works and distinguishes a hypothesis from a demonstrated result.',field:'Connects the learning problem to potential applications and the work required for real-world use.',operations:'Reports the mission structure, recorded milestones, and observed failure stages.'})[id]}</p></article>`).join('')}</div>`);}
  function showAgenda(){openPanel('Meeting agenda',`<p class="panel-copy">Jump to any question. Guided mode waits for you to ask it aloud.</p><div class="agenda">${D.chapters.map((c,i)=>`<button data-chapter="${i}" class="${state.c===i?'active':''}"><span>${String(i+1).padStart(2,'0')}</span><div>${esc(c.name)}${c.question?`<p class="panel-copy">${esc(c.question)}</p>`:''}</div><small>${time(agenda.filter(a=>a.c===i).reduce((sum,a)=>sum+a.seconds,0))}</small></button>`).join('')}</div>`);}
  function evidence(){
    const facts=E.facts;
    openPanel('Evidence behind the meeting',`<p class="panel-copy"><strong>Research snapshot: 29 October 2026.</strong> This meeting pins its script and numbers to one snapshot. The main dashboard may later contain newer results.</p><div class="evidence-grid"><div><strong>0 / 24</strong><small>Final saved-team successful test deliveries</small></div><div><strong>16 / 16</strong><small>Successful scripted practice trips</small></div></div><p class="panel-copy">Final evaluation: <strong>${esc(facts.finalEvaluation.runId)}</strong>. Failure stages: Regroup 18, Recon 5, OutboundRoute 1. The earlier checkpoint’s 24 tests are excluded from these final-team counts.</p><p class="panel-copy">The characters, locations, calls, and voices are produced presentation elements. Event timelines use recorded telemetry; they are not video or spatial movement replays. The test suite is diagnostic. No broad reliability or causal cooperation benefit is claimed.</p><div class="evidence-links"><a href="guide.html" target="_blank" rel="noopener">Open presenter guide ↗</a><a href="evidence.json" download>Download the pinned evidence</a><a href="https://aegis-sentinel-6u5m.onrender.com/#runs" target="_blank" rel="noopener">Open research dashboard ↗</a><a href="https://github.com/dane-anderson/days_gone_quiet" target="_blank" rel="noopener">Days Gone Quiet repository ↗</a></div><p class="mono">Snapshot SHA-256<br>${esc(E.snapshot.snapshotHash)}<br>Exported ${esc(E.snapshot.exportedAt)}</p><h3>Explore independently published RL research</h3><p class="panel-copy">These are external examples of RL research. They do not validate our game policies or establish transfer from Days Gone Quiet.</p><div class="evidence-links"><a href="https://proceedings.mlr.press/v164/rudin22a.html" target="_blank" rel="noopener">Learning to walk: ANYmal research ↗</a><a href="https://deepmind.google/blog/accelerating-fusion-science-through-learned-plasma-control/" target="_blank" rel="noopener">Learning plasma control: TCV research ↗</a></div>`);
  }
  function transcript(){openPanel('Prepared meeting transcript',D.chapters.map(c=>`<h3>${esc(c.name)}</h3>${c.question?`<p class="panel-copy"><strong>${esc(c.asker)} asks:</strong> ${esc(c.question)}</p>`:''}${c.turns.map(t=>`<div class="transcript-turn"><strong>${esc(D.people[t.speaker].name)}</strong><p>${esc(t.text)}</p></div>`).join('')}`).join(''));}
  function fullscreen(){if(document.fullscreenElement){document.exitFullscreen?.();return;}const req=document.documentElement.requestFullscreen?.();if(req)req.catch(()=>notify('Use your browser’s fullscreen command to present.'));else notify('Use your browser’s fullscreen command to present.');}
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-action],[data-chapter]');if(!target)return;
    if(target.dataset.chapter!==undefined){const ci=Number(target.dataset.chapter);panelWasRunning=false;closePanel();state.started=true;go(agenda.findIndex(x=>x.c===ci),true);return;}
    const actions={start:begin,team,answer:()=>go(index()+1,true),resources:evidence,agenda:showAgenda,transcript,restart:()=>go(0,true),'test-audio':()=>{stopAudio();audio=new Audio('audio/02.mp3');audio.play().then(()=>notify('Sound test: Athena’s recorded voice.')).catch(()=>notify('Audio could not play. Check your output device and browser sound permission.'));}};
    actions[target.dataset.action]?.();
  });
  document.addEventListener('change',e=>{if(e.target.id==='live-mode'){state.mode=e.target.value;updatePresenter();}});
  $('#play').addEventListener('click',toggle);$('#next').addEventListener('click',()=>go(index()+1,true));$('#previous').addEventListener('click',()=>go(index()-1,true));
  $('#sound').addEventListener('click',()=>{state.sound=!state.sound;if(audio)audio.muted=!state.sound;syncControls();});
  $('#captions').addEventListener('click',()=>{state.captions=!state.captions;$('.caption-box')?.classList.toggle('hidden',!state.captions);syncControls();});
  $('#presenter').addEventListener('click',()=>{state.presenter=!state.presenter;updatePresenter();syncControls();});
  $('#agenda-button').addEventListener('click',showAgenda);$('#evidence-button').addEventListener('click',evidence);$('#fullscreen').addEventListener('click',fullscreen);
  $('#close-panel').addEventListener('click',closePanel);$('#panel').addEventListener('close',()=>{if(panelWasRunning&&state.started&&!state.ended){state.running=true;playAudio();syncControls();}panelWasRunning=false;});
  document.addEventListener('keydown',e=>{
    if($('#panel').open||e.target.closest('input,select,textarea,button,a')||e.altKey||e.ctrlKey||e.metaKey)return;
    const key=e.key.toLowerCase();
    if(key===' '){e.preventDefault();toggle();}else if(state.started&&key==='arrowright'){e.preventDefault();go(index()+1,true);}else if(state.started&&key==='arrowleft'){e.preventDefault();go(index()-1,true);}else if(key==='f')fullscreen();else if(state.started&&key==='r')go(index(),true);else if(key==='m')$('#sound').click();else if(state.started&&key==='p')$('#presenter').click();
  });
  window.addEventListener('pagehide',stopAudio);
  lobby();requestAnimationFrame(tick);
})();
