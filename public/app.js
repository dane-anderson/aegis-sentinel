'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const fmt = n => new Intl.NumberFormat('en-US').format(n);
const num = n => Number.isFinite(n) ? n.toFixed(3) : 'Not recorded';
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = d => new Date(d).toLocaleDateString('en-US', {year:'numeric', month:'short',day:'numeric',timeZone:'America/Denver'});
let research, athena, loadError = false, selectedRun = '', selectedPolicy = '', chartMode = 'chart', selectedMode = 'training', selectedGroup = '', selectedMission = 'supply_run';
const modeName = mode => ({training:'Training',evaluation:'Saved-policy evaluation',scripted_demo:'Scripted demonstration',validation:'Mechanics validation',untrained_or_mixed:'Untrained or mixed'})[mode] || mode;
const timestamp = d => d ? new Date(d).toLocaleString('en-US', {timeZone:'America/Denver'}) + ' Denver' : 'Not recorded';
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
  for(const [x,y,color,label] of [[-3,3,'#a4d0ec','RICK / 01'],[3,1,'#98c2d2','NEGAN / 02'],[0,-3,'#b0e1b4','SCOUT / 03']]) {
    const [sx,sy]=project(x,y);
    markup+=`<circle cx="${sx}" cy="${sy}" r="25" fill="${color}" fill-opacity=".06" stroke="${color}" stroke-opacity=".35"/><circle cx="${sx}" cy="${sy}" r="5" fill="${color}"/><line x1="${sx}" y1="${sy-12}" x2="${sx}" y2="${sy-65}" stroke="${color}" stroke-opacity=".7"/><rect x="${sx-38}" y="${sy-84}" width="98" height="22" fill="#202b20" stroke="${color}" stroke-opacity=".4"/><text x="${sx-30}" y="${sy-70}" fill="${color}" font-family="monospace" font-size="10">${label}</text>`;
  }
  markup+='<g fill="#88977f" font-family="monospace" font-size="9"><text x="25" y="38">N ↑</text><text x="25" y="427">LOCAL OBSERVATION</text><text x="25" y="442">PARTIAL WORLD STATE</text><text x="500" y="442">SENTINEL / 001</text></g><path d="M565 28v40M545 48h40" stroke="#88977f" stroke-width=".6"/>';
  svg.innerHTML=markup;
}
function current() {
  const family=research.runs.filter(r=>selectedMission==='supply_run'?r.id.startsWith('sentinel-supply-'):r.id.startsWith('sentinel-')&&!r.id.startsWith('sentinel-supply-'));
  const savedAt=r=>Math.max(0,...r.policies.map(p=>Date.parse(p.checkpointAt)||0));
  const latest=family.filter(r=>r.kind!=='smoke_test').sort((a,b)=>savedAt(b)-savedAt(a))[0]||family[0];
  const run=research.runs.find(r=>r.id===selectedRun)||latest||research.runs[0];
  const policy=run.policies.find(p=>p.name===selectedPolicy)||run.policies[0];
  selectedRun=run.id; selectedPolicy=policy.name; return {run,policy};
}

function summary() {
  const {run,policy}=current();
  return `<div class="summary-grid"><div class="summary-stat"><label>Recorded checkpoint</label><strong>${policy.checkpointSteps===null?'Pending':fmt(policy.checkpointSteps)}</strong><small>${escapeHTML(run.id)} / ${escapeHTML(policy.name)}</small></div><div class="summary-stat"><label>Configured target</label><strong>${fmt(policy.targetSteps)}</strong><small>${run.kind==='smoke_test'?'Connection smoke test':'Training budget'} · steps</small></div><div class="summary-stat"><label>Policy architecture</label><strong class="lime">${run.policies.length} policies</strong><small>${escapeHTML(run.trainingMethod||'Independent PPO')}${run.id.startsWith('sentinel-')?' / shared mission rewards':''}</small></div><div class="summary-stat"><label>Cooperation improvement</label><strong>Unverified</strong><small>Matched baseline comparison still needed</small></div></div>`;
}
function cooperation() {
  const supply=selectedMission==='supply_run';
  const missionGroups=research.cooperation.groups.filter(g=>(g.missionType||'cooperation')===selectedMission);
  const groups=missionGroups.filter(g=>g.mode===selectedMode);
  const group=groups.find(g=>g.id===selectedGroup)||groups[0];
  if(group) selectedGroup=group.id;
  const n=group?.completed||0;
  const suite=group?groups.filter(g=>g.runId===group.runId&&g.environmentFingerprint===group.environmentFingerprint&&JSON.stringify(g.modelHashes)===JSON.stringify(group.modelHashes)):[];
  const suiteN=suite.reduce((n,g)=>n+g.completed,0), suiteWins=suite.reduce((n,g)=>n+g.successes,0);
  const steps=supply?[['routeReported','Scout reports','Safe outbound route identified'],['cargoCollected','Rick collects','Barn supplies retrieved after regrouping'],['returnedTogether','Team returns','All three survivors reach home'],['successes','Supplies delivered','Complete trip through the return checkpoint']]:[['routeReported','Scout reports','Safe route identified'],['routeReached','Rick follows','Reported route reached'],['guardianCleared','Negan protects','Nearby threat cleared'],['successes','Mission complete','All three survive and Rick claims the objective']];
  const modes=['training','evaluation','scripted_demo'];
  const ignored=research.cooperation.groups.filter(g=>!modes.includes(g.mode)).reduce((sum,g)=>sum+g.completed+g.interrupted,0);
  const episodes=group?research.cooperation.episodes.filter(e=>group.episodeIds.includes(e.episodeId)).slice(-12).reverse():[];
  return `<section class="card cooperation-panel"><div class="card-head"><h2>${supply?'Can they bring supplies home?':'Are they working together?'}</h2><span class="badge verified">DIRECT EPISODE EVIDENCE</span></div><p>Follow the handoff from observation to action. These milestones describe what happened; a matched comparison is still needed to measure how much cooperation helps.</p><div class="evidence-tabs" role="group" aria-label="Mission"><button data-mission="supply_run" aria-pressed="${supply}">Supply Run · prison to barn</button><button data-mission="cooperation" aria-pressed="${!supply}">Original cooperation mission</button></div><div class="evidence-tabs" role="group" aria-label="Episode evidence type">${modes.map(mode=>`<button data-evidence-mode="${mode}" aria-pressed="${mode===selectedMode}">${modeName(mode)}</button>`).join('')}</div>${groups.length?`<div class="field"><label for="episode-group">RUN / ENVIRONMENT / CONFIGURATION</label><select id="episode-group">${groups.map(g=>`<option value="${g.id}" ${g.id===group.id?'selected':''}>${escapeHTML(g.runId==='unlinked'?'Local session':g.runId)} ${g.scenario?' · '+escapeHTML(g.scenario):''} · ${g.environmentFingerprint.slice(0,8)} · ${g.id.slice(0,6)}</option>`).join('')}</select></div>`:''}<p class="section-note">${supply&&selectedMode==='evaluation'&&suiteN?`This saved team succeeded in ${suiteWins} of ${suiteN} test episodes across ${suite.length} recorded configurations. The selected case is shown below. This small test suite does not establish broad reliability.`:''}</p><div class="team-chain">${steps.map(([key,title,detail])=>`<article><span class="eyebrow">${title}</span><strong>${n?`${group[key]} / ${n}`:'—'}</strong><p>${detail}</p></article>`).join('')}</div><p class="section-note">${n?`${n} completed episodes · ${group.interrupted} interrupted, excluded from rates · ${group.allSurvived}/${n} all survived · mean duration ${group.meanSeconds.toFixed(1)} seconds.`:'No completed episodes in this evidence category yet.'} ${supply&&n?`${group.suppliesDelivered} supply units delivered · mean team damage ${group.meanDamage.toFixed(1)} HP.`:''} ${selectedMode==='scripted_demo'?'Scripted behavior validates the mechanics. It is not learned performance.':selectedMode==='training'?'Training episodes use changing policies; they are not a frozen-model evaluation.':'Evaluation requires all three saved models. Results still depend on the recorded settings and seeds.'}</p><details><summary>Inspect recent episodes and agent contributions</summary>${episodes.length?`<div class="data-table-wrap"><table class="data-table"><thead><tr><th>EPISODE / OUTCOME</th><th>SCOUT REPORT</th><th>${supply?'CARGO COLLECTED':'RICK ROUTE'}</th><th>${supply?'DELIVERY':'NEGAN CLEARED'}</th><th>TEAM / DURATION</th></tr></thead><tbody>${episodes.map(e=>`<tr><td><strong>${escapeHTML(e.outcome)}</strong><small>${escapeHTML(e.episodeId.slice(0,8))} / ${e.round}</small><small>${timestamp(e.timestamp)}</small></td><td>${e.reportAt>=0?e.reportAt.toFixed(1)+' s':'—'}</td><td>${supply?(e.collectedAt>=0?e.collectedAt.toFixed(1)+' s':'—'):(e.routeAt>=0?e.routeAt.toFixed(1)+' s':'—')}</td><td>${supply?`${e.suppliesDelivered}/${e.cargoUnits} units`:(e.guardianAt>=0?e.guardianAt.toFixed(1)+' s':'—')}</td><td>${e.agents.filter(a=>a.alive).length}/3 alive · ${e.durationSeconds.toFixed(1)} s<small>${e.agents.map(a=>`${escapeHTML(a.role)} ${Math.round(a.health)} HP · ${a.distance.toFixed(1)} m`).join('<br>')}</small></td></tr>`).join('')}</tbody></table></div>`:'<p>Evidence will appear after an episode finishes.</p>'}<p class="section-note">${ignored} validation or mixed-mode records are excluded from the three categories above. The downloadable snapshot contains full episode IDs, model hashes, environment fingerprints and settings.</p></details></section>`;
}
function athenaStatus() {
  return athena?.status==='ready' && athena.sourceSnapshotHash===research.snapshotHash;
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
  return `<section class="card"><div class="card-head"><h2>Training signal</h2><span class="badge verified">RECORDED DATA</span></div><div class="chart-controls"><div class="field"><label for="run-select">EXPERIMENT RECORD</label><select id="run-select">${research.runs.map(r=>`<option value="${r.id}" ${r.id===run.id?'selected':''}>${r.id}</option>`).join('')}</select></div><div class="field"><label for="policy-select">POLICY</label><select id="policy-select">${run.policies.map(p=>`<option ${p.name===policy.name?'selected':''}>${p.name}</option>`).join('')}</select></div><div class="chart-toggle" role="group" aria-label="Reward display"><button data-mode="chart" aria-pressed="${chartMode==='chart'}">Chart</button><button data-mode="table" aria-pressed="${chartMode==='table'}">Table</button></div></div><div class="chart-meta"><strong>${latest?num(latest.value):'—'}</strong><span>LATEST LOGGED REWARD · ${latest?fmt(latest.step):'—'} STEPS</span></div><div class="chart">${chartMode==='chart'?graph(policy):table}</div><p class="chart-note">${policy.points.length} original scalar samples · no smoothing · ${escapeHTML(research.metric)}.<br>Reward reflects this policy’s training objective. It is not a success rate or a comparison between agents.</p></section>`;
}
function recordsTable() {
  return `<section class="card record-list"><div class="card-head"><h2>Experiment register</h2><span class="eyebrow">${research.runs.length} RECORDED RUNS</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>RUN / LABEL</th><th>LAST CHECKPOINT</th><th>RECORD STATE</th><th>EVIDENCE</th></tr></thead><tbody>${research.runs.map(r=>`<tr><td><strong>${r.id}</strong><small>${r.environment} / descriptive label</small></td><td>${r.policies[0].checkpointSteps===null?'Pending':fmt(r.policies[0].checkpointSteps)+' steps'}<small>${r.policies[0].checkpointAt?date(r.policies[0].checkpointAt):'No saved checkpoint'}</small></td><td><span class="badge neutral">${r.policies.every(p=>p.checkpointSteps>=p.targetSteps)?'TARGET RECORDED':'BELOW TARGET'}</span></td><td><button data-inspect="${r.id}">Inspect ↗</button></td></tr>`).join('')}</tbody></table></div><p class="section-note">“Below target” compares the saved checkpoint with the run’s configured step budget. It does not identify why training ended or whether a process is running now.</p></section>`;
}
function overview(isRuns=false) {
  return heading(isRuns?'Training records':'Research overview',`Evidence updated ${timestamp(research.exportedAt)} · published snapshots refresh automatically`,manifestButton)+(isRuns?'':`<div class="command-banner"><img src="/assets/sentinel-command.jpg" alt="Fictional Sentinel Command research theater"><div class="command-banner-copy"><p>AEGIS DYNAMICS / RESEARCH DIVISION</p><h2>Three agents.<br>One shared mission.</h2><small>Rick navigates. Negan protects. Scout observes.</small></div><span class="image-caption">FACILITY CONCEPT / RECORDED DATA BELOW</span></div>`)+cooperation()+summary()+`<div class="dashboard-grid">${chartPanel()}<aside class="card brief-card"><span class="eyebrow">ATHENA / CONNECTED EVIDENCE</span><img class="athena-mini portrait-mini" src="/assets/athena-executive.jpg" alt="Athena, fictional executive concept"><h2>Observe.<br>Verify. Learn.</h2><p class="eyebrow">${athenaStatus()?'AI BRIEFING MATCHES THIS SNAPSHOT':'AI BRIEFING NOT CURRENTLY AVAILABLE'}</p><blockquote>${athenaStatus()?escapeHTML(athena.findings[0].text):'Verified measurements remain available above. Athena’s AI briefing will appear when the local model successfully processes this snapshot.'}</blockquote><a href="#briefing">Read Athena’s evidence briefing ↗</a></aside></div>`+recordsTable()+`<div class="notice">The site shows the last published snapshot, not a live Unity stream. Automatic updates require the local computer, Codex and connection to be available. Training, scripted demonstrations and saved-model evaluation remain separate.</div><a class="button outline" id="download-data" href="/data/research.json" download="sentinel-research-snapshot.json">Download research snapshot ↓</a>`;
}

function hypotheses() {
  return heading('Questions worth testing','Proposed experiments · no outcomes are claimed')+`<div class="hypothesis-grid"><article class="card hypothesis-card"><span class="eyebrow muted">SENTINEL / H-01</span><h2>Can shared objectives improve team survival?</h2><span class="badge planned">PLANNED / UNTESTED</span><p>The three-role cooperative condition now exists. Next, compare it with a matched baseline that leaves the objective achievable in both conditions.</p><dl><div><dt>Control</dt><dd>Independent PPO policies, current reward design.</dd></div><div><dt>Change</dt><dd>Vary access to helpful team information while keeping achievable objectives, training budgets and evaluation settings matched.</dd></div><div><dt>Measure</dt><dd>Team survival rate, escape rate, and episode duration across multiple held-out seeds.</dd></div><div><dt>Evidence needed</dt><dd>Saved evaluation episodes, policy hashes, scene revision, and uncertainty intervals.</dd></div></dl></article><article class="card hypothesis-card"><span class="eyebrow muted">SENTINEL / H-02</span><h2>Does a learned policy transfer to a new setting?</h2><span class="badge planned">PLANNED / UNTESTED</span><p>The prison and barn offer different situations. A compatible model alone does not establish successful transfer.</p><dl><div><dt>Control</dt><dd>Frozen prison policy evaluated in its original setting.</dd></div><div><dt>Change</dt><dd>Evaluate the same frozen policy in the barn before additional training.</dd></div><div><dt>Measure</dt><dd>Survival and task success under matched episode budgets and documented settings.</dd></div><div><dt>Evidence needed</dt><dd>A clear zero-shot evaluation before any adaptation, plus a separate fine-tuned comparison.</dd></div></dl></article></div><div class="notice">Research design note: Rick and Negan have different reward functions. A larger reward for one policy does not mean it is smarter or more capable than the other.</div>`;
}
function roadmap() {
  const items=[['01','Inspect the evidence','Training curves, Scout’s policy, episode outcomes, agent contributions and source fingerprints.','AVAILABLE NOW','verified'],['02','Connect the mission','Local Unity records feed published snapshots. Training launchers attach run IDs to new episodes.','CONNECTED','verified'],['03','Brief Athena','A local AI model selects findings and the next experiment from verified facts. Every briefing is tied to its source snapshot.','BATCH AI CONNECTED','verified'],['04','Expand the world','Supply Run connects the prison, two routes, a sheltered waystation and the barn. Separate evidence tracks cargo collection and whole-team delivery.','MISSION AVAILABLE','verified'],['05','Establish reliable performance','Train the three role policies and evaluate frozen models across documented seeds.','NEXT EXPERIMENT','planned'],['06','Measure the benefit of cooperation','Use matched conditions with achievable objectives and comparable training budgets. Live conversation, memory and voice remain future work.','PLANNED','planned']];
  return heading('Research roadmap','Progress is defined by inspectable evidence')+`<section class="card">${items.map(x=>`<article class="roadmap-row"><span class="roadmap-number">${x[0]}</span><div><h2>${x[1]}</h2><p>${x[2]}</p></div><span class="badge ${x[4]}">${x[3]}</span></article>`).join('')}</section>`;
}

function briefing() {
  const ready=athenaStatus();
  return heading('Athena’s evidence briefing','Fictional executive · real model connection · findings tied to recorded results',manifestButton)+`<div class="brief-layout"><article class="card executive-brief"><span class="badge ${ready?'verified':'neutral'}">${ready?'AI BRIEFING / CURRENT SNAPSHOT':'AI BRIEFING UNAVAILABLE OR OUTDATED'}</span><h2>What the team<br>actually demonstrated.</h2>${ready?`<p class="section-note">Generated ${timestamp(athena.generatedAt)} · ${escapeHTML(athena.model)}</p><p>${escapeHTML(athena.method)}</p><h3>Findings and required evidence context</h3><ol class="athena-findings">${athena.findings.map(f=>`<li>${escapeHTML(f.text)}<small>Evidence: ${escapeHTML(f.id)}</small></li>`).join('')}</ol><h3>Next experiment</h3><p>${escapeHTML(athena.nextExperiment)}</p><p class="section-note">Source snapshot: <code>${research.snapshotHash.slice(0,16)}</code>. Findings are constrained to the verified evidence catalog, so the model cannot change recorded numbers.</p>`:`<p>No current AI-generated briefing is available. The cooperation panel and training records still show verified measurements. The connection will retry Athena when the local model is available.</p>`}<h3>Evidence available to Athena</h3><p>Early Rick, prison, barn and Sentinel training records; role-specific checkpoints; mission success and failure; Scout’s report, Rick’s route and Negan’s threat response; supply pickup, delivery, whole-team return and injuries; survival, timing and movement; environment settings and model fingerprints. Scripted and training results are labeled separately.</p><a class="text-link" href="/data/athena.json" download="athena-briefing.json">Download briefing and source reference ↓</a></article><aside class="card notes-card"><h2>Research notebook</h2><p>Notes are saved only in this browser. They are not sent to Athena or published.</p><label for="research-notes">YOUR SESSION NOTES</label><textarea id="research-notes" placeholder="What should we measure next?"></textarea><div id="notes-status" class="notes-status" role="status"></div><button class="button outline" id="download-notes">Download notes ↓</button><dl><div><dt>Athena’s current role</dt><dd>Select important findings and a next experiment from the latest evidence.</dd></div><div><dt>Future capabilities</dt><dd>Live conversation, long-term research memory and interactive voice.</dd></div></dl></aside></div>`;
}

function download(content, filename, type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function evidence(id=selectedRun) {
  const run=research.runs.find(r=>r.id===id);$('#dialog-title').textContent=`Evidence / ${run.id}`;
  $('#evidence-body').innerHTML=`<p>Read-only snapshot exported ${date(research.exportedAt)}. Original files stay in the local training results folder. SHA-256 fingerprints identify the files read for this export.</p><p>Environment attribution: ${run.environmentEvidence}</p><p><a class="source-link" href="${research.sourceRepository}/tree/${research.sourceCommit}" target="_blank" rel="noopener">Inspect the public source revision ↗</a><br>The local Unity checkout has additional uncommitted work, including the barn scene. The source revision is context, not a claimed exact reproduction of every run.</p><h3>Policy records</h3>${run.policies.map(p=>`<p><strong>${p.name}</strong> · ${p.algorithm} · ${fmt(p.checkpointSteps)} checkpoint steps / ${fmt(p.targetSteps)} target · ${p.points.length} reward samples · ONNX export ${p.modelExportPresent?'present':'not found'}.</p>`).join('')}<h3>Source manifest</h3>${run.sources.map(s=>`<div class="source-entry"><strong>${escapeHTML(s.path)}</strong><code>SHA-256 ${s.sha256}</code></div>`).join('')}<h3>Interpretation limits</h3><p>The checkpoint summary reward and the latest TensorBoard scalar can differ because they summarize different moments. New Sentinel outcomes appear in the cooperation panel with separate training, demonstration and evaluation categories. No controlled improvement or multi-seed uncertainty is claimed. No raw model weights or private notes are published.</p>`;
  $('#evidence-dialog').showModal();
}
function wire() {
  $$('[data-evidence]').forEach(b=>b.addEventListener('click',()=>evidence()));
  $$('[data-inspect]').forEach(b=>b.addEventListener('click',()=>evidence(b.dataset.inspect)));
  for (const [selector,key] of [['#run-select','run'],['#policy-select','policy']]) {
    $(selector)?.addEventListener('change',e=>{if(key==='run')selectedRun=e.target.value;else selectedPolicy=e.target.value;renderContent();$(selector)?.focus();});
  }
  $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{chartMode=b.dataset.mode;renderContent();$(`[data-mode="${chartMode}"]`)?.focus();}));
  $$('[data-evidence-mode]').forEach(b=>b.addEventListener('click',()=>{selectedMode=b.dataset.evidenceMode;selectedGroup='';renderContent();$(`[data-evidence-mode="${selectedMode}"]`)?.focus();}));
  $$('[data-mission]').forEach(b=>b.addEventListener('click',()=>{selectedMission=b.dataset.mission;selectedGroup='';selectedRun='';selectedPolicy='';renderContent();$(`[data-mission="${selectedMission}"]`)?.focus();}));
  $('#episode-group')?.addEventListener('change',e=>{selectedGroup=e.target.value;renderContent();$('#episode-group')?.focus();});
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
async function refreshEvidence() {
  try {
    const response=await fetch('/data/research.json?t='+Date.now(),{cache:'no-store'});
    if(!response.ok) throw new Error('Snapshot unavailable');
    const data=await response.json();
    if(data.schemaVersion!==2||!Array.isArray(data.runs)||!data.runs.length||data.runs.some(r=>!r.policies?.length)) throw new Error('Unsupported snapshot');
    let brief=null;
    try {const r=await fetch('/data/athena.json?t='+Date.now(),{cache:'no-store'});if(r.ok)brief=await r.json();} catch {}
    const changed=research?.snapshotHash!==data.snapshotHash || athena?.generatedAt!==brief?.generatedAt || loadError;
    research=data;athena=brief;loadError=false;
    $('#connection-status').textContent='CONNECTED SNAPSHOTS · '+timestamp(data.exportedAt);
    if(changed && document.activeElement?.id!=='research-notes') renderContent();
  } catch {
    if(!research){loadError=true;renderContent();}
    $('#connection-status').textContent=research?'REFRESH UNAVAILABLE · SHOWING LAST LOADED SNAPSHOT':'EVIDENCE CONNECTION UNAVAILABLE';
  }
}
refreshEvidence();
setInterval(refreshEvidence,60000);
