/**
 * 此刻 Moment - 登录认证
 * 从 public/index.html 拆分而来
 */
try{var as=localStorage.getItem('mv_auth');if(as)AUTH=JSON.parse(as)}catch(e){}
function saveAuth(){localStorage.setItem('mv_auth',JSON.stringify(AUTH))}
function isLoggedIn(){return !!AUTH.token}
var onboardPage=0;
function startApp(){document.getElementById('onboarding').style.display='none';localStorage.setItem('mv_welcome','1');showLogin()}
function onboardNext(){var t=document.getElementById('onboard-track');var d=document.querySelectorAll('.onboard-dot');onboardPage++;if(onboardPage>=3){startApp();return}t.style.transform='translateX(-'+(onboardPage*100/3)+'%)';d.forEach(function(dot,i){dot.style.opacity=i===onboardPage?'1':'.4'})}
function onboardPrev(){if(onboardPage<=0)return;var t=document.getElementById('onboard-track');var d=document.querySelectorAll('.onboard-dot');onboardPage--;t.style.transform='translateX(-'+(onboardPage*100/3)+'%)';d.forEach(function(dot,i){dot.style.opacity=i===onboardPage?'1':'.4'})}
function initOnboardSwipe(){var el=document.getElementById('onboarding');var sx=0,sy=0;el.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});el.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-sx;var dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){if(dx<0)onboardNext();else if(dx>0)onboardPrev()}},{passive:true})}
function showLogin(){document.getElementById('loginScreen').style.display='flex';var btn=document.getElementById('loginBtn');if(btn){btn.textContent=localStorage.getItem('mv_has_logged_in')?'登录':'注册'}}
function skipLogin(){document.getElementById('loginScreen').style.display='none';updateAllUI();if(starryWorldEnabled&&typeof initStarryWorld==='function'){setTimeout(initStarryWorld,400)}}
function fetchTimeout(url,opts,ms){ms=ms||10000;return new Promise(function(resolve,reject){var t=setTimeout(function(){reject(new Error('timeout'))},ms);fetch(url,opts).then(function(r){clearTimeout(t);resolve(r)}).catch(function(e){clearTimeout(t);reject(e)})})}
var _sendingSMS=false,_smsTimer=null;
function sendSMS(){
  var btn=document.getElementById('smsBtn');
  if(_sendingSMS||(btn&&btn.disabled))return;
  var ph=document.getElementById('loginPhone').value.replace(/\s/g,'');
  var msg=document.getElementById('loginMsg');
  if(ph.length<11){msg.textContent='请输入11位手机号';return}
  _sendingSMS=true;clearInterval(_smsTimer);msg.textContent='';
  if(!btn)return;
  btn.disabled=true;btn.textContent='发送中...';
  clearInterval(_smsTimer);
  fetchTimeout(API+'/api/sms/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:ph})},10000)
  .then(function(r){return r.json()}).then(function(d){
    if(d.error){msg.textContent=d.error;resetSMSBtn(btn);return}
    msg.textContent='验证码已发送';
    var sec=60;btn.textContent=sec+'s';
    _smsTimer=setInterval(function(){sec--;if(sec<=0){clearInterval(_smsTimer);resetSMSBtn(btn)}else{btn.textContent=sec+'s'}},1000);
  }).catch(function(){msg.textContent='网络错误，请重试';resetSMSBtn(btn)})
}
function resetSMSBtn(btn){_sendingSMS=false;clearInterval(_smsTimer);btn.disabled=false;btn.textContent='获取验证码'}
var _loggingIn=false;
function doLogin(){
  if(_loggingIn)return;_loggingIn=true;
  var ph=document.getElementById('loginPhone').value.replace(/\s/g,'');
  var code=document.getElementById('loginCode').value.replace(/\s/g,'');
  var msg=document.getElementById('loginMsg');
  if(ph.length<11){msg.textContent='请输入11位手机号';_loggingIn=false;return}
  if(code.length!==6){msg.textContent='请输入6位验证码';_loggingIn=false;return}
  var loginBtn=document.getElementById('loginBtn');
  if(loginBtn){loginBtn.disabled=true;loginBtn.textContent='登录中...'}
  msg.textContent='';
  fetchTimeout(API+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:ph,code:code})},10000)
  .then(function(r){return r.json()}).then(function(d){
    if(d.error){msg.textContent=d.error;_loggingIn=false;if(loginBtn){loginBtn.disabled=false;loginBtn.textContent=localStorage.getItem('mv_has_logged_in')?'登录':'注册'}return}
    AUTH.token=d.token;AUTH.tokenCreatedAt=d.tokenCreatedAt||Date.now();AUTH.userId=d.userId;saveAuth();localStorage.setItem('mv_has_logged_in','1');
    if(d.nickname){localStorage.setItem('user_nickname',d.nickname)}
    if(d.avatar){localStorage.setItem('user_avatar',d.avatar);applyAvatar(d.avatar)}
    if(D.m.length>0){if(!confirm('登录将使用服务器数据。本地'+D.m.length+'条记录将被替换（已自动备份，可在设置中恢复）。继续？')){msg.textContent='';_loggingIn=false;if(loginBtn){loginBtn.disabled=false;loginBtn.textContent=localStorage.getItem('mv_has_logged_in')?'登录':'注册'}return}
      try{localStorage.setItem('mv21_backup',JSON.stringify(D));localStorage.setItem('mv21_backup_at',String(Date.now()))}catch(e){}
    }
    D={m:[],c:0,i:-1};localStorage.setItem('mv21','{"m":[],"c":0,"i":-1}');
    _loggingIn=false;document.getElementById('loginScreen').style.display='none';
    updateSideMenuUser();updateAllUI();
    if(starryWorldEnabled&&typeof initStarryWorld==='function'){setTimeout(initStarryWorld,400)}
  }).catch(function(e){msg.textContent='网络错误，请重试';_loggingIn=false;if(loginBtn){loginBtn.disabled=false;loginBtn.textContent=localStorage.getItem('mv_has_logged_in')?'登录':'注册'}})
}
function handleAuthExpired(){
  if(!AUTH.token)return;
  AUTH={token:'',tokenCreatedAt:0,userId:0};saveAuth();
  updateSideMenuUser();updateAllUI();
  showToast('登录已过期，请重新登录');
  setTimeout(showLogin,1500);
}
function api(path,opts){
  opts=opts||{};
  var url=API+path;
  var o={method:opts.method||'GET',headers:{'x-auth-token':AUTH.token}};
  if(opts.body){o.headers['Content-Type']='application/json';o.body=JSON.stringify(opts.body)}
  return fetch(url,o).then(function(r){
    if(r.status===401){
      // Only expire auth if our server confirms it (check response body)
      return r.json().then(function(d){
        if(d.error==='请先登录'||d.error==='登录已过期'){handleAuthExpired()}
        return Promise.reject(d.error||'auth_required');
      }).catch(function(){return Promise.reject('auth_required')});
    }
    return r.json();
  }).then(function(d){
    if(d.code==='AUTH_EXPIRED'||d.code==='AUTH_INVALID'){handleAuthExpired();return Promise.reject('auth_expired')}
    if(d.tokenExpired){handleAuthExpired();return Promise.reject('auth_expired')}
    return d;
  })
}
function logout(){if(confirm('退出登录？本地数据保留。')){AUTH={token:'',tokenCreatedAt:0,userId:0};saveAuth();updateSideMenuUser();updateAllUI()}}

