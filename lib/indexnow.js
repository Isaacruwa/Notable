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
module.exports={KEY,HOST,abs,submit};
