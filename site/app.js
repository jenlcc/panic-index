/* ===== 指标定义 ===== */
const DEFS = {
  VIX: {
    key:'VIX', title:'标普500恐慌指数', cnbc:'.VIX', tv:'CBOE:VIX',
    scale:[8,40], ticks:[12,15,20,25,35],
    stops:[{max:15,c:'red'},{max:20,c:'amber'},{max:35,c:'green'},{max:Infinity,c:'yellow'}],
    rules:[
      {max:12,       zone:'极度安逸', icon:'✗', cls:'act-no',  act:'停止追高', note:'利润回吐风险高 / 分批止盈'},
      {max:15,       zone:'低波动',   icon:'✗', cls:'act-no',  act:'不宜追高', note:'保持观望 / 维持基础定投'},
      {max:20,       zone:'正常区间', icon:'✓', cls:'act-buy', act:'坚持定投', note:'均值回归 / 按计划执行'},
      {max:25,       zone:'恐惧上升', icon:'✓', cls:'act-buy', act:'分批买入', note:'继续定投 / 动用预备金'},
      {max:35,       zone:'高度恐惧', icon:'✓', cls:'act-buy', act:'加大定投', note:'阶梯加仓 / 逢低扫货'},
      {max:Infinity, zone:'极端恐慌', icon:'✓', cls:'act-buy', act:'激进买入', note:'历史级买点 / 保留子弹'},
    ]
  },
  VXN: {
    key:'VXN', title:'纳指恐慌指数', cnbc:'.VXN', tv:'CBOE:VXN',
    scale:[10,50], ticks:[15,18,24,30,42],
    stops:[{max:18,c:'red'},{max:24,c:'amber'},{max:42,c:'green'},{max:Infinity,c:'yellow'}],
    rules:[
      {max:15,       zone:'极度安逸', icon:'✗', cls:'act-no',  act:'停止追高', note:'纳指高位 / 波动极低，回吐风险高'},
      {max:18,       zone:'低波动',   icon:'✗', cls:'act-no',  act:'不宜追高', note:'观望为主 / 仅维持基础定投'},
      {max:24,       zone:'正常区间', icon:'✓', cls:'act-buy', act:'坚持定投', note:'按计划执行，不做无谓择时'},
      {max:30,       zone:'恐惧上升', icon:'✓', cls:'act-buy', act:'分批买入', note:'纳指回调中 / 动用预备金'},
      {max:42,       zone:'高度恐惧', icon:'✓', cls:'act-buy', act:'加大定投', note:'阶梯加仓 / 逢低扫货'},
      {max:Infinity, zone:'极端恐慌', icon:'✓', cls:'act-buy', act:'激进买入', note:'历史级买点 / 保留子弹'},
    ]
  }
};

const COLORS = {
  red:   {fg:'#f87171', bg:'rgba(239,68,68,.12)', bd:'rgba(239,68,68,.4)',  seg:'rgba(239,68,68,.5)'},
  amber: {fg:'#fbbf24', bg:'rgba(245,158,11,.12)', bd:'rgba(245,158,11,.4)', seg:'rgba(245,158,11,.5)'},
  green: {fg:'#4ade80', bg:'rgba(34,197,94,.12)',  bd:'rgba(34,197,94,.4)',  seg:'rgba(34,197,94,.5)'},
  yellow:{fg:'#fde047', bg:'rgba(250,204,21,.14)', bd:'rgba(250,204,21,.5)', seg:'rgba(250,204,21,.55)'}
};

/* ===== 配置 ===== */
const LS_KEY = 'panic_mobile_v1';
const LS_AUTO = 'panic_mobile_auto';
const TIMEOUT = 9000;
const CNBC_BASE = 'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=';
const CNBC_TAIL = '&requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&events=1';
const CNBC_URL  = CNBC_BASE + '.VIX%7C.VXN' + CNBC_TAIL;
const TV_URL    = 'https://scanner.tradingview.com/america/scan';
const TV_BODY   = JSON.stringify({
  symbols:{tickers:['CBOE:VIX','CBOE:VXN'], query:{types:[]}},
  columns:['close','change','change_abs','open','high','low']
});

/* ===== 状态 ===== */
const data = { VIX:null, VXN:null };
let active = 'VIX';
let autoOn = true;
let nextAt = 0, flying = false, lastErr = '', mode = 'init';
let tickTimer = null, clockTimer = null;

/* ===== 工具 ===== */
function num(x){ const v = parseFloat(x); return isFinite(v) ? v : null; }

function usMarket(){
  const now = new Date();
  let et;
  try{ et = new Date(now.toLocaleString('en-US',{timeZone:'America/New_York'})); }
  catch(e){ return {open:false,label:'美股时段未知'}; }
  const day = et.getDay(), mins = et.getHours()*60 + et.getMinutes();
  if(day===0 || day===6) return {open:false, label:'美股休市'};
  if(mins>=570 && mins<960) return {open:true,  label:'美股盘中'};
  if(mins>=240 && mins<570) return {open:false, label:'美股盘前'};
  if(mins>=960 && mins<1200) return {open:false, label:'美股盘后'};
  return {open:false, label:'美股休市'};
}

function periodMs(){ return usMarket().open ? 20000 : 60000; }

function ago(ts){
  if(!ts) return '';
  const s = Math.floor((Date.now()-ts)/1000);
  if(s < 60) return s + '秒前';
  if(s < 3600) return Math.floor(s/60) + '分钟前';
  if(s < 86400) return Math.floor(s/3600) + '小时前';
  return Math.floor(s/86400) + '天前';
}

function qtime(q){
  const td = (q.last_timedate || '').trim().replace(/\s*EST\s*$/,' ET');
  const lt = (q.last_time || '').trim();
  const m  = lt.match(/(\d{4})-(\d{2})-(\d{2})/);
  const date = m ? m[1] + '-' + m[2] + '-' + m[3] : '';
  if(/[0-9]{1,2}:[0-9]{2}/.test(td)) return (date ? date + ' ' : '') + td;
  return date || td || '—';
}

async function getText(url, opts){
  const ctrl = new AbortController();
  const tid  = setTimeout(()=>ctrl.abort(), TIMEOUT);
  try{
    const r = await fetch(url, Object.assign({signal:ctrl.signal, cache:'no-store', credentials:'omit'}, opts||{}));
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(tid); }
}

/* ===== 数据源 ===== */
async function fromCNBC(){
  const j = JSON.parse(await getText(CNBC_URL));
  const arr = j && j.FormattedQuoteResult && j.FormattedQuoteResult.FormattedQuote;
  if(!arr || !arr.length) throw new Error('CNBC 无报价');
  const out = {};
  for(const k of ['VIX','VXN']){
    const q = arr.find(x => x.symbol === DEFS[k].cnbc);
    if(!q) continue;
    const v = num(q.last);
    if(v == null || v <= 0) continue;
    out[k] = {
      value:v, prev:num(q.previous_day_closing),
      chg:num(q.change), pct:num(q.change_pct),
      open:num(q.open), high:num(q.high), low:num(q.low),
      src:'CNBC', quoteTime: qtime(q)
    };
  }
  if(!out.VIX && !out.VXN) throw new Error('CNBC 数值无效');
  return out;
}

async function fromTV(){
  const j = JSON.parse(await getText(TV_URL, {
    method:'POST', headers:{'Content-Type':'text/plain'}, body:TV_BODY
  }));
  const rows = j && j.data;
  if(!rows || !rows.length) throw new Error('TradingView 无数据');
  const out = {};
  for(const row of rows){
    const k = row.s === DEFS.VIX.tv ? 'VIX' : row.s === DEFS.VXN.tv ? 'VXN' : null;
    if(!k) continue;
    const d = row.d || [];
    const v = num(d[0]);
    if(v == null || v <= 0) continue;
    const pct = num(d[1]);
    out[k] = {
      value:v,
      prev: (pct != null && pct !== 0) ? v/(1+pct/100) : v,
      chg: num(d[2]), pct: pct,
      open: num(d[3]), high: num(d[4]), low: num(d[5]),
      src:'TV', quoteTime:'最新'
    };
  }
  if(!out.VIX && !out.VXN) throw new Error('TradingView 空数据');
  return out;
}

/* ===== 区间计算 ===== */
function colorOf(v, def){
  for(const s of def.stops){ if(v < s.max) return COLORS[s.c]; }
  return COLORS.yellow;
}

function ruleIndexFor(v, def){
  for(let i=0;i<def.rules.length;i++){ if(v < def.rules[i].max) return i; }
  return def.rules.length-1;
}

function rangeLabel(i, def){
  if(i === 0) return '<' + def.rules[0].max;
  const lo = def.rules[i-1].max;
  return def.rules[i].max === Infinity ? '≥' + lo : lo + '–' + def.rules[i].max;
}

function nextInfo(v, def){
  const t = def.ticks.find(x => v < x);
  if(t == null){
    return {txt:'已在最高档，严格执行纪律', near:false};
  }
  const idx  = def.rules.findIndex(r => r.max > t);
  const rule = def.rules[idx];
  const gap  = t - v;
  const near = gap <= Math.max(0.4, t * 0.02);
  return {
    txt:'距 ' + t + '「' + (rule ? rule.zone : '') + '」还差 ' + gap.toFixed(2) + (near ? ' · 接近临界' : ''),
    near
  };
}

/* ===== 刻度条 ===== */
function buildGauge(def){
  const [lo, hi] = def.scale;
  const span = hi - lo;
  let segs = '', marks = '';
  let from = lo;
  for(const s of def.stops){
    const to = Math.min(s.max, hi);
    if(to > from){
      segs += '<div class="g-seg" style="width:' + ((to-from)/span*100) + '%;background:'
            + COLORS[s.c].seg + '"></div>';
    }
    from = to;
    if(from >= hi) break;
  }
  for(const t of def.ticks){
    marks += '<div class="g-tick" style="left:' + ((t-lo)/span*100) + '%">' + t + '</div>';
  }
  document.getElementById('gTrack').innerHTML  = segs;
  document.getElementById('gLabels').innerHTML = marks;
}

function moveMarker(v, def){
  const [lo, hi] = def.scale;
  let pos = (v - lo)/(hi - lo)*100;
  pos = Math.max(1, Math.min(99, pos));
  const m = document.getElementById('gMarker');
  m.style.left = pos + '%';
  m.style.color = colorOf(v, def).fg;
}
