const db=require("../lib/db"),a=require("../lib/auth"),b=require("../lib/bots");
module.exports=async(req,res)=>{
 try{
  if(req.method==="GET"){
   if(req.query.action==="preview"){
    if(!await a.email(req))return res.status(401).json({error:"Sign in to submit a bot."});
    const x=await b.fetchBot(req.query.url),o=await db.byUser(x.telegramUsername);
    return res.json({bot:x,alreadyListed:!!o,slug:o?.slug});
   }
   return res.json({bots:await db.list(req.query)});
  }
  const e=await a.email(req);if(!e)return res.status(401).json({error:"Sign in first."});
  const x=req.body||{};
  if(x.action==="submit"){
   const d=await b.fetchBot(x.telegramUrl),o=await db.byUser(d.telegramUsername);
   if(o)return res.status(409).json({error:"That Telegram username is already listed.",slug:o.slug});
   if(!String(x.description||d.description||"").trim())return res.status(400).json({error:"Add a description for this listing before publishing."});
   return res.status(201).json({bot:await db.addBot({...d,description:String(x.description||d.description||"").trim(),about:String(x.about||d.about||"").trim(),websiteUrl:String(x.websiteUrl||"").trim(),category:x.category||"other",ownerEmail:e})});
  }
  if(x.action==="refresh"){
   const d=await b.fetchBot(x.telegramUrl||x.slug);
   const saved=await db.refreshOwned(x.slug,e,d);
   if(!saved)return res.status(404).json({error:"That listing was not found in your account."});
   return res.json({bot:saved});
  }
  if(x.action==="edit"){
   const saved=await db.editOwned(x.slug,e,{description:x.description,about:x.about,websiteUrl:x.websiteUrl});
   if(!saved)return res.status(404).json({error:"That listing was not found in your account."});
   return res.json({bot:saved});
  }
  if(x.action==="upvote")return res.json(await db.vote(x.slug,b.voter(req)));
  res.status(400).json({error:"Unknown action."})
 }catch(err){res.status(400).json({error:err.message||"Request failed."})}
};