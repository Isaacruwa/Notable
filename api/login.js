const a=require("../lib/auth");
const RESET_MESSAGE="If that email is in our database, we will send a password reset link.";
module.exports=async(req,res)=>{
 try{
  if(req.method!=="POST")return res.status(405).json({error:"POST required"});
  const action=String(req.body?.action||"login");
  if(action==="requestPasswordReset"){
   const email=String(req.body?.email||"").trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(200).json({message:RESET_MESSAGE});
   const d=await a.requestPasswordReset(email);
   if(!d?.token)return res.status(200).json({message:RESET_MESSAGE});
   const key=String(process.env.BREVO_API_KEY||"").trim();
   if(!key)throw Object.assign(new Error("We couldn’t send the reset email right now. Please try again in a few minutes."),{status:503});
   const resetUrl="https://getkiver.com/reset-password.html?email="+encodeURIComponent(email)+"&token="+encodeURIComponent(d.token);
   const rr=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"content-type":"application/json","accept":"application/json","api-key":key},body:JSON.stringify({
    sender:{name:"Kiver",email:"noreply@getkiver.com"},
    to:[{email}],
    subject:"Reset your Kiver password",
    htmlContent:"<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px\"><h2>Reset your Kiver password</h2><p>We received a request to reset your Kiver password.</p><p><a href=\""+resetUrl+"\" style=\"display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px\">Reset Password</a></p><p>This link expires in 30 minutes.</p><p>If you did not request this, you can ignore this email.</p></div>"
   })});
   if(!rr.ok){console.error("Password reset email delivery failed:",await rr.text().catch(()=>""));throw Object.assign(new Error("We couldn’t send the reset email right now. Please try again in a few minutes."),{status:503})}
   return res.status(200).json({message:RESET_MESSAGE});
  }
  if(action==="completePasswordReset"){
   const email=String(req.body?.email||"").trim().toLowerCase();
   const token=String(req.body?.token||"").trim();
   const password=String(req.body?.password||"");
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||token.length<32||password.length<8||password.length>128)
    return res.status(400).json({error:"That reset link is invalid or expired."});
   await a.completePasswordReset(email,token,password);
   return res.status(200).json({reset:true});
  }
  const e=String(req.body?.email||"").trim().toLowerCase(),p=String(req.body?.password||"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)||p.length<8)return res.status(400).json({error:"Use a valid email and an 8+ character password."});
  res.setHeader("Cache-Control","no-store");
  res.json(await a.login(req,res,e,p));
 }catch(e){
  const status=Number(e?.status)||401;
  res.status(status).json({error:e.message||"Could not complete the request right now."});
 }
};