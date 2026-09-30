const crypto=require("crypto"),db=require("./db"),C="kiver_session";
function hash(p){const s=crypto.randomBytes(16).toString("hex");return s+":"+crypto.scryptSync(p,s,64).toString("hex")}
function verify(p,v){const a=String(v).split(":");if(a.length!==2)return false;return crypto.scryptSync(p,a[0],64).toString("hex")===a[1]}
function cookieDomain(req){const h=String(req.headers.host||"").split(":")[0].toLowerCase();return h==="getkiver.com"||h==="www.getkiver.com"?"; Domain=.getkiver.com":""}
function tok(req){const raw=String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(C+"="));return raw?raw.slice(C.length+1):null}
async function email(req){const t=tok(req);if(!t)return null;const s=await db.session(t);return s&&s.email}
async function login(req,res,e){const t=crypto.randomBytes(32).toString("hex");await db.saveSession(t,e,new Date(Date.now()+2592000000));res.setHeader("Set-Cookie",C+"="+t+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000"+cookieDomain(req))}
module.exports={hash,verify,email,login,logout:async(req,res)=>{const t=tok(req);if(t)await db.delSession(t);res.setHeader("Set-Cookie",C+"=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"+cookieDomain(req))}}