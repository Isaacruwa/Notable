const META=/meta\\b[^>]*>/gi;
function decode(s){return String(s||"").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#x([0-9a-f]+);/gi,(_,x)=>String.fromCharCode(parseInt(x,16))).replace(/&#(\\d+);/g,(_,x)=>String.fromCharCode(Number(x)));}
function metaImage(html){
 let m;
 while((m=META.exec(html))){
  const attrs={};let a;const ar=/([\\w:-]+)\\s*=\\s*(["'])(.*?)\\2/gi;
  while((a=ar.exec(m[0])))attrs[a[1].toLowerCase()]=decode(a[3]);
  const key=(attrs.property||attrs.name||"").toLowerCase();
  if((key==="og:image"||key==="twitter:image"||key==="twitter:image:src")&&attrs.content)return attrs.content.trim();
 }
 return "";
}
function validUsername(v){return /^[A-Za-z0-9_]{5,32}$/.test(String(v||""));}
module.exports=async(req,res)=>{
 const username=String(req.query.u||"").replace(/^@/,"").trim();
 if(!validUsername(username))return res.status(400).end("Invalid bot username");
 try{
  const page=await fetch("https://t.me/"+encodeURIComponent(username),{headers:{"user-agent":"Mozilla/5.0 KiverImageProxy/1.0","accept":"text/html,application/xhtml+xml"}});
  if(!page.ok)return res.status(404).end("Bot image unavailable");
  const html=await page.text();
  const imageUrl=metaImage(html);
  if(!imageUrl)return res.status(404).end("Bot image unavailable");
  const absolute=new URL(imageUrl,"https://t.me/").toString();
  const image=await fetch(absolute,{headers:{"user-agent":"Mozilla/5.0 KiverImageProxy/1.0","accept":"image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"}});
  if(!image.ok)return res.status(502).end("Bot image unavailable");
  const type=image.headers.get("content-type")||"image/jpeg";
  if(!/^image\\//i.test(type))return res.status(502).end("Invalid bot image");
  const bytes=Buffer.from(await image.arrayBuffer());
  if(bytes.length>8*1024*1024)return res.status(413).end("Bot image too large");
  res.setHeader("Content-Type",type);
  res.setHeader("Cache-Control","public, s-maxage=86400, stale-while-revalidate=604800");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.end(bytes);
 }catch(e){res.status(502).end("Bot image unavailable");}
};