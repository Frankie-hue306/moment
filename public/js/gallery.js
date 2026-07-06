/**
 * 此刻 Moment - 日记画廊与首页
 * 从 public/index.html 拆分而来
 */
// ======================== LOCAL STREAK (real consecutive days) ========================
function getDateKey(ts){
  return new Date(ts||Date.now()).toLocaleDateString('zh-CN');
}
function calcLocalStreak(){
  if(D.m.length===0)return 0;
  var sorted=D.m.slice().sort(function(a,b){return (b.d||0)-(a.d||0)});
  var streak=1;
  var todayKey=getDateKey(Date.now());
  // Get yesterday's key for comparison
  var d=new Date(Date.now()-86400000);
  var yesterdayKey=d.toLocaleDateString('zh-CN');
  // Check if the most recent photo is today or yesterday
  var latestKey=getDateKey(sorted[0].d);
  if(latestKey!==todayKey&&latestKey!==yesterdayKey)return 0;
  // Walk backwards counting consecutive days
  for(var i=0;i<sorted.length-1;i++){
    var curKey=getDateKey(sorted[i].d);
    var nxtKey=getDateKey(sorted[i+1].d);
    // Calculate day difference using date strings
    var curD=new Date(sorted[i].d||Date.now());
    var nxtD=new Date(sorted[i+1].d||Date.now());
    var diffDays=Math.round((curD.getTime()-nxtD.getTime())/86400000);
    if(diffDays===1){streak++}
    else if(diffDays===0){continue}
    else{break}
  }
  return streak;
}

// ======================== TODAY STATUS ========================
function todayPhotoIdx(){
  var today=new Date().toLocaleDateString('zh-CN');
  for(var i=0;i<D.m.length;i++){
    var d=new Date(D.m[i].d||Date.now());
    if(d.toLocaleDateString('zh-CN')===today)return i;
  }
  return -1;
}
function isTodayTaken(){return todayPhotoIdx()>=0}
var _dailyQuotes={
  unrecorded:[
    '流光容易把人抛，且记此刻。','今日尚未定格，等你按下快门。','花开花谢，此刻最值得记录。',
    '盛年不重来，一日难再晨。','眼下时光，稍纵即逝。','这个世界，正在等你记录。',
    '韶华不再，吾辈须当惜阴。','人生直作百岁翁，亦是万古一瞬中。','总得花看能几日，最难留惜是芳时。',
    '百年能几日，忍不惜光阴。','今天的空白，等你来填满。','此刻安静，世界在等你看见。',
    '日子匆忙，别忘了抬头看看。','时间在走，今天还没留下痕迹。','每一个当下，都是未来的礼物。',
    '你有多久，没有好好看过眼前了？','记录此刻，便是留住永恒。','今日的光，尚未被收藏。',
    '一瞬一世界，此刻最真实。','今天的故事，还没有开头。','浮生若梦，为欢几何。记下此刻。',
    '人生如逆旅，我亦是行人。此刻即风景。','世间万物，皆在流转。唯有此刻可留。','莫待明朝花落尽，今朝有景今朝拍。',
    '晨昏交替，此刻唯一。','每一天，都是余生的第一天。','此情此景，此时此地。',
    '按下快门，把今天留住。','今日晴好，宜记录。','世界很大，你看到了什么？'
  ],
  recorded:[
    '此时情绪此时天，无事小神仙。','今日已存档，人间又值得。','时光清浅处，一步一安然。',
    '今日无事，小神仙。','今天扫完今天的落叶。','今日定格，明日可期。',
    '此刻已留，余事皆安。','日日是好日，今朝尤可记。','往事不回头，今日已存档。',
    '莫道桑榆晚，为霞尚满天。','人间有味是清欢，今日已记。','此中有真意，欲辨已忘言。',
    '今天的风，今天的云，今天的光，都存好了。','花开了，我看见了。今日无憾。','日子发光，是因为你记录了它。',
    '今日之一瞬，已成永恒。','这一页今天，翻过去了。','很好，今天没有被辜负。',
    '时间路过，我按下了快门。','今日收工，人间值得。','无事小神仙，今日已归档。',
    '此情可待成追忆，今日已录。','一瞬已留，万事从容。','今天，到此为止。余事皆安。',
    '岁月不居，时节如流。今日已存。','花看半开，酒饮微醺，今日恰好。','今天的故事，已经讲完了。',
    '今日美景，已存入记忆。','日光之下，并无新事。但今日是我之唯一。','已完成今日仪式。明日再见。'
  ]
};
function getDailyQuote(type){
  var today=new Date().toLocaleDateString('zh-CN');
  var stored=localStorage.getItem('mv_daily_quote');
  var data=stored?JSON.parse(stored):{date:'',unIdx:-1,recIdx:-1};
  if(data.date!==today){
    data.date=today;
    data.unIdx=Math.floor(Math.random()*_dailyQuotes.unrecorded.length);
    data.recIdx=Math.floor(Math.random()*_dailyQuotes.recorded.length);
    localStorage.setItem('mv_daily_quote',JSON.stringify(data));
  }
  return type==='recorded'?_dailyQuotes.recorded[data.recIdx]:_dailyQuotes.unrecorded[data.unIdx];
}
function updateHomeUI(){
  var btn=document.getElementById('mainActionBtn');
  var status=document.getElementById('todayStatus');
  var idx=todayPhotoIdx();
  var glow=document.querySelector('.btn-shoot-glow');
  if(idx>=0){
    status.textContent='✅ 今日已记录';
    status.style.color='rgba(72,199,142,.8)';
    btn.innerHTML='查看今日<br>照片';
    btn.classList.add('taken');
    if(glow){glow.style.background='radial-gradient(circle,rgba(212,163,115,.2),transparent 70%)';glow.style.animationDuration='4s'}
    document.getElementById('reminderHint').textContent=getDailyQuote('recorded');
  }else{
    status.textContent='🌍';
    status.style.color='var(--muted)';
    btn.innerHTML='拍下<br>此刻';
    btn.classList.remove('taken');
    if(glow){glow.style.background='radial-gradient(circle,rgba(167,139,250,.2),transparent 70%)';glow.style.animationDuration='2s'}
    document.getElementById('reminderHint').textContent=getDailyQuote('unrecorded');
  }
  // Show today's date
  var now=new Date();
  document.getElementById('todayDate').textContent=(now.getMonth()+1)+'月'+now.getDate()+'日';
}
function mainAction(){
  var idx=todayPhotoIdx();
  if(idx>=0){viewTodayPhoto(idx)}
  else{pick()}
}
function viewTodayPhoto(idx){
  view(idx);
  // Show nav back hint
  document.getElementById('capturedLabel').textContent='今日记录';
}


// ======================== GALLERY ========================
function refreshGallery(){
  var g=document.getElementById('gr');
  if(isLoggedIn()){
    api('/api/gallery').then(function(r){
      if(r.moments&&r.moments.length){r.moments.forEach(function(sm){var existsIdx=-1;for(var k=0;k<D.m.length;k++){if(D.m[k].id===sm.id||((sm.imageUrl||sm.dataUrl)&&D.m[k].u===(sm.imageUrl||sm.dataUrl)&&Math.abs(D.m[k].d-new Date(sm.created_at+'Z').getTime())<5000)||(D.m[k]._localId&&sm.imageUrl)){existsIdx=k;break}};if(existsIdx>=0){D.m[existsIdx].status=sm.status;D.m[existsIdx].u=sm.dataUrl||D.m[existsIdx].u;D.m[existsIdx].rejectedMessage=sm.rejectedMessage;D.m[existsIdx].id=sm.id;D.m[existsIdx]._localId=null}});D.c=D.m.length;save()}
      renderGallery();
    }).catch(renderGallery)
  }else{renderGallery()}
}
function renderGallery(){
  var g=document.getElementById('gr');
  // Update gallery stats
  var days=D.m.length;
  var streak=0;
  if(D.m.length>0){var first=new Date(D.m[D.m.length-1].d||Date.now());streak=Math.floor((Date.now()-first.getTime())/86400000)+1}
  // Sync badges from server for side menu display
  if(isLoggedIn()){
    api('/api/stats').then(function(r){
      if(!r.error){updateSideMenuUser()}
    }).catch(function(){});
  }

  if(!D.m.length){g.innerHTML='<div style="color:#555;font-size:13px;text-align:center;padding:40px 0">还没有记录</div>';return}
  var groups={},order=[];
  D.m.forEach(function(m,i){var d=new Date(m.d||Date.now());var key=d.toLocaleDateString('zh-CN');if(!groups[key]){groups[key]=[];order.push(key)};groups[key].push({m:m,i:i,time:d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})})});
  var today=new Date().toLocaleDateString('zh-CN');
  var yesterday=new Date(Date.now()-86400000).toLocaleDateString('zh-CN');
  var html='';
  order.forEach(function(date){var items=groups[date];var label=date;if(date===today)label='今天';else if(date===yesterday)label='昨天';
    html+='<div style="color:var(--muted);font-size:14px;font-weight:600;margin:18px 0 8px;letter-spacing:-.3px">'+label+' · '+items.length+'张</div>';
    items.forEach(function(item){var statusTag='';var clickable=true;
      if(item.m.status==='pending'){statusTag='<span style="color:rgba(255,180,60,.8);font-size:10px;margin-left:6px">审核中</span>'}
      if(item.m.status==='rejected'){statusTag='<span style="color:rgba(255,80,80,.6);font-size:10px;margin-left:6px">已被移除</span>';clickable=false}
      if(item.m.status==='hidden'){statusTag='<span style="color:rgba(255,80,80,.5);font-size:10px;margin-left:6px">审核中</span>'}
      if(item.m._pending){statusTag='<span style="color:#D4A373;font-size:10px;margin-left:6px">等待上传</span>'}
      html+='<div '+(clickable?'onclick="view('+item.i+')"':'')+' style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--card);border-radius:12px;margin-bottom:6px;'+(clickable?'cursor:pointer;':'opacity:.5;')+'-webkit-tap-highlight-color:transparent">';
      html+='<img src="'+(item.m.u||'data:image/svg+xml,'+encodeURIComponent('<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2252%22 height=%2252%22><rect fill=%22%23222%22 width=%2252%22 height=%2252%22/><text fill=%22%23555%22 x=%2226%22 y=%2230%22 text-anchor=%22middle%22 font-size=%2212%22>🚫</text></svg>'))+'" onerror="this.style.display=\'none\'" style="width:52px;height:52px;object-fit:cover;border-radius:8px;flex-shrink:0;background:#111">';
      html+='<div style="flex:1;min-width:0"><div style="color:var(--text);font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.2px">'+escapeHtml(item.m.t||'无文字')+statusTag+'</div><div style="color:var(--muted);font-size:12px;margin-top:3px">'+item.time+'</div></div>';
      if(clickable)html+='<div style="color:var(--muted);font-size:12px">›</div>';
      html+='</div>'})});
  g.innerHTML=html;
}
function view(i){D.i=i;var m=D.m[i];var phEl=document.getElementById('ph');phEl.onerror=function(){this.style.display='none'};
  if(m.status==='rejected'){
    document.getElementById('ph').src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect fill="#1c1c1e" width="180" height="180" rx="20"/><text fill="#555" x="90" y="85" text-anchor="middle" font-size="40">🚫</text><text fill="#666" x="90" y="115" text-anchor="middle" font-size="12">已被移除</text></svg>');
    document.getElementById('viewText').textContent=m.rejectedMessage||'该内容因违反社区规范已被移除';
    document.getElementById('viewDate').textContent=new Date(m.d||Date.now()).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }else{
    document.getElementById('ph').src=m.u;
    document.getElementById('viewText').textContent=m.t||'(无文字)';
    document.getElementById('viewDate').textContent=new Date(m.d||Date.now()).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  document.getElementById('publishUI').style.display='none';document.getElementById('viewUI').style.display='block';
  // Restore own-photo buttons
  document.getElementById('btn3dv').style.display='';
  document.querySelectorAll('#viewUI > button').forEach(function(b){b.style.display=''});
  // Remove stranger actions
  var sa=document.getElementById('strangerDetailActions');if(sa)sa.remove();
  document.getElementById('capturedLabel').textContent=m.status==='rejected'?'已被移除':'日记回顾';
  document.getElementById('capturedBackBtn').style.display='';
  document.getElementById('captured').style.display='flex';if(starryWorldEnabled)dimStarsForPhoto(true)}
function backToGallery(){if(starryWorldEnabled)dimStarsForPhoto(false);document.getElementById('captured').style.display='none';navTo('photos')}


var _emojiPool=['🍎','🍊','🍋','🍇','🍓','🥝','🍑','🍒','🥭','🍍','🐱','🐶','🐰','🦊','🐼','🐨','🐯','🐸','🐙','🦋'];
function getNickname(phone){
  if(!phone)return _emojiPool[0]+'001';
  var hash=0;for(var i=0;i<phone.length;i++)hash=((hash<<5)-hash)+phone.charCodeAt(i);
  hash=Math.abs(hash);
  return _emojiPool[hash%_emojiPool.length]+('00'+(hash%900+100));
}

