const crypto=require("crypto");

function parse(v){
 const raw=String(v||"").trim();
 let x=raw;
 if(!/^https?:\/\//i.test(x))x="https://"+x;
 const u=new URL(x),parts=u.pathname.split("/").filter(Boolean),host=u.hostname.toLowerCase();
 if(!["t.me","telegram.me","www.t.me","www.telegram.me"].includes(host)||parts.length!==1)throw Error("Use a direct Telegram bot link such as https://t.me/example_bot.");
 const username=parts[0].replace(/^@/,"");
 if(!/^[A-Za-z0-9_]{5,32}$/.test(username))throw Error("That Telegram link does not contain a valid public bot username.");
 return{username,kind:"Bot",telegramUrl:"https://t.me/"+username};
}
function decode(s){
 return String(s||"").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#x([0-9a-f]+);/gi,(_,x)=>String.fromCharCode(parseInt(x,16))).replace(/&#(\d+);/g,(_,x)=>String.fromCharCode(Number(x)));
}
function metas(html){
 const out={};const re=/<meta\b[^>]*>/gi;let m;
 while((m=re.exec(html))){
  const tag=m[0],attrs={};const ar=/([\w:-]+)\s*=\s*(["'])(.*?)\2/gi;let a;
  while((a=ar.exec(tag)))attrs[a[1].toLowerCase()]=decode(a[3]);
  const key=(attrs.property||attrs.name||attrs.itemprop||"").toLowerCase();
  if(key&&!out[key]&&attrs.content)out[key]=attrs.content;
 }
 return out;
}
function first(m,keys){for(const k of keys){if(m[k])return m[k].trim()}return""}
function pageDescription(html){
 const m=html.match(/<div[^>]+class=["'][^"']*tgme_page_description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
 if(!m)return"";
 return decode(m[1].replace(/<br\s*\/?>(?=.)/gi,"\n").replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim();
}
function pageTitle(html){
 const m=html.match(/<div[^>]+class=["'][^"']*tgme_page_title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
 if(!m)return"";
 return decode(m[1].replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim();
}
function blockedText(value){
 const s=String(value||"").toLowerCase();
 return /(porn|xxx|sex\s*chat|escort|nude|onlyfans|hack(?:ing)?|malware|ransomware|phishing|steal passwords|credential theft|keylogger|botnet|drug dealer|cocaine|heroin|methamphetamine|fentanyl|scam|fraud|carding|stolen credit|counterfeit)/i.test(s);
}
function isVerified(html){
 const m=html.match(/<div[^>]+class=["'][^"']*tgme_page_title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
 return !!m&&/class=["'][^"']*verified-icon/i.test(m[1]);
}
async function fetchBot(v){
 const p=parse(v);
 const r=await fetch(p.telegramUrl,{headers:{"user-agent":"Mozilla/5.0 KiverDirectory/3.0","accept":"text/html,application/xhtml+xml"}});
 if(!r.ok)throw Error("Telegram could not be reached for that public bot link.");
 const h=await r.text(),m=metas(h);
 const verified=isVerified(h);
 const title=first(m,["og:title","twitter:title","title"])||pageTitle(h);
 const ogAbout=first(m,["og:description","twitter:description","description"]).replace(/^\s*Telegram:\s*/i,"").trim();
 // Bots with no About get Telegram's auto text ("You can contact @name right away."), which is not a real About.
 const isDefaultAbout=t=>!t||(/right away\.?$/i.test(t)&&t.toLowerCase().includes("@"+p.username.toLowerCase())&&t.length<90);
 const realAbout=pageDescription(h)||(isDefaultAbout(ogAbout)?"":ogAbout);
 const description="";
 // Bots with no profile photo get Telegram's generic logo as og:image, which is not a real logo.
 const rawImage=first(m,["og:image","twitter:image","twitter:image:src"]);
 const realImage=/telegram\.org\/img\/t_logo/i.test(rawImage)?"":rawImage;
 const cleanTitle=(title||p.username).replace(/\s*\|\s*Telegram.*$/i,"").replace(/^Telegram:\s*/i,"").trim();
 if(!cleanTitle)throw Error("Telegram did not provide a bot name for that link.");
 // Bots verified by Telegram are exempt from the logo and About requirements.
 if(!verified){
  if(!realImage)throw Error("That Telegram bot does not have a profile photo. Add one in @BotFather, then try again.");
  if(realAbout.length<15)throw Error("That Telegram bot needs an About description of at least 15 characters. Add one in @BotFather, then try again.");
 }
 const aboutText=realAbout||(verified?ogAbout:"");
 const imageUrl=realImage||(verified?rawImage:"");
 if(blockedText(cleanTitle+" "+aboutText+" "+description))throw Error("That Telegram bot cannot be listed on Kiver.");
 return{telegramUsername:p.username,telegramUrl:p.telegramUrl,name:cleanTitle,about:aboutText,description:description.trim(),imageUrl,kind:p.kind};
}
function voter(req){return crypto.createHash("sha256").update(String(req.headers.cookie||"")+"|"+String(req.headers["x-forwarded-for"]||"")+"|kiver").digest("hex")}
module.exports={fetchBot,voter,isSafeText:value=>!blockedText(value)};