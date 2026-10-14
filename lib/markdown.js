// Markdown for agents: converts a Kiver page's HTML to clean Markdown.
// Used when a request sends "Accept: text/markdown" (routed here by vercel.json).
const VOID=new Set(["br","hr","img","input","meta","link","source","wbr"]);
const DROP=new Set(["script","style","svg","noscript","template","iframe","button","select","textarea","form","head","title","canvas","video","audio","picture"]);
const INLINE=new Set(["a","span","strong","b","em","i","code","small","sup","sub","u","s","mark","label","abbr","time","kbd","br","img"]);
const BLOCKISH=new Set(["div","p","h1","h2","h3","h4","h5","h6","ul","ol","li","section","article","aside","header","footer","nav","figure","blockquote","table","pre","main"]);
const ENT={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" ",mdash:"\u2014",ndash:"\u2013",hellip:"\u2026",rarr:"\u2192",larr:"\u2190",middot:"\u00b7",copy:"\u00a9",bull:"\u2022",rsquo:"\u2019",lsquo:"\u2018",ldquo:"\u201c",rdquo:"\u201d",times:"\u00d7",uarr:"\u2191"};
const decode=s=>String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>{if(e[0]==="#"){const n=e[1].toLowerCase()==="x"?parseInt(e.slice(2),16):parseInt(e.slice(1),10);try{return String.fromCodePoint(n)}catch{return""}}return ENT[e.toLowerCase()]??m});

function parse(html){
  const root={tag:"#root",a:{},c:[]},stack=[root];
  const re=/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+|<)/g;
  let m;
  while((m=re.exec(html))){
    if(m[4]!==undefined){stack[stack.length-1].c.push(m[4]);continue}
    if(!m[2])continue;
    const tag=m[2].toLowerCase();
    if(m[1]){
      for(let i=stack.length-1;i>0;i--){if(stack[i].tag===tag){stack.length=i;break}}
      continue;
    }
    const a={};
    String(m[3]).replace(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g,(x,k,v1,v2,v3)=>{a[k.toLowerCase()]=decode(v1??v2??v3??"")});
    const node={tag,a,c:[]};
    stack[stack.length-1].c.push(node);
    if(!VOID.has(tag)&&!/\/\s*$/.test(m[3]||""))stack.push(node);
    if(tag==="script"||tag==="style"){ // raw text elements: skip to the closing tag
      const end=html.toLowerCase().indexOf("</"+tag,re.lastIndex);
      if(end>-1){re.lastIndex=end}
    }
  }
  return root;
}
const textOf=(n,top)=>typeof n==="string"?decode(n):(!top&&DROP.has(n.tag))?"":n.c.map(x=>textOf(x)).join("");
const hasBlock=n=>typeof n!=="string"&&n.c.some(x=>typeof x!=="string"&&(/^h[1-6]$/.test(x.tag)||x.tag==="p"||x.tag==="div"||x.tag==="ul"||x.tag==="ol"||hasBlock(x)));

module.exports=function toMarkdown(html,base){
  const abs=u=>{try{return new URL(u,base).toString()}catch{return u}};
  const wrap=(m,t)=>{const s=t.trim();return s?(t.startsWith(" ")?" ":"")+m+s+m+(t.endsWith(" ")?" ":""):t};
  function inline(nodes){
    let s="";
    for(const n of nodes){
      if(typeof n==="string"){s+=decode(n).replace(/\s+/g," ");continue}
      if(DROP.has(n.tag))continue;
      switch(n.tag){
        case"br":s+="  \n";break;
        case"a":{const t=inline(n.c).trim(),h=n.a.href||"";s+=t?" "+(h&&!/^(#|javascript:|mailto:\s*$)/i.test(h)?"["+t+"]("+abs(h)+")":t)+" ":"";break}
        case"strong":case"b":{const t=inline(n.c).trim();s+=t?" **"+t+"** ":"";break}
        case"em":case"i":{const t=inline(n.c).trim();s+=t?" *"+t+"* ":"";break}
        case"code":s+="`"+textOf(n).replace(/`/g,"'")+"`";break;
        case"img":s+=n.a.alt?"!["+n.a.alt+"]("+abs(n.a.src||"")+")":"";break;
        case"span":{const t=inline(n.c);s+=t.trim()?" "+t.trim()+" ":"";break}
        default:s+=inline(n.c)
      }
    }
    return s;
  }
  function list(n,depth){
    const ordered=n.tag==="ol";let i=0,lines=[];
    for(const li of n.c){
      if(typeof li==="string"||li.tag!=="li")continue;
      i++;
      const own=[],subs=[];
      for(const x of li.c){if(typeof x!=="string"&&(x.tag==="ul"||x.tag==="ol"))subs.push(x);else own.push(x)}
      const text=inline(own).replace(/[ \t]*\n[ \t]*/g," ").replace(/\s+/g," ").trim();
      lines.push("  ".repeat(depth)+(ordered?i+". ":"- ")+text);
      for(const s of subs)lines.push(list(s,depth+1));
    }
    return lines.join("\n");
  }
  function table(n){
    const rows=[];
    (function walk(x){for(const c of x.c){if(typeof c==="string")continue;if(c.tag==="tr"){rows.push(c.c.filter(t=>typeof t!=="string"&&(t.tag==="td"||t.tag==="th")).map(t=>inline(t.c).replace(/\|/g,"\\|").replace(/\s+/g," ").trim()))}else if(!DROP.has(c.tag))walk(c)}})(n);
    if(!rows.length)return"";
    const w=Math.max(...rows.map(r=>r.length));
    const pad=r=>"| "+Array.from({length:w},(_,i)=>r[i]||"").join(" | ")+" |";
    return [pad(rows[0]),"|"+" --- |".repeat(w),...rows.slice(1).map(pad)].join("\n");
  }
  function blocks(nodes,out){
    let buf=[];
    const flush=()=>{const t=buf.join("").replace(/[ \t]+/g," ").replace(/ *\n */g,"\n").trim();if(t)out.push(t);buf=[]};
    for(const n of nodes){
      if(typeof n==="string"){buf.push(decode(n).replace(/\s+/g," "));continue}
      if(DROP.has(n.tag))continue;
      if(INLINE.has(n.tag)&&!(n.tag==="a"&&hasBlock(n))){buf.push(inline([n]));continue}
      flush();
      const t=n.tag;
      if(/^h[1-6]$/.test(t)){const x=inline(n.c).replace(/\s+/g," ").trim();if(x)out.push("#".repeat(+t[1])+" "+x)}
      else if(t==="p"){const x=inline(n.c).trim();if(x)out.push(x)}
      else if(t==="ul"||t==="ol"){const x=list(n,0);if(x)out.push(x)}
      else if(t==="pre"){out.push("```\n"+textOf(n).replace(/\n+$/,"")+"\n```")}
      else if(t==="blockquote"){const sub=[];blocks(n.c,sub);if(sub.length)out.push(sub.join("\n\n").split("\n").map(l=>"> "+l).join("\n"))}
      else if(t==="table"){const x=table(n);if(x)out.push(x)}
      else if(t==="hr"){out.push("---")}
      else if(t==="figcaption"){const x=inline(n.c).trim();if(x)out.push("*"+x+"*")}
      else if(t==="a"){ // a card: link wrapping block content
        const sub=[];blocks(n.c,sub);const h=n.a.href?abs(n.a.href):"";
        const k=sub.findIndex(l=>/^#{1,6} /.test(l));
        if(h&&k>-1){sub[k]=sub[k].replace(/^(#{1,6}) (.*)$/,(m,a,b)=>a+" ["+b+"]("+h+")")}else if(h&&sub.length){sub.push("["+"Open"+"]("+h+")")}
        out.push(...sub);
      }
      else blocks(n.c,out);
    }
    flush();
  }
  const tree=parse(html);
  // Prefer <main>; fall back to <body>; fall back to everything.
  const find=(n,tag)=>{for(const c of n.c){if(typeof c==="string")continue;if(c.tag===tag)return c;const r=find(c,tag);if(r)return r}return null};
  const titleNode=find(tree,"title");
  const scope=find(tree,"main")||find(tree,"body")||tree;
  const out=[];blocks(scope.c,out);
  let md=out.join("\n\n").replace(/\n{3,}/g,"\n\n").replace(/ +([,.;:!?)])/g,"$1").replace(/\( +/g,"(").trim();
  const title=titleNode?textOf(titleNode,true).trim():"";
  if(!/^# /m.test(md)&&title)md="# "+title+"\n\n"+md;
  return {markdown:md+"\n",title};
};
