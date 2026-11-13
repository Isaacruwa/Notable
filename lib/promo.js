const crypto=require("crypto");

// Kiver promo emails: one upsell email a week after a maker lists, then an admin-approved follow-up.
// State and eligibility live in the kiver-promo Supabase function; this file renders and sends the emails (Resend).

const EDGE="https://ovxytcfhyzqtxzhsmmhn.supabase.co/functions/v1/kiver-promo";
const PK=Buffer.from("c2JfcHVibGlzaGFibGVfTTd3TlNaUzlVd3lQcHRJZEVwaEwyZ19JTG1aT3JYaQ==","base64").toString();
const SITE="https://getkiver.com";
const FROM="Kiver <noreply@getkiver.com>";
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const secretKey=()=>String(process.env.KIVER_PROMO_KEY||"").trim();
const err=(m,status)=>Object.assign(new Error(m),{status});

async function edge(action,params,token){
 const r=await fetch(EDGE,{method:"POST",headers:{"Content-Type":"application/json",apikey:PK,Authorization:"Bearer "+(token||PK)},body:JSON.stringify({action,params:params||{}})});
 let d;try{d=await r.json()}catch{throw err("The promo service returned an invalid response.",502)}
 if(!r.ok||!d.ok)throw err(d.error||"Promo request failed.",r.status);
 return d.result;
}
function need(){if(!secretKey())throw err("Promo emails aren’t configured yet (KIVER_PROMO_KEY is missing).",503)}
const auto=(action,params)=>{need();return edge(action,{...params,automationSecret:secretKey()})};

const sign=email=>crypto.createHmac("sha256",secretKey()).update("unsub:"+String(email).toLowerCase()).digest("hex").slice(0,32);
const unsubUrl=email=>SITE+"/api/account?action=promoUnsub&e="+encodeURIComponent(email)+"&t="+sign(email);

// ---------- the emails ----------
// Body markup: blank line = new paragraph; lines starting with "• " = bullet list; **bold**; [[button: Label | https://url]].
const short=(s,n)=>{s=String(s||"").trim();return s.length>n?s.slice(0,n-1).trimEnd()+"…":s};
const hello=r=>r&&r.username?"Hi "+r.username+",":"Hi,";

function week1(r){
 const bot=(r.listing&&r.listing.name)||"your bot";
 return{
  subject:"Get "+short(bot,45)+" in front of more Telegram users",
  body:[
   hello(r),
   "Thanks for listing "+bot+" on Kiver. I wanted to send you one short note on how makers get more people to find and trust their bots here, because listing is only the first step and getting discovered is the hard part.",
   "Here is what Kiver offers if you want "+bot+" to be seen by more people:",
   ["• **Featured Monthly, $19/month.** A featured spot in Top Discoveries on the Kiver homepage, the blue verified badge next to "+bot+"’s name, and a Boost included while your plan is active. Cancel anytime.",
    "• **Featured Forever, $149 one time.** The same featured spot and verified badge, permanently, plus a 7-day Boost. One payment, no renewals.",
    "• **Boost, $5.** 24 hours of promotional exposure. The easiest way to try it and see how people respond."].join("\n"),
   "Featured listings carry the blue verified badge, which tells people at a glance that the bot is the real thing before they tap Start. That trust is often what turns a visit into a user.",
   "**How to get started (about two minutes)**",
   ["• Sign in at getkiver.com and open Your account.",
    "• Press Promote on "+bot+" and pick a plan.",
    "• Pay securely with Paddle, or with Telegram Stars if you would rather stay in Telegram (300 ⭐ for 7 days, 1,000 ⭐ for 30 days)."].join("\n"),
   "[[button: Promote "+short(bot,30)+" | "+SITE+"/account]]",
   "Questions? Message @Controlla on Telegram and we will help.",
   "Thanks for being part of Kiver,\nThe Kiver team"
  ].join("\n\n")
 };
}

function followup(r){
 const bot=(r.listing&&r.listing.name)||"your bot",n=Number(r.listing&&r.listing.upvotes)||0;
 return{
  subject:"Still want more people finding "+short(bot,40)+"?",
  body:[
   hello(r),
   "A little while ago I shared how makers get more visibility on Kiver. I will keep this short, since an email like that is easy to miss.",
   (n>0?bot+" has collected "+n+" upvote"+(n===1?"":"s")+" on Kiver so far. ":"")+"Featured listings are placed in Top Discoveries on the Kiver homepage and carry the blue verified badge, which puts them in front of everyone who visits.",
   "If you want to try it with the least commitment, **Boost is $5** for 24 hours of promotional exposure. If you would rather have a steady presence, **Featured Monthly is $19/month** (cancel anytime) and includes the verified badge and a Boost.",
   "[[button: Promote "+short(bot,30)+" | "+SITE+"/account]]",
   "If this is not for you, no worries at all, and thanks for listing on Kiver.",
   "Thanks,\nThe Kiver team"
  ].join("\n\n")
 };
}

const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
function render({subject,body,to,preview}){
 const unsub=preview?"#":unsubUrl(to);
 let html="";const text=[];
 for(const b of String(body||"").replace(/\r/g,"").trim().split(/\n{2,}/)){
  const btn=b.match(/^\[\[button:\s*(.+?)\s*\|\s*(https?:\/\/\S+?)\s*\]\]$/);
  if(btn){
   html+='<table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 24px"><tr><td style="background:#171717;border-radius:10px"><a href="'+esc(btn[2])+'" style="display:inline-block;padding:13px 22px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none">'+esc(btn[1])+' →</a></td></tr></table>';
   text.push(btn[1]+": "+btn[2]);continue;
  }
  const lines=b.split("\n");
  if(lines.every(l=>/^•\s+/.test(l))){
   html+='<ul style="margin:0 0 18px;padding-left:20px;line-height:1.55">'+lines.map(l=>'<li style="margin:0 0 9px">'+inline(l.replace(/^•\s+/,""))+"</li>").join("")+"</ul>";
   text.push(lines.map(l=>"- "+l.replace(/^•\s+/,"").replace(/\*\*/g,"")).join("\n"));continue;
  }
  html+='<p style="margin:0 0 16px;line-height:1.6">'+inline(b).replace(/\n/g,"<br>")+"</p>";
  text.push(b.replace(/\*\*/g,""));
 }
 const out='<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#111;font-size:15px"><div style="font-size:20px;font-weight:700;margin-bottom:22px">Kiver</div>'+html+
  '<hr style="border:0;border-top:1px solid #e6e3dd;margin:26px 0 14px"><p style="margin:0;font-size:12px;line-height:1.5;color:#77736d">Kiver · <a href="'+SITE+'" style="color:#77736d">getkiver.com</a><br>This address can’t receive replies. To reach us, message <a href="https://t.me/Controlla" style="color:#77736d">@Controlla</a> on Telegram.<br>You’re getting this because you listed a bot on Kiver. <a href="'+esc(unsub)+'" style="color:#77736d">Unsubscribe</a> from promotional emails.</p></div>';
 const plain=text.join("\n\n")+"\n\n--\nKiver · getkiver.com\nThis address can’t receive replies. To reach us, message @Controlla on Telegram: https://t.me/Controlla\nYou’re getting this because you listed a bot on Kiver. Unsubscribe: "+unsub;
 return{html:out,text:plain,unsub};
}

async function sendEmail({to,subject,body,idem}){
 const key=String(process.env.RESEND_API_KEY||"").trim();
 if(!key)throw err("Email sending isn’t configured right now.",503);
 if(!EMAIL_RE.test(String(to||"")))throw err("Invalid recipient address.",400);
 const m=render({subject,body,to});
 const headers={"content-type":"application/json",authorization:"Bearer "+key};
 if(idem)headers["Idempotency-Key"]=idem;
 const rr=await fetch("https://api.resend.com/emails",{method:"POST",headers,body:JSON.stringify({from:FROM,to:[to],subject:String(subject||"").slice(0,150),html:m.html,text:m.text,headers:{"List-Unsubscribe":"<"+m.unsub+">","List-Unsubscribe-Post":"List-Unsubscribe=One-Click"}})});
 if(!rr.ok){const t=await rr.text().catch(()=>"");throw err("Resend "+rr.status+": "+t.slice(0,200),502)}
}

// Sends already-claimed rows ([{id,email,subject,body}]) and records the outcome of each.
async function deliver(rows){
 let sent=0,failed=0;
 const one=async r=>{
  try{await sendEmail({to:r.email,subject:r.subject,body:r.body,idem:"kiver-promo-"+r.id})}
  catch(e){failed++;try{await auto("markFailed",{id:r.id,error:e.message})}catch{}return}
  sent++;
  try{await auto("markSent",{id:r.id})}catch{try{await auto("markSent",{id:r.id})}catch{}}
 };
 for(let i=0;i<rows.length;i+=5)await Promise.all(rows.slice(i,i+5).map(one));
 return{sent,failed};
}

// Daily job: send the week-1 email to everyone who is due, and draft follow-ups for the admin to approve.
async function run(o={}){
 need();
 const d=await auto("due",{limit:o.limit||25});
 const out={paused:!!d.paused,sent:0,failed:0,drafted:0};
 if(d.paused)return out;
 const r=await deliver((d.week1||[]).map(x=>({id:x.id,email:x.email,...week1(x)})));
 out.sent=r.sent;out.failed=r.failed;
 const c=d.draftCandidates||[];
 if(c.length){const s=await auto("saveDrafts",{items:c.map(x=>({email:x.email,...followup(x)}))});out.drafted=s.saved||0}
 return out;
}

// Admin actions (called from api/account.js with the signed-in admin's session token).
async function admin(action,x,t){
 await require("./db").adminStats(t); // throws "Admin access required." for non-admins
 switch(action){
  case "promoOverview":return edge("overview",{},t);
  case "promoPause":return edge("setPaused",{paused:!!x.paused},t);
  case "promoEditDraft":return edge("editDraft",{id:x.id,subject:x.subject,body:x.body},t);
  case "promoSkip":return edge("skipDrafts",{ids:x.ids},t);
  case "promoApprove":{need();const a=await edge("approveDrafts",{ids:x.ids},t);const r=await deliver(a.send||[]);return{sent:r.sent,failed:r.failed,skipped:a.skipped||0}}
  case "promoRun":return run({limit:25});
  case "promoPreview":{
   const kind=x.kind==="followup"?"followup":"week1";
   const m=(kind==="followup"?followup:week1)({username:"yourname",listing:{name:"Your Bot",upvotes:kind==="followup"?12:0}});
   return{subject:m.subject,html:render({subject:m.subject,body:m.body,to:"you@example.com",preview:true}).html};
  }
 }
 throw err("Unknown promo action.",400);
}

// Public unsubscribe link. GET shows a confirm button (so mail scanners can't unsubscribe anyone); POST (button or one-click header) does it.
async function unsubscribe(req,res){
 const e=String(req.query.e||"").trim().toLowerCase(),t=String(req.query.t||"");
 const page=(code,title,msg,form)=>{
  res.statusCode=code;res.setHeader("content-type","text/html; charset=utf-8");res.setHeader("cache-control","no-store");
  res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+esc(title)+' — Kiver</title></head><body style="font-family:Arial,sans-serif;background:#faf9f6;color:#111;margin:0"><main style="max-width:480px;margin:12vh auto;padding:0 24px"><div style="font-size:20px;font-weight:700;margin-bottom:22px">Kiver</div><h1 style="font-size:26px;margin:0 0 12px">'+esc(title)+'</h1><p style="line-height:1.6;color:#444;margin:0 0 22px">'+esc(msg)+"</p>"+(form||"")+'<p style="margin:26px 0 0"><a href="'+SITE+'" style="color:#77736d">Back to Kiver</a></p></main></body></html>');
 };
 let ok=false;
 try{if(secretKey()&&EMAIL_RE.test(e)&&t.length===32){const a=Buffer.from(t),b=Buffer.from(sign(e));ok=a.length===b.length&&crypto.timingSafeEqual(a,b)}}catch{}
 if(!ok)return page(400,"This link isn’t valid","The unsubscribe link looks incomplete or has been changed. Message @Controlla on Telegram and we will remove you manually.");
 if(req.method!=="POST")return page(200,"Unsubscribe from promotional emails?","You’ll stop getting promotional emails from Kiver at "+e+". Account and security emails, like password resets, aren’t affected.",'<form method="post"><button type="submit" style="background:#171717;color:#fff;border:0;border-radius:10px;padding:13px 22px;font-weight:700;font-size:15px;cursor:pointer">Unsubscribe</button></form>');
 try{await auto("optOut",{email:e})}catch{return page(500,"Something went wrong","We couldn’t save that just now. Please try again in a few minutes, or message @Controlla on Telegram.")}
 return page(200,"You’re unsubscribed","You won’t get promotional emails from Kiver at "+e+" anymore. Account and security emails, like password resets, aren’t affected.");
}

module.exports={run,admin,unsubscribe,week1,followup,render};
