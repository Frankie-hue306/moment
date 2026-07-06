/**
 * 此刻 Moment - 初始化与入口
 * 从 public/index.html 拆分而来
 */
// ======================== INIT ========================
var seenWelcome=localStorage.getItem('mv_welcome');
if(AUTH.token&&AUTH.userId){setTimeout(function(){updateAllUI();updateSideMenuUser();processPendingQueue()},500)}
else if(!seenWelcome){setTimeout(function(){document.getElementById('onboarding').style.display='block';initOnboardSwipe()},500)}
else{setTimeout(showLogin,800)}

// Offline queue: auto-upload pending moments when connectivity returns
window.addEventListener('online',function(){
  if(typeof processPendingQueue==='function'){setTimeout(processPendingQueue,1000)}
});

// Immersive film pool auto-refreshes every 30s via loadFilmPool timer

// Status bar spacing now handled via env(safe-area-inset-top) in CSS
// Init UI
setTimeout(function(){
  updateHomeUI();updateSideMenuUser();
  // Init quick settings states
  // Sync daily pick from server if logged in
  if(isLoggedIn()){
    api('/api/user/preferences').then(function(r){
      if(!r.error){
        var dp=r.daily_pick_enabled!==false;
        document.getElementById('dailyPickState').textContent=dp?'已开启':'已关闭';
        document.getElementById('dailyPickState').style.color=dp?'var(--accent)':'var(--muted)';
      }
    }).catch(function(){});
  }else{
    var dp=localStorage.getItem('daily_pick_enabled')!=='0';
    document.getElementById('dailyPickState').textContent=dp?'已开启':'已关闭';
    document.getElementById('dailyPickState').style.color=dp?'var(--accent)':'var(--muted)';
  }
  var photoPublic=localStorage.getItem('photo_public')!=='0';
  document.getElementById('photoPublicState').textContent=photoPublic?'已开启':'已关闭';
  document.getElementById('photoPublicState').style.color=photoPublic?'var(--accent)':'var(--muted)';
  var dm=getDarkMode();
  document.getElementById('darkModeState').textContent=dm==='auto'?'跟随系统':(dm==='light'?'浅色模式':'深色模式');
  var iq=localStorage.getItem('img_quality')||'compressed';
  document.getElementById('imgQualityState').textContent=iq==='compressed'?'省流量':'原图';
  var sw=localStorage.getItem('starry_world')!=='0';
  document.getElementById('starryWorldState').textContent=sw?'已开启':'已关闭';
  document.getElementById('starryWorldState').style.color=sw?'var(--accent)':'var(--muted)';
  var ifx=localStorage.getItem('immersive_fx')!=='0';
  document.getElementById('immersiveFXState').textContent=ifx?'已开启':'已关闭';
  document.getElementById('immersiveFXState').style.color=ifx?'var(--accent)':'var(--muted)';
  applyDarkMode(dm);
},100);
// Haptic click feedback
var _clickAudio=null;
function hapticClick(){
  try{
    if(navigator.vibrate)navigator.vibrate(8);
    if(!_clickAudio){var ctx=new(window.AudioContext||window.webkitAudioContext)();_clickAudio=function(){var o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=120;g.gain.setValueAtTime(.03,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.05);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.05)}}
    _clickAudio();
  }catch(e){}
}
// Add haptic to all interactive elements
setTimeout(function(){
  document.querySelectorAll('button, .menu-row, .nav-item, .btn, #mainActionBtn, .wf-card, [onclick]').forEach(function(el){
    if(!el.hasAttribute('data-haptic')){
      el.setAttribute('data-haptic','1');
      el.addEventListener('click',function(e){hapticClick()});
    }
  });
},600);

// ====================== CUSTOM DIALOG ======================
function showCustomDialog(msg,onOk,onCancel){
  var overlay=document.createElement('div');overlay.className='custom-dialog-overlay';
  var dlg=document.createElement('div');dlg.className='custom-dialog';
  dlg.innerHTML='<p>'+escapeHtml(msg)+'</p><div class="btn-row"><button class="btn-cancel">取消</button><button class="btn-ok">确定</button></div>';
  overlay.appendChild(dlg);document.body.appendChild(overlay);
  dlg.querySelector('.btn-ok').onclick=function(){overlay.remove();if(onOk)onOk()};
  dlg.querySelector('.btn-cancel').onclick=function(){overlay.remove();if(onCancel)onCancel()};
  overlay.onclick=function(e){if(e.target===overlay){overlay.remove();if(onCancel)onCancel()}};
}


// ====================== IMAGE PROXY ======================
// Image proxy cache with LRU limit (max 30 entries)
var _imgCache={};
var _imgCacheKeys=[];
var _IMG_CACHE_MAX=30;
function cacheImage(url, blobUrl){
  if(_imgCache[url])return;
  // Evict oldest if cache full
  while(_imgCacheKeys.length>=_IMG_CACHE_MAX){
    var oldest=_imgCacheKeys.shift();
    if(_imgCache[oldest]){URL.revokeObjectURL(_imgCache[oldest]);delete _imgCache[oldest]}
  }
  _imgCache[url]=blobUrl;
  _imgCacheKeys.push(url);
}
// Listen for system dark mode changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(e){if(getDarkMode()==='auto')applyDarkMode('auto')});
