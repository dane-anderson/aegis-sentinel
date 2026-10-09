'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const fmt = n => new Intl.NumberFormat('en-US').format(n);
const num = n => Number.isFinite(n) ? n.toFixed(3) : 'Not recorded';
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = d => new Date(d).toLocaleDateString('en-US', {year:'numeric', month:'short',day:'numeric',timeZone:'America/Denver'});
let research, loadError = false, selectedRun = 'prison-duo-v2', selectedPolicy = 'RickEscape', chartMode = 'chart';
const sections = ['command','runs','hypotheses','roadmap','briefing'];
const heading = (title, subtitle, action='') => `<div class="dash-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
const manifestButton = '<button class="button outline" data-evidence>View evidence <span>↗</span></button>';

function terrain() {
  const svg = $('#terrain'); if(!svg) return;
  function project(x,y) {
    const z = 65*Math.exp(-((x-1.5)**2+(y-1.5)**2)/12) + 90*Math.exp(-((x+3)**2+(y+2)**2)/7) + 14*Math.sin(x*.5+y*.3);
    return [320+(x-y)*22,235+(x+y)*10-z];
  }
  const p = (x,y) => project(x,y).map(v=>v.toFixed(1)).join(',');
  let markup = '<defs><radialGradient id="fieldGlow"><stop stop-color="#8cb963" stop-opacity=".15"/><stop offset="1" stop-color="#1b261a" stop-opacity="0"/></radialGradient></defs><ellipse cx="320" cy="210" rx="320" ry="220" fill="url(#fieldGlow)"/>';
  for(let row=-7;row<=7;row++) {
    let a=[],b=[];
    for(let j=-70;j<=70;j+=2) { a.push(p(row,j/10)); b.push(p(j/10,row)); }
    markup += `<polyline points="${a.join(' ')}" fill="none" stroke="#709660" stroke-opacity=".42" stroke-width=".7"/><polyline points="${b.join(' ')}" fill="none" stroke="#709660" stroke-opacity=".42" stroke-width=".7"/>`;
  }
  markup += `<path d="M${p(-5,3)} L${p(-3,3)} L${p(-2,1)} L${p(0,0)} L${p(2,-2)}" stroke="#a4d0ec" stroke-width="2" stroke-dasharray="5 5" fill="none"/>`;
  for(const [x,y,color,label] of [[-3,3,'#a4d0ec','RICK / 01'],[3,1,'#98c2d2','NEGAN / 02']]) {
    const [sx,sy]=project(x,y);
    markup+=`<circle cx="${sx}" cy="${sy}" r="25" fill="${color}" fill-opacity=".06" stroke="${color}" stroke-opacity=".35"/><circle cx="${sx}" cy="${sy}" r="5" fill="${color}"/><line x1="${sx}" y1="${sy-12}" x2="${sx}" y2="${sy-65}" stroke="${color}" stroke-opacity=".7"/><rect x="${sx-38}" y="${sy-84}" width="98" height="22" fill="#202b20" stroke="${color}" stroke-opacity=".4"/><text x="${sx-30}" y="${sy-70}" fill="${color}" font-family="monospace" font-size="10">${label}</text>`;
  }
  markup+='<g fill="#88977f" font-family="monospace" font-size="9"><text x="25" y="38">N ↑</text><text x="25" y="427">LOCAL OBSERVATION</text><text x="25" y="442">PARTIAL WORLD STATE</text><text x="500" y="442">SENTINEL / 001</text></g><path d="M565 28v40M545 48h40" stroke="#88977f" stroke-width=".6"/>';
  svg.innerHTML=markup;
}
function current() { const run=research.runs.find(r=>r.id===selectedRun);return {run,policy:run.policies.find(p=>p.name===selectedPolicy)}; }
function summary() {
  const {run,policy}=current();
  return `<div class="summary-grid"><div class="summary-stat"><label>Recorded checkpoint</label><strong>${fmt(policy.checkpointSteps)}</strong><small>${run.id} / ${policy.name}</small></div><div class="summary-stat"><label>Configured target</label><strong>${fmt(policy.targetSteps)}</strong><small>Steps, not a success threshold</small></div><div class="summary-stat"><label>Policy architecture</label><strong class="lime">Independent</strong><small>2 PPO policies / separate rewards</small></div><div class="summary-stat"><label>Cooperative evaluation</label><strong>Unverified</strong><small>No recorded cooperative evaluation</small></div></div>`;
}
function graph(policy) {
  const points=policy.points;
  if(!points.length) return '<p class="empty-state">No reward samples were found for this policy.</p>';
  const W=780,H=280,L=56,R=22,T=25,B=48;
  let ymin=Math.min(...points.map(p=>p.value)),ymax=Math.max(...points.map(p=>p.value));
  const pad=(ymax-ymin)*.12||.1; ymin-=pad;ymax+=pad;
  const xmax=Math.max(...points.map(p=>p.step),1);
  const x=p=>L+p.step/xmax*(W-L-R), y=p=>H-B-(p.value-ymin)/(ymax-ymin)*(H-T-B);
  const path=points.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(2)},${y(p).toFixed(2)}`).join(' ');
  let grid='';
  for(let i=0;i<=4;i++){const yy=T+(H-T-B)*i/4;const val=ymax-(ymax-ymin)*i/4;grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#2c4054" stroke-dasharray="3 5"/><text x="${L-10}" y="${yy+4}" text-anchor="end">${val.toFixed(2)}</text>`;}
  for(let i=0;i<=4;i++){const step=xmax*i/4;grid+=`<text x="${L+(W-L-R)*i/4}" y="${H-24}" text-anchor="middle">${step>=1000?(step/1000).toFixed(1)+'k':Math.round(step)}</text>`;}
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHTML(policy.name)} recorded training reward across ${points.length} samples. Last value ${num(points.at(-1).value)} at step ${points.at(-1).step}. Table view provides all values."><g fill="#91a2b1" font-family="monospace" font-size="11">${grid}<text x="${W/2}" y="${H-3}" text-anchor="middle" font-size="9">TRAINING STEP</text></g><path d="${path}" fill="none" stroke="#a4d0ec" stroke-width="1.7" stroke-linejoin="round"/>${points.length<10?points.map(p=>`<circle cx="${x(p)}" cy="${y(p)}" r="3.5" fill="#a4d0ec"/>`).join(''):''}<circle cx="${x(points.at(-1))}" cy="${y(points.at(-1))}" r="4" fill="#a4d0ec"/></svg>`;
}
function chartPanel() {
  const {run,policy}=current(), latest=policy.points.at(-1);
  const table = `<div class="data-table-wrap"><table class="data-table"><caption class="skip">All recorded reward samples, latest first</caption><thead><tr><th>STEP</th><th>REWARD</th><th>RECORDED (DENVER)</th></tr></thead><tbody>${[...policy.points].reverse().map(p=>`<tr><td>${fmt(p.step)}</td><td>${num(p.value)}</td><td>${date(p.recordedAt)}</td></tr>`).join('')}</tbody></table></div>`;
  return `<section class="card"><div class="card-head"><h2>Training signal</h2><span class="badge verified">RECORDED DATA</span></div><div class="chart-controls"><div class="field"><label for="run-select">EXPERIMENT RECORD</label><select id="run-select">${research.runs.map(r=>`<option value="${r.id}" ${r.id===run.id?'selected':''}>${r.id}</option>`).join('')}</select></div><div class="field"><label for="policy-select">POLICY</label><select id="policy-select">${run.policies.map(p=>`<option ${p.name===policy.name?'selected':''}>${p.name}</option>`).join('')}</select></div><div class="chart-toggle" role="group" aria-label="Reward display"><button data-mode="chart" aria-pressed="${chartMode==='chart'}">Chart</button><button data-mode="table" aria-pressed="${chartMode==='table'}">Table</button></div></div><div class="chart-meta"><strong>${latest?num(latest.value):'—'}</strong><span>LATEST LOGGED REWARD · ${latest?fmt(latest.step):'—'} STEPS</span></div><div class="chart">${chartMode==='chart'?graph(policy):table}</div><p class="chart-note">${policy.points.length} original scalar samples · no smoothing · ${escapeHTML(research.metric)}.<br>Reward reflects this policy’s training objective. It is not a success rate or a comparison between Rick and Negan.</p></section>`;
}
function recordsTable() {
  return `<section class="card record-list"><div class="card-head"><h2>Experiment register</h2><span class="eyebrow">3 SELECTED LOCAL RUNS</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>RUN / LABEL</th><th>LAST CHECKPOINT</th><th>RECORD STATE</th><th>EVIDENCE</th></tr></thead><tbody>${research.runs.map(r=>`<tr><td><strong>${r.id}</strong><small>${r.environment} / descriptive label</small></td><td>${fmt(r.policies[0].checkpointSteps)} steps<small>${date(r.policies[0].checkpointAt)}</small></td><td><span class="badge neutral">${r.policies.every(p=>p.checkpointSteps>=p.targetSteps)?'TARGET RECORDED':'BELOW TARGET'}</span></td><td><button data-inspect="${r.id}">Inspect ↗</button></td></tr>`).join('')}</tbody></table></div><p class="section-note">“Below target” compares the saved checkpoint with the run’s configured step budget. It does not identify why training ended or whether a process is running now.</p></section>`;
}
function overview(isRuns=false) {
  return heading(isRuns?'Training records':'Research overview',`Snapshot exported ${date(research.exportedAt)} · source-linked records from Days Gone Quiet`,manifestButton)+(isRuns?'':`<div class="command-banner"><img src="/assets/sentinel-command.jpg" alt="Fictional Sentinel Command research theater"><div class="command-banner-copy"><p>AEGIS DYNAMICS / RESEARCH DIVISION</p><h2>Welcome to<br>Sentinel Command.</h2><small>The experiments behind the vision.</small></div><span class="image-caption">FACILITY CONCEPT / RECORDED DATA BELOW</span></div>`)+summary()+`<div class="dashboard-grid">${chartPanel()}<aside class="card brief-card"><span class="eyebrow">ATHENA / RESEARCH NOTE</span><img class="athena-mini portrait-mini" src="/assets/athena-executive.jpg" alt="Athena, fictional executive concept"><h2>Two policies.<br>One open question.</h2><p class="eyebrow">CURATED BRIEF · NOT LIVE AI</p><blockquote>Sharing an environment does not establish cooperation. The next experiment needs a baseline and a measurable team outcome.</blockquote><a href="#briefing">Read the executive brief ↗</a></aside></div>`+recordsTable()+`<div class="notice">Evidence boundary: these are recorded training signals and saved model artifacts. Controlled success rates, multi-seed uncertainty, and cooperative improvements have not been verified.</div><a class="button outline" id="download-data" href="/data/research.json" download="sentinel-research-snapshot.json">Download research snapshot ↓</a>`;
}
function hypotheses() {
  return heading('Questions worth testing','Proposed experiments · no outcomes are claimed')+`<div class="hypothesis-grid"><article class="card hypothesis-card"><span class="eyebrow muted">SENTINEL / H-01</span><h2>Can shared objectives improve team survival?</h2><span class="badge planned">PLANNED / UNTESTED</span><p>Compare the existing independent policies with an explicitly cooperative training condition.</p><dl><div><dt>Control</dt><dd>Independent PPO policies, current reward design.</dd></div><div><dt>Change</dt><dd>Add a defined team objective while keeping the environment and training budget fixed.</dd></div><div><dt>Measure</dt><dd>Team survival rate, escape rate, and episode duration across multiple held-out seeds.</dd></div><div><dt>Evidence needed</dt><dd>Saved evaluation episodes, policy hashes, scene revision, and uncertainty intervals.</dd></div></dl></article><article class="card hypothesis-card"><span class="eyebrow muted">SENTINEL / H-02</span><h2>Does a learned policy transfer to a new setting?</h2><span class="badge planned">PLANNED / UNTESTED</span><p>The prison and barn offer different situations. A compatible model alone does not establish successful transfer.</p><dl><div><dt>Control</dt><dd>Frozen prison policy evaluated in its original setting.</dd></div><div><dt>Change</dt><dd>Evaluate the same frozen policy in the barn before additional training.</dd></div><div><dt>Measure</dt><dd>Survival and task success under matched episode budgets and documented settings.</dd></div><div><dt>Evidence needed</dt><dd>A clear zero-shot evaluation before any adaptation, plus a separate fine-tuned comparison.</dd></div></dl></article></div><div class="notice">Research design note: Rick and Negan have different reward functions. A larger reward for one policy does not mean it is smarter or more capable than the other.</div>`;
}
function roadmap() {
  const items=[['01','Make the work inspectable','Public AEGIS site, source-linked training snapshots, run selection, and a transparent evidence register.','AVAILABLE NOW','verified'],['02','Establish evaluation baselines','Record success rates on fixed evaluation scenarios with scene versions, seeds, and policy hashes.','NEXT / PLANNED','planned'],['03','Test coordination','Implement a cooperative condition and compare team outcomes against independent policies.','PLANNED','planned'],['04','Connect the research workspace','Add authenticated private access, reviewed snapshot ingestion, and a durable experiment database.','PLANNED','planned'],['05','Bring Athena online','Connect an AI model to approved evidence, with citations, reviewable analysis, memory, and voice.','PLANNED','planned']];
  return heading('Research roadmap','Progress is defined by evidence, not a launch date')+`<section class="card">${items.map(x=>`<article class="roadmap-row"><span class="roadmap-number">${x[0]}</span><div><h2>${x[1]}</h2><p>${x[2]}</p></div><span class="badge ${x[4]}">${x[3]}</span></article>`).join('')}</section>`;
}
function briefing() {
  const prison=research.runs.find(r=>r.id==='prison-duo-v2'), barn=research.runs.find(r=>r.id==='barn-team-v2');
  return heading('Athena’s executive brief','Fictional Chief Intelligence Officer · curated research briefing',manifestButton)+`<div class="brief-layout"><article class="card executive-brief"><span class="badge neutral">CURATED CONTENT / NO LIVE AI CONNECTION</span><h2>The foundation exists.<br>The central claim is still open.</h2><p>We have two independent PPO policies, saved model exports, and inspectable training records. That gives Project Sentinel a concrete starting point.</p><h3>What the records support</h3><ul><li>Prison-duo-v2 records a checkpoint at ${fmt(prison.policies[0].checkpointSteps)} steps for each policy.</li><li>Barn-team-v2 records a checkpoint at ${fmt(barn.policies[0].checkpointSteps)} steps for each policy.</li><li>Both runs contain TensorBoard reward samples and ONNX exports.</li></ul><h3>What remains unverified</h3><p>The records do not establish reliable escape, reliable simulated combat, cooperative improvement, or generalization. Training reward is useful diagnostic evidence, but controlled evaluation needs its own measurements.</p><h3>Recommended next experiment</h3><p>Freeze the existing policies. Log scene revision and environment settings. Run repeatable evaluation episodes and record direct outcomes before changing the reward design.</p><p class="eyebrow">HUMAN-REVIEWED RESEARCH IS THE INTENDED WORKFLOW.<br>THIS BRIEF IS A WRITTEN INTERFACE, NOT AN AUTONOMOUS EXECUTIVE.</p></article><aside class="card notes-card"><h2>Research notebook</h2><p>Keep questions for the next session. Notes are saved only in this browser; they are never sent to Athena or the server.</p><label for="research-notes">YOUR SESSION NOTES</label><textarea id="research-notes" placeholder="What should we measure next?"></textarea><div id="notes-status" class="notes-status" role="status"></div><button class="button outline" id="download-notes">Download notes ↓</button><dl><div><dt>Athena’s intended mandate</dt><dd>Challenge conclusions. Cite evidence. Surface uncertainty.</dd></div><div><dt>Future capabilities</dt><dd>Source-grounded chat, research memory, approved analysis, and voice.</dd></div></dl></aside></div>`;
}
function download(content, filename, type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function evidence(id=selectedRun) {
  const run=research.runs.find(r=>r.id===id);$('#dialog-title').textContent=`Evidence / ${run.id}`;
  $('#evidence-body').innerHTML=`<p>Read-only snapshot exported ${date(research.exportedAt)}. Original files stay in the local training results folder. SHA-256 fingerprints identify the files read for this export.</p><p>Environment attribution: ${run.environmentEvidence}</p><p><a class="source-link" href="${research.sourceRepository}/tree/${research.sourceCommit}" target="_blank" rel="noopener">Inspect the public source revision ↗</a><br>The local Unity checkout has additional uncommitted work, including the barn scene. The source revision is context, not a claimed exact reproduction of every run.</p><h3>Policy records</h3>${run.policies.map(p=>`<p><strong>${p.name}</strong> · ${p.algorithm} · ${fmt(p.checkpointSteps)} checkpoint steps / ${fmt(p.targetSteps)} target · ${p.points.length} reward samples · ONNX export ${p.modelExportPresent?'present':'not found'}.</p>`).join('')}<h3>Source manifest</h3>${run.sources.map(s=>`<div class="source-entry"><strong>${escapeHTML(s.path)}</strong><code>SHA-256 ${s.sha256}</code></div>`).join('')}<h3>Interpretation limits</h3><p>The checkpoint summary reward and the latest TensorBoard scalar can differ because they summarize different moments. No evaluation success rate or confidence interval was collected in this export. No raw model weights or private notes are published.</p>`;
  $('#evidence-dialog').showModal();
}
function wire() {
  $$('[data-evidence]').forEach(b=>b.addEventListener('click',()=>evidence()));
  $$('[data-inspect]').forEach(b=>b.addEventListener('click',()=>evidence(b.dataset.inspect)));
  for (const [selector,key] of [['#run-select','run'],['#policy-select','policy']]) {
    $(selector)?.addEventListener('change',e=>{if(key==='run')selectedRun=e.target.value;else selectedPolicy=e.target.value;renderContent();$(selector)?.focus();});
  }
  $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{chartMode=b.dataset.mode;renderContent();$(`[data-mode="${chartMode}"]`)?.focus();}));
  const notes=$('#research-notes');
  if(notes){
    try{notes.value=localStorage.getItem('aegis-sentinel-notes')||'';}catch{$('#notes-status').textContent='Browser storage is unavailable. Download notes to keep them.';}
    notes.addEventListener('input',()=>{try{localStorage.setItem('aegis-sentinel-notes',notes.value);$('#notes-status').textContent='Saved in this browser.';}catch{$('#notes-status').textContent='Unable to save locally. Download notes to keep them.';}});
    $('#download-notes').addEventListener('click',()=>download(notes.value,'sentinel-research-notes.txt','text/plain'));
  }
}
function routeName(){return location.hash.slice(1)||'home';}
const office = $('#office-transmission');
const athenaVideo = $('#athena-video');
const transmissionStatus = $('#transmission-status');
const replayTransmission = $('#replay-transmission');
let officeOpen = false, playbackAttempt = 0;
function playTransmission() {
  const attempt = ++playbackAttempt;
  athenaVideo.currentTime = 0;
  transmissionStatus.textContent = 'Opening transmission…';
  athenaVideo.play().catch(error => {
    if(attempt !== playbackAttempt || !officeOpen) return;
    replayTransmission.innerHTML = 'Play transmission <span aria-hidden="true">▷</span>';
    transmissionStatus.textContent = error.name === 'NotAllowedError'
      ? 'Press Play transmission to hear Athena.'
      : 'Playback unavailable. Try Play transmission or open the download.';
  });
}
function syncOffice() {
  const entering = routeName() === 'briefing';
  office.hidden = !entering;
  if(entering === officeOpen) return;
  officeOpen = entering;
  if(!entering) { ++playbackAttempt; athenaVideo.pause(); return; }
  replayTransmission.innerHTML = 'Play transmission <span aria-hidden="true">▷</span>';
  transmissionStatus.textContent = 'Transmission ready. Press play to hear Athena.';
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches && !document.hidden) playTransmission();
}
replayTransmission.addEventListener('click', playTransmission);
athenaVideo.addEventListener('playing', () => {
  if(!officeOpen) { athenaVideo.pause(); return; }
  replayTransmission.innerHTML = 'Replay transmission <span aria-hidden="true">↻</span>';
  transmissionStatus.textContent = 'Transmission playing. Playback controls are below the video.';
});
athenaVideo.addEventListener('pause', () => {
  if(officeOpen && !athenaVideo.ended) transmissionStatus.textContent = 'Transmission paused. Resume in the player or replay from the beginning.';
});
athenaVideo.addEventListener('ended', () => {
  transmissionStatus.textContent = 'Transmission complete. Replay whenever you like.';
});
athenaVideo.addEventListener('error', () => {
  transmissionStatus.textContent = 'Transmission could not load. Try the download link.';
});
document.addEventListener('visibilitychange', () => { if(document.hidden) athenaVideo.pause(); });
// Start within the entry click so browsers can allow speech after user interaction.
document.addEventListener('click', event => {
  const link = event.target.closest('a[href="#briefing"]');
  if(!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if(routeName() !== 'briefing') location.hash = 'briefing';
  route();
});
function renderContent() {
  const section=routeName();if(!sections.includes(section))return;
  const root=$('#dashboard-content');
  if(loadError){root.innerHTML='<div class="empty-state"><h2>Research snapshot unavailable</h2><p>The records could not be loaded. Refresh the page to retry. No placeholder metrics are being shown.</p><button class="button outline" id="retry">Retry loading</button></div>';$('#retry').onclick=()=>location.reload();return;}
  if(!research){root.innerHTML='<p class="loading">Loading verified research snapshot…</p>';return;}
  root.innerHTML=section==='command'?overview():section==='runs'?overview(true):section==='hypotheses'?hypotheses():section==='roadmap'?roadmap():briefing();wire();
}
function route() {
  const name=routeName(), command=sections.includes(name);
  $('#public-site').hidden=command;$('#command-site').hidden=!command;document.body.classList.toggle('public-view',!command);document.body.classList.toggle('command-view',command);
  $$('.sidebar nav a').forEach(a=>{a.classList.toggle('active',a.dataset.section===name);if(a.dataset.section===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title=command?'Sentinel Command — AEGIS':'AEGIS Dynamics — Intelligence for an uncertain world.';
  syncOffice();
  if(command){renderContent();window.scrollTo({top:0,behavior:'instant'});}else{requestAnimationFrame(()=>document.getElementById(name)?.scrollIntoView());}
}
$('#close-dialog').addEventListener('click',()=>$('#evidence-dialog').close());
$('#evidence-dialog').addEventListener('click',e=>{if(e.target===$('#evidence-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
window.addEventListener('hashchange',route);terrain();route();
fetch('/data/research.json').then(r=>{if(!r.ok)throw new Error('Snapshot unavailable');return r.json();}).then(data=>{if(data.schemaVersion!==1||!Array.isArray(data.runs)||data.runs.length!==3)throw new Error('Unsupported snapshot');research=data;renderContent();}).catch(()=>{loadError=true;renderContent();});
