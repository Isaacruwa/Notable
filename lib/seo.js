const E=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const abs=(origin,p)=>!p?"":/^https?:\/\//i.test(p)?p:origin+(String(p).startsWith("/")?"":"/")+p;
function clip(s,n){s=String(s||"").replace(/\s+/g," ").trim();if(s.length<=n)return s;const c=s.slice(0,n-1),i=c.lastIndexOf(" ");return(i>n*.6?c.slice(0,i):c).replace(/[\s,;:.\-–—]+$/,"")+"…"}
// Open Graph + Twitter card tags. Image URLs are always made absolute because link-preview crawlers need full https:// URLs.
function social({origin,title,description,url,image,alt,card,type}){
 const img=abs(origin,image||"/og-image.png");
 return'<meta property="og:site_name" content="Kiver"><meta property="og:type" content="'+E(type||"website")+'"><meta property="og:title" content="'+E(title)+'"><meta property="og:description" content="'+E(description)+'"><meta property="og:url" content="'+E(url)+'"><meta property="og:image" content="'+E(img)+'">'+(alt?'<meta property="og:image:alt" content="'+E(alt)+'">':"")+'<meta name="twitter:card" content="'+E(card||"summary_large_image")+'"><meta name="twitter:title" content="'+E(title)+'"><meta name="twitter:description" content="'+E(description)+'"><meta name="twitter:image" content="'+E(img)+'">'+(alt?'<meta name="twitter:image:alt" content="'+E(alt)+'">':"");
}
module.exports={E,abs,clip,social};
