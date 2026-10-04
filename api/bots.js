const db=require("../lib/db"),a=require("../lib/auth"),b=require("../lib/bots");
const CATEGORIES=["ai","productivity","utilities","finance","games","community","media","education","other"];
const CLAIM_URL="https://ovxytcfhyzqtxzhsmmhn.supabase.co/functions/v1/kiver-claim",CLAIM_KEY=Buffer.from("c2JfcHVibGlzaGFibGVfTTd3TlNaUzlVd3lQcHRJZEVwaEwyZ19JTG1aT3JYaQ==","base64").toString();
async function claimCall(action,params,token){
 const r=await fetch(CLAIM_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":CLAIM_KEY,"Authorization":"Bearer "+token},body:JSON.stringify({action,params})});
 let d;try{d=await r.json()}catch{throw Error("The claim service returned an invalid response.")}
 if(!r.ok||!d.ok)throw Error(d.error||"Claim request failed.");
 return d.result;
}
module.exports=async(req,res)=>{
 try{
  const t=a.token(req),e=await a.email(req);
  if(req.method==="GET"){
   if(req.query.action==="preview"){if(!e)return res.status(401).json({error:"Sign in to submit a bot."});const x=await b.fetchBot(req.query.url),o=await db.byUser(x.telegramUsername,t);return res.json({bot:x,alreadyListed:!!o,slug:o?.slug})}
   if(req.query.action==="claimLookup"){if(!e)return res.status(401).json({error:"Sign in to claim a bot."});return res.json(await claimCall("lookup",{q:String(req.query.q||"")},t))}
   if(req.query.action==="reviews"){res.setHeader("Cache-Control","no-store");const r=await db.reviews(String(req.query.slug||""));if(!r)return res.status(404).json({error:"Listing not found."});return res.json(r)}
   if(req.query.action==="myReview"){if(!e)return res.status(401).json({error:"Sign in first."});res.setHeader("Cache-Control","no-store");return res.json((await db.myReview(String(req.query.slug||""),t))||{review:null,isOwner:false})}
   if(req.query.action==="checkUsername"){res.setHeader("Cache-Control","no-store");return res.json(await db.checkUsername(String(req.query.username||""),t))}
   return res.json({bots:await db.list(req.query,t)});
  }
  if(!e)return res.status(401).json({error:"Sign in first."});
  const x=req.body||{};
  if(x.action==="submit"){const d=await b.fetchBot(x.telegramUrl),o=await db.byUser(d.telegramUsername,t);if(o)return res.status(409).json({error:"That Telegram username is already listed.",slug:o.slug});const description=String(x.description||"").trim(),about=String(x.about||d.about||"").trim(),category=String(x.category||"").trim().toLowerCase();if(!CATEGORIES.includes(category))return res.status(400).json({error:"Choose a category for this listing."});if(!b.isSafeText(description+" "+about))return res.status(400).json({error:"That listing cannot be published on Kiver."});return res.status(201).json({bot:await db.addBot({...d,description,about,websiteUrl:String(x.websiteUrl||"").trim(),category},t)})}
  if(x.action==="refresh"){const d=await b.fetchBot(x.telegramUrl||x.slug),saved=await db.refreshOwned(x.slug,e,d,t);if(!saved)return res.status(404).json({error:"That listing was not found in your account."});return res.json({bot:saved})}
  if(x.action==="edit"){const saved=await db.editOwned(x.slug,e,{description:x.description,about:x.about,websiteUrl:x.websiteUrl,category:x.category},t);if(!saved)return res.status(404).json({error:"That listing was not found in your account."});return res.json({bot:saved})}
  if(x.action==="claim")return res.json(await claimCall("claim",{q:String(x.q||x.slug||"")},t));
  if(x.action==="upvote")return res.json(await db.vote(x.slug,b.voter(req),t));
  if(x.action==="review")return res.json(await db.addReview({slug:String(x.slug||""),rating:Number(x.rating),body:String(x.body||"")},t));
  if(x.action==="deleteReview")return res.json(await db.deleteReview(String(x.slug||""),t));
  if(x.action==="setUsername")return res.json(await db.setUsername(String(x.username||""),t));
  res.status(400).json({error:"Unknown action."})
 }catch(err){res.status(400).json({error:err.message||"Request failed."})}
};