/**
 * 此刻 Moment - 设置与偏好
 * 从 public/index.html 拆分而来
 */
// ======================== SIDE MENU & SETTINGS ========================
function openSideMenu(){
  document.getElementById('sideMenu').classList.add('open');
  document.getElementById('menuOverlay').style.display='block';
  updateSideMenuUser();
}
function openQuickSettings(){
  document.getElementById('quickSettings').classList.add('open');
  document.getElementById('menuOverlay').style.display='block';
}
function closeAllPanels(){
  document.getElementById('sideMenu').classList.remove('open');
  document.getElementById('quickSettings').classList.remove('open');
  document.getElementById('menuOverlay').style.display='none';
  closeReportSheet();
  closeModeSheet();
  closeDarkModeSheet();
}
// ======================== QUICK SETTINGS ========================
function toggleDailyPick(){
  var el=document.getElementById('dailyPickState');
  var current=el.textContent==='已开启';
  var next=!current;
  el.textContent=next?'已开启':'已关闭';
  el.style.color=next?'var(--accent)':'var(--muted)';
  if(isLoggedIn()){
    api('/api/user/preferences',{method:'POST',body:{daily_pick_enabled:next}}).catch(function(){});
  }else{
    localStorage.setItem('daily_pick_enabled',next?'1':'0');
  }
}
function restoreBackup(){
  var bk=localStorage.getItem('mv21_backup');
  if(!bk){alert('没有可恢复的本地备份');return}
  var data;try{data=JSON.parse(bk)}catch(e){alert('备份数据已损坏，无法恢复');return}
  if(!data||!data.m||!data.m.length){alert('备份为空，无需恢复');return}
  var at=localStorage.getItem('mv21_backup_at');
  var when=at?new Date(parseInt(at)).toLocaleString('zh-CN'):'未知时间';
  if(!confirm('将用备份恢复本地记录（共'+data.m.length+'条，备份于'+when+'）。\n当前本地记录将被覆盖，确定吗？'))return;
  D={m:data.m,c:typeof data.c==='number'?data.c:data.m.length,i:typeof data.i==='number'?data.i:-1};
  save();
  showToast('已恢复'+data.m.length+'条本地记录');
  updateAllUI();updateSideMenuUser();
}
function doClearCache(){
  if(confirm('清除缓存不会删除你的照片和记录。\n将清理：图片缓存、临时数据。\n确定清除吗？')){
    try{
      // Clear image blob cache
      for(var k in _imgCache){try{URL.revokeObjectURL(_imgCache[k])}catch(e){}}
      _imgCache={};_imgCacheKeys=[];
      // Clear waterfall cached data
      wfMoments=[];wfPage=1;wfHasMore=true;
      // Clear film pool cached data
      filmPool=[];
      // Clear collage cached data
      collageAvailable=[];collageCanvas=null;
    }catch(e){}
    showToast('缓存已清除');
  }
}
function openDarkModeSheet(){
  var mode=getDarkMode();
  document.getElementById('dm-check-auto').style.display=mode==='auto'?'inline':'none';
  document.getElementById('dm-check-light').style.display=mode==='light'?'inline':'none';
  document.getElementById('dm-check-dark').style.display=mode==='dark'?'inline':'none';
  document.getElementById('darkModeSheet').style.transform='translateY(0)';
}
function closeDarkModeSheet(){
  document.getElementById('darkModeSheet').style.transform='translateY(100%)';
}
function getDarkMode(){
  return localStorage.getItem('dark_mode')||(new Date().getHours()>=7&&new Date().getHours()<19?'light':'dark');
}
function effectiveDarkMode(){
  var dm=getDarkMode();
  if(dm==='auto'){return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
  return dm;
}
function setDarkMode(mode){
  localStorage.setItem('dark_mode',mode);
  var label=mode==='auto'?'跟随系统':(mode==='light'?'浅色模式':'深色模式');
  document.getElementById('darkModeState').textContent=label;
  applyDarkMode(mode);
  // 切换模式后重建星空：清空旧元素（深色星星/浅色云朵），按新模式重新生成
  if(starryWorldEnabled&&typeof initStarryWorld==='function'){initStarryWorld()}
  closeDarkModeSheet();
}
function applyDarkMode(mode){
  var r=document.documentElement.style;
  if(mode==='auto'){mode=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
  // Update starry world bg if enabled
  if(starryWorldEnabled){
    var sw=document.getElementById('starryWorld');
    if(sw){sw.setAttribute('data-mode',mode);sw.style.display='block'}
  }
  if(mode==='light'){
    r.setProperty('--bg','#E8F4FD');r.setProperty('--accent','#1E6FA8');
    r.setProperty('--card','#fff');
    r.setProperty('--text','#1c2b36');
    r.setProperty('--muted','#5a7384');
    r.setProperty('--overlay-bg','rgba(255,255,255,.95)');
    r.setProperty('--panel-bg','#EAF4FC');
    r.setProperty('--nav-bg','rgba(232,244,253,.85)');
    r.setProperty('--nav-border','rgba(0,40,80,.10)');
    r.setProperty('--menu-bg','#fff');
    r.setProperty('--menu-sep','rgba(0,40,80,.08)');
    r.setProperty('--tab-bg','#E8F4FD');
    r.setProperty('--sheet-bg','#fff');
    r.setProperty('--overlay-alpha','rgba(0,0,0,.3)');
    r.setProperty('--card-shadow','0 2px 8px rgba(60,158,220,.10)');
    var btn=document.getElementById('mainActionBtn');if(btn)btn.classList.add('light-glass')
    r.setProperty('--world-bg','#0B0E1A');
  }else{
    r.setProperty('--bg','#000');r.setProperty('--accent','#D4A373');
    r.setProperty('--card','#1c1c1e');
    r.setProperty('--text','#f5f5f7');
    r.setProperty('--muted','#98989d');
    r.setProperty('--overlay-bg','rgba(0,0,0,.85)');
    r.setProperty('--panel-bg','#0d0d0f');
    r.setProperty('--nav-bg','rgba(0,0,0,.85)');
    r.setProperty('--nav-border','rgba(255,255,255,.06)');
    r.setProperty('--menu-bg','#0d0d0f');
    r.setProperty('--menu-sep','rgba(255,255,255,.06)');
    r.setProperty('--tab-bg','#000');
    r.setProperty('--sheet-bg','#1c1c1e');
    r.setProperty('--overlay-alpha','rgba(0,0,0,.55)');
    r.setProperty('--card-shadow','none');
    var btn=document.getElementById('mainActionBtn');if(btn)btn.classList.remove('light-glass')
    r.setProperty('--world-bg','#0B0E1A');
  }
}
function toggleImmersiveFX(){
  var current=localStorage.getItem('immersive_fx')!=='0';
  var next=!current;
  localStorage.setItem('immersive_fx',next?'1':'0');
  document.getElementById('immersiveFXState').textContent=next?'已开启':'已关闭';
  document.getElementById('immersiveFXState').style.color=next?'var(--accent)':'var(--muted)';
  showToast(next?'已开启：呼吸动画 + 涟漪触感':'已关闭沉浸特效');
}
function toggleImageQuality(){
  var current=localStorage.getItem('img_quality')||'compressed';
  var next=current==='compressed'?'original':'compressed';
  localStorage.setItem('img_quality',next);
  document.getElementById('imgQualityState').textContent=next==='compressed'?'省流量':'原图';
}
function openLink(url){
  try{window.open(url,'_blank')}catch(e){}
}
function showAbout(){
  closeAllPanels();
  alert('此刻 v304\n记录真实瞬间，连接世界此刻\n\nAndroid下载:\npgyer.com/cike-android-d\nv304: 模块化架构·审核后台·缩略图加速·离线队列·自动备份·安全加固');
}
var _legalTexts={
terms:"<h2>用户协议</h2><p>更新日期：2026年6月26日</p><h3>1. 服务说明</h3><p>此刻App是一款个人生活记录工具，每天为您提供一次记录当下瞬间的机会。</p><h3>2. 用户行为规范</h3><p>不得上传色情、暴力、骚扰、广告或侵犯他人隐私的内容。违反者内容将被移除，严重者账号注销。</p><h3>3. 内容审核</h3><p>您上传的内容可能经过审核。不符合规范的内容将标记为审核中或已被移除。</p><h3>4. 知识产权</h3><p>您拍摄的内容著作权归您所有。您可随时删除内容。</p><h3>5. 免责声明</h3><p>您对上传内容承担法律责任。因不可抗力导致服务中断我们不承担责任。</p><h3>6. 联系我们</h3><p>moment.app@163.com</p>",
privacy:"<h2>隐私政策</h2><p>更新日期：2026年6月26日</p><h3>1. 信息收集</h3><p>仅收集您的手机号（用于登录）和您主动拍摄的照片及文字。不收集位置、通讯录等额外信息。</p><h3>2. 信息使用</h3><p>手机号仅用于账号识别。照片可设为公开（显示在探索）或私密。</p><h3>3. 信息存储</h3><p>数据存储于中国大陆云服务器，采取加密和访问控制保护。</p><h3>4. 信息共享</h3><p>我们不会出售或转让您的个人信息给第三方。</p><h3>5. 您的权利</h3><p>您可随时删除照片或注销账号，注销后数据永久删除。</p><h3>6. 联系我们</h3><p>moment.app@163.com</p>"
};
function openLegalPage(type){
  document.getElementById('legalTitle').textContent=type==='terms'?'用户协议':'隐私政策';
  document.getElementById('legalContent').innerHTML=_legalTexts[type];
  document.getElementById('legalOverlay').style.display='block';
}
function closeLegalPage(){
  document.getElementById('legalOverlay').style.display='none';
}
// Toast helper
function showToast(msg){
  var t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText='position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#fff;font-size:14px;padding:10px 24px;border-radius:20px;z-index:5000;opacity:0;transition:opacity .3s;pointer-events:none';
  document.body.appendChild(t);
  requestAnimationFrame(function(){t.style.opacity='1'});
  setTimeout(function(){t.style.opacity='0';setTimeout(function(){t.remove()},300)},1500);
}
// ======================== REPORT ========================
var reportTargetMomentId=null;
function openReportSheet(momentId){
  reportTargetMomentId=momentId;
  document.getElementById('reportSheet').style.transform='translateY(0)';
  document.getElementById('menuOverlay').style.display='block';
}
function closeReportSheet(){
  document.getElementById('reportSheet').style.transform='translateY(100%)';
  reportTargetMomentId=null;
}
function submitReport(reason){
  if(!isLoggedIn()){alert('登录后才能举报哦');closeReportSheet();return}
  if(!reportTargetMomentId)return;
  api('/api/report',{method:'POST',body:{
    momentId:parseInt(reportTargetMomentId),reason:reason
  }}).then(function(r){
    if(r.error){alert(r.error)}
    else{alert('举报已提交，我们会尽快处理')}
    closeReportSheet();
    document.getElementById('menuOverlay').style.display='none';
  }).catch(function(){alert('网络错误，请重试');closeReportSheet();document.getElementById('menuOverlay').style.display='none'})
}
// ======================== MODE SWITCH ========================
function getWatchMode(){
  var mode=localStorage.getItem('watch_world_mode');
  return mode==='waterfall'?'waterfall':'immersive';
}
function setWatchMode(mode){localStorage.setItem('watch_world_mode',mode)}
function openModeSwitcher(){
  var mode=getWatchMode();
  document.getElementById('check-waterfall').style.display=mode==='waterfall'?'inline':'none';
  document.getElementById('check-immersive').style.display=mode==='immersive'?'inline':'none';
  document.getElementById('modeSheet').style.transform='translateY(0)';
  document.getElementById('menuOverlay').style.display='block';
}
function closeModeSheet(){
  document.getElementById('modeSheet').style.transform='translateY(100%)';
}
function switchMode(mode,animate){
  var oldMode=getWatchMode();
  if(mode===oldMode)return;
  setWatchMode(mode);closeModeSheet();
  document.getElementById('menuOverlay').style.display='none';
  // Always hide the inactive tab
  var immersiveEl=document.getElementById('tab-strangers');
  var waterfallEl=document.getElementById('tab-strangers-waterfall');
  if(animate){
    slideSwitchMode(oldMode,mode);
  }else{
    immersiveEl.style.display='none';
    waterfallEl.style.display='none';
    if(mode==='waterfall'){refreshWaterfall(true)}
    else{immersiveEl.style.display='block';refreshStrangers()}
  }
  showModeToast(mode);
}
var slideAnimId=0;
function slideSwitchMode(from,to){
  var fromTab=from==='waterfall'?'tab-strangers-waterfall':'tab-strangers';
  var toTab=to==='waterfall'?'tab-strangers-waterfall':'tab-strangers';
  var fromEl=document.getElementById(fromTab);
  var toEl=document.getElementById(toTab);
  // Cancel any in-flight slide animation
  slideAnimId++;
  var animId=slideAnimId;
  // Clean up stale inline styles from previous interrupted animation
  fromEl.style.transition=''; fromEl.style.transform=''; fromEl.style.opacity='';
  toEl.style.transition=''; toEl.style.transform=''; toEl.style.opacity='';
  // Prepare target tab offscreen
  toEl.style.display=to==='home'?'flex':'block';
  toEl.style.transition='none';
  toEl.style.transform='translateX(100%)';
  toEl.style.opacity='1';
  if(to==='waterfall'){refreshWaterfall(true)}
  else{refreshStrangers()}
  // Animate: current slides out left, new slides in from right
  requestAnimationFrame(function(){
    if(animId!==slideAnimId)return;
    fromEl.style.transition='transform .25s ease, opacity .25s ease';
    fromEl.style.transform='translateX(-30%)';
    fromEl.style.opacity='0';
    toEl.style.transition='transform .25s ease';
    toEl.style.transform='translateX(0)';
    setTimeout(function(){
      if(animId!==slideAnimId)return; // cancelled by newer animation
      fromEl.style.display='none';
      fromEl.style.transform='';
      fromEl.style.opacity='';
      fromEl.style.transition='';
      toEl.style.transform='';
      toEl.style.opacity='';
      toEl.style.transition='';
    },260);
  });
}
var modeToastTimer=null;
function showModeToast(mode){
  var toast=document.getElementById('modeToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='modeToast';
    toast.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.85);color:#fff;font-size:16px;font-weight:600;padding:12px 28px;border-radius:20px;z-index:5000;opacity:0;transition:opacity .2s;pointer-events:none;letter-spacing:-.2px';
    document.body.appendChild(toast);
  }
  toast.textContent=mode==='waterfall'?'瀑布流':'沉浸';
  toast.style.opacity='1';
  clearTimeout(modeToastTimer);
  modeToastTimer=setTimeout(function(){toast.style.opacity='0'},800);
}
// Swipe gesture for tab-strangers and tab-strangers-waterfall
function initSwipeGestures(){
  var touchStartX=0,touchStartY=0;
  function handleTouchStart(e){touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY}
  function handleTouchEnd(e){
    if(!e.changedTouches||!e.changedTouches.length)return;
    var dx=e.changedTouches[0].clientX-touchStartX;
    var dy=e.changedTouches[0].clientY-touchStartY;
    // Ignore if too close to edges (system back gesture zone)
    var sx=touchStartX;
    if(sx<30||sx>window.innerWidth-30)return;
    // Need horizontal swipe > 30px and horizontal > vertical
    if(Math.abs(dx)<30||Math.abs(dx)<Math.abs(dy))return;
    var mode=getWatchMode();
    if(dx>0&&mode==='immersive'){switchMode('waterfall',true)}       // right swipe -> waterfall
    else if(dx<0&&mode==='waterfall'){switchMode('immersive',true)}  // left swipe -> immersive
  }
  // Attach to both stranger tabs
  var tabs=[document.getElementById('tab-strangers'),document.getElementById('tab-strangers-waterfall')];
  tabs.forEach(function(tab){
    if(tab){
      tab.addEventListener('touchstart',handleTouchStart,{passive:true});
      tab.addEventListener('touchend',handleTouchEnd,{passive:true});
    }
  });
  // Show swipe hint every time entering 看世界
  var swipeHintTimer=null;
  window.showSwipeHint=function(){
    clearTimeout(swipeHintTimer);
    var old=document.getElementById('swipeHint');
    if(old)old.remove();
    var tip=document.createElement('div');
    tip.id='swipeHint';
    tip.style.cssText='position:fixed;bottom:25%;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.1);color:rgba(255,255,255,.6);font-size:13px;padding:8px 20px;border-radius:20px;z-index:5000;opacity:0;transition:opacity .4s;pointer-events:none;letter-spacing:0px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
    tip.textContent='← 滑动切换模式 →';
    document.body.appendChild(tip);
    requestAnimationFrame(function(){tip.style.opacity='1'});
    swipeHintTimer=setTimeout(function(){tip.style.opacity='0';setTimeout(function(){tip.remove()},400)},2000);
  };
}

function updateSideMenuUser(){
  if(AUTH.token){
    document.getElementById('sideMenuLoginPrompt').style.display='none';
    document.getElementById('sideMenuLoggedIn').style.display='block';
    var phone='用户'+AUTH.userId;
    var phInput=document.getElementById('loginPhone');
    if(phInput&&phInput.value.length===11){
      phone=phInput.value.substr(0,3)+'****'+phInput.value.substr(7);
    }
    var savedName=localStorage.getItem('user_nickname');
    document.getElementById('sideMenuNick').textContent=savedName||('用户'+AUTH.userId);
    var savedAvatar=localStorage.getItem('user_avatar');
    if(savedAvatar)applyAvatar(savedAvatar);
    document.getElementById('sideMenuPhoneSmall').textContent=phone;
    // Stats — calc real consecutive days from local photos
    var streak=calcLocalStreak();
    document.getElementById('sideMenuStats').innerHTML='🔥 连续'+streak+'天 &nbsp; 📷 已记录'+D.c+'张';
    // Sync streak from server
    api('/api/stats').then(function(r){if(!r.error&&r.streak!==undefined){
      document.getElementById('sideMenuStats').innerHTML='🔥 连续'+r.streak+'天 &nbsp; 📷 已记录'+D.c+'张';
    }}).catch(function(){});
  }else{
    document.getElementById('sideMenuLoginPrompt').style.display='block';
    document.getElementById('sideMenuLoggedIn').style.display='none';
  }
}
function editNickname(){
  if(!isLoggedIn()){showLogin();return}
  var current=localStorage.getItem('user_nickname')||('用户'+AUTH.userId);
  var name=prompt('修改用户名（最多12字）：',current);
  if(name&&name.trim()){
    name=name.trim().substring(0,12);
    localStorage.setItem('user_nickname',name);
    document.getElementById('sideMenuNick').textContent=name;
    api('/api/user/nickname',{method:'POST',body:{nickname:name}}).then(function(){updateSideMenuUser()}).catch(function(){});
  }
}
function pickAvatar(){
  if(!isLoggedIn()){showLogin();return}
  document.getElementById('avatarPicker').click();
}
function gotAvatar(e){
  var f=e.target.files[0];if(!f)return;
  var r=new FileReader();
  r.onload=function(ev){
    var img=new Image();
    img.onload=function(){
      var size=Math.min(img.width,img.height,200);
      var c=document.createElement('canvas');c.width=size;c.height=size;
      var ctx=c.getContext('2d');
      var sx=(img.width-size)/2,sy=(img.height-size)/2;
      ctx.drawImage(img,sx,sy,size,size,0,0,size,size);
      var dataUrl=c.toDataURL('image/jpeg',0.8);
      localStorage.setItem('user_avatar',dataUrl);
      applyAvatar(dataUrl);
    };
    img.src=ev.target.result;
  };r.readAsDataURL(f);e.target.value='';
}
function applyAvatar(dataUrl){
  var el=document.getElementById('sideMenuAvatar');
  if(el&&dataUrl){
    el.style.backgroundImage='url('+dataUrl+')';
    el.textContent='';
  }
}
function doLogout(){
  if(confirm('确定退出登录吗？')){
    AUTH={token:'',userId:0};saveAuth();
    document.getElementById('sideMenuLoggedIn').style.display='none';
    document.getElementById('sideMenuLoginPrompt').style.display='block';
    closeAllPanels();
    updateAllUI();
    showLogin();
  }
}
function deleteAccount(){
  if(!isLoggedIn()){alert('请先登录');return}
  if(!confirm('确定注销账号吗？\n\n此操作将永久删除你的账号、所有照片、点赞和记录，无法恢复！'))return;
  if(!confirm('再次确认：注销后数据将彻底删除，不可找回。确定继续吗？'))return;
  api('/api/account/delete',{method:'POST',body:{}}).then(function(r){
    if(r.error){alert(r.error);return}
    D={m:[],c:0,i:-1};localStorage.setItem('mv21','{"m":[],"c":0,"i":-1}');
    AUTH={token:'',userId:0};saveAuth();
    closeAllPanels();
    updateAllUI();
    alert('账号已注销');
    location.reload();
  }).catch(function(){alert('网络错误，请重试')})
}
function togglePhotoPublic(){
  var current=localStorage.getItem('photo_public')!=='0';
  var next=!current;
  localStorage.setItem('photo_public',next?'1':'0');
  document.getElementById('photoPublicState').textContent=next?'已开启':'已关闭';
  document.getElementById('photoPublicState').style.color=next?'var(--accent)':'var(--muted)';
  if(isLoggedIn()){api('/api/user/preferences',{method:'POST',body:{photo_public:next}}).catch(function(){})}
}
function showClearConfirm(){
  if(confirm('此操作将永久删除你所有的照片和记录，无法恢复。\n\n确定清空吗？')){
    D={m:[],c:0,i:-1};
    localStorage.setItem('mv21','{"m":[],"c":0,"i":-1}');
    alert('所有记录已清空');
    location.reload();
  }
}


setTimeout(initSwipeGestures,800);

