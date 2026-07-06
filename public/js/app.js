/**
 * 此刻 Moment - 全局状态与导航
 * 从 public/index.html 拆分而来
 */
var D={m:[],c:0,i:-1};
try{var s=localStorage.getItem('mv21');if(s){D=JSON.parse(s);if(!D.m)D.m=[];if(typeof D.c!='number')D.c=D.m.length;if(typeof D.i!='number')D.i=-1}}catch(e){}
var API=(localStorage.getItem('mv_api')||'').replace(/\/+$/,'')||(location.protocol==='https:'?'https://cikemoment.cn':'http://124.156.163.213:3000');var AUTH={token:'',tokenCreatedAt:0,userId:0};
// SECURITY: Prevent path traversal in image URLs
function safeImageUrl(url){
  if(!url)return'';
  if(url.startsWith('data:'))return url;
  // Remove any path traversal attempts
  url=url.replace(/\.\.\//g,'').replace(/\.\.\\/g,'');
  return url;
}
function imgUrl(path){if(!path)return'';if(path.indexOf('http')===0||path.indexOf('data:')===0)return path;return API+path}
function escapeHtml(s){if(s==null)return'';return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function safeId(v){var n=parseInt(v,10);return isNaN(n)?0:n}

// ======================== NAVIGATION ========================
var currentTab='home';
var tabOrder=['photos','home','strangers'];
function navTo(tab){
  if(tab===currentTab)return;
  // Hide all tabs
  ['tab-home','tab-photos','tab-strangers','tab-strangers-waterfall'].forEach(function(x){
    var el=document.getElementById(x);if(el){el.style.display='none';el.style.transform='';el.style.opacity='';el.style.transition=''}
  });
  // Clean up old tab timers
  clearTimeout(wfIdleTimer);clearTimeout(filmTimer);
  // Show target tab
  if(tab==='strangers'){
    var m=getWatchMode();
    if(m==='waterfall'){refreshWaterfall(true)}
    else{document.getElementById('tab-strangers').style.display='block';refreshStrangers()}
    if(window.showSwipeHint)window.showSwipeHint();
  }else{
    document.getElementById('tab-'+tab).style.display=tab==='home'?'flex':'block';
  }
  currentTab=tab;
  updateNavActive(tab);
  if(tab==='photos'){refreshGallery();if(!starryWorldEnabled){var dm=effectiveDarkMode();document.documentElement.style.setProperty('--bg',dm==='light'?'#E8F4FD':'#1c1c1e')}}
  if(tab==='home')updateHomeUI();
  document.getElementById('captured').style.display='none';if(starryWorldEnabled)dimStarsForPhoto(false);
  document.getElementById('collage').style.display='none';stopCountdown();
}
function updateNavActive(tab){
  ['home','photos','strangers'].forEach(function(x){
    var el=document.getElementById('nav-'+x);
    if(el){el.classList.toggle('active',x===tab)}
  });
}


// ======================== UPDATE ALL UI ========================
function updateAllUI(){
  updateHomeUI();
  if(currentTab==='photos')refreshGallery();
  if(currentTab==='strangers'){if(getWatchMode()==='waterfall')refreshWaterfall(true);else refreshStrangers();}
}

// ======================== SAVE ========================
function save(){try{localStorage.setItem('mv21',JSON.stringify(D))}catch(e){if(confirm('存储空间不足。\n\n可尝试：\n1. 清除缓存释放空间\n2. 备份当前记录再清空\n\n要备份并清空本地记录吗？')){try{localStorage.setItem('mv21_quota_backup',JSON.stringify(D));localStorage.setItem('mv21_quota_backup_at',String(Date.now()))}catch(ex){}D={m:[],c:0,i:-1};localStorage.setItem('mv21','{"m":[],"c":0,"i":-1}');showToast('已备份并清空本地记录，可在设置中恢复');setTimeout(function(){location.reload()},1500)}else{showToast('无法保存，请手动清理浏览器数据或减少本地记录')}}}

// ======================== OFFLINE QUEUE ========================
var _processingQueue=false;
function processPendingQueue(){
  if(_processingQueue)return;
  if(!isLoggedIn()||!navigator.onLine)return;
  var pending=[];
  for(var i=0;i<D.m.length;i++){if(D.m[i]._pending)pending.push({idx:i,m:D.m[i]})}
  if(pending.length===0)return;
  _processingQueue=true;
  var total=pending.length,success=0,fail=0;
  function processNext(i){
    if(i>=pending.length){
      _processingQueue=false;
      if(success>0){showToast('已自动上传'+success+'条离线记录'+(fail>0?'，'+fail+'条失败':''));updateAllUI()}
      return;
    }
    var item=pending[i];
    api('/api/moments',{method:'POST',body:{dataUrl:item.m.u,thought:item.m.t||''}}).then(function(r){
      if(r.error){fail++;processNext(i+1);return}
      D.m[item.idx].id=r.id;D.m[item.idx]._pending=false;
      if(r.imageUrl)D.m[item.idx].u=r.imageUrl;
      success++;save();processNext(i+1);
    }).catch(function(){fail++;processNext(i+1)});
  }
  processNext(0);
}

