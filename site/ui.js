/* ===== 渲染 ===== */
function render(flash){
  const def = DEFS[active];
  const d   = data[active];

  document.getElementById('tabValVIX').textContent = data.VIX ? data.VIX.value.toFixed(2) : '--.--';
  document.getElementById('tabValVXN').textContent = data.VXN ? data.VXN.value.toFixed(2) : '--.--';
  document.getElementById('tabVIX').className = 'tab' + (active==='VIX' ? ' on' : '');
  document.getElementById('tabVXN').className = 'tab' + (active==='VXN' ? ' on' : '');

  document.getElementById('mkt').textContent = usMarket().label;

  const valEl = document.getElementById('val');
  const chgEl = document.getElementById('chg');

  if(!d){
    valEl.textContent = '--.--';
    valEl.classList.add('loading');
    valEl.style.color = 'var(--amber)';
    chgEl.className = 'chg flat';
    chgEl.textContent = '—';
    document.getElementById('chgSub').textContent = '昨收 —';
    document.getElementById('zone').textContent = '暂无行情，点刷新重试';
    document.getElementById('zone').style.color = 'var(--muted)';
    document.getElementById('aAct').textContent = '—';
    document.getElementById('aNote').textContent = '—';
    document.getElementById('aNext').textContent = '';
    document.getElementById('cmp').innerHTML = '';
    document.getElementById('dot').className = 'dot err';
    document.getElementById('state').textContent = '离线';
    const b = document.getElementById('banner');
    b.className = 'banner show err';
    b.textContent = '⚠ 行情接口暂不可用' + (lastErr ? '：' + lastErr : '');
    renderRules(null);
    return;
  }

  const v = d.value;

  valEl.textContent = v.toFixed(2);
  valEl.classList.remove('loading');
  if(flash){
    valEl.classList.remove('flash');
    void valEl.offsetWidth;
    valEl.classList.add('flash');
  }

  const c = colorOf(v, def);
  valEl.style.color = c.fg;
  document.getElementById('panel').style.setProperty('--glow', c.fg + '55');
  moveMarker(v, def);

  const idx  = ruleIndexFor(v, def);
  const rule = def.rules[idx];

  const zoneEl = document.getElementById('zone');
  zoneEl.style.setProperty('--zbg', c.bg);
  zoneEl.style.setProperty('--zbd', c.bd);
  zoneEl.style.color = c.fg;
  zoneEl.innerHTML = '当前 <span class="big">' + v.toFixed(2) + '</span> · '
    + (rule.icon==='✓' ? '绿灯 ' : '红灯 ') + rule.zone;

  let chg = d.chg, pct = d.pct;
  if(chg == null && d.prev != null){
    chg = v - d.prev;
    pct = d.prev ? chg/d.prev*100 : null;
  }
  if(chg != null){
    chgEl.className = 'chg ' + (chg > 0 ? 'up' : chg < 0 ? 'down' : 'flat');
    chgEl.textContent = (chg>=0?'+':'') + chg.toFixed(2)
      + (pct != null ? ' (' + (pct>=0?'+':'') + pct.toFixed(2) + '%)' : '');
  } else {
    chgEl.className = 'chg flat';
    chgEl.textContent = '—';
  }
  document.getElementById('chgSub').textContent =
    '昨收 ' + (d.prev != null ? d.prev.toFixed(2) : '—');

  document.getElementById('advice').style.borderLeftColor = c.fg;
  const aAct = document.getElementById('aAct');
  aAct.textContent = rule.act;
  aAct.style.color = c.fg;
  document.getElementById('aNote').textContent = rule.note;
  const nx = nextInfo(v, def);
  const nxEl = document.getElementById('aNext');
  nxEl.textContent = nx.txt;
  nxEl.style.color = nx.near ? '#fbbf24' : 'var(--muted)';

  const set = (id, val)=> document.getElementById(id).textContent = (val == null) ? '—' : val.toFixed(2);
  set('stOpen', d.open); set('stHigh', d.high); set('stLow', d.low); set('stPrev', d.prev);

  const other = active === 'VIX' ? 'VXN' : 'VIX';
  const od = data[other];
  const cmpEl = document.getElementById('cmp');
  if(od && data.VXN && data.VIX){
    const gap = data.VXN.value - data.VIX.value;
    const pct2 = data.VIX.value ? gap/data.VIX.value*100 : 0;
    cmpEl.innerHTML =
      '<span class="chip">VIX <b>' + data.VIX.value.toFixed(2) + '</b></span>'
      + '<span class="chip">VXN <b>' + data.VXN.value.toFixed(2) + '</b></span>'
      + '<span>纳指溢价 <b style="color:' + (gap >= 0 ? '#f87171' : '#4ade80') + '">'
      + (gap>=0?'+':'') + gap.toFixed(2) + '（' + (pct2>=0?'+':'') + pct2.toFixed(1) + '%）</b></span>';
  } else {
    cmpEl.innerHTML = '<span class="chip">' + other + ' <b>—</b></span>';
  }

  const modeTxt = {live:'实时', cache:'缓存', error:'离线', init:'连接中'};
  document.getElementById('dot').className =
    'dot ' + (mode==='live' ? 'on' : (mode==='cache' ? 'warn' : 'err'));
  document.getElementById('state').textContent =
    (modeTxt[mode] || '连接中')
    + (d.src ? ' · ' + d.src : '')
    + (mode==='cache' ? ' · ' + ago(d.fetchedAt) : '');

  const b = document.getElementById('banner');
  if(mode === 'cache'){
    b.className = 'banner show';
    b.textContent = '⚠ 主源未响应，显示 ' + ago(d.fetchedAt) + ' 的缓存' + (lastErr ? '（' + lastErr + '）' : '');
  } else if(mode === 'live' && d.src !== 'CNBC'){
    b.className = 'banner show';
    b.textContent = '已切到备用源 TradingView';
  } else {
    b.className = 'banner';
    b.textContent = '';
  }

  document.getElementById('qtime').textContent =
    '行情 ' + (d.quoteTime || '—') + (d.fetchedAt ? ' · 拉取 ' + ago(d.fetchedAt) : '');

  renderRules(v);
}

function renderRules(v){
  const def  = DEFS[active];
  const box  = document.getElementById('rules');
  const on   = (v == null) ? -1 : ruleIndexFor(v, def);
  const line = { 'act-buy': 'var(--green)', 'act-no': 'var(--red)' };
  box.innerHTML = def.rules.map((r, i) => {
    const isOn = i === on;
    return '<div class="rule ' + (isOn?'on':'') + '" style="'
      + (isOn ? 'border-left-color:' + (line[r.cls] || 'var(--line)') + ';' : '')
      + '">'
      + '<div class="r1"><div class="r-rng">' + rangeLabel(i, def) + '</div>'
      + '<div class="r-zn">' + r.zone + '</div></div>'
      + '<div class="r-note">' + r.note + '</div>'
      + '<div class="r-act ' + r.cls + '">' + r.icon + ' ' + r.act + '</div>'
      + '</div>';
  }).join('');
}

/* ===== 取数 ===== */
async function refresh(){
  if(flying) return;
  flying = true;
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('spin');

  const failed = [];
  try{
    for(const fn of [fromCNBC, fromTV]){
      try{
        const got = await fn();
        const stamp = Date.now();
        for(const k of ['VIX','VXN']){
          if(!got[k]) continue;
          data[k] = Object.assign({}, got[k], {fetchedAt: stamp});
        }
        mode = 'live';
        lastErr = failed.length ? failed[0] : '';
        saveCache();
        render(true);
        return;
      }catch(e){
        failed.push((e && e.message) || 'error');
      }
    }

    lastErr = failed.join(' | ');
    mode = (data.VIX || data.VXN) ? 'cache' : 'error';
    render(false);
    console.warn('[指数] 取数失败：', lastErr);
  } finally {
    flying = false;
    btn.classList.remove('spin');
    nextAt = Date.now() + periodMs();
  }
}

/* ===== 缓存 ===== */
function saveCache(){
  try{
    localStorage.setItem(LS_KEY, JSON.stringify({VIX:data.VIX, VXN:data.VXN}));
  }catch(e){}
}

function loadCache(){
  try{
    const d = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if(!d) return;
    let hit = false;
    for(const k of ['VIX','VXN']){
      const x = d[k];
      if(!x || !isFinite(x.value) || x.value <= 0) continue;
      if(x.fetchedAt && Date.now() - x.fetchedAt > 3*24*3600*1000) continue;
      data[k] = x; hit = true;
    }
    if(hit){ mode = 'cache'; render(false); }
  }catch(e){}
}

/* ===== 定时 ===== */
function schedule(){
  clearInterval(tickTimer);
  tickTimer = setInterval(()=>{
    if(!autoOn) return;
    if(Date.now() >= nextAt) refresh();
  }, 4000);
  nextAt = Date.now() + periodMs();
}

function startClock(){
  clearInterval(clockTimer);
  clockTimer = setInterval(()=>{
    const left = Math.max(0, Math.round((nextAt - Date.now())/1000));
    document.getElementById('tick').textContent = autoOn
      ? '每 ' + periodMs()/1000 + ' 秒刷新 · 下一跳 ' + left + 's'
      : '已暂停自动刷新';
  }, 1000);
}
