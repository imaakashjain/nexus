// ===== CONFIG =====
const SUPERSET = 'https://superset.cc-tooling.cctools.capillarytech.com';
const DS = { id: 11, type: 'table' };

const ENV = {
  prod:    { label:'Production', cls:'prod',    clusters:['seacrm','Eucrm','incrm','Seacrm','sgcrm','Tatacrm','Uscrm','Ushc_Crm'] },
  staging: { label:'Staging',    cls:'staging',  clusters:['Crm_Staging_New'] },
  nightly: { label:'Nightly',    cls:'nightly',  clusters:['Nightly_Cc'] }
};

const MODS = [
  { id:'loyaltyUI',     label:'Loyalty UI',      cat:'Loyalty',   type:'UI'   },
  { id:'loyaltynode',    label:'Loyalty Node',    cat:'Loyalty',   type:'Node' },
  { id:'couponsUI',      label:'Coupons UI',      cat:'Coupon',    type:'UI'   },
  { id:'couponnode',     label:'Coupon Node',     cat:'Coupon',    type:'Node' },
  { id:'badgesUI',       label:'Badges UI',       cat:'Badges',    type:'UI'   },
  { id:'tesseractUI',    label:'Tesseract UI',    cat:'Tesseract', type:'UI'   },
  { id:'garudaUIUI',     label:'Garuda UI',       cat:'Garuda',    type:'UI'   },
  { id:'incentivesnode', label:'Incentives Node', cat:'Incentive', type:'Node' },
];
const MOD_IDS = MODS.map(m => m.id);
const CATS = ['Loyalty','Coupon','Badges','Tesseract','Garuda','Incentive'];
const TARGETS = { Loyalty:99, Coupon:100, Badges:100, Tesseract:99, Garuda:99, Incentive:100 };

// ===== STATE =====
let okrData = null, dataTabData = {}, curDataEnv = 'prod', chartInst = {}, weeklyTrends = {}, moduleNotes = {};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initMainTabs();
  initOkrDates();
  initDataTab();
  initMonthlyTab();
  document.getElementById('fetchOkrBtn').addEventListener('click', fetchOkr);
  document.getElementById('genPptxBtn').addEventListener('click', generatePptx);
});

function initMainTabs() {
  document.querySelectorAll('.main-tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.main-tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  }));
}

// ===== QUARTER LOGIC =====
// Fiscal quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
function getQuarterStart(date) {
  const m = date.getMonth(), y = date.getFullYear();
  if (m >= 3 && m <= 5) return new Date(y, 3, 1);  // Apr-Jun → Apr 1
  if (m >= 6 && m <= 8) return new Date(y, 6, 1);  // Jul-Sep → Jul 1
  if (m >= 9 && m <= 11) return new Date(y, 9, 1); // Oct-Dec → Oct 1
  return new Date(y, 0, 1);                          // Jan-Mar → Jan 1
}

// ===== OKR DATE LOGIC (Wed→Tue) =====
function getOkrWeek() {
  const now = new Date();
  const d = now.getDay();
  const sinceWed = d >= 3 ? d - 3 : d + 4;
  const wedStart = new Date(now);
  wedStart.setDate(now.getDate() - sinceWed);
  wedStart.setHours(0,0,0,0);
  const tueEnd = new Date(wedStart);
  tueEnd.setDate(wedStart.getDate() + 6);
  return { start: wedStart, end: tueEnd };
}

function initOkrDates() {
  const wk = getOkrWeek();
  document.getElementById('okrWeekStart').value = fmt(wk.start);
  document.getElementById('okrWeekEnd').value = fmt(wk.end);
  updateOkrInfo();
  document.getElementById('okrWeekStart').addEventListener('change', updateOkrInfo);
}

function updateOkrInfo() {
  const ws = document.getElementById('okrWeekStart').value;
  if (!ws) return;
  const start = new Date(ws);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  document.getElementById('okrWeekEnd').value = fmt(end);
  const qStart = getQuarterStart(start);
  const apiEnd = new Date(end); apiEnd.setDate(end.getDate() + 1);
  document.getElementById('okrDateInfo').innerHTML =
    `<strong>Current Week:</strong> ${fmtD(start)} 12:00 AM → ${fmtD(end)} 11:59 PM<br>` +
    `<strong>Overall (Quarter):</strong> ${fmtD(qStart)} → ${fmtD(end)}<br>` +
    `<span style="font-size:10px;color:#adb5bd">Quarter started ${fmtD(qStart)} | API end date (exclusive): ${fmtD(apiEnd)}</span>`;
}

function fmt(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtD(d) { return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }

// ===== SUPERSET API =====
function buildStabPayload(timeRange, moduleIds, clusters) {
  return JSON.stringify({
    datasource:DS, force:false,
    queries:[{time_range:timeRange, granularity:'start_time',
      filters:[{col:'abortedby',op:'IS NULL'},{col:'module',op:'IN',val:moduleIds},{col:'environment',op:'IN',val:clusters}],
      extras:{where:"(session_name like '%Smoke%' or session_name like '%Sanity%')",having:"(ROUND((SUM(pass)/sum(pass+fail))*100, 2) IS NOT NULL)"},
      columns:['module'],
      metrics:[
        {expressionType:'SQL',hasCustomLabel:true,label:'Pass%',sqlExpression:"ROUND(SUM(case when (fail = 0 and pass > 0) then 1 else 0 end)/SUM(case when pass + fail > 0 then 1 else 0 end)*100,2)"},
        {expressionType:'SQL',hasCustomLabel:true,label:'Fail%',sqlExpression:"ROUND(SUM(case when fail > 0 then 1 else 0 end)/SUM(case when pass + fail > 0 then 1 else 0 end)*100,2)"}
      ],
      orderby:[[{expressionType:'SQL',label:'Pass%',sqlExpression:"ROUND(SUM(case when (fail = 0 and pass > 0) then 1 else 0 end)/SUM(case when pass + fail > 0 then 1 else 0 end)*100,2)"},false]],
      row_limit:50000
    }],result_format:'json',result_type:'full'
  });
}

function buildTrendsPayload(timeRange, moduleIds, clusters) {
  return JSON.stringify({
    datasource:DS, force:false,
    queries:[{time_range:timeRange, granularity:'start_time', time_grain_sqla:'P1D', is_timeseries:true,
      filters:[{col:'abortedby',op:'IS NULL'},{col:'module',op:'IN',val:moduleIds},{col:'environment',op:'IN',val:clusters}],
      extras:{time_grain_sqla:'P1D',where:"(run_id not like '%Regression%') AND (run_id not like '%Lighthouse%') AND ((run_id not like '%Eucrm%2024-07-18_06%' or run_id not like '%Eucrm%2024-07-18_07%')) AND ((run_id not like '%Uscrm%2024-07-22_12%' or run_id not like '%Uscrm%2024-07-22_13%')) AND ((run_id not like '%Incrm%2024-07-24_00%' or run_id not like '%Incrm%2024-07-23_01%'))"},
      columns:[],
      metrics:[
        {expressionType:'SQL',hasCustomLabel:true,label:'PassCount',sqlExpression:'SUM(pass)'},
        {expressionType:'SQL',hasCustomLabel:true,label:'FailCount',sqlExpression:'SUM(fail)'}
      ],
      orderby:[[{expressionType:'SQL',label:'start_time',sqlExpression:'start_time'},true]],row_limit:50000
    }],result_format:'json',result_type:'full'
  });
}

function buildFailedRunsPayload(timeRange, moduleIds, clusters) {
  const where="(fail > 0) AND (run_id not like '%Regression%') AND (run_id not like '%Lighthouse%') AND ((run_id not like '%Eucrm%2024-07-18_06%' or run_id not like '%Eucrm%2024-07-18_07%')) AND ((run_id not like '%Uscrm%2024-07-22_12%' or run_id not like '%Uscrm%2024-07-22_13%')) AND ((run_id not like '%Incrm%2024-07-24_00%' or run_id not like '%Incrm%2024-07-23_01%'))";
  return JSON.stringify({
    datasource:DS, force:false,
    queries:[{
      time_range:timeRange, granularity:'start_time', is_timeseries:false,
      groupby:['id','run_id','start_time'],
      metrics:[
        {expressionType:'SQL',hasCustomLabel:true,label:'fail',sqlExpression:'SUM(fail)'},
        {expressionType:'SQL',hasCustomLabel:true,label:'total',sqlExpression:'SUM(total)'}
      ],
      filters:[
        {col:'abortedby',op:'IS NULL'},
        {col:'module',op:'IN',val:moduleIds},
        {col:'environment',op:'IN',val:clusters}
      ],
      extras:{where},
      orderby:[[{expressionType:'SQL',label:'start_time',sqlExpression:'start_time'},false]],
      row_limit:200
    }],result_format:'json',result_type:'full'
  });
}

function mkScript(payloadJson) {
  return `(async()=>{try{const c=await fetch('/api/v1/security/csrf_token/',{headers:{'Content-Type':'application/json'}});const csrf=(await c.json()).result;const r=await fetch('/api/v1/chart/data',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:'${payloadJson.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}'});const d=await r.json();if(d.errors)return JSON.stringify({error:d.errors[0]?.message||'API error'});return JSON.stringify(d.result?.[0]?.data||[])}catch(e){return JSON.stringify({error:e.message})}})();`;
}

async function runInSuperset(script) {
  const [tab] = await chrome.tabs.query({ url: SUPERSET + '/*' });
  if (!tab) throw new Error('Open Superset in a tab and login first (Google SSO)');
  const res = await chrome.scripting.executeScript({target:{tabId:tab.id},func:c=>eval(c),args:[script],world:'MAIN'});
  const raw = res[0]?.result;
  if (!raw) throw new Error('No response from Superset');
  const data = typeof raw==='string' ? JSON.parse(raw) : raw;
  if (data.error) throw new Error(data.error);
  return data;
}

// ===== OKR FETCH =====
async function fetchOkr() {
  const ws = document.getElementById('okrWeekStart').value;
  const we = document.getElementById('okrWeekEnd').value;
  if (!ws||!we) return setStatus('okrStatus','error','Set dates');

  const weekEndExcl = new Date(we); weekEndExcl.setDate(weekEndExcl.getDate()+1);
  const weekRange = `${ws} : ${fmt(weekEndExcl)}`;
  const qStart = getQuarterStart(new Date(ws));
  const overallRange = `${fmt(qStart)} : ${fmt(weekEndExcl)}`;

  const btn = document.getElementById('fetchOkrBtn');
  btn.disabled=true; btn.textContent='Fetching...';

  const results = {};
  try {
    for (const envKey of ['prod','staging','nightly']) {
      const cls = ENV[envKey].clusters;
      setStatus('okrStatus','loading',`Fetching ${ENV[envKey].label} current week...`);
      results[envKey] = { current: await runInSuperset(mkScript(buildStabPayload(weekRange,MOD_IDS,cls))) };
      setStatus('okrStatus','loading',`Fetching ${ENV[envKey].label} overall (quarter)...`);
      results[envKey].overall = await runInSuperset(mkScript(buildStabPayload(overallRange,MOD_IDS,cls)));
    }
    okrData = { results, weekStart:ws, weekEnd:we, qStart:fmt(qStart) };
    renderOkr();
    setStatus('okrStatus','success',`OKR data fetched: Week ${ws} to ${we} | Overall from ${fmt(qStart)}`);
    document.getElementById('genPptxBtn').disabled = false;
  } catch(e) { setStatus('okrStatus','error',e.message); }
  finally { btn.disabled=false; btn.textContent='Fetch OKR Data'; }
}

// ===== OKR RENDER =====
function renderOkr() {
  if (!okrData) return;
  const { results } = okrData;
  const area = document.getElementById('okrResults');

  const getP = (envData,modId) => { const r=envData?.find(d=>d.module===modId); return r?r['Pass%']:null; };
  const fmtP = v => v===null ? '<span class="dim">—</span>' : v>=100 ? `<span class="g">${v}%</span>` : v>=95 ? `<span class="y">${v}%</span>` : `<span class="r">${v}%</span>`;

  let html = '';

  // Prod + Staging table
  html += `<div class="okr-section">
    <div class="okr-section-title"><span class="env-badge prod">PROD</span> <span class="env-badge staging">STAGING</span> Automation Stability</div>
    <table><thead><tr><th style="width:35%">Metric (Target)</th><th>Current Week</th><th>Overall (Quarter)</th></tr></thead><tbody>`;

  for (const cat of CATS) {
    const mods = MODS.filter(m=>m.cat===cat);
    for (const envKey of ['prod','staging']) {
      const lbl = envKey==='prod'?'Production':'Staging';
      const tgt = TARGETS[cat]||99;
      const cwParts = mods.map(m=>`${m.type}: ${fmtP(getP(results[envKey].current,m.id))}`).join(' &nbsp;|&nbsp; ');
      const ovParts = mods.map(m=>`${m.type}: ${fmtP(getP(results[envKey].overall,m.id))}`).join(' &nbsp;|&nbsp; ');
      html += `<tr><td><strong>${cat} ${lbl}</strong> (${tgt}%)</td><td>${cwParts}</td><td>${ovParts}</td></tr>`;
    }
  }
  html += '</tbody></table></div>';

  // Nightly table
  html += `<div class="okr-section">
    <div class="okr-section-title"><span class="env-badge nightly">NIGHTLY</span> Week Numbers</div>
    <table><thead><tr><th>Module</th><th>Current Week %</th><th>Overall (Quarter) %</th></tr></thead><tbody>`;

  for (const m of MODS) {
    html += `<tr><td>${m.label}</td><td>${fmtP(getP(results.nightly.current,m.id))}</td><td>${fmtP(getP(results.nightly.overall,m.id))}</td></tr>`;
  }
  html += '</tbody></table></div>';
  area.innerHTML = html;
}

// ===== PPTX GENERATION =====
function generatePptx() {
  if (!okrData || typeof PptxGenJS === 'undefined') {
    setStatus('okrStatus','error','PptxGenJS not loaded or no data. Try again.');
    return;
  }
  const { results, weekStart, weekEnd, qStart } = okrData;
  const getP = (envData,modId) => { const r=envData?.find(d=>d.module===modId); return r?r['Pass%']:null; };
  const fmtVal = v => v===null?'—':v+'%';

  const pres = new PptxGenJS();
  pres.defineLayout({name:'WIDE',width:13.33,height:7.5});
  pres.layout='WIDE';

  // Color palette
  const BG='FFFFFF', INK='1A1A2E', ACCENT='4361EE', GRAY='6C757D';
  const GREEN='1D9E75', GREEN_BG='D4EDDA', AMBER='B45309', AMBER_BG='FFF3CD', RED='DC2626', RED_BG='FEE2E2';

  const statusColor = (val, target) => {
    if (val===null) return {color:GRAY,fill:{color:'F9FAFB'}};
    if (val>=target) return {color:GREEN,fill:{color:GREEN_BG}};
    if (val>=target-5) return {color:AMBER,fill:{color:AMBER_BG}};
    return {color:RED,fill:{color:RED_BG}};
  };

  const hdr = {fontSize:9,bold:true,color:'FFFFFF',fill:{color:'1A1A2E'},border:[{pt:.5,color:'374151'}],align:'center',valign:'middle'};
  const metricCell = {fontSize:9,color:INK,border:[{pt:.5,color:'E5E7EB'}],valign:'middle',bold:true};
  const dataCell = (val,tgt) => ({fontSize:9,border:[{pt:.5,color:'E5E7EB'}],valign:'middle',align:'center',bold:true,...statusColor(val,tgt)});
  const commentCell = {fontSize:8,color:GRAY,border:[{pt:.5,color:'E5E7EB'}],valign:'middle',italic:true};

  const dateLabel = `${fmtD(new Date(weekStart))} → ${fmtD(new Date(weekEnd))}`;
  const qLabel = fmtD(new Date(qStart));

  // ===== SLIDE 1: Production Stability =====
  const s1 = pres.addSlide();
  s1.addText('UI Weekly Update',{x:.5,y:.25,w:8,h:.35,fontSize:18,bold:true,color:INK});
  s1.addText(`Week: ${dateLabel}  |  Overall from: ${qLabel}`,{x:.5,y:.65,w:10,h:.25,fontSize:10,color:GRAY});
  s1.addShape(pres.ShapeType.rect,{x:.5,y:.95,w:12.33,h:.03,fill:{color:ACCENT}});

  const rows1 = [[
    {text:'METRIC',options:{...hdr,align:'left'}},
    {text:'CURRENT WEEK',options:hdr},
    {text:'OVERALL (QTR)',options:hdr},
    {text:'COMMENT / ACTION ITEMS',options:hdr}
  ]];
  for (const cat of CATS) {
    const mods=MODS.filter(m=>m.cat===cat);
    const tgt=TARGETS[cat]||99;
    // Production row
    const cwVals=mods.map(m=>getP(results.prod.current,m.id));
    const ovVals=mods.map(m=>getP(results.prod.overall,m.id));
    const cwText=mods.map((m,i)=>`${m.type}: ${fmtVal(cwVals[i])}`).join('  |  ');
    const ovText=mods.map((m,i)=>`${m.type}: ${fmtVal(ovVals[i])}`).join('  |  ');
    const worstCw=cwVals.filter(v=>v!==null).length?Math.min(...cwVals.filter(v=>v!==null)):null;
    const worstOv=ovVals.filter(v=>v!==null).length?Math.min(...ovVals.filter(v=>v!==null)):null;
    rows1.push([
      {text:`${cat} Production (${tgt}%)`,options:metricCell},
      {text:cwText,options:dataCell(worstCw,tgt)},
      {text:ovText,options:dataCell(worstOv,tgt)},
      {text:'',options:commentCell}
    ]);
    // Staging row
    const cwS=mods.map(m=>getP(results.staging.current,m.id));
    const ovS=mods.map(m=>getP(results.staging.overall,m.id));
    const cwSText=mods.map((m,i)=>`${m.type}: ${fmtVal(cwS[i])}`).join('  |  ');
    const ovSText=mods.map((m,i)=>`${m.type}: ${fmtVal(ovS[i])}`).join('  |  ');
    const worstCwS=cwS.filter(v=>v!==null).length?Math.min(...cwS.filter(v=>v!==null)):null;
    const worstOvS=ovS.filter(v=>v!==null).length?Math.min(...ovS.filter(v=>v!==null)):null;
    rows1.push([
      {text:`${cat} Staging (${tgt}%)`,options:{...metricCell,color:GRAY}},
      {text:cwSText,options:dataCell(worstCwS,tgt)},
      {text:ovSText,options:dataCell(worstOvS,tgt)},
      {text:'',options:commentCell}
    ]);
  }
  s1.addTable(rows1,{x:.5,y:1.1,w:12.33,colW:[3.2,2.4,2.4,4.33],rowH:.42,autoPage:true,autoPageRepeatHeader:true});

  // ===== SLIDE 2: Nightly =====
  const s2 = pres.addSlide();
  s2.addText('Nightly Week Numbers',{x:.5,y:.25,w:8,h:.35,fontSize:18,bold:true,color:INK});
  s2.addText(`Week: ${dateLabel}  |  Overall from: ${qLabel}`,{x:.5,y:.65,w:10,h:.25,fontSize:10,color:GRAY});
  s2.addShape(pres.ShapeType.rect,{x:.5,y:.95,w:12.33,h:.03,fill:{color:'8B5CF6'}});

  const rows2 = [[
    {text:'MODULE',options:{...hdr,align:'left'}},
    {text:'CURRENT WEEK %',options:hdr},
    {text:'OVERALL (QTR) %',options:hdr},
    {text:'COMMENTS',options:hdr}
  ]];
  for (const m of MODS) {
    const cwV=getP(results.nightly.current,m.id);
    const ovV=getP(results.nightly.overall,m.id);
    rows2.push([
      {text:m.label,options:metricCell},
      {text:fmtVal(cwV),options:dataCell(cwV,90)},
      {text:fmtVal(ovV),options:dataCell(ovV,90)},
      {text:'',options:commentCell}
    ]);
  }
  s2.addTable(rows2,{x:.5,y:1.1,w:12.33,colW:[2.8,2.2,2.2,5.13],rowH:.45});

  pres.writeFile({fileName:`weekly-cadence-${weekStart}-to-${weekEnd}.pptx`});
  setStatus('okrStatus','success','PPTX downloaded!');
}

// ===== DATA TAB =====
function initDataTab() {
  const grid=document.getElementById('modulesGrid');
  MODS.forEach(m=>{
    const c=document.createElement('div');c.className='module-chip selected';c.dataset.id=m.id;
    c.innerHTML=`<span class="chip-dot"></span><span>${m.label}</span><input type="checkbox" checked>`;
    c.addEventListener('click',()=>c.classList.toggle('selected'));
    grid.appendChild(c);
  });
  setDataQuickDate('lastWeek');
  document.querySelectorAll('.env-tab').forEach(t=>t.addEventListener('click',()=>{
    document.querySelectorAll('.env-tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active'); curDataEnv=t.dataset.env;
    if(dataTabData[curDataEnv]) renderDataTab(curDataEnv);
    else document.getElementById('dataResults').style.display='none';
  }));
  document.getElementById('fetchBtn').addEventListener('click',fetchDataTab);
  document.getElementById('downloadBtn').addEventListener('click',generateWeeklyPptx);
  document.getElementById('thisWeek').addEventListener('click',()=>setDataQuickDate('thisWeek'));
  document.getElementById('lastWeek').addEventListener('click',()=>setDataQuickDate('lastWeek'));
  document.getElementById('last7').addEventListener('click',()=>setDataQuickDate('last7'));
}

function setDataQuickDate(type) {
  const now=new Date(); let s,e;
  // Use (day+6)%7 to get correct Monday offset even on Sunday
  const monOffset=(now.getDay()+6)%7; // 0=Mon,1=Tue,...,6=Sun
  const thisMon=new Date(now); thisMon.setDate(now.getDate()-monOffset);
  if(type==='thisWeek'){
    s=new Date(thisMon); e=new Date(now); // Mon → today (inclusive)
  } else if(type==='lastWeek'){
    e=new Date(thisMon); e.setDate(thisMon.getDate()-1); // prev Sunday (inclusive)
    s=new Date(e); s.setDate(e.getDate()-6); // prev Monday
  } else { // last7: 7 days ending today
    s=new Date(now); s.setDate(now.getDate()-6); e=new Date(now);
  }
  document.getElementById('startDate').value=fmt(s);
  document.getElementById('endDate').value=fmt(e);
}

async function fetchDataTab() {
  const sd=document.getElementById('startDate').value,ed=document.getElementById('endDate').value;
  if(!sd||!ed) return setStatus('dataStatus','error','Set dates');
  const mods=[...document.querySelectorAll('.module-chip.selected')].map(c=>c.dataset.id);
  if(!mods.length) return setStatus('dataStatus','error','Select modules');
  // ed is inclusive; add 1 day to get the exclusive API end Superset expects
  const edDate=new Date(ed+'T00:00:00'); edDate.setDate(edDate.getDate()+1);
  const tr=`${sd} : ${fmt(edDate)}`,cls=ENV[curDataEnv].clusters;
  const btn=document.getElementById('fetchBtn');btn.disabled=true;btn.textContent='Fetching...';
  try{
    setStatus('dataStatus','loading',`Fetching ${ENV[curDataEnv].label}...`);
    const stab=await runInSuperset(mkScript(buildStabPayload(tr,mods,cls)));
    dataTabData[curDataEnv]={stability:stab,modules:mods,timeRange:tr,sd,ed};
    renderDataTab(curDataEnv);
    setStatus('dataStatus','success',`${ENV[curDataEnv].label} data fetched`);
    document.getElementById('downloadBtn').disabled=false;
  }catch(e){setStatus('dataStatus','error',e.message)}
  finally{btn.disabled=false;btn.textContent='Fetch Data'}
}

function renderDataTab(envKey) {
  const d=dataTabData[envKey];if(!d) return;
  document.getElementById('dataResults').style.display='block';
  const env=ENV[envKey];
  document.getElementById('dataEnvLabel').innerHTML=`<span class="env-badge ${env.cls}">${env.label}</span>`;
  document.getElementById('dataClusters').innerHTML='Clusters: '+env.clusters.map(c=>`<code>${c}</code>`).join(' ');
  const cats={};
  d.modules.forEach(modId=>{const m=MODS.find(x=>x.id===modId);const s=d.stability.find(x=>x.module===modId);if(!m)return;if(!cats[m.cat])cats[m.cat]={};cats[m.cat][m.type]=s?s['Pass%']:'N/A'});
  let sh='';
  Object.entries(cats).forEach(([cat,vals])=>{
    const tgt=TARGETS[cat]||99;let parts=[];
    if(vals.UI!==undefined){const f=vals.UI!=='N/A'&&vals.UI<tgt?`<span class="ff">⚠ below ${tgt}%</span>`:'';parts.push(`UI: <span class="g">${vals.UI}%</span>${f}`)}
    if(vals.Node!==undefined){const f=vals.Node!=='N/A'&&vals.Node<tgt?`<span class="ff">⚠ below ${tgt}%</span>`:'';parts.push(`Node: <span class="g">${vals.Node}%</span>${f}`)}
    sh+=`<div class="ml"><span class="mn">${cat}:</span><span>${parts.join(' | ')}</span></div>`;
  });
  document.getElementById('dataSlide').innerHTML=sh;
  let tb='';
  d.modules.forEach(modId=>{const m=MODS.find(x=>x.id===modId);const s=d.stability.find(x=>x.module===modId);
    tb+=`<tr><td>${m?m.label:modId}</td><td class="g">${s?s['Pass%']+'%':'-'}</td><td class="r">${s?s['Fail%']+'%':'-'}</td></tr>`});
  document.getElementById('dataBody').innerHTML=tb;
  // Charts
  const ca=document.getElementById('dataCharts');ca.innerHTML='';
  Object.values(chartInst).forEach(c=>c.destroy());chartInst={};weeklyTrends={};moduleNotes={};
  fetchModCharts(d.modules,d.timeRange,envKey);
}

async function fetchModCharts(modules,timeRange,envKey) {
  const area=document.getElementById('dataCharts'),cls=ENV[envKey].clusters;
  const dlBtn=document.getElementById('downloadBtn'); dlBtn.disabled=true;
  area.innerHTML=`<div class="pptx-note">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#4361ee" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5.5" rx=".75" fill="#4361ee"/><circle cx="8" cy="4.75" r=".85" fill="#4361ee"/></svg>
    Loading trend data — full charts will be in the <strong>PPTX</strong>…
  </div><div id="modCards"></div>`;
  const cardsEl=document.getElementById('modCards');

  for(const modId of modules){
    const m=MODS.find(x=>x.id===modId),label=m?m.label:modId;
    const card=document.createElement('div'); card.className='mod-card';
    card.innerHTML=`<div class="mod-card-row"><span class="mod-card-name">${label}</span><span class="mod-card-loading">loading…</span></div>`;
    cardsEl.appendChild(card);
    const row=card.querySelector('.mod-card-row');

    try{
      const td=await runInSuperset(mkScript(buildTrendsPayload(timeRange,[modId],cls)));
      const labels=td.map(r=>new Date(r.__timestamp).getDate().toString());
      const fullDates=td.map(r=>{const d=new Date(r.__timestamp);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`});
      const pass=td.map(r=>r.PassCount||0),fail=td.map(r=>r.FailCount||0);
      weeklyTrends[modId]={labels,pass,fail,fullDates};

      if(!td.length){
        row.querySelector('.mod-card-loading').textContent='No trend data in range';
      } else {
        const totals=pass.map((p,i)=>(p||0)+(fail[i]||0));
        const failSum=fail.reduce((a,b)=>a+(Number(b)||0),0);
        const runStr=runsRange(Math.min(...totals),Math.max(...totals));
        const stab=dataTabData[envKey]?.stability?.find(x=>x.module===modId);
        const passPct=stab&&stab['Pass%']!=null?stab['Pass%']:null;
        const tgt=m?TARGETS[m.cat]||99:99;
        const passHtml=passPct==null?`<span class="dim">—</span>`:passPct>=tgt?`<span class="g">${passPct}%</span>`:`<span class="r">${passPct}%</span>`;

        if(failSum===0){
          row.querySelector('.mod-card-loading').outerHTML=
            `<span class="mod-card-sep">|</span><span class="mod-card-stat">Pass: ${passHtml}</span><span class="mod-card-sep">|</span><span class="mod-card-stat">Runs: <strong>${runStr}</strong></span><span class="mod-card-sep">|</span><span class="mod-card-stat g">✓ No callouts</span>`;
        } else {
          const failDates=fullDates.filter((_,i)=>(fail[i]||0)>0).join(', ');
          row.querySelector('.mod-card-loading').outerHTML=
            `<span class="mod-card-sep">|</span><span class="mod-card-stat">Pass: ${passHtml}</span><span class="mod-card-sep">|</span><span class="mod-card-stat">Runs: <strong>${runStr}</strong></span><span class="mod-card-sep">|</span><span class="mod-card-stat r">⚠ Failures on Dates: ${failDates}</span>`;

          const failWrap=document.createElement('div'); failWrap.className='fail-runs-wrap';
          failWrap.innerHTML='<div class="mod-card-loading" style="font-size:10px">Loading failed run details…</div>';
          card.appendChild(failWrap);

          try{
            const fr=await runInSuperset(mkScript(buildFailedRunsPayload(timeRange,[modId],cls)));
            weeklyTrends[modId].failedRuns=fr;
            let html='<ul class="fail-runs-list">';
            fr.forEach(r=>{
              const url=r.id?`https://apitester.capillary.in/apitest_app/result.html?resultId=${r.id}`:null;
              const ds=r.start_time?(typeof r.start_time==='number'?fmt(new Date(r.start_time)):String(r.start_time).substring(0,10)):'—';
              const passCount=Number(r.total)-Number(r.fail);
              html+=`<li class="fail-run-row"><span class="fail-date">${ds}</span><span class="fail-total">Total: ${r.total}</span><span class="fail-pass">Pass: ${passCount}</span><span class="fail-fail">Fail: ${r.fail}</span>${url?`<a class="fail-run-id" href="${url}" target="_blank">${r.run_id}</a>`:`<span class="fail-run-id" style="color:#495057">${r.run_id}</span>`}</li>`;
            });
            html+='</ul>';
            failWrap.innerHTML=html;
          }catch(e2){
            weeklyTrends[modId].failedRuns=[];
            failWrap.innerHTML=`<div class="r" style="font-size:10px;margin-top:4px">Could not load run details: ${e2.message}</div>`;
          }
        }
      }
    }catch(e){
      row.querySelector('.mod-card-loading').innerHTML=`<span class="r">${e.message}</span>`;
    }
  }

  document.querySelector('.pptx-note').innerHTML=`
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#4361ee" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5.5" rx=".75" fill="#4361ee"/><circle cx="8" cy="4.75" r=".85" fill="#4361ee"/></svg>
    Data loaded. Click <strong>📥 Download PPTX</strong> — slides include trend charts, run counts, failure details with links, and your notes.`;
  dlBtn.disabled=false;
}

function dlChart(modId){const ch=chartInst[modId];if(!ch)return;const a=document.createElement('a');a.download=`${curDataEnv}_${modId}.png`;a.href=ch.toBase64Image('image/png',1);a.click()}

// ===== SUPERSET-STYLE CHART (matches Superset UI line chart) =====
const C_PASS='#2E9E3F', C_FAIL='#E23B2E';

function fmtK(v){v=Math.round(Number(v)||0);return v>=1000?Math.round(v/1000)+'k':''+v;}

function valueLabelPlugin(fontSize){
  return {id:'valueLabels',afterDatasetsDraw(chart){
    const ctx=chart.ctx;
    chart.data.datasets.forEach((ds,i)=>{
      const meta=chart.getDatasetMeta(i); if(meta.hidden) return;
      meta.data.forEach((pt,j)=>{
        ctx.save();
        ctx.font='600 '+fontSize+"px -apple-system,'Segoe UI',sans-serif";
        ctx.fillStyle=ds.borderColor; ctx.textAlign='center'; ctx.textBaseline='bottom';
        ctx.fillText(fmtK(ds.data[j]),pt.x,pt.y-6);
        ctx.restore();
      });
    });
  }};
}

function supersetChartConfig(labels,pass,fail,opts){
  opts=opts||{}; const big=!!opts.export;
  const fs=big?18:9, lblFs=big?17:9, ptR=big?5:3, lw=big?3:2;
  const mk=(label,data,color)=>({label,data,borderColor:color,backgroundColor:color,
    pointBackgroundColor:'#fff',pointBorderColor:color,pointBorderWidth:lw,pointRadius:ptR,
    pointHoverRadius:ptR+1,borderWidth:lw,tension:0,fill:false});
  return {
    type:'line',
    data:{labels,datasets:[ mk('FailCount',fail,C_FAIL), mk('PassCount',pass,C_PASS) ]},
    options:{
      responsive:!big, maintainAspectRatio:false, animation:big?false:{duration:300},
      devicePixelRatio:big?1:undefined,
      layout:{padding:{top:big?34:20,right:big?18:8,left:4,bottom:0}},
      plugins:{
        legend:{display:true,position:'top',align:'end',
          labels:{boxWidth:big?22:12,usePointStyle:true,pointStyle:'line',font:{size:fs},color:'#444'}},
        tooltip:{enabled:!big}
      },
      scales:{
        x:{grid:{color:'rgba(0,0,0,.06)'},border:{display:false},ticks:{font:{size:fs},color:'#888'}},
        y:{beginAtZero:true,grid:{color:'rgba(0,0,0,.06)'},border:{display:false},
           ticks:{font:{size:fs},color:'#888',callback:v=>fmtK(v)}}
      }
    },
    plugins:[ valueLabelPlugin(lblFs) ]
  };
}

// Render a high-res offscreen chart and return a PNG data URL for the PPTX
function renderExportChart(labels,pass,fail){
  return new Promise(resolve=>{
    let holder=document.getElementById('exportCanvasHolder');
    if(!holder){holder=document.createElement('div');holder.id='exportCanvasHolder';
      holder.style.cssText='position:fixed;left:-99999px;top:0;width:1600px;height:800px';
      document.body.appendChild(holder);}
    holder.innerHTML='<canvas width="1600" height="800" style="width:1600px;height:800px"></canvas>';
    const cv=holder.querySelector('canvas');
    const ch=new Chart(cv,supersetChartConfig(labels,pass,fail,{export:true}));
    setTimeout(()=>{let img=null;try{img=ch.toBase64Image('image/png',1);}catch(e){}ch.destroy();resolve(img);},90);
  });
}

// Daily-runs min–max formatted in "k" (e.g. ~0.1-0.2k or ~116-134k)
function runsRange(min,max){
  const f=v=>{const k=v/1000; if(k>=10) return Math.round(k)+'';
    if(k>=1) return (Math.round(k*10)/10+'').replace(/\.0$/,'');
    return (Math.round(k*10)/10).toFixed(1);};
  return min===max?`~${f(min)}k`:`~${f(min)}-${f(max)}k`;
}

// ===== WEEKLY PPTX (one module per slide) =====
async function generateWeeklyPptx(){
  const envKey=curDataEnv, d=dataTabData[envKey];
  if(!d){return setStatus('dataStatus','error','Fetch data first');}
  if(typeof PptxGenJS==='undefined'){return setStatus('dataStatus','error','PptxGenJS not loaded — reopen the popup');}
  const btn=document.getElementById('downloadBtn'); const old=btn.textContent; btn.disabled=true; btn.textContent='Building PPTX...';
  try{
    const pres=new PptxGenJS();
    pres.defineLayout({name:'WIDE',width:13.33,height:7.5}); pres.layout='WIDE';
    const INK='1A1A2E', GRAY='6C757D', GREEN='1D9E75', RED='DC2626';
    const env=ENV[envKey];
    let added=0;

    for(const modId of d.modules){
      const m=MODS.find(x=>x.id===modId); if(!m) continue;
      const slug=m.label.split(' ').map((w,i)=>i===0?w:w.toLowerCase()).join('-');
      const stab=d.stability.find(x=>x.module===modId);
      const passPct=(stab&&stab['Pass%']!=null)?stab['Pass%']:null;
      const tgt=TARGETS[m.cat]||99;
      const t=weeklyTrends[modId];

      const s=pres.addSlide();
      // Header
      s.addText('Automation Alerts',{x:.45,y:.22,w:9,h:.5,fontSize:30,bold:true,color:INK});
      s.addText('capillary',{x:10.4,y:.33,w:2.5,h:.4,fontSize:18,bold:true,color:'1BB3A0',align:'right'});
      // Module box
      s.addShape(pres.ShapeType.rect,{x:.5,y:.88,w:3.4,h:.5,fill:{color:'ECECEC'},line:{color:'C4C4C4',width:1}});
      s.addText(slug,{x:.5,y:.88,w:3.4,h:.5,fontSize:20,bold:true,color:INK,align:'center',valign:'middle'});

      if(t && t.labels.length){
        // Chart (compact height to leave room for failure table)
        const img=await renderExportChart(t.labels,t.pass,t.fail);
        if(img) s.addImage({data:img,x:.35,y:1.53,w:8.8,h:3.42});

        const totals=t.pass.map((p,i)=>(Number(p)||0)+(Number(t.fail[i])||0));
        const minT=Math.min(...totals), maxT=Math.max(...totals);
        const failSum=t.fail.reduce((a,b)=>a+(Number(b)||0),0);
        const passColor=passPct==null?GRAY:(passPct>=tgt?GREEN:RED);
        const callout=failSum===0?'No callouts':`⚠ ${failSum} failures`;
        const calloutColor=failSum===0?INK:RED;

        // Stats block (right side, expanded to hold notes)
        const statsArr=[
          {text:`Runs: ${runsRange(minT,maxT)}`,options:{fontSize:18,bold:true,color:INK,breakLine:true}},
          {text:`Pass Rate: ${passPct==null?'—':passPct+'%'}`,options:{fontSize:18,bold:true,color:passColor,breakLine:true}},
          {text:callout,options:{fontSize:16,bold:true,color:calloutColor}}
        ];
        s.addText(statsArr,{x:9.5,y:2.4,w:3.4,h:2.0,lineSpacingMultiple:1.5,valign:'top'});

        // Failure runs table (only when failures exist)
        if(failSum>0 && t.failedRuns && t.failedRuns.length){
          s.addText('⚠  Failed Runs',{x:.4,y:5.05,w:4,h:.25,fontSize:10,bold:true,color:RED});
          const hdrOpts={bold:true,fontSize:9,fill:{color:'F0F2F5'},color:INK,align:'center',valign:'middle'};
          const tableRows=[
            [
              {text:'Date',options:{...hdrOpts,align:'left'}},
              {text:'Total',options:{...hdrOpts}},
              {text:'Pass',options:{...hdrOpts,color:GREEN}},
              {text:'Fail',options:{...hdrOpts,color:RED}},
              {text:'Run ID',options:{...hdrOpts,align:'left'}},
              {text:'Result',options:{...hdrOpts}},
              {text:'RCA / Comment',options:{...hdrOpts,align:'left',fill:{color:'EEF2FF'}}}
            ]
          ];
          t.failedRuns.forEach(r=>{
            const ds=r.start_time?(typeof r.start_time==='number'?fmt(new Date(r.start_time)):String(r.start_time).substring(0,10)):'—';
            const url=r.id?`https://apitester.capillary.in/apitest_app/result.html?resultId=${r.id}`:null;
            const passCount=Number(r.total)-Number(r.fail);
            tableRows.push([
              {text:ds,options:{fontSize:8,color:GRAY,align:'left',valign:'middle'}},
              {text:String(r.total),options:{fontSize:9,bold:true,color:INK,align:'center',valign:'middle'}},
              {text:String(passCount),options:{fontSize:9,bold:true,color:GREEN,align:'center',valign:'middle'}},
              {text:String(r.fail),options:{fontSize:9,bold:true,color:RED,align:'center',valign:'middle'}},
              {text:String(r.run_id||'—'),options:{fontSize:7,fontFace:'Consolas',color:INK,align:'left',valign:'middle'}},
              url?{text:'View',options:{fontSize:8,color:'4361EE',align:'center',valign:'middle',hyperlink:{url,tooltip:'Open in apitester'}}}:{text:'—',options:{fontSize:8,color:GRAY,align:'center',valign:'middle'}},
              {text:'',options:{fontSize:9,fill:{color:'F0F4FF'},align:'left',valign:'middle'}}
            ]);
          });
          s.addTable(tableRows,{x:.4,y:5.32,w:12.5,colW:[1.0,0.75,0.75,0.75,4.5,1.2,3.55],rowH:.3,border:{type:'solid',color:'E9ECEF',pt:.5},autoPage:true,autoPageRepeatHeader:true,autoPageLineWeight:.5});
        } else if(failSum>0){
          s.addText('⚠  Failed Runs',{x:.4,y:5.05,w:4,h:.25,fontSize:10,bold:true,color:RED});
          s.addText('Run details unavailable — check apitester directly',{x:.4,y:5.32,w:9,h:.3,fontSize:9,italic:true,color:GRAY});
        }
      } else {
        s.addText('No automation data in selected range',{x:.5,y:3.3,w:8.5,h:.6,fontSize:16,italic:true,color:GRAY});
        s.addText([
          {text:`Pass Rate: ${passPct==null?'—':passPct+'%'}`,options:{fontSize:18,bold:true,color:passPct==null?GRAY:(passPct>=(TARGETS[m.cat]||99)?GREEN:RED),breakLine:true}},
          {text:'No callouts',options:{fontSize:18,bold:true,color:INK}}
        ],{x:9.5,y:2.4,w:3.4,h:1.6,lineSpacingMultiple:1.6,valign:'top'});
      }

      // Footer
      s.addText(`${env.label}  |  ${d.sd} → ${d.ed}  |  clusters: ${env.clusters.join(', ')}`,{x:.5,y:7.08,w:12.3,h:.28,fontSize:9,color:GRAY});
      added++;
    }

    if(!added){btn.disabled=false;btn.textContent=old;return setStatus('dataStatus','error','No modules to export');}
    const fname=`weekly-alerts-${env.cls}-${d.sd}_to_${d.ed}.pptx`;
    await pres.writeFile({fileName:fname});
    setStatus('dataStatus','success',`PPTX downloaded — ${added} slide(s)`);
  }catch(e){setStatus('dataStatus','error','PPTX failed: '+e.message);}
  finally{btn.disabled=false;btn.textContent=old||'📥 Download PPTX';}
}

// ===== UTILS =====
function setStatus(id,type,msg){const b=document.getElementById(id);b.className='status-bar '+type;b.textContent=msg}

// ============================================================
// ===== MONTHLY TAB (3rd tab) — Production only =====
// ============================================================
// One slide per entry. `cat` is the slide heading; `short` (optional) is the
// compact label used on the chart badge. `node:null` = UI-only module: the Node
// fetches are skipped and the cluster table drops its Node % column.
const MONTHLY_PAIRS = [
  { cat:'Coupons', ui:'couponsUI', node:'couponnode' },
  { cat:'Loyalty', ui:'loyaltyUI', node:'loyaltynode' },
  { cat:'New Promotion V3 (Garuda UI)', short:'Garuda UI', ui:'garudaUIUI', node:null }
];

// environment value → short display name
const CLUSTER_LABEL = {
  'Eucrm':'EU',  'eucrm':'EU',
  'incrm':'IN',  'Incrm':'IN',
  'Seacrm':'SEA','seacrm':'SEA',
  'sgcrm':'ASIA','Sgcrm':'ASIA',
  'Tatacrm':'TATA','tatacrm':'TATA',
  'Uscrm':'US',  'uscrm':'US',
  'Ushc_Crm':'USHC','ushc_crm':'USHC'
};
const CLUSTER_ORDER = ['EU','ASIA','IN','TATA','US','USHC','SEA'];

let monthlyData = null;

// Per-cluster pass/fail grouped by environment (no timeseries)
function buildMonthlyClusterPayload(timeRange, moduleIds, clusters) {
  return JSON.stringify({
    datasource:DS, force:false,
    queries:[{
      time_range:timeRange, granularity:'start_time', is_timeseries:false,
      groupby:['environment'],
      metrics:[
        {expressionType:'SQL',hasCustomLabel:true,label:'pass',sqlExpression:'SUM(pass)'},
        {expressionType:'SQL',hasCustomLabel:true,label:'fail',sqlExpression:'SUM(fail)'}
      ],
      filters:[
        {col:'abortedby',op:'IS NULL'},
        {col:'module',op:'IN',val:moduleIds},
        {col:'environment',op:'IN',val:clusters}
      ],
      extras:{where:"(session_name like '%Smoke%' or session_name like '%Sanity%')"},
      row_limit:1000
    }],result_format:'json',result_type:'full'
  });
}

function setMonthlyQuickDate(type) {
  const now=new Date();
  let s, e;
  if(type==='last'){
    s=new Date(now.getFullYear(), now.getMonth()-1, 1);
    e=new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
  } else {
    s=new Date(now.getFullYear(), now.getMonth(), 1);
    e=new Date(now);
  }
  document.getElementById('mStartDate').value=fmt(s);
  document.getElementById('mEndDate').value=fmt(e);
}

function initMonthlyTab() {
  setMonthlyQuickDate('last'); // default: last full month
  document.getElementById('mLastMonth').addEventListener('click',()=>setMonthlyQuickDate('last'));
  document.getElementById('mThisMonth').addEventListener('click',()=>setMonthlyQuickDate('this'));
  document.getElementById('mFetchBtn').addEventListener('click', fetchMonthlyData);
  document.getElementById('mDownloadBtn').addEventListener('click', generateMonthlyPptx);
}

// Aggregate API rows into {displayName: {pass, fail}} (merges duplicates like seacrm+Seacrm)
function aggregateClusters(rows) {
  const map={};
  rows.forEach(r=>{
    const lbl=CLUSTER_LABEL[r.environment]||r.environment;
    if(!map[lbl]) map[lbl]={pass:0,fail:0};
    map[lbl].pass += Number(r.pass)||0;
    map[lbl].fail += Number(r.fail)||0;
  });
  return map;
}

// Pass% for a named cluster (2 decimal places, null if no data)
function clusterPct(map, lbl) {
  if(!map[lbl]) return null;
  const {pass,fail}=map[lbl]; const tot=pass+fail;
  return tot>0 ? Math.round((pass/tot)*10000)/100 : null;
}

// Overall pass% across all clusters
function allClusterPct(map) {
  let p=0,f=0; Object.values(map).forEach(v=>{p+=v.pass;f+=v.fail});
  const tot=p+f; return tot>0 ? Math.round((p/tot)*10000)/100 : null;
}

async function fetchMonthlyData() {
  const sd=document.getElementById('mStartDate').value;
  const ed=document.getElementById('mEndDate').value;
  if(!sd||!ed) return setStatus('mStatus','error','Set date range');
  const edDate=new Date(ed+'T00:00:00'); edDate.setDate(edDate.getDate()+1);
  const tr=`${sd} : ${fmt(edDate)}`;
  const cls=ENV.prod.clusters;
  const btn=document.getElementById('mFetchBtn');
  btn.disabled=true; btn.textContent='Fetching…';
  document.getElementById('mDownloadBtn').disabled=true;
  monthlyData=null;
  try{
    setStatus('mStatus','loading','Fetching monthly data — Production only…');
    const pairs=[];
    for(const pair of MONTHLY_PAIRS){
      setStatus('mStatus','loading',`Fetching ${pair.cat}: trends + cluster stats…`);
      const hasNode = !!pair.node;
      // Up to 5 parallel calls: UI trend, Node trend, combined (UI+Node) trend,
      // UI cluster stats, Node cluster stats. UI-only modules skip the Node calls
      // and reuse the UI trend as the combined trend.
      const [uiTrend,nodeTrend,combinedRaw,uiCluster,nodeCluster]=await Promise.all([
        runInSuperset(mkScript(buildTrendsPayload(tr,[pair.ui],cls))),
        hasNode ? runInSuperset(mkScript(buildTrendsPayload(tr,[pair.node],cls))) : [],
        hasNode ? runInSuperset(mkScript(buildTrendsPayload(tr,[pair.ui,pair.node],cls))) : [],
        runInSuperset(mkScript(buildMonthlyClusterPayload(tr,[pair.ui],cls))),
        hasNode ? runInSuperset(mkScript(buildMonthlyClusterPayload(tr,[pair.node],cls))) : []
      ]);
      const toTrend = rows => ({
        labels: rows.map(r=>new Date(r.__timestamp).getDate().toString()),
        pass:   rows.map(r=>r.PassCount||0),
        fail:   rows.map(r=>r.FailCount||0)
      });
      pairs.push({
        cat: pair.cat, short: pair.short, ui: pair.ui, node: pair.node,
        uiTrend:       toTrend(uiTrend),
        nodeTrend:     toTrend(nodeTrend),
        combinedTrend: toTrend(hasNode ? combinedRaw : uiTrend),
        uiCluster:   aggregateClusters(uiCluster),
        nodeCluster: aggregateClusters(nodeCluster)
      });
    }
    monthlyData={pairs,sd,ed,tr};
    renderMonthlyResults();
    setStatus('mStatus','success','Monthly data loaded — click Download PPTX');
    document.getElementById('mDownloadBtn').disabled=false;
  }catch(e){
    setStatus('mStatus','error',e.message);
  }finally{
    btn.disabled=false; btn.textContent='Fetch Monthly Data';
  }
}

function renderMonthlyResults() {
  const area=document.getElementById('mResults'); if(!monthlyData){area.innerHTML='';return;}
  const sections=monthlyData.pairs.map(p=>p.short||p.cat).join(', ');
  let html=`<div class="pptx-note" style="margin-bottom:8px"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#4361ee" stroke-width="1.5"/><rect x="7.25" y="6.5" width="1.5" height="5.5" rx=".75" fill="#4361ee"/><circle cx="8" cy="4.75" r=".85" fill="#4361ee"/></svg>&nbsp;PPTX will have ${monthlyData.pairs.length} slides — ${sections} — each with a trend chart and a cluster pass-rate table.</div>`;
  for(const p of monthlyData.pairs){
    const uiAll=allClusterPct(p.uiCluster), nodeAll=allClusterPct(p.nodeCluster);
    const uiCls=uiAll!=null&&uiAll>=99?'g':'r', nodeCls=nodeAll!=null&&nodeAll>=99?'g':'r';
    // UI-only modules have no Node figure to show
    const nodeStat=p.node?`<span class="mod-card-sep">|</span>
      <span class="mod-card-stat">Node All-Cluster: <strong class="${nodeCls}">${nodeAll!=null?nodeAll+'%':'—'}</strong></span>`:'';
    html+=`<div class="mod-card" style="margin-bottom:6px"><div class="mod-card-row">
      <span class="mod-card-name">${p.cat}</span>
      <span class="mod-card-sep">|</span>
      <span class="mod-card-stat">${p.node?'UI ':''}All-Cluster: <strong class="${uiCls}">${uiAll!=null?uiAll+'%':'—'}</strong></span>
      ${nodeStat}
      <span class="mod-card-sep">|</span>
      <span class="mod-card-stat">Days: <strong>${p.uiTrend.labels.length}</strong></span>
    </div></div>`;
  }
  area.innerHTML=html;
}

async function generateMonthlyPptx() {
  if(!monthlyData) return setStatus('mStatus','error','Fetch data first');
  if(typeof PptxGenJS==='undefined') return setStatus('mStatus','error','PptxGenJS not loaded — reopen popup');
  const btn=document.getElementById('mDownloadBtn');
  const old=btn.textContent; btn.disabled=true; btn.textContent='Building PPTX…';
  try{
    const pres=new PptxGenJS();
    pres.defineLayout({name:'WIDE',width:13.33,height:7.5}); pres.layout='WIDE';
    const INK='1A1A2E', GRAY='6C757D', GREEN='1D9E75', RED='DC2626', AMBER='B45309';
    const TEAL='1A7F6E', ORANGE='D96A0A';

    for(const pair of monthlyData.pairs){
      const s=pres.addSlide();
      const hasNode=!!pair.node;

      // ── Header — w runs up to the 'capillary' mark at x:10.5 so long
      // headings like "New Promotion V3 (Garuda UI)" don't get clipped
      s.addText('Automation Runs',{x:.3,y:.17,w:5.5,h:.45,fontSize:26,bold:true,color:ORANGE});
      s.addText(`— ${pair.cat}`,{x:3.65,y:.19,w:6.75,h:.42,fontSize:19,bold:false,color:GRAY});
      s.addShape(pres.ShapeType.rect,{x:.3,y:.6,w:3.0,h:.05,fill:{color:TEAL}});
      s.addText('capillary',{x:10.5,y:.24,w:2.5,h:.35,fontSize:15,bold:true,color:'1BB3A0',align:'right'});

      // ── Combined (UI + Node) chart — single chart on left
      const chartW=7.9;

      // Combined (UI + Node) chart — UI-only modules have nothing to combine
      const chartLabel=`${pair.short||pair.cat}${hasNode?' Combined':''}`;
      s.addShape(pres.ShapeType.rect,{x:.3,y:.73,w:3.4,h:.32,fill:{color:'1A7F6E'},line:{color:'1A7F6E',width:1}});
      s.addText(chartLabel,{x:.3,y:.73,w:3.4,h:.32,fontSize:12,bold:true,color:'FFFFFF',align:'center',valign:'middle'});
      const combImg=await renderExportChart(pair.combinedTrend.labels,pair.combinedTrend.pass,pair.combinedTrend.fail);
      if(combImg) s.addImage({data:combImg,x:.3,y:1.08,w:chartW,h:3.42});

      // ── Cluster pass-rate table: Cluster | UI% | Node% — no Combined% col.
      // UI-only modules drop the Node column and widen Pass % to fill the space.
      const hdr={bold:true,fontSize:9,fill:{color:TEAL},color:'FFFFFF',align:'center',valign:'middle'};
      const tableRows=[[
        {text:'Cluster',options:{...hdr,align:'left'}},
        {text:hasNode?'UI %':'Pass %',options:{...hdr}},
        ...(hasNode?[{text:'Node %',options:{...hdr}}]:[])
      ]];

      const pctCell=(v,bold=false)=>{
        if(v==null) return {text:'—',options:{fontSize:10,color:GRAY,align:'center',valign:'middle'}};
        const color=v>=99.5?GREEN:v>=99?AMBER:RED;
        return {text:v+'%',options:{fontSize:bold?11:10,bold,color,align:'center',valign:'middle'}};
      };

      for(const lbl of CLUSTER_ORDER){
        tableRows.push([
          {text:lbl,options:{fontSize:10,color:INK,align:'left',valign:'middle'}},
          pctCell(clusterPct(pair.uiCluster,lbl)),
          ...(hasNode?[pctCell(clusterPct(pair.nodeCluster,lbl))]:[])
        ]);
      }

      // All-clusters bold summary row
      const allFill={fill:{color:'F0F2F5'}};
      const boldPct=(v)=>{
        if(v==null) return {text:'—',options:{fontSize:11,bold:true,color:GRAY,align:'center',valign:'middle',...allFill}};
        return {text:v+'%',options:{fontSize:11,bold:true,color:v>=99.5?GREEN:v>=99?AMBER:RED,align:'center',valign:'middle',...allFill}};
      };
      tableRows.push([
        {text:'All Clusters',options:{fontSize:10,bold:true,color:INK,align:'left',valign:'middle',...allFill}},
        boldPct(allClusterPct(pair.uiCluster)),
        ...(hasNode?[boldPct(allClusterPct(pair.nodeCluster))]:[])
      ]);

      // rowH: spread 8 rows (7 clusters + All) across ~6.24" → 0.78" each
      s.addTable(tableRows,{
        x:8.38, y:.73, w:4.67,
        colW:hasNode?[0.92,1.88,1.87]:[0.92,3.75],
        rowH:.78,
        border:{type:'solid',color:'E9ECEF',pt:.5},
        autoPage:false
      });

      // Footer
      s.addText(`Production  |  ${monthlyData.sd} → ${monthlyData.ed}  |  ${ENV.prod.clusters.join(', ')}`,
        {x:.3,y:7.1,w:12.7,h:.28,fontSize:8,color:GRAY});
    }

    const fname=`monthly-report-${monthlyData.sd}_to_${monthlyData.ed}.pptx`;
    await pres.writeFile({fileName:fname});
    setStatus('mStatus','success',`Monthly PPTX downloaded — ${monthlyData.pairs.length} slides`);
  }catch(e){
    setStatus('mStatus','error','PPTX failed: '+e.message);
  }finally{
    btn.disabled=false; btn.textContent=old||'📥 Download PPTX';
  }
}
