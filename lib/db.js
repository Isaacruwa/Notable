const{neon}=require("@neondatabase/serverless");let s,r=false;const db=()=>s||(s=neon(process.env.DATABASE_URL));const q=(x,p=[])=>db()(x,p);
async function init(){
 if(r)return;
 if(!process.env.DATABASE_URL)throw Error("DATABASE_URL is not set");
 await q("CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL)");
 await q("CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,email TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL)");
 await q("CREATE TABLE IF NOT EXISTS bot_listings(id SERIAL PRIMARY KEY,slug TEXT UNIQUE NOT NULL,telegram_username TEXT UNIQUE NOT NULL,telegram_url TEXT UNIQUE NOT NULL,name TEXT NOT NULL,description TEXT,image_url TEXT,category TEXT DEFAULT 'other',owner_email TEXT,upvotes INT DEFAULT 0,status TEXT DEFAULT 'approved',created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now(),last_synced_at TIMESTAMPTZ DEFAULT now())");
 await q("ALTER TABLE bot_listings ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'Bot'");
 await q("ALTER TABLE bot_listings ADD COLUMN IF NOT EXISTS about TEXT");
 await q("ALTER TABLE bot_listings ADD COLUMN IF NOT EXISTS website_url TEXT");
 await q("CREATE TABLE IF NOT EXISTS bot_votes(id SERIAL PRIMARY KEY,bot_id INT REFERENCES bot_listings(id) ON DELETE CASCADE,voter_hash TEXT NOT NULL,UNIQUE(bot_id,voter_hash))");
 await q("CREATE TABLE IF NOT EXISTS bot_reviews(id SERIAL PRIMARY KEY,bot_id INT REFERENCES bot_listings(id) ON DELETE CASCADE,author_email TEXT,rating INT,body TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now())");
 await q("CREATE TABLE IF NOT EXISTS bot_comments(id SERIAL PRIMARY KEY,bot_id INT REFERENCES bot_listings(id) ON DELETE CASCADE,author_email TEXT,body TEXT NOT NULL,created_at TIMESTAMPTZ DEFAULT now())");
 r=true
}
async function user(e){await init();const x=await q("SELECT * FROM users WHERE email=$1",[e]);return x[0]}
async function addUser(e,h){await init();const x=await q("INSERT INTO users(email,password_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id,email",[e,h]);return x[0]}
async function saveSession(t,e,x){await init();await q("INSERT INTO sessions VALUES($1,$2,$3)",[t,e,x])}
async function session(t){await init();const x=await q("SELECT * FROM sessions WHERE token=$1",[t]);if(!x[0]||new Date(x[0].expires_at)<new Date())return null;return x[0]}
async function delSession(t){await init();await q("DELETE FROM sessions WHERE token=$1",[t])}
async function getBot(s){await init();const x=await q("SELECT * FROM bot_listings WHERE slug=$1 AND status='approved'",[s]);return x[0]}
async function byUser(u){await init();const x=await q("SELECT * FROM bot_listings WHERE telegram_username=$1",[u]);return x[0]}
async function addBot(d){
 await init();let s=String(d.name).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"telegram-bot",b=s,n=2;
 while((await q("SELECT 1 FROM bot_listings WHERE slug=$1",[s])).length)s=b+"-"+n++;
 const x=await q("INSERT INTO bot_listings(slug,telegram_username,telegram_url,name,description,about,image_url,website_url,category,owner_email,kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",[s,d.telegramUsername,d.telegramUrl,d.name,d.description||"",d.about||"",d.imageUrl||"",d.websiteUrl||"",d.category,d.ownerEmail,d.kind||"Bot"]);
 return x[0]
}
async function list(o={}){
 await init();const w=["status='approved'"],p=[],t=String(o.q||"");
 if(t){p.push("%"+t+"%");w.push("(name ILIKE $1 OR description ILIKE $1 OR about ILIKE $1 OR telegram_username ILIKE $1)")}
 if(o.category){p.push(o.category);w.push("category=$"+p.length)}
 p.push(Math.min(Number(o.limit)||48,60));const li=p.length;p.push(Math.max(Number(o.offset)||0,0));
 return q("SELECT * FROM bot_listings WHERE "+w.join(" AND ")+" ORDER BY "+(o.sort==="new"?"created_at DESC":"upvotes DESC,created_at DESC")+" LIMIT $"+li+" OFFSET $"+p.length,p)
}
async function owned(e){await init();return q("SELECT slug,name,telegram_username,telegram_url,kind,about,description,image_url,website_url,upvotes,updated_at,last_synced_at FROM bot_listings WHERE owner_email=$1 ORDER BY created_at DESC",[e])}
async function vote(s,v){const b=await getBot(s);if(!b)return null;const x=await q("INSERT INTO bot_votes(bot_id,voter_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id",[b.id,v]);if(!x.length)return{upvotes:b.upvotes};const y=await q("UPDATE bot_listings SET upvotes=upvotes+1 WHERE id=$1 RETURNING upvotes",[b.id]);return{upvotes:y[0].upvotes}}
async function reviews(s){const b=await getBot(s);if(!b)return null;return{reviews:await q("SELECT rating,body FROM bot_reviews WHERE bot_id=$1 ORDER BY created_at DESC LIMIT 30",[b.id]),comments:await q("SELECT body FROM bot_comments WHERE bot_id=$1 ORDER BY created_at LIMIT 50",[b.id])}}
async function refreshOwned(slug,email,d){
 await init();
 const x=await q("UPDATE bot_listings SET name=$1,description=$2,about=$3,image_url=$4,telegram_url=$5,kind=$6,last_synced_at=now(),updated_at=now() WHERE slug=$7 AND owner_email=$8 AND status='approved' RETURNING *",[d.name,d.description||"",d.about||"",d.imageUrl||"",d.telegramUrl,d.kind||"Bot",slug,email]);
 return x[0]
}
async function editOwned(slug,email,d){
 await init();
 const description=String(d.description||"").trim(),about=String(d.about||"").trim(),websiteUrl=String(d.websiteUrl||"").trim();
 if(!description)throw Error("Description is required.");
 if(description.length>2000)throw Error("Description is too long.");
 if(about.length>120)throw Error("About must be 120 characters or fewer.");
 if(websiteUrl.length>500)throw Error("Website URL is too long.");
 const x=await q("UPDATE bot_listings SET description=$1,about=$2,website_url=$3,updated_at=now() WHERE slug=$4 AND owner_email=$5 AND status='approved' RETURNING *",[description,about,websiteUrl,slug,email]);
 return x[0]
}
async function stale(){await init();return q("SELECT * FROM bot_listings ORDER BY last_synced_at LIMIT 50")}
module.exports={user,addUser,saveSession,session,delSession,getBot,byUser,addBot,list,owned,vote,reviews,refreshOwned,editOwned,stale};