/**
 * 此刻 Moment - 探索世界
 * 从 public/index.html 拆分而来
 */
// ======================== WATERFALL ========================
var wfPage=1,wfHasMore=true,wfLoading=false,wfMoments=[],wfIdleTimer=null;
var WF_MAX_CARDS=50;  // Max visible cards before DOM recycling kicks in
var wfRecycledHeight=0;
function resetWFIdleTimer(){
  clearTimeout(wfIdleTimer);
  wfIdleTimer=setTimeout(function(){
    if(currentTab==='strangers'&&getWatchMode()==='waterfall'){
      refreshWaterfall(true);
    }
  },60000);
}
function refreshWaterfall(reset){
  if(reset){wfPage=1;wfHasMore=true;wfMoments=[];wfRecycledHeight=0;document.getElementById('wf-grid').innerHTML='';document.getElementById('wf-end').style.display='none'}
  document.getElementById('tab-strangers-waterfall').style.display='block';
  loadWaterfallPage();
  updateStrangerStats();
  resetWFIdleTimer();
}
function loadWaterfallPage(){
  if(wfLoading||!wfHasMore)return;
  wfLoading=true;document.getElementById('wf-loading').style.display='block';
  fetchTimeout(API+'/api/explore?page='+wfPage+'&limit=15&sort=recent',null,15000).then(function(r){return r.json()}).then(function(d){
    document.getElementById('wf-loading').style.display='none';
    if(d.moments&&d.moments.length>0){
      wfMoments=wfMoments.concat(d.moments);
      renderWaterfallCards(d.moments,true);
      recycleCards();
      wfPage++;wfHasMore=d.hasMore;
      if(!d.hasMore){document.getElementById('wf-end').style.display='block'}
    }else{wfHasMore=false;document.getElementById('wf-end').style.display='block'}
    wfLoading=false;
    // Update global stats
    if(d.total){document.getElementById('wf-stats').textContent='🌐 '+d.total+'个瞬间'}
  }).catch(function(){document.getElementById('wf-loading').style.display='none';wfLoading=false})
}
function renderWaterfallCards(moments,append){
  var grid=document.getElementById('wf-grid');
  if(!append)grid.innerHTML='';
  moments.forEach(function(m){
    var card=document.createElement('div');
    card.className='wf-card';
    card.onclick=function(){viewStrangerMoment(m)};
    var timeAgo=formatTimeAgo(m.created_at);
    var thought=m.thought||'';
    var thoughtHtml=thought?'<div class="wf-thought">'+escapeHtml(thought)+'</div>':'';
    var infoDiv=document.createElement('div');
    infoDiv.className='wf-info';
    infoDiv.innerHTML='<div class="wf-time">'+timeAgo+'</div>'+thoughtHtml;
    var img=document.createElement('img');
    img.style='width:100%;display:block;background:var(--card);min-height:120px;object-fit:cover';
    img.src=imgUrl(m.thumbnailUrl||m.imageUrl);
    img.loading='lazy';
    img.onerror=function(){this.style.display='none'};
    card.appendChild(img);
    card.appendChild(infoDiv);
    grid.appendChild(card);
  });
}
// DOM recycling: remove off-screen cards when count exceeds WF_MAX_CARDS
function recycleCards(){
  var grid=document.getElementById('wf-grid');
  var cards=grid.querySelectorAll('.wf-card');
  if(cards.length<=WF_MAX_CARDS)return;
  var removeCount=cards.length-WF_MAX_CARDS;
  var removedH=0;
  for(var i=0;i<removeCount;i++){
    removedH+=cards[i].offsetHeight+parseInt(getComputedStyle(cards[i]).marginBottom||8);
    cards[i].remove();
  }
  wfRecycledHeight+=removedH;
  var spacer=document.getElementById('wf-spacer');
  if(!spacer){spacer=document.createElement('div');spacer.id='wf-spacer';grid.insertBefore(spacer,grid.firstChild)}
  spacer.style.height=wfRecycledHeight+'px';
}
function formatTimeAgo(dateStr){
  if(!dateStr)return '';
  var d=new Date(dateStr+'Z');if(isNaN(d.getTime()))d=new Date(dateStr);
  var now=new Date(),diff=Math.floor((now-d)/1000);
  if(diff<60)return '刚刚';
  if(diff<3600)return Math.floor(diff/60)+'分钟前';
  if(diff<86400)return Math.floor(diff/3600)+'小时前';
  if(diff<604800)return Math.floor(diff/86400)+'天前';
  return d.toLocaleDateString('zh-CN');
}
// Shared helper: render stranger moment detail overlay (used by waterfall & filmstrip)
function showStrangerDetail(moment){
  stopCountdown();document.getElementById('countdownBadge').style.display='none';
  var phEl=document.getElementById('ph');phEl.onerror=function(){this.style.display='none'};
  phEl.src=imgUrl(moment.imageUrl);
  document.getElementById('viewText').textContent=moment.thought||'(无文字)';
  document.getElementById('viewDate').textContent=formatTimeAgo(moment.created_at);
  document.getElementById('publishUI').style.display='none';
  document.getElementById('viewUI').style.display='block';
  document.getElementById('btn3dv').style.display='none';
  document.querySelectorAll('#viewUI > button').forEach(function(b){b.style.display='none'});
  var viewUI=document.getElementById('viewUI');
  var existing=document.getElementById('strangerDetailActions');
  if(existing)existing.remove();
  var actions=document.createElement('div');
  actions.id='strangerDetailActions';
  var _mid=safeId(moment.id);
  actions.innerHTML='<div style="display:flex;gap:8px;margin-top:12px;align-items:stretch"><button class="btn" onclick="event.stopPropagation();doWorldLike(this,'+_mid+')" style="text-align:center;flex:1">❤️ ...</button><button onclick="event.stopPropagation();openReportSheet('+_mid+')" class="btn" style="text-align:center;flex-shrink:0;padding:18px 16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:14px;color:rgba(255,255,255,.4);font-size:16px;cursor:pointer">⚠️</button></div>';
  viewUI.appendChild(actions);
  if(moment.id&&isLoggedIn()){
    api('/api/like?momentId='+moment.id).then(function(r){
      var b=actions.querySelector('button');
      if(b)b.textContent='❤️ '+(r.count||0);
    }).catch(function(){var b=actions.querySelector('button');if(b)b.textContent='❤️ LIKE'})
  }else{var b=actions.querySelector('button');if(b)b.textContent='❤️ 0'}
  document.getElementById('capturedLabel').textContent='探索';
  document.getElementById('capturedBackBtn').style.display='';
  document.getElementById('captured').style.display='flex';if(starryWorldEnabled)dimStarsForPhoto(true);
}
function viewStrangerMoment(m){
  showStrangerDetail(m);
}
function backFromStrangerDetail(){if(starryWorldEnabled)dimStarsForPhoto(false);
  closeZoom();
  document.getElementById('captured').style.display='none';
  document.getElementById('countdownBadge').style.display='';
  var pausedRows=[];document.querySelectorAll('[id^=filmRow]').forEach(function(r){if(r.getAttribute('data-paused')==='1')pausedRows.push(r.id)});
  document.querySelectorAll('[id^=filmRow]').forEach(function(r){r.setAttribute('data-paused','0');var t=r.querySelector('.film-track');if(t)t.style.animationPlayState='running'});
  pausedRows.forEach(function(id){var r=document.getElementById(id);if(r){r.setAttribute('data-paused','1');var t=r.querySelector('.film-track');if(t)t.style.animationPlayState='paused'}});
  navTo('strangers');
}
// Scroll load for waterfall
setTimeout(function(){
  var wfEl=document.getElementById('tab-strangers-waterfall');
  if(wfEl){
    wfEl.addEventListener('scroll',function(){
      resetWFIdleTimer();
      var btn=document.getElementById('wf-backTop');
      if(btn)btn.style.display=this.scrollTop>400?'flex':'none';
      if(this.scrollTop+this.clientHeight>=this.scrollHeight-300){
        if(!wfLoading&&wfHasMore)loadWaterfallPage();
      }
    });
    wfEl.addEventListener('click',function(){resetWFIdleTimer()});
    // Pull-to-refresh
    var pullStartY=0,pulling=false,pullEl=null;
    wfEl.addEventListener('touchstart',function(e){
      if(wfEl.scrollTop<=0){
        pullStartY=e.touches[0].clientY;pulling=true;
      }
    },{passive:true});
    wfEl.addEventListener('touchmove',function(e){
      if(!pulling)return;
      var dy=e.touches[0].clientY-pullStartY;
      if(dy>20&&dy<80){
        if(!pullEl){
          pullEl=document.createElement('div');
          pullEl.style.cssText='text-align:center;padding:4px;color:var(--accent);font-size:13px;transition:none';
          pullEl.textContent='↓ 释放刷新';
          wfEl.insertBefore(pullEl,wfEl.firstChild);
        }
        pullEl.style.padding=(Math.min(dy,60)-10)+'px 0 4px';
      }
    },{passive:true});
    wfEl.addEventListener('touchend',function(e){
      if(!pulling)return;
      var dy=e.changedTouches[0].clientY-pullStartY;
      if(dy>50&&wfEl.scrollTop<=0){
        if(pullEl)pullEl.textContent='刷新中...';
        refreshWaterfall(true);
      }
      if(pullEl){setTimeout(function(){if(pullEl)pullEl.remove();pullEl=null},300)}
      pulling=false;
    },{passive:true});
  }
},500);
function scrollToTop(){
  var wfEl=document.getElementById('tab-strangers-waterfall');
  if(wfEl){
    wfEl.scrollTo({top:0,behavior:'smooth'});
    setTimeout(function(){refreshWaterfall(true)},400);
  }
}


// ======================== IMMERSIVE FILMSTRIP ========================
var filmPool=[],filmTimer=null;
function refreshStrangers(){
  document.getElementById('tab-strangers').style.display='block';
  loadFilmPool();
  startFilmTime();
}
function startFilmTime(){
  var tab=document.getElementById('tab-strangers');if(tab){tab.style.display='block';tab.style.opacity='';tab.style.transform='';tab.style.transition='';}
  if(starryWorldEnabled&&effectiveDarkMode()!=='light'){setTimeout(welcomeMeteorShower,3000)}
}
function updateStrangerStats(){} // stub - stats now in filmstrip time header
function loadFilmPool(){
  fetch(API+'/api/explore?limit=50&sort=recent').then(function(r){return r.json()}).then(function(d){
    if(d.moments&&d.moments.length){
      // Merge with existing pool (don't lose paused row references)
      var poolMap={};
      for(var i=0;i<filmPool.length;i++){poolMap[filmPool[i].id]=filmPool[i]}
      for(var j=0;j<d.moments.length;j++){poolMap[d.moments[j].id]=d.moments[j]}
      filmPool=[];
      for(var k in poolMap){filmPool.push(poolMap[k])}
      filmPool.sort(function(a,b){return (b.id||0)-(a.id||0)});
      if(filmPool.length>100)filmPool=filmPool.slice(0,100);
      renderFilmRows();
    }
  }).catch(function(){});
  clearTimeout(filmTimer);
  filmTimer=setTimeout(loadFilmPool,30000);
}
function renderFilmRows(){
  if(filmPool.length===0)return;
  // Split pool into 3 non-overlapping groups for visual variety
  var shuffled=filmPool.slice().sort(function(){return Math.random()-.5});
  var third=Math.ceil(shuffled.length/3);
  buildRow('filmRow1',shuffled.slice(0,third),'left');
  buildRow('filmRow2',shuffled.slice(third,third*2),'right');
  buildRow('filmRow3',shuffled.slice(third*2),'left');
}
function buildRow(id,photos,dir){
  var row=document.getElementById(id);
  if(!row)return;
  // Duplicate for seamless loop
  var all=photos.concat(photos);
  var html='<div class="film-track '+dir+'">';
  all.forEach(function(p,i){
    var author=p.author_phone_masked||getNickname('');
    var timeAgo=formatTimeAgo(p.created_at||'');
    html+='<div class="film-photo" data-row="'+id+'" onclick="viewFilmPhoto('+p.id+',&quot;'+id+'&quot;)"><img src="'+imgUrl((p.thumbnailUrl||p.imageUrl))+'" loading="lazy"><div class="film-label"><span>'+author+'</span><span class="film-time-label">'+timeAgo+'</span></div></div>';
  });
  html+='</div>';
  row.innerHTML=html;
  // Resume animation if not paused
  var track=row.querySelector('.film-track');
  if(track&&row.getAttribute('data-paused')==='1')track.style.animationPlayState='paused';
}
var _filmLastTouch=0;
function toggleFilmRow(el){
  if(Date.now()-_filmLastTouch<500)return;
  _filmLastTouch=Date.now();
  if(el.getAttribute('data-paused')==='1'){el.setAttribute('data-paused','0');var t=el.querySelector('.film-track');if(t)t.style.animationPlayState='running'}
  else{el.setAttribute('data-paused','1');var t=el.querySelector('.film-track');if(t)t.style.animationPlayState='paused'}
}
function viewFilmPhoto(id,rowId){
  if(rowId){
    var rowEl=document.getElementById(rowId);
    if(rowEl){rowEl.setAttribute('data-paused','1');var t=rowEl.querySelector('.film-track');if(t)t.style.animationPlayState='paused'}
  }
  var found=null;
  for(var i=0;i<filmPool.length;i++){if(filmPool[i].id===id){found=filmPool[i];break}}
  if(!found)return;
  showStrangerDetail(found);
}
function doWorldLike(btn,momentId){
  if(!momentId){return}
  if(!isLoggedIn()){alert('登录后才能点赞哦');return}
  btn.textContent='❤️ ...';btn.disabled=true;
  api('/api/like',{method:'POST',body:{momentId:parseInt(momentId)}}).then(function(r){
    if(!r.error){btn.textContent='❤️ '+(r.count||0);btn.style.background=r.liked?'rgba(255,80,80,.5)':'rgba(255,107,53,.3)'}
    btn.disabled=false
  }).catch(function(){btn.textContent='❤️ LIKE';btn.disabled=false})
}

