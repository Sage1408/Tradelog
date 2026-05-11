var SUPA_URL = 'https://wkswluzempqggguzjdnx.supabase.co';
var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indrc3dsdXplbXBxZ2dndXpqZG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzM1ODcsImV4cCI6MjA5MzU0OTU4N30.rrtO9u6_2zO3_4P_rFHSb9KnVSJSeWBWErC6sTZWa64';
var sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);

var trades = [], notes = [], currentUser = null, currentScreenshot = null, authMode = 'login';
var filteredTrades = [], currentPage = 1, pageSize = 15, editingId = null, editingNoteId = null;
var calYear = new Date().getFullYear(), calMonth = new Date().getMonth();
var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* UTILS */
function showLoading(m){document.getElementById('loading-text').textContent=m||'Loading...';document.getElementById('loading-overlay').classList.add('show');}
function hideLoading(){document.getElementById('loading-overlay').classList.remove('show');}
function showToast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},3000);}

/* DARK MODE */
var dark = localStorage.getItem('se-dark') === '1';
function applyTheme(){document.documentElement.setAttribute('data-theme',dark?'dark':'light');document.getElementById('dark-btn').textContent=dark?'☀️':'🌙';}
function toggleDark(){dark=!dark;localStorage.setItem('se-dark',dark?'1':'0');applyTheme();}
applyTheme();

/* AUTH */
function showAuthTab(m){
  authMode=m;
  document.querySelectorAll('.auth-tab').forEach(function(t,i){t.classList.toggle('active',(m==='login'&&i===0)||(m==='signup'&&i===1));});
  document.getElementById('auth-submit-btn').textContent=m==='login'?'Sign In':'Create Account';
  var fl=document.getElementById('auth-forgot-link');if(fl) fl.style.display=m==='login'?'block':'none';
  document.getElementById('auth-error').textContent='';
}

function showForgotPassword(){document.getElementById('forgot-modal').classList.add('open');}
function closeForgotModal(){document.getElementById('forgot-modal').classList.remove('open');}

async function sendPasswordReset(){
  var email=document.getElementById('forgot-email').value.trim();
  var errEl=document.getElementById('forgot-error');
  if(!email){errEl.textContent='Enter your email';return;}
  var res=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.href});
  if(res.error){errEl.textContent=res.error.message;}
  else{errEl.style.color='var(--green)';errEl.textContent='Reset link sent! Check your email.';setTimeout(closeForgotModal,3000);}
}

async function signInWithGoogle(){
  showLoading('Connecting to Google...');
  var res=await sb.auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo:window.location.origin+window.location.pathname}
  });
  if(res.error){hideLoading();document.getElementById('auth-error').textContent=res.error.message;}
}

async function handleEmailAuth(){
  var email=document.getElementById('auth-email').value.trim();
  var pass=document.getElementById('auth-password').value;
  var errEl=document.getElementById('auth-error');
  errEl.textContent='';errEl.className='auth-error';
  if(!email||!pass){errEl.textContent='Please fill in all fields';return;}
  showLoading(authMode==='login'?'Signing in...':'Creating account...');
  if(authMode==='login'){
    var res=await sb.auth.signInWithPassword({email:email,password:pass});
    hideLoading();
    if(res.error){errEl.textContent=res.error.message;}
    else if(res.data&&res.data.session){await initApp(res.data.session);}
  } else {
    var res=await sb.auth.signUp({email:email,password:pass});
    hideLoading();
    if(res.error){errEl.textContent=res.error.message;}
    else{errEl.className='auth-error auth-success';errEl.textContent='Account created! Check your email then sign in.';}
  }
}

async function signOut(){
  showLoading('Signing out...');
  await sb.auth.signOut();
  trades=[];notes=[];currentUser=null;
  document.getElementById('app-screen').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  hideLoading();
}

/* INIT APP */
async function initApp(session){
  if(!session||!session.user){
    document.getElementById('app-screen').style.display='none';
    document.getElementById('auth-screen').style.display='flex';
    hideLoading();return;
  }
  currentUser=session.user;
  document.getElementById('user-email-display').textContent=session.user.email;
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app-screen').style.display='block';
  document.getElementById('f-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('f-pair').onchange=function(){
    document.getElementById('custom-pair-group').style.display=this.value==='custom'?'flex':'none';
  };
  showDashboardSkeleton();
  await loadTrades();
  await loadNotes();
  renderDashboard();renderTable();renderNotesList();
}

/* AUTH STATE - handles both email login AND Google OAuth redirect */
sb.auth.onAuthStateChange(async function(ev, session){
  if(ev==='SIGNED_IN'||ev==='TOKEN_REFRESHED'||ev==='INITIAL_SESSION'){
    if(session&&session.user){
      if(!currentUser||currentUser.id!==session.user.id){
        await initApp(session);
      } else {
        hideLoading();
      }
    } else {
      hideLoading();
      document.getElementById('auth-screen').style.display='flex';
    }
  } else if(ev==='SIGNED_OUT'){
    trades=[];notes=[];currentUser=null;
    document.getElementById('app-screen').style.display='none';
    document.getElementById('auth-screen').style.display='flex';
    hideLoading();
  }
});

/* Show auth screen after timeout if nothing fires */
showLoading('Starting...');
setTimeout(function(){
  if(!currentUser){
    hideLoading();
    document.getElementById('auth-screen').style.display='flex';
  }
},8000);

/* SKELETON */
function showDashboardSkeleton(){
  var d=document.getElementById('view-dashboard');
  d.innerHTML='<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>';
}

/* TABS */
function switchTab(name,btn){
  document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active');});
  document.querySelectorAll('.bnav-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById('view-'+name).classList.add('active');
  btn.classList.add('active');
  if(name==='dashboard') renderDashboard();
  if(name==='log') renderTable();
  if(name==='notes') renderNotesList();
}

/* SCREENSHOT */
function handleScreenshot(e){
  var file=e.target.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(ev){
    currentScreenshot=ev.target.result;
    document.getElementById('upload-preview-img').src=ev.target.result;
    document.getElementById('upload-placeholder').style.display='none';
    document.getElementById('upload-preview-wrap').style.display='block';
  };
  reader.readAsDataURL(file);
}
function removeScreenshot(e){
  e.preventDefault();e.stopPropagation();
  currentScreenshot=null;
  document.getElementById('f-screenshot').value='';
  document.getElementById('upload-placeholder').style.display='block';
  document.getElementById('upload-preview-wrap').style.display='none';
  document.getElementById('upload-preview-img').src='';
}
function viewScreenshot(id){
  var trade=null;
  for(var i=0;i<trades.length;i++){if(String(trades[i].id)===String(id)){trade=trades[i];break;}}
  if(!trade||!trade.screenshot)return;
  document.getElementById('screenshot-modal-img').src=trade.screenshot;
  document.getElementById('screenshot-modal').style.display='flex';
}
function closeScreenshotModal(){document.getElementById('screenshot-modal').style.display='none';}

/* LOAD TRADES */
async function loadTrades(){
  showLoading('Loading your trades...');
  try{
    var res=await Promise.race([
      sb.from('trades').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false}),
      new Promise(function(_,rej){setTimeout(function(){rej(new Error('timeout'));},10000);})
    ]);
    hideLoading();
    if(res.error){showToast('Error: '+res.error.message);trades=[];return;}
    trades=res.data||[];
  }catch(e){hideLoading();showToast('Connection timeout. Please refresh.');trades=[];}
}

/* LOAD NOTES */
async function loadNotes(){
  try{
    var res=await sb.from('journal_notes').select('*').eq('user_id',currentUser.id).order('date',{ascending:false});
    if(!res.error) notes=res.data||[];
  }catch(e){notes=[];}
}

/* SAVE TRADE */
async function saveTrade(){
  var pairVal=document.getElementById('f-pair').value;
  var pair=pairVal==='custom'?document.getElementById('f-custom-pair').value.trim():pairVal;
  var result=document.getElementById('f-result').value;
  var dir=document.getElementById('f-dir').value;
  if(!pair||!dir||!result){showToast('Fill in Pair, Direction and Result');return;}
  var trade={
    user_id:currentUser.id,
    date:document.getElementById('f-date').value,
    pair:pair,dir:dir,
    session:document.getElementById('f-session').value||null,
    entry:parseFloat(document.getElementById('f-entry').value)||null,
    sl:parseFloat(document.getElementById('f-sl').value)||null,
    tp:parseFloat(document.getElementById('f-tp').value)||null,
    lot:parseFloat(document.getElementById('f-lot').value)||null,
    result:result,
    rr:parseFloat(document.getElementById('f-rr').value)||null,
    setup:document.getElementById('f-setup').value||null,
    mindset:parseInt(document.getElementById('f-mindset').value)||null,
    notes:document.getElementById('f-notes').value.trim()||null,
    screenshot:currentScreenshot
  };
  showLoading('Saving trade...');
  var res=await sb.from('trades').insert([trade]).select();
  hideLoading();
  if(res.error){showToast('Error: '+res.error.message);return;}
  trades.unshift(res.data[0]);
  showToast('Trade saved!');
  clearForm();
  switchTab('log',document.querySelectorAll('.bnav-btn')[1]);
}

/* DELETE TRADE */
async function deleteTrade(id){
  if(!confirm('Delete this trade?'))return;
  showLoading('Deleting...');
  var res=await sb.from('trades').delete().eq('id',id);
  hideLoading();
  if(res.error){showToast('Error deleting');return;}
  trades=trades.filter(function(t){return t.id!==id;});
  renderTable();renderDashboard();
  showToast('Trade deleted');
}

/* EDIT TRADE */
function openEditModal(id){
  var trade=null;
  for(var i=0;i<trades.length;i++){if(String(trades[i].id)===String(id)){trade=trades[i];break;}}
  if(!trade)return;
  editingId=id;
  document.getElementById('e-date').value=trade.date||'';
  document.getElementById('e-pair').value=trade.pair||'';
  document.getElementById('e-dir').value=trade.dir||'';
  document.getElementById('e-session').value=trade.session||'';
  document.getElementById('e-entry').value=trade.entry||'';
  document.getElementById('e-sl').value=trade.sl||'';
  document.getElementById('e-tp').value=trade.tp||'';
  document.getElementById('e-lot').value=trade.lot||'';
  document.getElementById('e-result').value=trade.result||'';
  document.getElementById('e-rr').value=trade.rr||'';
  document.getElementById('e-setup').value=trade.setup||'';
  document.getElementById('e-mindset').value=trade.mindset||'';
  document.getElementById('e-notes').value=trade.notes||'';
  document.getElementById('edit-modal').classList.add('open');
}
function closeEditModal(){document.getElementById('edit-modal').classList.remove('open');editingId=null;}
async function saveEditTrade(){
  if(!editingId)return;
  var upd={
    date:document.getElementById('e-date').value,
    pair:document.getElementById('e-pair').value,
    dir:document.getElementById('e-dir').value,
    session:document.getElementById('e-session').value||null,
    entry:parseFloat(document.getElementById('e-entry').value)||null,
    sl:parseFloat(document.getElementById('e-sl').value)||null,
    tp:parseFloat(document.getElementById('e-tp').value)||null,
    lot:parseFloat(document.getElementById('e-lot').value)||null,
    result:document.getElementById('e-result').value,
    rr:parseFloat(document.getElementById('e-rr').value)||null,
    setup:document.getElementById('e-setup').value||null,
    mindset:parseInt(document.getElementById('e-mindset').value)||null,
    notes:document.getElementById('e-notes').value.trim()||null
  };
  showLoading('Updating...');
  var res=await sb.from('trades').update(upd).eq('id',editingId).select();
  hideLoading();
  if(res.error){showToast('Error updating');return;}
  for(var i=0;i<trades.length;i++){if(String(trades[i].id)===String(editingId)){trades[i]=res.data[0];break;}}
  closeEditModal();renderTable();renderDashboard();
  showToast('Trade updated!');
}

/* CLEAR FORM */
function clearForm(){
  ['f-pair','f-dir','f-session','f-result','f-setup'].forEach(function(id){document.getElementById(id).value='';});
  ['f-entry','f-sl','f-tp','f-lot','f-rr','f-mindset','f-notes','f-custom-pair'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('custom-pair-group').style.display='none';
  currentScreenshot=null;
  document.getElementById('f-screenshot').value='';
  document.getElementById('upload-placeholder').style.display='block';
  document.getElementById('upload-preview-wrap').style.display='none';
  document.getElementById('upload-preview-img').src='';
  document.getElementById('f-date').value=new Date().toISOString().split('T')[0];
}

/* TABLE */
function applyFilters(){
  var search=(document.getElementById('filter-search').value||'').toLowerCase();
  var pair=document.getElementById('filter-pair').value;
  var session=document.getElementById('filter-session').value;
  var result=document.getElementById('filter-result').value;
  filteredTrades=trades.filter(function(t){
    if(search&&!(t.pair||'').toLowerCase().includes(search)&&!(t.notes||'').toLowerCase().includes(search))return false;
    if(pair&&t.pair!==pair)return false;
    if(session&&t.session!==session)return false;
    if(result&&t.result!==result)return false;
    return true;
  });
  currentPage=1;renderTable();
}

function renderTable(){
  var tbody=document.getElementById('trade-table-body');
  filteredTrades=filteredTrades.length||document.getElementById('filter-search').value?filteredTrades:trades.slice();
  if(!filteredTrades.length&&!trades.length){
    tbody.innerHTML='<tr><td colspan="15"><div class="empty-state"><div class="empty-icon">&#128203;</div><p>No trades yet. Add your first!</p></div></td></tr>';
    document.getElementById('pagination').innerHTML='';return;
  }
  if(!filteredTrades.length){
    tbody.innerHTML='<tr><td colspan="15"><div class="empty-state"><div class="empty-icon">&#128269;</div><p>No trades match your filters.</p></div></td></tr>';
    document.getElementById('pagination').innerHTML='';return;
  }
  var total=filteredTrades.length,pages=Math.ceil(total/pageSize);
  if(currentPage>pages)currentPage=pages;
  var start=(currentPage-1)*pageSize,end=Math.min(start+pageSize,total);
  var html='';
  for(var i=start;i<end;i++){
    var t=filteredTrades[i];
    var rr=t.rr!==null&&t.rr!==undefined?t.rr:null;
    var rrClass=t.result==='Win'?'rr-pos':t.result==='Loss'?'rr-neg':'';
    var resBadge=t.result==='Win'?'badge-win':t.result==='Loss'?'badge-loss':'badge-be';
    var dirBadge=t.dir==='Buy'?'badge-buy':'badge-sell';
    var rrTxt=rr!==null?((t.result==='Loss'?'-':'')+rr+'R'):'--';
    var setup=t.setup?t.setup.split(' - ')[0]:'--';
    var scCell=t.screenshot?'<img src="'+t.screenshot+'" class="sc-thumb" onclick="viewScreenshot(\''+t.id+'\')" title="View chart"/>'  :'--';
    html+='<tr>';
    html+='<td class="mono" style="color:var(--ink-muted)">'+(total-i)+'</td>';
    html+='<td class="mono" style="font-size:0.73rem">'+(t.date||'--')+'</td>';
    html+='<td><strong>'+(t.pair||'--')+'</strong></td>';
    html+='<td><span class="badge '+dirBadge+'">'+(t.dir||'--')+'</span></td>';
    html+='<td><span class="badge badge-session">'+(t.session||'--')+'</span></td>';
    html+='<td><span class="badge badge-setup">'+setup+'</span></td>';
    html+='<td class="mono">'+(t.entry!==null&&t.entry!==undefined?t.entry:'--')+'</td>';
    html+='<td class="mono">'+(t.sl!==null&&t.sl!==undefined?t.sl:'--')+'</td>';
    html+='<td class="mono">'+(t.tp!==null&&t.tp!==undefined?t.tp:'--')+'</td>';
    html+='<td class="mono">'+(t.lot!==null&&t.lot!==undefined?t.lot:'--')+'</td>';
    html+='<td class="mono '+rrClass+'">'+rrTxt+'</td>';
    html+='<td><span class="badge '+resBadge+'">'+t.result+'</span></td>';
    html+='<td>'+scCell+'</td>';
    html+='<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.73rem;color:var(--ink-muted)">'+(t.notes||'--')+'</td>';
    html+='<td style="display:flex;gap:4px;"><button class="btn btn-icon" onclick="openEditModal(\''+t.id+'\')">&#9998;</button><button class="btn btn-danger" onclick="deleteTrade(\''+t.id+'\')">X</button></td>';
    html+='</tr>';
  }
  tbody.innerHTML=html;
  var pag='';
  if(pages>1){
    pag+='<button class="page-btn" onclick="changePage('+(currentPage-1)+')" '+(currentPage===1?'disabled':'')+'>Prev</button>';
    for(var p=1;p<=pages;p++){pag+='<button class="page-btn'+(p===currentPage?' active':'')+'" onclick="changePage('+p+')">'+p+'</button>';}
    pag+='<button class="page-btn" onclick="changePage('+(currentPage+1)+')" '+(currentPage===pages?'disabled':'')+'>Next</button>';
  }
  document.getElementById('pagination').innerHTML=pag;
}

function changePage(p){currentPage=p;renderTable();window.scrollTo(0,0);}

/* DASHBOARD */
function renderDashboard(){
  var dashEl=document.getElementById('view-dashboard');
  if(!trades.length){
    dashEl.innerHTML='<div class="empty-dashboard"><div class="empty-icon">&#128200;</div><h3>Start your trading journal</h3><p>Log your first trade to see your stats, charts and performance breakdown here.</p><button class="btn btn-gold" onclick="switchTab(\'add\',document.querySelectorAll(\'.bnav-btn\')[2])">Log First Trade</button></div>';
    return;
  }

  var wins=[],losses=[],bes=[];
  for(var i=0;i<trades.length;i++){
    if(trades[i].result==='Win')wins.push(trades[i]);
    else if(trades[i].result==='Loss')losses.push(trades[i]);
    else bes.push(trades[i]);
  }
  var total=trades.length;
  var wr=total?Math.round((wins.length/total)*100):0;
  var rrSum=0,rrCount=0;
  for(var i=0;i<trades.length;i++){if(trades[i].rr!==null&&trades[i].rr!==undefined){rrSum+=Number(trades[i].rr);rrCount++;}}
  var avgRR=rrCount?(rrSum/rrCount).toFixed(2):'--';
  var winRR=0,lossRR=0;
  for(var i=0;i<wins.length;i++)winRR+=Number(wins[i].rr||0);
  for(var i=0;i<losses.length;i++)lossRR+=Number(losses[i].rr||0);
  var pf=lossRR>0?(winRR/lossRR).toFixed(2):(wins.length?'MAX':'--');

  // Best/worst pair
  var pairStats={};
  for(var i=0;i<trades.length;i++){
    var p=trades[i].pair||'Unknown';
    if(!pairStats[p])pairStats[p]={wins:0,total:0};
    if(trades[i].result==='Win')pairStats[p].wins++;
    pairStats[p].total++;
  }
  var bestPair='--',worstPair='--',bestWR=-1,worstWR=101;
  Object.keys(pairStats).forEach(function(p){
    if(pairStats[p].total<2)return;
    var pw=Math.round(pairStats[p].wins/pairStats[p].total*100);
    if(pw>bestWR){bestWR=pw;bestPair=p+' ('+pw+'%)';}
    if(pw<worstWR){worstWR=pw;worstPair=p+' ('+pw+'%)';}
  });

  // Streak
  var sorted=trades.slice().sort(function(a,b){return (a.date||'')<(b.date||'')?-1:1;});
  var streak=1,stype=sorted[sorted.length-1].result;
  for(var i=sorted.length-2;i>=0;i--){if(sorted[i].result===stype)streak++;else break;}

  dashEl.innerHTML=
    '<div class="stats-grid">'+
    '<div class="stat-card green"><div class="stat-label">Win Rate</div><div class="stat-value">'+wr+'%</div><div class="stat-sub">'+wins.length+'W / '+losses.length+'L / '+bes.length+'BE</div></div>'+
    '<div class="stat-card"><div class="stat-label">Avg RR</div><div class="stat-value">'+(avgRR!=='--'?avgRR+'R':'--')+'</div><div class="stat-sub">Risk-Reward</div></div>'+
    '<div class="stat-card blue"><div class="stat-label">Total Trades</div><div class="stat-value">'+total+'</div><div class="stat-sub">All time</div></div>'+
    '<div class="stat-card"><div class="stat-label">Profit Factor</div><div class="stat-value">'+pf+'</div><div class="stat-sub">Win RR / Loss RR</div></div>'+
    '<div class="stat-card green"><div class="stat-label">Best Pair</div><div class="stat-value" style="font-size:1rem;">'+bestPair+'</div><div class="stat-sub">Highest win rate</div></div>'+
    '<div class="stat-card red"><div class="stat-label">Worst Pair</div><div class="stat-value" style="font-size:1rem;">'+worstPair+'</div><div class="stat-sub">Lowest win rate</div></div>'+
    '<div class="stat-card purple"><div class="stat-label">Streak</div><div class="stat-value">'+streak+'</div><div class="stat-sub">'+(stype==='Win'?'Win streak':stype==='Loss'?'Loss streak':'BE streak')+'</div></div>'+
    '</div>'+
    '<div class="chart-row">'+
    '<div class="chart-card"><div class="chart-title">Cumulative RR Over Time</div><canvas id="rrChart" height="180"></canvas></div>'+
    '<div class="chart-card"><div class="chart-title">Outcome Breakdown</div><div class="donut-wrap"><canvas id="donutChart" width="150" height="150" style="width:150px;height:150px;"></canvas><div class="donut-legend" id="donut-legend"></div></div></div>'+
    '</div>'+
    '<div class="chart-row">'+
    '<div class="chart-card"><div class="chart-title">Win Rate by Session</div><div class="rate-bars" id="session-bars"></div></div>'+
    '<div class="chart-card"><div class="chart-title">Win Rate by Setup</div><div class="rate-bars" id="setup-bars"></div></div>'+
    '</div>'+
    '<div class="chart-row">'+
    '<div class="chart-card"><div class="chart-title">Monthly Performance</div><canvas id="monthChart" height="160"></canvas></div>'+
    '<div class="chart-card">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'+
    '<div class="chart-title" style="margin-bottom:0;">Trade Calendar</div>'+
    '<div style="display:flex;align-items:center;gap:8px;">'+
    '<button onclick="calPrevMonth()" style="background:var(--paper);border:1px solid var(--border);border-radius:6px;padding:3px 9px;cursor:pointer;">&#8592;</button>'+
    '<span id="cal-month-label" style="font-family:DM Mono,monospace;font-size:0.78rem;min-width:85px;text-align:center;"></span>'+
    '<button onclick="calNextMonth()" style="background:var(--paper);border:1px solid var(--border);border-radius:6px;padding:3px 9px;cursor:pointer;">&#8594;</button>'+
    '</div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:5px;">'+
    '<div style="font-size:0.6rem;text-align:center;color:var(--ink-muted);">Su</div>'+
    '<div style="font-size:0.6rem;text-align:center;color:var(--ink-muted);">Mo</div>'+
    '<div style="font-size:0.6rem;text-align:center;color:var(--ink-muted);">Tu</div>'+
    '<div style="font-size:0.6rem;text-align:center;color:var(--ink-muted);">We</div>'+
    '<div style="font-size:0.6rem;text-align:center;color:var(--ink-muted);">Th</div>'+
    '<div style="font-size:0.6rem;text-align:center;color:var(--ink-muted);">Fr</div>'+
    '<div style="font-size:0.6rem;text-align:center;color:var(--ink-muted);">Sa</div>'+
    '</div>'+
    '<div class="cal-grid" id="cal-grid"></div>'+
    '</div>'+
    '</div>';

  drawLineChart();
  drawDonut(wins.length,losses.length,bes.length);
  drawRateBars('session-bars','session');
  drawRateBars('setup-bars','setup',function(s){return s.split(' - ')[0];});
  drawMonthChart();
  drawCalendar();
}

function drawRateBars(elId, key, transform){
  var stats={};
  for(var i=0;i<trades.length;i++){
    var v=trades[i][key]||'Unknown';
    if(transform)v=transform(v);
    if(!stats[v])stats[v]={wins:0,total:0};
    if(trades[i].result==='Win')stats[v].wins++;
    stats[v].total++;
  }
  var html='';
  Object.keys(stats).forEach(function(k){
    var wr=Math.round(stats[k].wins/stats[k].total*100);
    html+='<div class="rate-bar-row">'+
      '<div class="rate-bar-label"><span>'+k+'</span><span>'+wr+'% ('+stats[k].total+' trades)</span></div>'+
      '<div class="rate-bar-track"><div class="rate-bar-fill" style="width:'+wr+'%"></div></div>'+
      '</div>';
  });
  document.getElementById(elId).innerHTML=html||'<div style="color:var(--ink-muted);font-size:0.82rem;">No data yet</div>';
}

function drawLineChart(){
  var canvas=document.getElementById('rrChart');if(!canvas)return;
  var ctx=canvas.getContext('2d');
  var sorted=trades.slice().sort(function(a,b){return (a.date||'')<(b.date||'')?-1:1;});
  var cum=0,points=[];
  for(var i=0;i<sorted.length;i++){var t=sorted[i];if(t.result==='Win')cum+=Number(t.rr||1);else if(t.result==='Loss')cum-=Number(t.rr||1);points.push(cum);}
  var W=canvas.offsetWidth||600,H=180;canvas.width=W;canvas.height=H;ctx.clearRect(0,0,W,H);
  if(points.length<2){ctx.fillStyle='#9A948A';ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText('Add more trades to see your curve',W/2,H/2);return;}
  var pad={t:16,r:20,b:30,l:44},pw=W-pad.l-pad.r,ph=H-pad.t-pad.b;
  var minV=Math.min.apply(null,points.concat([0])),maxV=Math.max.apply(null,points.concat([0]));
  var range=maxV-minV||1;
  function tx(i){return pad.l+(i/(points.length-1))*pw;}
  function ty(v){return pad.t+ph-((v-minV)/range)*ph;}
  ctx.beginPath();ctx.strokeStyle='#DDD8CE';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.moveTo(pad.l,ty(0));ctx.lineTo(pad.l+pw,ty(0));ctx.stroke();ctx.setLineDash([]);
  var grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'rgba(45,106,79,0.25)');grad.addColorStop(1,'rgba(45,106,79,0)');
  ctx.beginPath();ctx.moveTo(tx(0),ty(points[0]));for(var i=1;i<points.length;i++)ctx.lineTo(tx(i),ty(points[i]));ctx.lineTo(tx(points.length-1),ty(0));ctx.lineTo(tx(0),ty(0));ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();ctx.moveTo(tx(0),ty(points[0]));for(var i=1;i<points.length;i++)ctx.lineTo(tx(i),ty(points[i]));ctx.strokeStyle='#2D6A4F';ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();
  ctx.fillStyle='#9A948A';ctx.font='10px monospace';ctx.textAlign='right';
  ctx.fillText(minV.toFixed(1)+'R',pad.l-4,ty(minV)+4);ctx.fillText(maxV.toFixed(1)+'R',pad.l-4,ty(maxV)+4);
}

function drawDonut(w,l,b){
  var canvas=document.getElementById('donutChart');if(!canvas)return;
  var ctx=canvas.getContext('2d'),total=w+l+b;
  ctx.clearRect(0,0,150,150);
  if(!total){document.getElementById('donut-legend').innerHTML='<div style="text-align:center;color:var(--ink-muted);font-size:0.8rem">No data</div>';return;}
  var slices=[{v:w,c:'#2D6A4F',l:'Win'},{v:l,c:'#9B2335',l:'Loss'},{v:b,c:'#2C4A7C',l:'BE'}];
  var angle=-Math.PI/2;
  for(var i=0;i<slices.length;i++){if(!slices[i].v)continue;var sweep=(slices[i].v/total)*Math.PI*2;ctx.beginPath();ctx.moveTo(75,75);ctx.arc(75,75,65,angle,angle+sweep);ctx.closePath();ctx.fillStyle=slices[i].c;ctx.fill();angle+=sweep;}
  ctx.beginPath();ctx.arc(75,75,38,0,Math.PI*2);ctx.fillStyle='var(--card)';ctx.fill();
  ctx.fillStyle='var(--ink)';ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillText(total,75,79);
  var legend='';for(var i=0;i<slices.length;i++){if(!slices[i].v)continue;legend+='<div class="legend-item"><div class="legend-dot" style="background:'+slices[i].c+'"></div><span>'+slices[i].l+': <strong>'+slices[i].v+'</strong> ('+Math.round(slices[i].v/total*100)+'%)</span></div>';}
  document.getElementById('donut-legend').innerHTML=legend;
}

function drawMonthChart(){
  var canvas=document.getElementById('monthChart');if(!canvas)return;
  var ctx=canvas.getContext('2d');
  var monthData={};
  for(var i=0;i<trades.length;i++){
    var d=trades[i].date;if(!d)continue;
    var ym=d.substring(0,7);
    if(!monthData[ym])monthData[ym]={wins:0,losses:0,bes:0};
    if(trades[i].result==='Win')monthData[ym].wins++;
    else if(trades[i].result==='Loss')monthData[ym].losses++;
    else monthData[ym].bes++;
  }
  var keys=Object.keys(monthData).sort().slice(-6);
  var W=canvas.offsetWidth||400,H=160;canvas.width=W;canvas.height=H;ctx.clearRect(0,0,W,H);
  if(!keys.length){ctx.fillStyle='#9A948A';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('No data yet',W/2,H/2);return;}
  var pad={t:10,r:10,b:30,l:10},pw=W-pad.l-pad.r,ph=H-pad.t-pad.b;
  var maxV=0;keys.forEach(function(k){maxV=Math.max(maxV,monthData[k].wins+monthData[k].losses+monthData[k].bes);});
  var bw=pw/keys.length*0.5,gap=pw/keys.length;
  keys.forEach(function(k,i){
    var d=monthData[k],x=pad.l+i*gap+(gap-bw)/2;
    var wh=(d.wins/(maxV||1))*ph,lh=(d.losses/(maxV||1))*ph;
    ctx.fillStyle='#2D6A4F';ctx.beginPath();ctx.roundRect(x,pad.t+ph-wh,bw*0.48,wh,[3,3,0,0]);ctx.fill();
    ctx.fillStyle='#9B2335';ctx.beginPath();ctx.roundRect(x+bw*0.52,pad.t+ph-lh,bw*0.48,lh,[3,3,0,0]);ctx.fill();
    ctx.fillStyle='#9A948A';ctx.font='8px sans-serif';ctx.textAlign='center';
    ctx.fillText(k.substring(5),x+bw/2,H-pad.b+12);
  });
}

function calPrevMonth(){calMonth--;if(calMonth<0){calMonth=11;calYear--;}drawCalendar();}
function calNextMonth(){calMonth++;if(calMonth>11){calMonth=0;calYear++;}drawCalendar();}

function drawCalendar(){
  var grid=document.getElementById('cal-grid');if(!grid)return;
  var label=document.getElementById('cal-month-label');
  if(label)label.textContent=monthNames[calMonth]+' '+calYear;
  var dayMap={};
  for(var i=0;i<trades.length;i++){
    var d=trades[i].date;if(!d)continue;
    if(!dayMap[d])dayMap[d]={wins:0,losses:0,bes:0};
    if(trades[i].result==='Win')dayMap[d].wins++;
    else if(trades[i].result==='Loss')dayMap[d].losses++;
    else dayMap[d].bes++;
  }
  var firstDay=new Date(calYear,calMonth,1).getDay();
  var daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  var today=new Date().toISOString().split('T')[0];
  var html='';
  for(var i=0;i<firstDay;i++)html+='<div class="cal-day empty"></div>';
  for(var day=1;day<=daysInMonth;day++){
    var mm=String(calMonth+1).padStart(2,'0'),dd=String(day).padStart(2,'0');
    var ds=calYear+'-'+mm+'-'+dd;
    var dm=dayMap[ds];
    var cls='cal-day';
    if(ds===today)cls+=' today';
    if(dm){if(dm.wins>0&&dm.losses===0&&dm.bes===0)cls+=' win';else if(dm.losses>0&&dm.wins===0&&dm.bes===0)cls+=' loss';else if(dm.bes>0&&dm.wins===0&&dm.losses===0)cls+=' be';else cls+=' mixed';}
    var tip=ds+(dm?': '+dm.wins+'W/'+dm.losses+'L/'+dm.bes+'BE':'');
    html+='<div class="'+cls+'" style="position:relative;"><span style="font-size:0.55rem;position:absolute;top:2px;left:3px;opacity:0.7;">'+day+'</span><div class="cal-tooltip">'+tip+'</div></div>';
  }
  grid.innerHTML=html;
}

/* NOTES */
function renderNotesList(){
  var list=document.getElementById('notes-list');
  if(!notes.length){list.innerHTML='<div class="empty-state"><div class="empty-icon">&#128221;</div><p>No notes yet</p></div>';return;}
  var html='';
  for(var i=0;i<notes.length;i++){
    var n=notes[i];
    html+='<div class="note-item'+(editingNoteId===n.id?' active':'')+'" onclick="openNote(\''+n.id+'\')">'+
      '<div class="note-item-date">'+(n.date||'')+'</div>'+
      '<div class="note-item-preview">'+(n.title||n.content||'Untitled')+'</div>'+
      '</div>';
  }
  list.innerHTML=html;
}

function openNote(id){
  var note=null;for(var i=0;i<notes.length;i++){if(String(notes[i].id)===String(id)){note=notes[i];break;}}
  if(!note)return;
  editingNoteId=id;
  document.getElementById('note-title-input').value=note.title||'';
  document.getElementById('note-date-input').value=note.date||'';
  document.getElementById('note-content').value=note.content||'';
  document.getElementById('note-editor-section').style.display='flex';
  renderNotesList();
}

function newNote(){
  editingNoteId=null;
  document.getElementById('note-title-input').value='';
  document.getElementById('note-date-input').value=new Date().toISOString().split('T')[0];
  document.getElementById('note-content').value='';
  document.getElementById('note-editor-section').style.display='flex';
}

async function saveNote(){
  var title=document.getElementById('note-title-input').value.trim();
  var date=document.getElementById('note-date-input').value;
  var content=document.getElementById('note-content').value.trim();
  if(!content){showToast('Write something first!');return;}
  showLoading('Saving note...');
  if(editingNoteId){
    var res=await sb.from('journal_notes').update({title:title,date:date,content:content}).eq('id',editingNoteId).select();
    hideLoading();
    if(res.error){showToast('Error saving: '+res.error.message);return;}
    for(var i=0;i<notes.length;i++){if(String(notes[i].id)===String(editingNoteId)){notes[i]=res.data[0];break;}}
  } else {
    var res=await sb.from('journal_notes').insert([{user_id:currentUser.id,title:title,date:date,content:content}]).select();
    hideLoading();
    if(res.error){showToast('Error saving: '+res.error.message);return;}
    notes.unshift(res.data[0]);
    editingNoteId=res.data[0].id;
  }
  renderNotesList();showToast('Note saved!');
}

async function deleteNote(){
  if(!editingNoteId||!confirm('Delete this note?'))return;
  showLoading('Deleting...');
  var res=await sb.from('journal_notes').delete().eq('id',editingNoteId);
  hideLoading();
  if(res.error){showToast('Error deleting');return;}
  notes=notes.filter(function(n){return String(n.id)!==String(editingNoteId);});
  editingNoteId=null;
  document.getElementById('note-editor-section').style.display='none';
  renderNotesList();showToast('Note deleted');
}

/* EXPORT */
function getExportTrades(){
  var from=document.getElementById('export-from').value,to=document.getElementById('export-to').value,result=[];
  for(var i=0;i<trades.length;i++){var t=trades[i];if(from&&t.date&&t.date<from)continue;if(to&&t.date&&t.date>to)continue;result.push(t);}
  return result;
}
function updateExportCount(){var n=getExportTrades().length;document.getElementById('export-count-label').textContent=n+' trade'+(n!==1?'s':'')+' in range';}
function openExportModal(){
  var today=new Date().toISOString().split('T')[0];
  var dates=[];for(var i=0;i<trades.length;i++){if(trades[i].date)dates.push(trades[i].date);}dates.sort();
  document.getElementById('export-from').value=dates.length?dates[0]:today;
  document.getElementById('export-to').value=today;
  updateExportCount();
  document.getElementById('export-modal').classList.add('open');
}
function closeExportModal(){document.getElementById('export-modal').classList.remove('open');}

function exportCSV(){
  var filtered=getExportTrades();if(!filtered.length){showToast('No trades in range!');return;}
  var wins=0,losses=0,bes=0,rrSum=0,rrCount=0;
  for(var i=0;i<filtered.length;i++){if(filtered[i].result==='Win')wins++;else if(filtered[i].result==='Loss')losses++;else bes++;if(filtered[i].rr!==null&&filtered[i].rr!==undefined){rrSum+=Number(filtered[i].rr);rrCount++;}}
  var wr=filtered.length?Math.round((wins/filtered.length)*100):0,avgRR=rrCount?(rrSum/rrCount).toFixed(2):'N/A';
  var csv='SYSTEMICEDGE SUMMARY\nGenerated:,'+new Date().toLocaleDateString()+'\nTotal:,'+filtered.length+'\nWin Rate:,'+wr+'%\nWins:,'+wins+'\nLosses:,'+losses+'\nBE:,'+bes+'\nAvg RR:,'+avgRR+'R\n\n';
  csv+='#,Date,Pair,Dir,Session,Setup,Entry,SL,TP,Lot,RR,Result,Mindset,Notes\n';
  var rev=filtered.slice().reverse();
  for(var i=0;i<rev.length;i++){var t=rev[i];csv+=[(i+1),(t.date||''),(t.pair||''),(t.dir||''),(t.session||''),(t.setup||'').replace(/,/g,' '),(t.entry!==null&&t.entry!==undefined?t.entry:''),(t.sl!==null&&t.sl!==undefined?t.sl:''),(t.tp!==null&&t.tp!==undefined?t.tp:''),(t.lot!==null&&t.lot!==undefined?t.lot:''),(t.rr!==null&&t.rr!==undefined?t.rr:''),(t.result||''),(t.mindset!==null&&t.mindset!==undefined?t.mindset:''),(t.notes||'').replace(/,/g,' ').replace(/\n/g,' ')].join(',')+'\n';}
  var blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='SystemicEdge_'+new Date().toISOString().split('T')[0]+'.csv';a.click();URL.revokeObjectURL(url);
  closeExportModal();showToast('CSV downloaded!');
}

function exportPDF(){
  var filtered=getExportTrades();if(!filtered.length){showToast('No trades in range!');return;}
  var jsPDF=window.jspdf.jsPDF,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  var wins=0,losses=0,bes=0,rrSum=0,rrCount=0;
  for(var i=0;i<filtered.length;i++){if(filtered[i].result==='Win')wins++;else if(filtered[i].result==='Loss')losses++;else bes++;if(filtered[i].rr!==null&&filtered[i].rr!==undefined){rrSum+=Number(filtered[i].rr);rrCount++;}}
  var wr=filtered.length?Math.round((wins/filtered.length)*100):0,avgRR=rrCount?(rrSum/rrCount).toFixed(2):'N/A';
  doc.setFillColor(26,24,20);doc.rect(0,0,297,20,'F');doc.setTextColor(255,255,255);doc.setFontSize(14);doc.setFont('helvetica','bold');doc.text('SystemicEdge Journal',14,13);doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text('Generated: '+new Date().toLocaleDateString(),210,13);
  doc.setTextColor(26,24,20);doc.setFontSize(9);var sx=14;
  var sp=[['Total: '+filtered.length,'Wins: '+wins],['Losses: '+losses,'BE: '+bes],['Win Rate: '+wr+'%','Avg RR: '+avgRR+'R']];
  for(var i=0;i<sp.length;i++){doc.setFont('helvetica','bold');doc.text(sp[i][0],sx,28);doc.setFont('helvetica','normal');doc.text(sp[i][1],sx,34);sx+=80;}
  var headers=['#','Date','Pair','Dir','Session','Setup','Entry','SL','TP','Lot','RR','Result','Notes'],colW=[8,20,18,10,22,28,16,14,14,10,12,16,39],y=42;
  doc.setFillColor(243,240,232);doc.rect(14,y,269,7,'F');doc.setFont('helvetica','bold');doc.setFontSize(7);doc.setTextColor(100,100,100);
  var x=14;for(var i=0;i<headers.length;i++){doc.text(headers[i],x+1,y+5);x+=colW[i];}y+=8;
  doc.setFont('helvetica','normal');doc.setFontSize(7);var rev=filtered.slice().reverse();
  for(var i=0;i<rev.length;i++){var t=rev[i];if(y>185){doc.addPage();y=14;}if(i%2===0){doc.setFillColor(250,248,243);doc.rect(14,y,269,6,'F');}doc.setTextColor(26,24,20);var row=[i+1,(t.date||'-'),(t.pair||'-'),(t.dir||'-'),(t.session||'-'),(t.setup||'-').split(' - ')[0],(t.entry!==null&&t.entry!==undefined?t.entry:'-'),(t.sl!==null&&t.sl!==undefined?t.sl:'-'),(t.tp!==null&&t.tp!==undefined?t.tp:'-'),(t.lot!==null&&t.lot!==undefined?t.lot:'-'),(t.rr?t.rr+'R':'-'),(t.result||'-'),((t.notes||'-').substring(0,35))];x=14;for(var j=0;j<row.length;j++){doc.text(String(row[j]),x+1,y+4.5);x+=colW[j];}y+=6;}
  for(var i=0;i<filtered.length;i++){var t=filtered[i];if(!t.screenshot)continue;doc.addPage();doc.setFillColor(26,24,20);doc.rect(0,0,297,14,'F');doc.setTextColor(255,255,255);doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text((t.pair||'')+' | '+(t.dir||'')+' | '+(t.date||'')+' | '+(t.result||'')+(t.rr?' | '+t.rr+'R':''),14,10);try{doc.addImage(t.screenshot,'JPEG',14,18,269,170,undefined,'FAST');}catch(e){}}
  doc.save('SystemicEdge_'+new Date().toISOString().split('T')[0]+'.pdf');closeExportModal();showToast('PDF downloaded!');
}

window.onresize=function(){if(document.getElementById('view-dashboard')&&document.getElementById('view-dashboard').classList.contains('active'))renderDashboard();};
