/* ===== 交互 ===== */
function setAuto(on){
  autoOn = on;
  const b = document.getElementById('autoBtn');
  b.className = 'btn ' + (on ? 'on' : 'off');
  b.textContent = on ? '自动开' : '自动关';
  try{ localStorage.setItem(LS_AUTO, on ? '1' : '0'); }catch(e){}
  if(on) nextAt = Date.now();
}

function switchTo(k){
  if(active === k) return;
  active = k;
  try{ history.replaceState(null, '', '#' + k); }catch(e){}
  buildGauge(DEFS[k]);
  render(false);
  document.getElementById('more').textContent =
    document.getElementById('rules').classList.contains('open') ? '收起全部区间 ▴' : '展开全部区间 ▾';
}

document.getElementById('tabVIX').onclick = ()=> switchTo('VIX');
document.getElementById('tabVXN').onclick = ()=> switchTo('VXN');
document.getElementById('refreshBtn').onclick = ()=> refresh();
document.getElementById('autoBtn').onclick = ()=> setAuto(!autoOn);

document.getElementById('more').onclick = ()=>{
  const box = document.getElementById('rules');
  const open = box.classList.toggle('open');
  document.getElementById('more').textContent = open ? '收起全部区间 ▴' : '展开全部区间 ▾';
  if(open) renderRules(data[active] ? data[active].value : null);
};

/* 下拉刷新 */
(function(){
  const ptr  = document.getElementById('ptr');
  const txt  = document.getElementById('ptrText');
  let startY = 0, pulling = false, dist = 0;

  document.addEventListener('touchstart', e=>{
    if(window.scrollY <= 0 && !flying){
      startY = e.touches[0].clientY;
      pulling = true; dist = 0;
    }
  }, {passive:true});

  document.addEventListener('touchmove', e=>{
    if(!pulling) return;
    dist = e.touches[0].clientY - startY;
    if(dist <= 0){ pulling = false; ptr.style.height = '0px'; return; }
    if(window.scrollY > 0) return;
    const h = Math.min(dist * 0.55, 56);
    ptr.style.height = h + 'px';
    txt.textContent = h > 44 ? '松开刷新' : '下拉刷新';
  }, {passive:true});

  document.addEventListener('touchend', ()=>{
    if(!pulling) return;
    pulling = false;
    const h = parseFloat(ptr.style.height || '0');
    if(h > 44){
      txt.textContent = '刷新中…';
      ptr.style.height = '44px';
      refresh().finally(()=>{
        setTimeout(()=>{ ptr.style.height = '0px'; txt.textContent = '下拉刷新'; }, 350);
      });
    } else {
      ptr.style.height = '0px';
    }
  }, {passive:true});
})();

document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState !== 'visible') return;
  if(autoOn && Date.now() - (data[active] ? data[active].fetchedAt || 0 : 0) > periodMs() * 1.5) refresh();
});

/* ===== 启动 ===== */
try{
  if(localStorage.getItem(LS_AUTO) === '0') autoOn = false;
}catch(e){}

if(/#VXN/i.test(location.hash)) active = 'VXN';

buildGauge(DEFS[active]);
renderRules(null);
loadCache();
render(false);
setAuto(autoOn);
refresh();
schedule();
startClock();
