const U="https://ovxytcfhyzqtxzhsmmhn.supabase.co/functions/v1/kiver-db",K=Buffer.from("c2JfcHVibGlzaGFibGVfTTd3TlNaUzlVd3lQcHRJZEVwaEwyZ19JTG1aT3JYaQ==","base64").toString(),C="kiver_session";
const tok=req=>String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(C+"="))?.slice(C.length+1)||null;
async function call(action,params={},token=null){
 const h={"Content-Type":"application/json","apikey":K,"Authorization":"Bearer "+(token||K)};
 const r=await fetch(U,{method:"POST",headers:h,body:JSON.stringify({action,params})});
 let d;try{d=await r.json()}catch{throw Error("Authentication service returned an invalid response.")};
 if(!r.ok||!d.ok)throw Error(d.error||"Authentication request failed.");
 return d.result
}
async function email(req){const t=tok(req);if(!t)return null;try{return(await call("me",{},t))?.email||null}catch{return null}}
async function profile(req){const t=tok(req);if(!t)return null;try{const m=await call("me",{},t);return m?.email?{email:m.email,username:m.username||null,verified:!!m.verified}:null}catch{return null}}
async function login(req,res,e,p){
 const d=await call("login",{email:e,password:p});
 if(!d?.token)throw Error("Your account could not be signed in.");
 res.setHeader("Set-Cookie",C+"="+d.token+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000");
 return{email:d.email||e}
}
async function requestPasswordReset(e){return await call("requestPasswordReset",{email:e})}
async function completePasswordReset(e,t,p){return await call("completePasswordReset",{email:e,token:t,password:p})}
async function signup(req,res,e,p){
 const d=await call("signup",{email:e,password:p});
 if(!d?.token)throw Error("Your account could not be created.");
 res.setHeader("Set-Cookie",C+"="+d.token+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000");
 return{email:d.email||e}
}
module.exports={email,profile,token:tok,login,signup,requestPasswordReset,completePasswordReset,logout:async(req,res)=>{
 const t=tok(req);if(t){try{await call("logout",{},t)}catch{}}
 res.setHeader("Set-Cookie",C+"=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax")
}};