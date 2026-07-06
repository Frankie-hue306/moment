/**
 * 此刻 Moment - 拼贴与时光碎片
 * 从 public/index.html 拆分而来
 */
// ======================== COLLAGE ========================
var collageMonth=null,collageCanvas=null,collageAvailable=[];
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();
}
function getAvailableMonths(){
  var map={};D.m.forEach(function(m){var d=new Date(m.d||Date.now());var y=d.getFullYear();var mo=d.getMonth()+1;var key=y+'-'+mo;if(!map[key])map[key]={year:y,month:mo,count:0};map[key].count++});
  var result=[];for(var k in map){var item=map[k];item.label=item.month+'月碎片';result.push(item)}
  result.sort(function(a,b){return b.year!==a.year?b.year-a.year:b.month-a.month});return result;
}
function openCollage(){
  collageAvailable=getAvailableMonths();
  if(collageAvailable.length===0){alert('还没有记录，先拍一些照片吧');return}
  var now=new Date(),cy=now.getFullYear(),cm=now.getMonth()+1,found=false;
  for(var i=0;i<collageAvailable.length;i++){if(collageAvailable[i].year===cy&&collageAvailable[i].month===cm){collageMonth=collageAvailable[i];found=true;break}}
  if(!found)collageMonth=collageAvailable[0];renderCollageScreen();
  document.getElementById('collage').style.display='block';
}
function renderCollageScreen(){
  document.getElementById('collageMonth').textContent=collageMonth.year+'年'+collageMonth.month+'月';
  document.getElementById('collageCount').textContent=collageMonth.count+'张照片';
  document.getElementById('collagePrev').style.display=getPrevMonth()?'block':'none';
  document.getElementById('collageNext').style.display=getNextMonth()?'block':'none';
  document.getElementById('collagePreview').style.display='none';document.getElementById('collageActions').style.display='none';
  document.getElementById('collageLoading').style.display='none';collageCanvas=null;
}
function getPrevMonth(){var idx=collageAvailable.indexOf(collageMonth);if(idx>0)return collageAvailable[idx-1];return null}
function getNextMonth(){var idx=collageAvailable.indexOf(collageMonth);if(idx>=0&&idx<collageAvailable.length-1)return collageAvailable[idx+1];return null}
function collagePrevMonth(){var p=getPrevMonth();if(p){collageMonth=p;renderCollageScreen()}}
function collageNextMonth(){var n=getNextMonth();if(n){collageMonth=n;renderCollageScreen()}}
function loadAllImages(moments,callback){
  var remaining=moments.length;if(remaining===0){callback([]);return}
  var imgs=new Array(moments.length);
  moments.forEach(function(m,i){var img=new Image(),done=false;
    img.onload=function(){if(!done){done=true;remaining--;if(remaining<=0)callback(imgs)}};
    img.onerror=function(){if(!done){done=true;imgs[i]=null;remaining--;if(remaining<=0)callback(imgs)}};
    img.src=m.u;imgs[i]=img;
  });
}
function generateCollage(){
  var moments=[];D.m.forEach(function(m){var d=new Date(m.d||Date.now());if(d.getFullYear()===collageMonth.year&&(d.getMonth()+1)===collageMonth.month){moments.push(m)}});
  moments.sort(function(a,b){return(a.d||0)-(b.d||0)});
  if(moments.length===0){alert('该月没有照片');return}
  document.getElementById('collageLoading').style.display='block';document.getElementById('collagePreview').style.display='none';document.getElementById('collageActions').style.display='none';
  loadAllImages(moments,function(imgs){
    document.getElementById('collageLoading').style.display='none';
    collageCanvas=renderCollageCanvas(imgs,moments,collageMonth);
    document.getElementById('collageImg').src=collageCanvas.toDataURL('image/png');
    document.getElementById('collagePreview').style.display='block';document.getElementById('collageActions').style.display='block';
  });
}
function renderCollageCanvas(imgs,moments,monthInfo){
  var N=moments.length,CW=780,PH=14,GAP=8,HH=90,FH=50,AW=CW-2*PH;
  var cols,cellSize,captionFontSize,captionH;
  if(N===1){cols=1;cellSize=AW;captionFontSize=14;captionH=30}
  else if(N<=4){cols=2;cellSize=(AW-GAP)/2;captionFontSize=12;captionH=26}
  else if(N<=9){cols=3;cellSize=(AW-2*GAP)/3;captionFontSize=11;captionH=24}
  else{cols=4;cellSize=(AW-3*GAP)/4;captionFontSize=10;captionH=22}
  var rows=Math.ceil(N/cols),CH=HH+rows*(cellSize+captionH+GAP)+FH;
  var canvas=document.createElement('canvas');canvas.width=CW;canvas.height=CH;var ctx=canvas.getContext('2d');
  ctx.fillStyle='#08080a';ctx.fillRect(0,0,CW,CH);
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#D4A373';ctx.fillRect(0,0,CW,3);
  ctx.fillStyle='#f5f5f7';ctx.font='bold 26px -apple-system,"PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillText(monthInfo.label,CW/2,38);
  var fd=new Date(moments[0].d||Date.now()),ld=new Date(moments[N-1].d||Date.now());
  var sub=N+'个瞬间 · '+(fd.getMonth()+1)+'.'+fd.getDate()+' - '+(ld.getMonth()+1)+'.'+ld.getDate();
  ctx.fillStyle='#98989d';ctx.font='12px -apple-system,"PingFang SC",sans-serif';ctx.fillText(sub,CW/2,58);
  ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(CW*.1,74);ctx.lineTo(CW*.9,74);ctx.stroke();
  for(var i=0;i<N;i++){
    var col=i%cols,row=Math.floor(i/cols);
    var fw=cellSize+8,fh=cellSize+8+captionH;
    var fx=PH+col*(cellSize+GAP),fy=HH+row*(cellSize+captionH+GAP);
    var px=fx+4,py=fy+4,pw=cellSize,ph=cellSize;
    roundRect(ctx,fx,fy,fw,fh,8);ctx.fillStyle='#1c1c1e';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;ctx.stroke();
    ctx.save();roundRect(ctx,px,py,pw,ph,5);ctx.clip();
    if(imgs[i]){
      var img=imgs[i],sc=Math.max(pw/img.width,ph/img.height),sw=img.width*sc,sh=img.height*sc;
      ctx.drawImage(img,px-(sw-pw)/2,py-(sh-ph)/2,sw,sh);
    }else{ctx.fillStyle='#2c2c2e';ctx.fillRect(px,py,pw,ph);ctx.fillStyle='#555';ctx.font=(cellSize*.3)+'px -apple-system';ctx.textAlign='center';ctx.fillText('?',px+pw/2,py+ph/2+cellSize*.1)}
    ctx.restore();
    var thought=moments[i].t||'';if(thought.length>0){
      var maxChars=cols===1?12:(cols===2?8:6);if(thought.length>maxChars)thought=thought.substring(0,maxChars)+'..';
      ctx.fillStyle='#98989d';ctx.font=captionFontSize+'px -apple-system,"PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillText(thought,fx+fw/2,fy+fh-8);
    }
  }
  var footerY=HH+rows*(cellSize+captionH+GAP)+14;
  ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(CW*.25,footerY);ctx.lineTo(CW*.75,footerY);ctx.stroke();
  ctx.fillStyle='#666';ctx.font='11px -apple-system,"PingFang SC",sans-serif';ctx.fillText('此刻 MOMENT v298',CW/2,footerY+20);
  return canvas;
}
// Shared: save canvas to file (Capacitor native or browser download)
function saveCanvasToFile(canvas, filename){
  if(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Filesystem){
    var base64=canvas.toDataURL('image/png').split(',')[1];
    window.Capacitor.Plugins.Filesystem.writeFile({path:filename,data:base64,directory:2}).then(function(){
      showToast('已保存到文件');
    }).catch(function(){
      showToast('保存失败');
    });
    return;
  }
  var a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);
}

// Shared: share canvas via native share sheet, fallback to save
function shareCanvas(canvas, title, filename){
  canvas.toBlob(function(blob){
    var file=new File([blob],filename,{type:'image/png'});
    if(navigator.share){
      navigator.share({title:title,files:[file]}).catch(function(){saveCanvasToFile(canvas,filename)});
    }else{saveCanvasToFile(canvas,filename)}
  },'image/png');
}

function downloadCollage(){
  if(!collageCanvas)return;
  saveCanvasToFile(collageCanvas,'moment-'+collageMonth.year+'-'+collageMonth.month+'.png');
}
function shareCollage(){
  if(!collageCanvas)return;
  shareCanvas(collageCanvas,collageMonth.label,'moment-'+collageMonth.year+'-'+collageMonth.month+'.png');
}
function backFromCollage(){
  document.getElementById('collage').style.display='none';
  navTo('photos');
}

// ======================== TIME FRAGMENT ========================
var tfCanvas=null,tfTemplate=0,tfMoments=[],tfImgs=[],tfStart=null,tfEnd=null;
var tfSelectedDays=7;
function selectTF(idx){
  tfTemplate=idx;
  var items=document.querySelectorAll('.tf-tpl');
  for(var i=0;i<items.length;i++){
    items[i].style.borderColor=i===idx?'var(--accent)':'transparent';
    items[i].classList.toggle('active',i===idx);
  }
}
function setTFDays(days,btn){
  tfSelectedDays=days;
  // Highlight selected button
  var btns=document.querySelectorAll('#tfDayBtns .btn');
  for(var i=0;i<btns.length;i++){btns[i].style.background='var(--card)';btns[i].style.color='var(--text)'}
  btn.style.background='var(--accent)';btn.style.color='#fff';
  // Update date inputs
  var end=new Date();
  var start=new Date(end-days*86400000);
  document.getElementById('tfEnd').value=end.toISOString().split('T')[0];
  document.getElementById('tfStart').value=start.toISOString().split('T')[0];
}
function onTFCustomDate(){
  tfSelectedDays=0;
  var btns=document.querySelectorAll('#tfDayBtns .btn');
  for(var i=0;i<btns.length;i++){btns[i].style.background='var(--card)';btns[i].style.color='var(--text)'}
}
function genTFNow(){
  if(tfSelectedDays>0){
    var end=new Date();
    var start=new Date(end-tfSelectedDays*86400000);
    genTF(start,end);
  }else{
    var start=new Date(document.getElementById('tfStart').value);
    var end=new Date(document.getElementById('tfEnd').value);
    if(isNaN(start.getTime())||isNaN(end.getTime())){alert('请选择日期');return}
    if(end<start){alert('结束日期不能早于起始日期');return}
    var diffDays=Math.ceil((end-start)/86400000);
    if(diffDays>90){alert('日期范围不能超过90天');return}
    genTF(start,end);
  }
}
function openTimeFragment(){
  var today=new Date();
  document.getElementById('tfEnd').value=today.toISOString().split('T')[0];
  var weekAgo=new Date(today-7*86400000);
  document.getElementById('tfStart').value=weekAgo.toISOString().split('T')[0];
  document.getElementById('tfLoading').style.display='none';
  document.getElementById('timeFragment').style.display='block';
  // Highlight 7-day preset
  tfSelectedDays=7;
  var btns=document.querySelectorAll('#tfDayBtns .btn');
  for(var i=0;i<btns.length;i++){btns[i].style.background='var(--card)';btns[i].style.color='var(--text)'}
  if(btns[0]){btns[0].style.background='var(--accent)';btns[0].style.color='#fff'}
}
function closeTimeFragment(){
  document.getElementById('timeFragment').style.display='none';
}
function genTF(start,end){
  end.setHours(23,59,59,999);
  start.setHours(0,0,0,0);
  tfStart=new Date(start);tfEnd=new Date(end);
  var moments=[];
  D.m.forEach(function(m){
    var d=new Date(m.d||Date.now());
    if(d>=start&&d<=end&&m.status!=='rejected')moments.push(m);
  });
  moments.sort(function(a,b){return(a.d||0)-(b.d||0)});
  if(moments.length===0){alert('该时间段暂无照片，试试其他日期吧');return}
  if(moments.length<3){alert('至少需要3张照片才能生成碎片');return}
  if(moments.length>30){moments=moments.slice(0,30);alert('照片太多，仅展示前30张')}
  tfMoments=moments;
  document.getElementById('tfLoading').style.display='block';
  loadAllImages(moments,function(imgs){
    tfImgs=imgs;
    document.getElementById('tfLoading').style.display='none';
    tfCanvas=renderTFCanvas(imgs,moments,tfStart,tfEnd,tfTemplate);
    document.getElementById('tfImg').src=tfCanvas.toDataURL('image/png');
    // Show fullscreen result overlay
    var overlay=document.getElementById('tfResultOverlay');
    overlay.style.display='flex';
    setTimeout(function(){overlay.style.transform='translateY(0)'},20);
  });
}
function closeTFResult(){
  var overlay=document.getElementById('tfResultOverlay');
  overlay.style.transform='translateY(100%)';
  setTimeout(function(){overlay.style.display='none'},350);
}
function renderTFCanvas(imgs,moments,start,end,tpl){
  tpl=tpl||0;
  if(tpl===0)return renderTplGrid(imgs,moments,start,end);
  if(tpl===1)return renderTplPolaroid(imgs,moments,start,end);
  if(tpl===2)return renderTplMagazine(imgs,moments,start,end);
  if(tpl===3)return renderTplCalendar(imgs,moments,start,end);
  if(tpl===4)return renderTplFilm(imgs,moments,start,end);
  return renderTplGrid(imgs,moments,start,end);
}
// Template 1: Classic Grid
function renderTplGrid(imgs,moments,start,end){
  var N=moments.length,CW=780,PH=12,GAP=6;
  var cols=N<=4?2:3;
  var cellSize=(CW-2*PH-(cols-1)*GAP)/cols;
  var rows=Math.ceil(N/cols);
  var HH=70,FH=38;
  var CH=HH+rows*(cellSize+GAP)+FH;
  var canvas=document.createElement('canvas');canvas.width=CW;canvas.height=CH;
  var ctx=canvas.getContext('2d');
  ctx.fillStyle='#f5f5f5';ctx.fillRect(0,0,CW,CH);
  ctx.fillStyle='#1c1c1e';ctx.font='bold 22px -apple-system,"PingFang SC",sans-serif';ctx.textAlign='center';
  ctx.fillText('✨ 时光碎片',CW/2,33);
  var ds=start.getFullYear()+'-'+pad2(start.getMonth()+1)+'-'+pad2(start.getDate());
  var de=end.getFullYear()+'-'+pad2(end.getMonth()+1)+'-'+pad2(end.getDate());
  ctx.fillStyle='#8e8e93';ctx.font='12px -apple-system,"PingFang SC",sans-serif';
  ctx.fillText(ds+' 至 '+de,CW/2,52);ctx.fillText(N+'个瞬间',CW/2,66);
  for(var i=0;i<N;i++){
    var col=i%cols,row=Math.floor(i/cols);
    var px=PH+col*(cellSize+GAP),py=HH+row*(cellSize+GAP);
    ctx.save();roundRect(ctx,px,py,cellSize,cellSize,6);ctx.clip();
    if(imgs[i]){var img=imgs[i],sc=Math.max(cellSize/img.width,cellSize/img.height);ctx.drawImage(img,px-(img.width*sc-cellSize)/2,py-(img.height*sc-cellSize)/2,img.width*sc,img.height*sc)}
    ctx.restore();
    ctx.strokeStyle='#ddd';ctx.lineWidth=.5;ctx.beginPath();roundRect(ctx,px,py,cellSize,cellSize,6);ctx.stroke();
  }
  var fy=HH+rows*(cellSize+GAP)+10;
  ctx.fillStyle='#999';ctx.font='10px -apple-system,"PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillText('此刻 · 时光碎片',CW/2,fy+14);
  return canvas;
}
// Template 2: Polaroid Stack
function renderTplPolaroid(imgs,moments,start,end){
  var N=moments.length,CW=780,CH=Math.max(500,N*120+160);
  var canvas=document.createElement('canvas');canvas.width=CW;canvas.height=CH;
  var ctx=canvas.getContext('2d');
  ctx.fillStyle='#fdf8f0';ctx.fillRect(0,0,CW,CH);
  // Random laid-back layout
  var placed=[];
  var sizes=[{w:100,h:100},{w:110,h:110},{w:120,h:120},{w:95,h:95},{w:105,h:105},{w:115,h:115}];
  for(var i=0;i<N;i++){
    var sz=sizes[i%sizes.length];
    var x=20+Math.random()*(CW-sz.w-60),y=40+Math.random()*(CH-sz.h-120);
    // White polaroid frame
    var fw=sz.w+16,fh=sz.h+30;
    ctx.save();
    ctx.translate(x+fw/2,y+fh/2);
    ctx.rotate((Math.random()-.5)*6*Math.PI/180);
    ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,.15)';ctx.shadowBlur=8;ctx.shadowOffsetY=2;
    ctx.fillRect(-fw/2,-fh/2,fw,fh);
    ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    if(imgs[i]){
      var sc=Math.max(sz.w/imgs[i].width,sz.h/imgs[i].height);
      var sw=imgs[i].width*sc,sh=imgs[i].height*sc;
      ctx.drawImage(imgs[i],-sw/2,-sh/2+4,sw,sh);
    }
    // Date at bottom of polaroid
    var d=new Date(moments[i].d||Date.now());
    ctx.fillStyle='#999';ctx.font='9px -apple-system,"PingFang SC",sans-serif';ctx.textAlign='center';
    ctx.fillText((d.getMonth()+1)+'/'+d.getDate(),0,fh/2-8);
    ctx.restore();
  }
  // Footer text
  var ds=start.getFullYear()+'-'+pad2(start.getMonth()+1)+'-'+pad2(start.getDate());
  var de=end.getFullYear()+'-'+pad2(end.getMonth()+1)+'-'+pad2(end.getDate());
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.font='11px -apple-system,"PingFang SC",sans-serif';ctx.textAlign='right';
  ctx.fillText('拍立得·时光  '+ds+'~'+de,CW-16,CH-10);
  return canvas;
}
// Template 3: Magazine Layout
function renderTplMagazine(imgs,moments,start,end){
  var N=moments.length,CW=780,CH=600;
  var canvas=document.createElement('canvas');canvas.width=CW;canvas.height=CH;
  var ctx=canvas.getContext('2d');
  var grad=ctx.createLinearGradient(0,0,0,CH);
  grad.addColorStop(0,'#1a1a2e');grad.addColorStop(1,'#16213e');
  ctx.fillStyle=grad;ctx.fillRect(0,0,CW,CH);
  // Main hero image
  var mainIdx=Math.floor(moments.length/2);
  ctx.save();ctx.fillStyle='rgba(255,255,255,.1)';ctx.fillRect(20,80,220,280);ctx.restore();
  if(imgs[mainIdx]){
    var sc=Math.max(220/imgs[mainIdx].width,280/imgs[mainIdx].height);
    ctx.drawImage(imgs[mainIdx],20,80,imgs[mainIdx].width*sc,imgs[mainIdx].height*sc);
    ctx.save();ctx.beginPath();ctx.rect(20,80,220,280);ctx.clip();
    ctx.drawImage(imgs[mainIdx],20-(imgs[mainIdx].width*sc-220)/2,80-(imgs[mainIdx].height*sc-280)/2,imgs[mainIdx].width*sc,imgs[mainIdx].height*sc);
    ctx.restore();
  }
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=1;ctx.strokeRect(20,80,220,280);
  // Side images
  var sideImgs=[];
  for(var i=0;i<N;i++){if(i!==mainIdx)sideImgs.push(i)}
  var sx=260,sy=80;
  for(var j=0;j<Math.min(sideImgs.length,5);j++){
    var idx=sideImgs[j];
    ctx.fillStyle='rgba(255,255,255,.05)';ctx.fillRect(sx,sy,110,90);
    if(imgs[idx]){
      ctx.save();ctx.beginPath();ctx.rect(sx,sy,110,90);ctx.clip();
      var sc2=Math.max(110/imgs[idx].width,90/imgs[idx].height);
      ctx.drawImage(imgs[idx],sx-(imgs[idx].width*sc2-110)/2,sy-(imgs[idx].height*sc2-90)/2,imgs[idx].width*sc2,imgs[idx].height*sc2);
      ctx.restore();
    }
    ctx.strokeStyle='rgba(255,255,255,.15)';ctx.strokeRect(sx,sy,110,90);
    sy+=98;
  }
  // Title
  ctx.fillStyle='#fff';ctx.font='bold 28px "Georgia","Times New Roman",serif';ctx.textAlign='left';
  ctx.fillText('封面故事',20,50);
  var ds=start.getFullYear()+'-'+pad2(start.getMonth()+1)+'-'+pad2(start.getDate());
  var de=end.getFullYear()+'-'+pad2(end.getMonth()+1)+'-'+pad2(end.getDate());
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='12px "Georgia",serif';ctx.fillText(ds+' — '+de,20,68);
  ctx.fillStyle='rgba(255,255,255,.3)';ctx.font='9px -apple-system';ctx.textAlign='right';ctx.fillText('此刻·杂志',CW-16,CH-12);
  return canvas;
}
// Template 4: Calendar Diary
function renderTplCalendar(imgs,moments,start,end){
  var N=moments.length,CW=780;
  var days=['日','一','二','三','四','五','六'];
  // Group by date, take latest per day
  var dayMap={};
  moments.forEach(function(m,i){var d=new Date(m.d||Date.now());var key=d.toLocaleDateString('zh-CN');if(!dayMap[key]||(m.d||0)>(dayMap[key].m.d||0))dayMap[key]={m:m,i:i}});
  var entries=[];
  for(var k in dayMap)entries.push(dayMap[k]);
  entries.sort(function(a,b){return(a.m.d||0)-(b.m.d||0)});
  entries=entries.slice(0,30);
  var rowH=100,CH=60+entries.length*rowH+60;
  var canvas=document.createElement('canvas');canvas.width=CW;canvas.height=CH;
  var ctx=canvas.getContext('2d');
  ctx.fillStyle='#f8f9fa';ctx.fillRect(0,0,CW,CH);
  // Header
  ctx.fillStyle='#1c1c1e';ctx.font='bold 20px -apple-system,"PingFang SC",sans-serif';ctx.textAlign='center';ctx.fillText('📅 日历日记',CW/2,34);
  var ds=start.getFullYear()+'-'+pad2(start.getMonth()+1)+'-'+pad2(start.getDate());
  var de=end.getFullYear()+'-'+pad2(end.getMonth()+1)+'-'+pad2(end.getDate());
  ctx.fillStyle='#8e8e93';ctx.font='11px -apple-system,"PingFang SC",sans-serif';ctx.fillText(ds+' 至 '+de,CW/2,50);
  // Entries
  entries.forEach(function(entry,j){
    var y=60+j*rowH,d=new Date(entry.m.d||Date.now());
    ctx.fillStyle='#e9ecef';ctx.fillRect(10,y+rowH-1,CW-20,1);
    // Date column
    ctx.fillStyle='#1c1c1e';ctx.font='bold 18px -apple-system,"PingFang SC",sans-serif';ctx.textAlign='center';
    ctx.fillText((d.getMonth()+1)+'/'+d.getDate(),50,y+35);
    ctx.fillStyle='#8e8e93';ctx.font='11px -apple-system';ctx.fillText('周'+days[d.getDay()],50,y+52);
    // Photo
    if(imgs[entry.i]){
      ctx.save();ctx.beginPath();ctx.rect(90,y+8,84,84);ctx.clip();
      var sc=Math.max(84/imgs[entry.i].width,84/imgs[entry.i].height);
      ctx.drawImage(imgs[entry.i],90-(imgs[entry.i].width*sc-84)/2,y+8-(imgs[entry.i].height*sc-84)/2,imgs[entry.i].width*sc,imgs[entry.i].height*sc);
      ctx.restore();
      ctx.strokeStyle='#dee2e6';ctx.strokeRect(90,y+8,84,84);
    }
    // Time
    var time=d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
    ctx.fillStyle='#999';ctx.font='10px -apple-system';ctx.textAlign='left';ctx.fillText(time,180,y+52);
    // Thought
    var t=entry.m.t||'';
    if(t.length>0){ctx.fillStyle='#666';ctx.font='13px -apple-system';ctx.textAlign='left';ctx.fillText(t.substring(0,12),180,y+35)}
  });
  return canvas;
}
// Template 5: Film Strip
function renderTplFilm(imgs,moments,start,end){
  var N=Math.min(moments.length,15),CW=Math.max(780,N*120+40),cellW=100,cellH=150;
  var CH=cellH+120;
  var canvas=document.createElement('canvas');canvas.width=CW;canvas.height=CH;
  var ctx=canvas.getContext('2d');
  ctx.fillStyle='#111';ctx.fillRect(0,0,CW,CH);
  // Film strip holes
  ctx.fillStyle='#000';
  for(var x=20;x<CW-20;x+=30){ctx.beginPath();ctx.arc(x,18,6,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(x,CH-18,6,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle='rgba(255,255,255,.04)';ctx.fillRect(0,40,CW,cellH+30);
  // Photos
  for(var i=0;i<N;i++){
    var x=20+i*115;
    ctx.fillStyle='#000';ctx.fillRect(x-2,48,cellW+4,cellH+8);
    if(imgs[i]){
      ctx.save();ctx.beginPath();ctx.rect(x,52,cellW,cellH);ctx.clip();
      var sc=Math.max(cellW/imgs[i].width,cellH/imgs[i].height);
      ctx.drawImage(imgs[i],x-(imgs[i].width*sc-cellW)/2,52-(imgs[i].height*sc-cellH)/2,imgs[i].width*sc,imgs[i].height*sc);
      ctx.restore();
    }
  }
  // Subtitle
  var ds=start.getFullYear()+'-'+pad2(start.getMonth()+1)+'-'+pad2(start.getDate());
  var de=end.getFullYear()+'-'+pad2(end.getMonth()+1)+'-'+pad2(end.getDate());
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='11px -apple-system,"PingFang SC",sans-serif';ctx.textAlign='center';
  ctx.fillText(ds+' ~ '+de,CW/2,CH-40);
  ctx.fillText('🎬 此刻·胶片',CW/2,CH-22);
  return canvas;
}
function pad2(n){return n<10?'0'+n:''+n}
function saveTF(){
  if(!tfCanvas)return;
  saveCanvasToFile(tfCanvas,'时光碎片_'+Date.now()+'.png');
}
function shareTF(){
  if(!tfCanvas)return;
  shareCanvas(tfCanvas,'我的时光碎片','时光碎片.png');
}

