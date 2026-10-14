const toMd=require("./markdown");
const HOST_OK=/^([a-z0-9-]+\.)*(getkiver\.com|vercel\.app)(:\d+)?$/i;
const text=(res,code,msg)=>{res.status(code);res.setHeader("Content-Type","text/plain; charset=utf-8");return res.end(msg)};
// Serves a Markdown version of a page. vercel.json routes requests that send "Accept: text/markdown" here.
module.exports=async(req,res)=>{
 const host=String(req.headers.host||"");
 const p=String(req.query.p||"/");
 if(!HOST_OK.test(host)||!/^\/[A-Za-z0-9._~\/%@+-]*$/.test(p)||p.startsWith("/api")||p.startsWith("//")||p.includes(".."))return text(res,400,"Bad request\n");
 const qs=new URLSearchParams();
 for(const [k,v] of Object.entries(req.query||{})){if(k==="md"||k==="p")continue;(Array.isArray(v)?v:[v]).forEach(x=>qs.append(k,String(x)))}
 const url="https://"+host+p+(qs.toString()?"?"+qs.toString():"");
 let r;
 try{r=await fetch(url,{headers:{Accept:"text/html","User-Agent":"Kiver-Markdown/1.0"},redirect:"manual"})}catch{return text(res,502,"Could not load the page.\n")}
 if(r.status>=300&&r.status<400&&r.headers.get("location")){res.status(r.status);res.setHeader("Location",r.headers.get("location"));return res.end()}
 const html=await r.text();
 const {markdown}=toMd(html,url);
 res.status(r.status);
 res.setHeader("Content-Type","text/markdown; charset=utf-8");
 res.setHeader("Vary","Accept");
 res.setHeader("x-markdown-tokens",String(Math.ceil(markdown.length/4)));
 res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=3600");
 res.end(markdown);
};
