/**
 * 此刻 Moment - 审核后台逻辑
 * 从 public/admin.html 拆分而来
 */
var API='';
var TOKEN='';
var page=1,totalPages=1;

// Get API base from localStorage (same as main app)
function init(){
  API=(localStorage.getItem('mv_api')||'').replace(/\/+$/,'')||(location.protocol==='https:'?'https://cikemoment.cn':'http://124.156.163.213:3000');
  var saved=localStorage.getItem('mv_auth');
  if(saved){
    try{
      var a=JSON.parse(saved);
      if(a.token&&a.userId===1){TOKEN=a.token;loadReview();return}
    }catch(e){}
  }
  document.getElementById('loginBlock').style.display='block';
}

function login(){
  var tok=document.getElementById('tokenInput').value.trim();
  if(!tok){document.getElementById('loginMsg').textContent='请输入Token';return}
  TOKEN=tok;
  fetch(API+'/api/stats',{headers:{'x-auth-token':TOKEN}})
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.error){document.getElementById('loginMsg').textContent='Token无效或已过期';return}
      document.getElementById('loginBlock').style.display='none';
      loadReview();
    })
    .catch(function(){document.getElementById('loginMsg').textContent='网络错误'});
}

function loadReview(){
  document.getElementById('reviewBlock').style.display='block';
  document.getElementById('momentList').innerHTML='<div class="loading">加载中...</div>';

  fetch(API+'/api/admin/moments?page='+page+'&limit=20',{headers:{'x-auth-token':TOKEN}})
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.error){alert(d.error);return}
      document.getElementById('statsBar').textContent='共 '+d.total+' 条待审核';
      totalPages=Math.ceil(d.total/20)||1;

      if(!d.moments||d.moments.length===0){
        document.getElementById('momentList').innerHTML='';
        document.getElementById('emptyState').style.display='block';
        document.getElementById('pagination').innerHTML='';
        return;
      }

      document.getElementById('emptyState').style.display='none';
      var html='';
      d.moments.forEach(function(m){
        var img=m.imageUrl?API+m.imageUrl:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect fill="#222" width="120" height="120"/><text fill="#555" x="60" y="65" text-anchor="middle" font-size="14">无图片</text></svg>');
        html+='<div class="card" id="card-'+m.id+'">';
        html+='<img src="'+img+'" loading="lazy">';
        html+='<div class="info">';
        html+='<div class="thought">'+(m.thought||'(无文字)')+'</div>';
        html+='<div class="meta">作者: '+escHtml(m.author)+'</div>';
        html+='<div class="meta">时间: '+m.created_at+' · 状态: '+m.status+'</div>';
        if(m.reportCount>0)html+='<div class="report-badge">⚠️ 被举报 '+m.reportCount+' 次</div>';
        html+='<div class="reject-reason" id="reason-'+m.id+'" style="display:none"><input id="reasonInput-'+m.id+'" placeholder="驳回原因（可选）"></div>';
        html+='</div>';
        html+='<div class="actions">';
        html+='<button class="btn btn-approve" onclick="approve('+m.id+')">✓ 通过</button>';
        html+='<button class="btn btn-reject" onclick="toggleReject('+m.id+')">✕ 驳回</button>';
        html+='</div>';
        html+='</div>';
      });
      document.getElementById('momentList').innerHTML=html;
      renderPagination();
    })
    .catch(function(){document.getElementById('momentList').innerHTML='<div class="loading">加载失败，请刷新</div>'});
}

function renderPagination(){
  var html='';
  html+='<button '+(page<=1?'disabled':'')+' onclick="goPage('+(page-1)+')">上一页</button>';
  html+='<span style="padding:8px 12px;color:var(--muted);font-size:13px">'+page+' / '+totalPages+'</span>';
  html+='<button '+(page>=totalPages?'disabled':'')+' onclick="goPage('+(page+1)+')">下一页</button>';
  document.getElementById('pagination').innerHTML=html;
}

function goPage(p){page=p;loadReview();window.scrollTo(0,0)}

function approve(id){
  if(!confirm('确定通过这条内容？'))return;
  fetch(API+'/api/admin/moments/'+id+'/approve',{method:'POST',headers:{'x-auth-token':TOKEN,'Content-Type':'application/json'}})
    .then(function(r){return r.json()})
    .then(function(d){
      if(d.error){alert(d.error);return}
      var card=document.getElementById('card-'+id);
      if(card)card.style.opacity='.3';
      setTimeout(loadReview,500);
    })
    .catch(function(){alert('操作失败')});
}

var _rejectId=null;
function toggleReject(id){
  var el=document.getElementById('reason-'+id);
  if(_rejectId===id){
    var reason=document.getElementById('reasonInput-'+id).value||'内容不符合社区规范';
    if(!confirm('确定驳回这条内容？\n原因: '+reason))return;
    fetch(API+'/api/admin/moments/'+id+'/reject',{
      method:'POST',
      headers:{'x-auth-token':TOKEN,'Content-Type':'application/json'},
      body:JSON.stringify({reason:reason})
    })
      .then(function(r){return r.json()})
      .then(function(d){
        if(d.error){alert(d.error);return}
        var card=document.getElementById('card-'+id);
        if(card)card.style.opacity='.3';
        _rejectId=null;
        setTimeout(loadReview,500);
      })
      .catch(function(){alert('操作失败')});
  }else{
    if(_rejectId)document.getElementById('reason-'+_rejectId).style.display='none';
    el.style.display='block';
    document.getElementById('reasonInput-'+id).focus();
    _rejectId=id;
  }
}

function escHtml(s){if(!s)return'';return String(s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}

init();
