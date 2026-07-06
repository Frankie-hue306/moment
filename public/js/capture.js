/**
 * 此刻 Moment - 拍照与发布
 * 从 public/index.html 拆分而来
 */
// ======================== PHOTO TAKING ========================
var countdownTimer=null,countdownSec=0,countdownDeadline=0;
function pick(){
  var now=Date.now();
  // One-shot: deadline set once, never resets until expired or photo taken
  if(countdownDeadline<=now){countdownDeadline=now+60000}
  countdownSec=Math.max(0,Math.ceil((countdownDeadline-now)/1000));
  document.getElementById('pkr').click();
  updateCountdown();
  clearInterval(countdownTimer);
  countdownTimer=setInterval(function(){
    countdownSec=Math.max(0,Math.ceil((countdownDeadline-Date.now())/1000));
    updateCountdown();
    if(countdownSec<=0){cancelPhoto()}
  },1000);
}
function updateCountdown(){
  var el=document.getElementById('countdownBadge');
  if(el){el.textContent=countdownSec+'s';el.style.color=countdownSec<=10?'rgba(255,80,80,.9)':'rgba(255,255,255,.6)'}
  // Ring progress
  var ring=document.querySelector('#countdownRing circle');
  if(ring){
    ring.setAttribute('opacity','1');
    var pct=countdownSec/60;
    ring.style.strokeDashoffset=(521.5*(1-pct));
    ring.style.stroke=countdownSec<=10?'#FF6B6B':(starryWorldEnabled?'#fff':'#1C1C1E');
  }
}
function cancelPhoto(){
  clearInterval(countdownTimer);
  countdownSec=0;
  // If user hasn't taken a photo yet, cancel and go home (keep deadline for continuity)
  if(document.getElementById('captured').style.display!=='flex'){
    document.getElementById('pkr').value='';
    navTo('home');
    return;
  }
  // If photo is shown but not published, auto-publish
  countdownDeadline=0;
  if(document.getElementById('publishUI').style.display!=='none'){
    saveMoment();
  }
}
function stopCountdown(){
  clearInterval(countdownTimer);
  countdownSec=0;countdownDeadline=0;
  var ring=document.querySelector('#countdownRing circle');
  if(ring){ring.setAttribute('opacity','0');ring.style.strokeDashoffset='0'}
}
function gotPhoto(e){
  stopCountdown();
  var f=e.target.files[0];if(!f)return;
  var r=new FileReader();
  r.onload=function(ev){
    resizeImage(ev.target.result,function(thumb){
      D.i=-1; // prevent saveTh from corrupting previous photo
      document.getElementById('ph').src=thumb;
      document.getElementById('th').value='';
      document.getElementById('cc').textContent='0';
      document.getElementById('st').textContent='写好感想，点下方发布';
      document.getElementById('publishUI').style.display='block';
      document.getElementById('viewUI').style.display='none';
      document.getElementById('capturedLabel').textContent='已记录';
      document.getElementById('captured').style.display='flex';if(starryWorldEnabled)dimStarsForPhoto(true);
      document.getElementById('th').focus();
    });
  };r.readAsDataURL(f);e.target.value='';
}
var savingMoment=false;
function saveMoment(){
  if(savingMoment)return;
  savingMoment=true;
  // Disable the publish button
  var publishBtn=document.querySelector('#publishUI div[onclick]');
  if(publishBtn){publishBtn.style.opacity='.5';publishBtn.style.pointerEvents='none'}
  var t=document.getElementById('th').value.slice(0,20);
  function done(){
    savingMoment=false;
    if(publishBtn){publishBtn.style.opacity='';publishBtn.style.pointerEvents=''}
  }
  if(isLoggedIn()){
    var dataUrl=document.getElementById('ph').src;
    // Offline mode: queue locally, upload later
    if(!navigator.onLine){
      D.c++;D.m.unshift({u:dataUrl,t:t,d:Date.now(),_pending:true});D.i=0;save();
      showToast('已保存到本地，联网后自动上传');
      afterCaptureBack();
      updateAllUI();
      done();
      return;
    }
    api('/api/moments',{method:'POST',body:{dataUrl:dataUrl,thought:t}}).then(function(r){
      if(r.error){
        if(r.code==='CONTENT_REJECTED'){alert('内容不符合社区规范，未发布');done();return}
        else{alert(r.error);done();return}
      }
      D.c++;D.m.unshift({u:r.imageUrl||dataUrl,t:t,d:Date.now(),id:r.id});D.i=0;save();
      if(r.newBadge){
        var b=r.newBadge;
        var msg='🎉 恭喜！你已连续打卡'+b.days+'天，获得【'+b.name+'】徽章 '+b.emoji;
        if(b.days===306)msg='🎈 恭喜！连续打卡306天，获得【诞辰之光】徽章 🎈 这一天，因你而特别。';
        setTimeout(function(){alert(msg)},500);
      }
      afterCaptureBack();
      updateAllUI();
      done();
    }).catch(function(){showToast('发布失败，请检查网络后重试');done()})
  }else{
    D.c++;var u=document.getElementById('ph').src;D.m.unshift({u:u,t:t,d:Date.now()});D.i=0;save();
    afterCaptureBack();
    updateAllUI();
    done();
  }
}
function zoomPhoto(){
  var img=document.getElementById('ph');
  if(!img||!img.src)return;
  document.getElementById('photoZoomImg').src=img.src;
  document.getElementById('photoZoom').style.display='flex';
}
function closeZoom(){
  document.getElementById('photoZoom').style.display='none';
}
function afterCaptureBack(){if(starryWorldEnabled)dimStarsForPhoto(false);
  closeZoom();stopCountdown();
  document.getElementById('captured').style.display='none';
  var pausedRows=[];document.querySelectorAll('[id^=filmRow]').forEach(function(r){if(r.getAttribute('data-paused')==='1')pausedRows.push(r.id)});
  document.querySelectorAll('[id^=filmRow]').forEach(function(r){r.setAttribute('data-paused','0');var t=r.querySelector('.film-track');if(t)t.style.animationPlayState='running'});
  pausedRows.forEach(function(id){var r=document.getElementById(id);if(r){r.setAttribute('data-paused','1');var t=r.querySelector('.film-track');if(t)t.style.animationPlayState='paused'}});
  navTo('home');
}
function saveTh(){if(D.i>=0&&D.i<D.m.length){D.m[D.i].t=document.getElementById('th').value.slice(0,20);save()}}
var is3D=false;
function toggle3D(){
  is3D=!is3D;var img=document.getElementById('ph');var btn=document.getElementById('btn3d');var b2=document.getElementById('btn3dv');
  if(is3D){img.classList.add('depth3d');btn.textContent='✨ 3D开';btn.style.background='var(--accent)';if(b2)b2.textContent='✨ 3D开';if(b2)b2.style.background='var(--accent)'}
  else{img.classList.remove('depth3d');btn.textContent='✨ 3D景深';btn.style.background='var(--accent)';if(b2)b2.textContent='✨ 3D景深';if(b2)b2.style.background='var(--accent)'}
}
function resizeImage(dataUrl,cb){var img=new Image();img.onload=function(){var w=img.width,h=img.height;var maxDim=2048;var needResize=w>maxDim||h>maxDim;var cw=needResize?Math.round(w*Math.min(maxDim/w,maxDim/h)/2)*2:w;var ch=needResize?Math.round(h*Math.min(maxDim/w,maxDim/h)/2)*2:h;var c=document.createElement('canvas');c.width=cw;c.height=ch;var ctx=c.getContext('2d');ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,cw,ch);ctx.drawImage(img,0,0,cw,ch);var id=ctx.getImageData(0,0,cw,ch);var px=id.data;var topDark=0;for(var y=0;y<ch;y++){var sum=0;for(var x=0;x<Math.min(cw,20);x++){var i=(y*cw+x)*4;sum+=px[i]+px[i+1]+px[i+2]}if(sum/(Math.min(cw,20)*3)<30)topDark=y;else break}var finalH=ch-topDark;if(topDark>10&&topDark<ch*.25&&finalH>100){var c2=document.createElement('canvas');c2.width=cw;c2.height=finalH;var ctx2=c2.getContext('2d');ctx2.fillStyle='#FFFFFF';ctx2.fillRect(0,0,cw,finalH);ctx2.drawImage(c,0,topDark,cw,finalH,0,0,cw,finalH);cb(c2.toDataURL('image/jpeg',0.85))}else{cb(c.toDataURL('image/jpeg',0.85))}};img.src=dataUrl}

