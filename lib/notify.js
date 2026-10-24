const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function sendMakerEmail({to,subject,message}){
 const key=String(process.env.RESEND_API_KEY||"").trim();
 if(!key)throw Object.assign(new Error("Email sending isn’t configured right now."),{status:503});
 if(!EMAIL.test(String(to||"")))throw Object.assign(new Error("The maker’s email address is invalid."),{status:400});
 const body=String(message||"").replace(/\r/g,"").trim();
 const paras=body.split(/\n{2,}/).map(p=>'<p style="margin:0 0 14px;line-height:1.55">'+esc(p).replace(/\n/g,"<br>")+"</p>").join("");
 const html='<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#111"><div style="font-size:20px;font-weight:700;margin-bottom:22px">Kiver</div>'+paras+'<hr style="border:0;border-top:1px solid #e6e3dd;margin:26px 0 14px"><p style="margin:0;font-size:12px;line-height:1.5;color:#77736d">Kiver · <a href="https://getkiver.com" style="color:#77736d">getkiver.com</a><br>This address can’t receive replies. To reach us, message <a href="https://t.me/Controlla" style="color:#77736d">@Controlla</a> on Telegram.</p></div>';
 const text=body+"\n\n--\nKiver · getkiver.com\nThis address can’t receive replies. To reach us, message @Controlla on Telegram: https://t.me/Controlla";
 const rr=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+key},body:JSON.stringify({from:"Kiver <noreply@getkiver.com>",to:[to],subject:String(subject||"").slice(0,150),html,text})});
 if(!rr.ok){console.error("Maker email delivery failed:",await rr.text().catch(()=>""));throw Object.assign(new Error("The email couldn’t be delivered right now. Try again in a few minutes."),{status:502})}
}
module.exports={sendMakerEmail};
