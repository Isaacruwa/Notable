// IndexNow: tells Bing, Yandex, Naver, Seznam and others about new or changed URLs the moment we know.
const KEY="1ae948b26bf9efd0c90c376cfe04946d",HOST="www.getkiver.com";
const abs=p=>"https://"+HOST+p;
async function submit(urls,opt){
 const timeout=(opt&&opt.timeout)||8000;
 const list=[...new Set((urls||[]).filter(Boolean))].slice(0,10000);
 if(!list.length)return{submitted:0,status:0};
 const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const r=await fetch("https://api.indexnow.org/indexnow",{method:"POST",headers:{"Content-Type":"application/json; charset=utf-8"},body:JSON.stringify({host:HOST,key:KEY,keyLocation:abs("/"+KEY+".txt"),urlList:list}),signal:ctrl.signal});
  return{submitted:list.length,status:r.status};
 }catch(e){return{submitted:0,status:0,error:String(e&&e.name||e)}}
 finally{clearTimeout(t)}
}
// Submits every listing created or updated in the last 30 hours (called from the daily /api/refresh cron).
async function submitRecent(){
 const rows=(await require("./profile").sitemapListings().catch(()=>[]))||[];
 const cut=Date.now()-30*3600*1000;
 const fresh=rows.filter(r=>r&&r.slug&&r.updated_at&&new Date(r.updated_at).getTime()>cut);
 if(!fresh.length)return{changed:0,submitted:0};
 const urls=fresh.map(r=>abs("/bot/"+encodeURIComponent(r.slug)));
 urls.push(abs("/"),abs("/directory"));
 return{changed:fresh.length,...(await submit(urls))};
}
module.exports={KEY,HOST,abs,submit,submitRecent};
