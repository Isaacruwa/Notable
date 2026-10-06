const U="https://ovxytcfhyzqtxzhsmmhn.supabase.co/functions/v1/kiver-profile",K=Buffer.from("c2JfcHVibGlzaGFibGVfTTd3TlNaUzlVd3lQcHRJZEVwaEwyZ19JTG1aT3JYaQ==","base64").toString();
async function call(action,params={},token=null){
 const h={"Content-Type":"application/json","apikey":K,"Authorization":"Bearer "+(token||K)};
 const r=await fetch(U,{method:"POST",headers:h,body:JSON.stringify({action,params})});
 let d;try{d=await r.json()}catch{throw Error("Profile service returned an invalid response.")}
 if(!r.ok||!d.ok)throw Error(d.error||"Profile request failed.");
 return d.result
}
module.exports={mine:t=>call("mine",{},t),update:(p,t)=>call("update",p,t),getPublic:u=>call("public",{username:u}),verifiedUsernames:()=>call("verifiedUsernames"),admin:(a,p,t)=>call(a,p,t)};
