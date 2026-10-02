const a=require("../lib/auth");
const U="https://ovxytcfhyzqtxzhsmmhn.supabase.co/functions/v1/kiver-claim",K=Buffer.from("c2JfcHVibGlzaGFibGVfTTd3TlNaUzlVd3lQcHRJZEVwaEwyZ19JTG1aT3JYaQ==","base64").toString();
async function call(action,params,token){
 const r=await fetch(U,{method:"POST",headers:{"Content-Type":"application/json","apikey":K,"Authorization":"Bearer "+token},body:JSON.stringify({action,params})});
 let d;try{d=await r.json()}catch{throw Object.assign(Error("The claim service returned an invalid response."),{status:502})}
 if(!r.ok||!d.ok)throw Object.assign(Error(d.error||"Claim request failed."),{status:r.status||400});
 return d.result;
}
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 try{
  const t=a.token(req),e=await a.email(req);
  if(!t||!e)return res.status(401).json({error:"Sign in to claim a bot."});
  if(req.method==="GET")return res.json(await call("lookup",{q:String(req.query.q||"")},t));
  if(req.method==="POST"){const x=req.body||{};return res.json(await call("claim",{q:String(x.q||x.slug||"")},t))}
  return res.status(405).json({error:"Method not allowed."});
 }catch(err){
  const s=Number(err.status);
  return res.status(s>=400&&s<600?s:400).json({error:err.message||"Request failed."});
 }
};
