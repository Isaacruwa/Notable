const db=require("../lib/db");
const seo=require("../lib/seo");
const E=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const imageSrc=b=>b&&b.telegram_username?"/api/image?u="+encodeURIComponent(b.telegram_username):"";
function renderDescription(s){
 const lines=String(s||"").replace(/\r/g,"").split("\n"),list=[];let out="";
 const flush=()=>{if(list.length){out+='<ul class="description-list">'+list.map(x=>"<li>"+E(x)+"</li>").join("")+"</ul>";list.length=0}};
 for(const raw of lines){const line=raw.trim();if(!line){flush();continue}if(/^[-•*]\s+/.test(line)){list.push(line.replace(/^[-•*]\s+/,""));continue}flush();out+="<p>"+E(line)+"</p>"}flush();return out||"<p>Telegram tool.</p>";
}


const FAQ_STOP={
 de:"der die das und ist nicht mit für auf ein eine zu den von im sie ich du wir auch bei oder wie dein deine dem sich als nur".split(" "),
 es:"el la los las y es de que en un una para con por se su del al más como tu tus muy este esta".split(" "),
 fr:"le la les et est de des un une pour avec dans sur pas que qui votre vous ce au du en sont plus".split(" "),
 pt:"o a os as e é de do da dos das um uma para com em que não por seu sua você como mais muito este".split(" "),
 tr:"ve bir bu için ile da de çok daha olarak mi en ne gibi her değil sen ya veya olan".split(" "),
 id:"dan yang di untuk dengan ini itu dari ke pada adalah anda kamu bisa tidak akan atau juga".split(" "),
 en:"the and is to of for with a in on your you it that this are be can".split(" ")
};
function faqLang(s){
 try{
  const t=String(s||"").replace(/https?:\/\/\S+/g," ").replace(/[@#]\w+/g," ");
  const letters=t.match(/\p{L}/gu)||[];if(letters.length<12)return"en";
  const cnt=re=>(t.match(re)||[]).length;
  const arab=cnt(/[\u0600-\u06FF]/g),cyr=cnt(/[\u0400-\u04FF]/g);
  if(arab/letters.length>0.3)return/[پچژگکی]/.test(t)?"fa":"ar";
  if(cyr/letters.length>0.3)return/[іїєґІЇЄҐ]/.test(t)?"uk":"ru";
  const lat=cnt(/[A-Za-zÀ-ÿĞğİıŞş]/g);if(lat/letters.length<0.7)return null;
  const words=t.toLowerCase().match(/\p{L}+/gu)||[];if(words.length<5)return"en";
  const sc={};for(const k in FAQ_STOP){const set=new Set(FAQ_STOP[k]);sc[k]=words.filter(w=>set.has(w)).length}
  const ranked=Object.keys(sc).sort((a,b)=>sc[b]-sc[a]);const best=ranked[0],second=sc[ranked[1]];
  if(best==="en"||sc[best]<3||sc[best]<1.5*second||sc[best]<=sc.en)return(sc.en<2&&words.length>=8)?null:"en";
  return best;
 }catch(e){return"en"}
}
const FAQ_T={
 en:{h:"Frequently asked questions about {n}",qw:"What is {n}?",qu:"How do I use {n}?",au:"Tap Open in Telegram on this page to launch {n} (@{u}) inside Telegram, then follow its prompts to get started.",qs:"What do users say about {n}?",as:"{n} has an average rating of {avg} out of 5 from {c} on Kiver. Read the community reviews above for details.",a0:"There are no reviews of {n} on Kiver yet. Try it in Telegram and be the first to leave one.",qa:"What are alternatives to {n}?",aa:"Similar Telegram tools on Kiver include {list}. Scroll down to the related tools to compare them.",r1:"1 review",rn:"{c} reviews"},
 ru:{h:"Частые вопросы о {n}",qw:"Что такое {n}?",qu:"Как пользоваться {n}?",au:"Нажмите кнопку «Open in Telegram» на этой странице, чтобы открыть {n} (@{u}) в Telegram, и следуйте подсказкам.",qs:"Что говорят пользователи о {n}?",as:"Средняя оценка {n} на Kiver — {avg} из 5 (отзывов: {c}). Подробности — в отзывах сообщества выше.",a0:"У {n} на Kiver пока нет отзывов. Попробуйте в Telegram и оставьте первый отзыв.",qa:"Какие есть альтернативы {n}?",aa:"Похожие Telegram-инструменты на Kiver: {list}. Прокрутите страницу вниз, чтобы сравнить их."},
 uk:{h:"Поширені запитання про {n}",qw:"Що таке {n}?",qu:"Як користуватися {n}?",au:"Натисніть кнопку «Open in Telegram» на цій сторінці, щоб відкрити {n} (@{u}) у Telegram, і дотримуйтесь підказок.",qs:"Що кажуть користувачі про {n}?",as:"Середня оцінка {n} на Kiver — {avg} із 5 (відгуків: {c}). Деталі — у відгуках спільноти вище.",a0:"У {n} на Kiver поки немає відгуків. Спробуйте в Telegram і залиште перший відгук.",qa:"Які є альтернативи {n}?",aa:"Схожі Telegram-інструменти на Kiver: {list}. Прокрутіть сторінку вниз, щоб порівняти їх."},
 de:{h:"Häufige Fragen zu {n}",qw:"Was ist {n}?",qu:"Wie benutze ich {n}?",au:"Tippe auf dieser Seite auf „Open in Telegram“, um {n} (@{u}) in Telegram zu starten, und folge den Anweisungen.",qs:"Was sagen Nutzer über {n}?",as:"{n} hat auf Kiver eine durchschnittliche Bewertung von {avg} von 5 (Bewertungen: {c}). Details findest du oben in den Community-Bewertungen.",a0:"Für {n} gibt es auf Kiver noch keine Bewertungen. Probiere es in Telegram aus und schreibe die erste.",qa:"Welche Alternativen gibt es zu {n}?",aa:"Ähnliche Telegram-Tools auf Kiver sind {list}. Scrolle nach unten, um sie zu vergleichen."},
 es:{h:"Preguntas frecuentes sobre {n}",qw:"¿Qué es {n}?",qu:"¿Cómo uso {n}?",au:"Toca «Open in Telegram» en esta página para abrir {n} (@{u}) en Telegram y sigue sus indicaciones.",qs:"¿Qué opinan los usuarios de {n}?",as:"{n} tiene una valoración media de {avg} sobre 5 en Kiver (reseñas: {c}). Consulta las reseñas de la comunidad más arriba.",a0:"{n} aún no tiene reseñas en Kiver. Pruébalo en Telegram y sé el primero en dejar una.",qa:"¿Qué alternativas hay a {n}?",aa:"Herramientas de Telegram similares en Kiver: {list}. Baja por la página para compararlas."},
 fr:{h:"Questions fréquentes sur {n}",qw:"Qu’est-ce que {n} ?",qu:"Comment utiliser {n} ?",au:"Appuyez sur « Open in Telegram » sur cette page pour lancer {n} (@{u}) dans Telegram, puis suivez les instructions.",qs:"Que disent les utilisateurs de {n} ?",as:"{n} a une note moyenne de {avg} sur 5 sur Kiver (avis : {c}). Consultez les avis de la communauté ci-dessus.",a0:"{n} n’a pas encore d’avis sur Kiver. Essayez-le dans Telegram et laissez le premier.",qa:"Quelles sont les alternatives à {n} ?",aa:"Des outils Telegram similaires sur Kiver : {list}. Faites défiler la page pour les comparer."},
 pt:{h:"Perguntas frequentes sobre {n}",qw:"O que é {n}?",qu:"Como usar {n}?",au:"Toque em «Open in Telegram» nesta página para abrir {n} (@{u}) no Telegram e siga as instruções.",qs:"O que os usuários dizem sobre {n}?",as:"{n} tem uma avaliação média de {avg} de 5 no Kiver (avaliações: {c}). Veja as avaliações da comunidade acima.",a0:"{n} ainda não tem avaliações no Kiver. Experimente no Telegram e seja o primeiro a avaliar.",qa:"Quais são as alternativas a {n}?",aa:"Ferramentas de Telegram semelhantes no Kiver: {list}. Role a página para compará-las."},
 tr:{h:"{n} hakkında sık sorulan sorular",qw:"{n} nedir?",qu:"{n} nasıl kullanılır?",au:"Bu sayfadaki «Open in Telegram» düğmesine dokun, {n} (@{u}) Telegram’da açılsın ve yönergeleri izle.",qs:"Kullanıcılar {n} hakkında ne diyor?",as:"{n}, Kiver’da 5 üzerinden {avg} ortalama puana sahip (yorum sayısı: {c}). Ayrıntılar için yukarıdaki topluluk yorumlarına bak.",a0:"{n} için Kiver’da henüz yorum yok. Telegram’da dene ve ilk yorumu sen yaz.",qa:"{n} için alternatifler neler?",aa:"Kiver’daki benzer Telegram araçları: {list}. Karşılaştırmak için sayfayı aşağı kaydır."},
 id:{h:"Pertanyaan umum tentang {n}",qw:"Apa itu {n}?",qu:"Bagaimana cara menggunakan {n}?",au:"Ketuk «Open in Telegram» di halaman ini untuk membuka {n} (@{u}) di Telegram, lalu ikuti petunjuknya.",qs:"Apa kata pengguna tentang {n}?",as:"{n} memiliki rating rata-rata {avg} dari 5 di Kiver (ulasan: {c}). Lihat ulasan komunitas di atas untuk detailnya.",a0:"{n} belum memiliki ulasan di Kiver. Cobalah di Telegram dan jadilah yang pertama memberi ulasan.",qa:"Apa alternatif untuk {n}?",aa:"Alat Telegram serupa di Kiver: {list}. Gulir ke bawah untuk membandingkannya."},
 fa:{h:"سؤالات متداول درباره {n}",qw:"{n} چیست؟",qu:"چطور از {n} استفاده کنم؟",au:"در همین صفحه روی دکمه «Open in Telegram» بزنید تا {n} (@{u}) در تلگرام باز شود و سپس راهنمای آن را دنبال کنید.",qs:"کاربران درباره {n} چه می‌گویند؟",as:"میانگین امتیاز {n} در Kiver برابر {avg} از 5 است (تعداد نظرات: {c}). برای جزئیات، نظرات کاربران را در بالا ببینید.",a0:"هنوز نظری درباره {n} در Kiver ثبت نشده است. آن را در تلگرام امتحان کنید و اولین نظر را بنویسید.",qa:"جایگزین‌های {n} کدامند؟",aa:"ابزارهای مشابه تلگرام در Kiver: {list}. برای مقایسه، صفحه را پایین بروید."},
 ar:{h:"أسئلة شائعة حول {n}",qw:"ما هو {n}؟",qu:"كيف أستخدم {n}؟",au:"اضغط على «Open in Telegram» في هذه الصفحة لفتح {n} (@{u}) في تيليجرام ثم اتبع التعليمات.",qs:"ماذا يقول المستخدمون عن {n}؟",as:"متوسط تقييم {n} على Kiver هو {avg} من 5 (عدد المراجعات: {c}). اطلع على مراجعات المجتمع أعلاه للتفاصيل.",a0:"لا توجد مراجعات لـ {n} على Kiver حتى الآن. جرّبه على تيليجرام وكن أول من يكتب مراجعة.",qa:"ما بدائل {n}؟",aa:"أدوات تيليجرام مشابهة على Kiver: {list}. مرّر لأسفل الصفحة لمقارنتها."}
};
function buildFaq(b,c,related,stats,about,type,origin,E){
 try{
  const name=String(b.name||"").trim();if(!name)return{html:"",ld:""};
  const text=String(b.description||about||"").replace(/\s+/g," ").trim();
  const lang=faqLang(text);if(!lang)return{html:"",ld:""};const T=FAQ_T[lang]||FAQ_T.en,rtl=lang==="fa"||lang==="ar";
  const f=(s,o)=>s.replace(/\{(\w+)\}/g,(m,k)=>o[k]!=null?o[k]:m);
  const o={n:name,u:b.telegram_username||""};
  const qa=[];
  if(text)qa.push([f(T.qw,o),text.length>300?text.slice(0,297).replace(/\s+\S*$/,"")+"...":text]);
  if(b.telegram_username)qa.push([f(T.qu,o),f(T.au,o)]);
  if(stats&&stats.count){const cc=lang==="en"?(stats.count===1?T.r1:f(T.rn,{c:stats.count})):String(stats.count);qa.push([f(T.qs,o),f(T.as,{...o,avg:Number(stats.average).toFixed(1),c:cc})])}
  else qa.push([f(T.qs,o),f(T.a0,o)]);
  if(related&&related.length){const names=related.map(x=>x.name).filter(Boolean).slice(0,4);if(names.length)qa.push([f(T.qa,o),f(T.aa,{...o,list:names.join(", ")})])}
  if(!qa.length)return{html:"",ld:""};
  const html='<section class="content-block faq-block" lang="'+lang+'"'+(rtl?' dir="rtl"':"")+'><span class="eyebrow">FAQ</span><h2>'+E(f(T.h,o))+"</h2>"+qa.map(x=>"<h3>"+E(x[0])+"</h3><p>"+E(x[1])+"</p>").join("")+"</section>";
  const ld='<script type="application/ld+json">'+JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","inLanguage":lang,"mainEntity":qa.map(x=>({"@type":"Question","name":x[0],"acceptedAnswer":{"@type":"Answer","text":x[1]}}))}).replace(/</g,"\\u003c")+"</script>";
  return{html,ld};
 }catch(e){return{html:"",ld:""}}
}

const SEO_T={
 en:{k:"",d:"Read reviews and see how to use {n} on Kiver."},
 ru:{k:"Telegram-бот",d:"Отзывы и инструкция по использованию {n} на Kiver."},
 uk:{k:"Telegram-бот",d:"Відгуки та інструкція з використання {n} на Kiver."},
 de:{k:"Telegram-Bot",d:"Bewertungen und Anleitung zur Nutzung von {n} auf Kiver."},
 es:{k:"bot de Telegram",d:"Reseñas y guía para usar {n} en Kiver."},
 fr:{k:"bot Telegram",d:"Avis et mode d’emploi de {n} sur Kiver."},
 pt:{k:"bot do Telegram",d:"Avaliações e como usar {n} no Kiver."},
 tr:{k:"Telegram botu",d:"{n} için yorumlar ve kullanım rehberi, Kiver’da."},
 id:{k:"bot Telegram",d:"Ulasan dan cara menggunakan {n} di Kiver."},
 fa:{k:"ربات تلگرام",d:"نظرات و راهنمای استفاده از {n} در Kiver."},
 ar:{k:"بوت تيليجرام",d:"المراجعات ودليل استخدام {n} على Kiver."}
};
function seoMeta(b,text,type,metaDesc,pageTitle){
 try{
  const lang=faqLang(text);if(!lang)return{title:pageTitle,desc:metaDesc};
  const T=SEO_T[lang];if(!T)return{title:pageTitle,desc:metaDesc};
  const name=String(b.name||"").trim(),u=String(b.telegram_username||"").trim();
  const isBot=String(type||"Bot")==="Bot";
  const kw=(lang==="en"||!isBot)?"Telegram "+type:T.k;
  let title=pageTitle;
  if(name){
   const withHandle=u?name+" (@"+u+") — "+kw+" | Kiver":"";
   const plain=name+" — "+kw+" | Kiver";
   if(withHandle&&withHandle.length<=62)title=withHandle;
   else if(lang!=="en"&&plain.length<=62)title=plain;
  }
  let desc=metaDesc;
  if(name&&String(metaDesc||"").length<90){
   const base=String(metaDesc||"").replace(/[\s.!?…،。]+$/,"");
   desc=(base?base+". ":"")+T.d.replace("{n}",name);
   if(desc.length>155)desc=metaDesc;
  }
  return{title,desc};
 }catch(e){return{title:pageTitle,desc:metaDesc}}
}

module.exports=async(req,res)=>{
 if(req.query.user)return require("../lib/profile-page")(req,res);
 const b=await db.getBot(req.query.slug);if(!b)return res.status(404).end("Bot not found");
 const c=await db.reviews(b.slug),related=(await db.list({category:b.category,sort:"top",limit:5})).filter(x=>x.slug!==b.slug).slice(0,4);
 const origin=(req.headers["x-forwarded-proto"]||"https")+"://"+req.headers.host,url=origin+"/bot/"+b.slug;
 const type=b.kind||"Bot",about=b.about||"",description=b.description||about||"Telegram tool",bodyDescription=(b.description&&String(b.description).trim()!==about.trim())?b.description:"";
 const relatedHtml=related.map(x=>`<a class="compact-card" href="/bot/${encodeURIComponent(x.slug)}"><div class="compact-avatar">${imageSrc(x)?'<img src="'+E(imageSrc(x))+'" alt="">':E((x.name||"B").charAt(0))}</div><div><b>${E(x.name)}</b><p>${E(x.description||x.about||"Telegram tool")}</p><small>↑ ${x.upvotes||0} · ${E(x.category||"Other")}</small></div></a>`).join("");
 const stats=c.stats||{count:(c.reviews||[]).length,average:0},reviewWord=n=>n+(n===1?" review":" reviews");
 const starRow=n=>{n=Math.max(0,Math.min(5,Math.round(Number(n)||0)));return '<span class="stars" role="img" aria-label="'+n+' out of 5 stars">'+"★".repeat(n)+'<span class="stars-off">'+"★".repeat(5-n)+"</span></span>"};
 const userBadge='<svg class="verified-badge user-verified" viewBox="0 0 18 18" width="16" height="16" role="img" aria-label="Verified user" xmlns="http://www.w3.org/2000/svg"><title>Verified</title><polygon fill="#0099FD" points="9,16 7.1,16.9 5.8,15.2 3.7,15.1 3.4,13 1.5,12 2.2,9.9 1.1,8.2 2.6,6.7 2.4,4.6 4.5,4 5.3,2 7.4,2.4 9,1.1 10.7,2.4 12.7,2 13.6,4 15.6,4.6 15.5,6.7 17,8.2 15.9,9.9 16.5,12 14.7,13 14.3,15.1 12.2,15.2 10.9,16.9"/><polygon fill="#FFFFFF" points="13.1,7.3 12.2,6.5 8.1,10.6 5.9,8.5 5,9.4 8,12.4"/></svg>';
 const fmtDate=s=>{try{return new Date(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"})}catch{return""}};
 const reviews=(c.reviews||[]).map(r=>`<article class="review-card"><div class="review-head"><span class="review-avatar">${E((r.username||"K").charAt(0).toUpperCase())}</span><div class="review-who"><span class="review-name"><b>@${E(r.username||"kiver_user")}</b>${r.verified?userBadge:""}</span><small>${E(fmtDate(r.created_at))}${r.edited?" · edited":""}</small></div>${starRow(r.rating)}</div><p>${E(r.body)}</p></article>`).join("");
 const reviewSummary=stats.count?'<div class="review-summary"><b>'+E(Number(stats.average).toFixed(1))+"</b>"+starRow(stats.average)+"<small>"+reviewWord(stats.count)+"</small></div>":"";
 const comments=(c.comments||[]).map(x=>`<article class="comment-card"><p>${E(x.body)}</p><small>Community discussion</small></article>`).join("");
 const website=b.website_url?`<a class="outline-button" href="${E(b.website_url)}" target="_blank" rel="noopener noreferrer">Visit website ↗</a>`:"";
 const metaDesc=seo.clip(description||("Discover "+b.name+" on Kiver."),155),ogImage=imageSrc(b)?seo.abs(origin,imageSrc(b)):"",tail=stats.count?"Features and Reviews":"Features and How to Use",tFull=b.name+" Telegram "+type+": "+tail+" | Kiver",tAlt=b.name+" — Telegram "+type+" | Kiver",pageTitle=tFull.length<=62?tFull:(tAlt.length<=62?tAlt:seo.clip(b.name,40)+" — Telegram "+type+" | Kiver");
 let metaDescF=metaDesc,pageTitleF=pageTitle;try{const sm=seoMeta(b,String(b.description||about||"").replace(/\s+/g," ").trim(),type,metaDesc,pageTitle);metaDescF=sm.desc;pageTitleF=sm.title}catch(e){}
 const crumbs=[{n:"Directory",u:origin+"/directory"}].concat(b.category?[{n:String(b.category),u:origin+"/category/"+encodeURIComponent(String(b.category).toLowerCase())}]:[],[{n:b.name,u:url}]);
 const breadcrumbScript='<script type="application/ld+json">'+JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":crumbs.map((c,i)=>({"@type":"ListItem","position":i+1,"name":c.n,"item":c.u}))}).replace(/</g,"\\u003c")+"</script>";
 const faq=buildFaq(b,c,related,stats,about,type,origin,E);
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${E(metaDescF)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${E(url)}">${seo.social({origin,title:pageTitleF,description:metaDescF,url,image:ogImage||"/og-image.png",alt:ogImage?b.name+" logo":"Kiver, the Telegram bot directory",card:ogImage?"summary":"summary_large_image"})}<link rel="manifest" href="/manifest.json"><link rel="icon" href="/favicon.ico?v=8" sizes="48x48"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=8"><link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png?v=8"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=8"><link rel="stylesheet" href="/app.css"><title>${E(pageTitleF)}</title></head><body><header class="nav"><a class="brand" href="/"><span class="kiver-inline-logo" aria-label="Kiver" role="img"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Kiver"><rect width="256" height="256" fill="#fff"/><circle cx="128" cy="58" r="17" fill="#090909"/><rect x="123" y="70" width="10" height="30" rx="5" fill="#090909"/><rect x="54" y="91" width="148" height="116" rx="43" fill="#090909"/><rect x="75" y="112" width="106" height="45" rx="23" fill="#fff"/><circle cx="98" cy="134" r="9" fill="#090909"/><circle cx="158" cy="134" r="9" fill="#090909"/><circle cx="127" cy="171" r="18" fill="none" stroke="#fff" stroke-width="8"/><path d="M141 185 L159 203" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/></svg></span><span>Kiver</span></a><nav><a href="/directory">Discover</a><a href="/blog">Blog</a><a href="/submit">For makers</a></nav><div class="nav-actions"><a class="nav-link" href="/login.html">Sign in</a><a class="nav-cta" href="/submit">Launch a tool</a></div></header><main class="product-page"><div class="crumb"><a href="/directory">Directory</a><span>/</span><span>${E(b.name)}</span></div><section class="product-hero"><div class="product-logo">${imageSrc(b)?'<img src="'+imageSrc(b)+'" alt="'+E(b.name)+' logo">':E((b.name||"B").charAt(0))}</div><div class="product-copy"><div class="card-meta"><span>${E(type)}</span><span>Telegram</span></div><h1><span class="verified-name">${E(b.name)}</span>${b.verified?'<svg class="verified-badge" viewBox="0 0 18 18" width="18" height="18" aria-label="Verified" role="img" xmlns="http://www.w3.org/2000/svg"><polygon fill="#0099FD" points="9,16 7.1,16.9 5.8,15.2 3.7,15.1 3.4,13 1.5,12 2.2,9.9 1.1,8.2 2.6,6.7 2.4,4.6 4.5,4 5.3,2 7.4,2.4 9,1.1 10.7,2.4 12.7,2 13.6,4 15.6,4.6 15.5,6.7 17,8.2 15.9,9.9 16.5,12 14.7,13 14.3,15.1 12.2,15.2 10.9,16.9 "/><polygon fill="#FFFFFF" points="13.1,7.3 12.2,6.5 8.1,10.6 5.9,8.5 5,9.4 8,12.4 "/></svg>':""}</h1><div class="product-handle">@${E(b.telegram_username)}</div>${about?'<p class="product-about">'+E(about)+'</p>':""}${bodyDescription?`<p>${E(bodyDescription)}</p>`:""}<div class="product-actions"><a class="dark-button" href="${E(b.telegram_url)}" target="_blank" rel="noopener noreferrer">Open in Telegram <span>↗</span></a><button class="vote-button" data-vote="${E(b.slug)}">↑ <span>${b.upvotes||0}</span> Upvote</button></div>${website?'<div class="product-website">'+website+'</div>':""}<div class="product-proof"><span><b>${b.upvotes||0}</b> community upvotes</span><span><b>${stats.count}</b> ${stats.count===1?"review":"reviews"}</span>${(c.comments||[]).length?`<span><b>${(c.comments||[]).length}</b> discussions</span>`:""}</div></div></section><div class="product-layout"><div><section class="content-block"><span class="eyebrow">ABOUT THIS ${E(type).toUpperCase()}</span><h2>What is ${E(b.name)}?</h2>${about?'<p><strong>About</strong><br>'+E(about)+'</p>':""}${bodyDescription?renderDescription(bodyDescription):""}<p>Kiver gives this Telegram tool a permanent public page so people can discover what it does, evaluate it with the community and open it directly in Telegram.</p></section><section class="content-block"><div class="section-head"><div><span class="eyebrow">COMMUNITY</span><h2>Community reviews</h2></div><span class="community-count" id="reviewCount">${reviewWord(stats.count)}</span></div><div id="reviewSummary">${reviewSummary}</div><div id="reviewBox" class="review-box" data-slug="${E(b.slug)}"></div><div class="review-list" id="reviewList">${reviews||'<div class="empty-inline">No reviews yet. Be the first person to share an experience with this tool.</div>'}</div><div class="comment-list">${comments||""}</div></section>${faq.html}</div><aside><div class="side-card"><span class="eyebrow">FOR THE MAKER</span><h3>Is this your ${E(type.toLowerCase())}?</h3><p>Refresh the Telegram details from your maker account whenever the public profile changes.</p><a href="/account?claim=${encodeURIComponent(b.slug)}" class="outline-button">Manage listing →</a></div>${website?'<div class="side-card"><span class="eyebrow">WEBSITE</span><h3>Official site</h3>'+website+'</div>':""}</aside></div>${related.length?'<section class="related"><div class="section-head"><div><span class="eyebrow">MORE TO EXPLORE</span><h2>More Telegram tools</h2></div><a class="text-link" href="/directory">View all →</a></div><div class="compact-grid">'+relatedHtml+"</div></section>":""}</main><footer><div><a class="brand" href="/"><span class="kiver-inline-logo" aria-label="Kiver" role="img"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="Kiver"><rect width="256" height="256" fill="#fff"/><circle cx="128" cy="58" r="17" fill="#090909"/><rect x="123" y="70" width="10" height="30" rx="5" fill="#090909"/><rect x="54" y="91" width="148" height="116" rx="43" fill="#090909"/><rect x="75" y="112" width="106" height="45" rx="23" fill="#fff"/><circle cx="98" cy="134" r="9" fill="#090909"/><circle cx="158" cy="134" r="9" fill="#090909"/><circle cx="127" cy="171" r="18" fill="none" stroke="#fff" stroke-width="8"/><path d="M141 185 L159 203" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/></svg></span><span>Kiver</span></a><p>The discovery marketplace for Telegram tools.</p></div><div class="footer-links"><a href="/directory">Directory</a><a href="/blog">Blog</a><a href="/submit">Submit a tool</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/refund.html">Refunds</a></div></footer><script src="/app.js?v=11" defer></script><script src="/reviews.js?v=1" defer></script><script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"SoftwareApplication","name":b.name,"description":description,"applicationCategory":"Telegram tool","url":url,"sameAs":[b.telegram_url,b.website_url||undefined].filter(Boolean),"image":ogImage||undefined,"operatingSystem":"Telegram","aggregateRating":stats.count?{"@type":"AggregateRating","ratingValue":Number(Number(stats.average).toFixed(1)),"reviewCount":stats.count}:undefined}).replace(/</g,"\\u003c")}</script>${breadcrumbScript}${faq.ld}</body></html>`;
 res.setHeader("Content-Type","text/html; charset=utf-8");res.setHeader("Cache-Control","s-maxage=120, stale-while-revalidate=600");res.end(html);
};