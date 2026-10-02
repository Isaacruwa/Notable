(function(){
 var sec=document.getElementById("claimSection");if(!sec)return;
 var input=document.getElementById("claimInput"),btn=document.getElementById("claimBtn"),st=document.getElementById("claimStatus"),pv=document.getElementById("claimPreview");
 var timer=null,seq=0,current=null,busy=false;
 function msg(t,ok){st.textContent=t||"";st.className="form-status"+(ok?" ok":"")}
 function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
 function api(method,url,body){
  return fetch(url,{method:method,credentials:"same-origin",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined})
   .then(function(r){return r.json().catch(function(){return{}}).then(function(d){if(!r.ok)throw new Error(d.error||"Something went wrong. Please try again.");return d})});
 }
 var TEXT={open:"Ready to claim. Add Kiver to the bot's About, then press Verify.",yours:"This bot is already in your account.",claimed:"This bot has already been claimed by another account.",manual:"This bot's About already mentions Kiver, so it can't be verified automatically. Contact Kiver support to claim it."};
 function showPreview(r){
  current=r;
  if(!r){pv.classList.add("hidden");pv.innerHTML="";btn.disabled=false;return}
  pv.innerHTML='<div class="claim-row"><img alt="" src="/api/image?u='+encodeURIComponent(r.telegram_username)+'"><div><b>'+esc(r.name)+'</b><br><span class="muted">@'+esc(r.telegram_username)+'</span></div></div><p class="muted">'+esc(TEXT[r.state]||"")+'</p>';
  pv.classList.remove("hidden");
  btn.disabled=r.state!=="open";
 }
 function lookup(){
  var q=input.value.trim(),my=++seq;
  msg("");
  if(!q){showPreview(null);return}
  api("GET","/api/bots?action=claimLookup&q="+encodeURIComponent(q)).then(function(r){if(my===seq)showPreview(r)}).catch(function(e){if(my!==seq)return;showPreview(null);msg(e.message)});
 }
 input.addEventListener("input",function(){clearTimeout(timer);timer=setTimeout(lookup,450)});
 input.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();clearTimeout(timer);lookup()}});
 btn.addEventListener("click",function(){
  if(busy)return;
  var q=input.value.trim();
  if(!q){msg("Enter your bot's username or link first.");return}
  busy=true;btn.disabled=true;msg("Checking the bot's About on Telegram…");
  api("POST","/api/bots",{action:"claim",q:q}).then(function(r){
   msg("Verified. "+(r.name||"The bot")+" is now in your account.",true);
   setTimeout(function(){window.location.href="/account"},1200);
  }).catch(function(e){msg(e.message);busy=false;btn.disabled=current?current.state!=="open":false});
 });
 api("GET","/api/me").then(function(m){
  if(!m||!m.loggedIn)return;
  sec.classList.remove("hidden");
  var c=new URLSearchParams(window.location.search).get("claim");
  if(c){input.value=c;lookup();setTimeout(function(){if(sec.scrollIntoView)sec.scrollIntoView({behavior:"smooth",block:"start"})},700)}
 }).catch(function(){});
})();
