const db=require("../lib/db"),prof=require("../lib/profile"),ix=require("../lib/indexnow");
const WINDOW=30*3600*1000;
// Daily cron: submits listings created or updated in the last 30 hours. ?slug=x submits one existing listing on demand.
module.exports=async(req,res)=>{
 try{
  res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=60");
  const slug=String((req.query&&req.query.slug)||"").trim();
  if(slug){
   const b=await db.getBot(slug).catch(()=>null);
   if(!b)return res.status(404).json({error:"Listing not found."});
   return res.json(await ix.submit([ix.abs("/bot/"+encodeURIComponent(b.slug))]));
  }
  const rows=(await prof.sitemapListings().catch(()=>[]))||[];
  const cut=Date.now()-WINDOW;
  const fresh=rows.filter(r=>r&&r.slug&&r.updated_at&&new Date(r.updated_at).getTime()>cut);
  if(!fresh.length)return res.json({changed:0,submitted:0});
  const urls=fresh.map(r=>ix.abs("/bot/"+encodeURIComponent(r.slug)));
  urls.push(ix.abs("/"),ix.abs("/directory"));
  return res.json({changed:fresh.length,...(await ix.submit(urls))});
 }catch(e){res.status(200).json({error:"IndexNow submit failed."})}
};
