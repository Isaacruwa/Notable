const db=require("../lib/db"),a=require("../lib/auth");
module.exports=async(req,res)=>{
 try{
  const email=await a.email(req);if(!email)return res.status(401).json({error:"Sign in required."});
  const bots=await db.owned(email);
  res.json({email,bots})
 }catch(e){res.status(500).json({error:"Could not load your account."})}
};