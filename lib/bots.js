const crypto=require("crypto");
function parse(v){let x=String(v||"").trim();if(!/^https?:\/\//i.test(x))x="https://"+x.replace(/^@/,"t.me/");const u=new URL(x),parts=u.pathname.split("/").filter(Boolean),host=u.hostname.toLowerCase();if(!["t.me","telegram.me","www.t.me","www.telegram.me"].includes(host)||!parts.length||parts.length>2)throw Error("Use a direct Telegram bot or Mini App link such as https://t.me/example_bot.");const username=parts[0].replace(/^@/,"");if(!/^[A-Za-z0-9_]{5,32}$/.test(username))throw Error("That Telegram link does not contain a valid public username.");return{username,kind:parts.length===2?"Mini App":"Bot",telegramUrl:"https://t.me/"+parts.join("/")}}
function dec(s){return String(s).replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(+d)).replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&")}
function meta(h,n){for(const t of h.match(/<meta\b[^>]*>/gi)||[]){const k=/(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(t);if(!k||k[1].toLowerCase()!==n)continue;const c=/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(t);if(c)return dec(c[1]!==undefined?c[1]:c[2]).trim()}return""}
async function fetchBot(v){
 const p=parse(v),r=await fetch("https://t.me/"+p.username,{headers:{"user-agent":"KiverDirectory/1.0"},redirect:"follow"});
 if(!r.ok)throw Error("Telegram could not be reached for that public link.");
 const h=await r.text(),title=meta(h,"og:title");
 if(!title||/^telegram:\s*contact\s*@/i.test(title))throw Error("We couldn’t find a public Telegram bot at that link. Check the username and try again.");
 if(/Preview channel/i.test(h)||/tgme_page_extra">[^<]*(subscribers|members)\s*</i.test(h))throw Error("That link is a channel or group, not a bot or Mini App.");
 return{telegramUsername:p.username,telegramUrl:p.telegramUrl,name:title.replace(/\s*\|\s*Telegram.*$/i,"").trim()||p.username,description:meta(h,"og:description")||"Telegram tool",imageUrl:meta(h,"og:image")||"",kind:p.kind}
}
function voter(req){return crypto.createHash("sha256").update(String(req.headers.cookie||"")+"|"+String(req.headers["x-forwarded-for"]||"")+"|kiver").digest("hex")}
module.exports={fetchBot,voter};
