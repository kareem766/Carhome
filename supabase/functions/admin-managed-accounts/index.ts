import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const enc=(v:Uint8Array)=>btoa(String.fromCharCode(...v));
const dec=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
async function hashPassword(password:string,salt:Uint8Array){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},key,256);return enc(new Uint8Array(bits));}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const send=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
 if(req.method!=="POST")return send({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
 const auth=req.headers.get("Authorization")||"";if(!auth.startsWith("Bearer "))return send({error:"يجب تسجيل الدخول أولاً."},401);
 const db=createClient(url,key,{auth:{persistSession:false}});const {data:caller,error:authError}=await db.auth.getUser(auth.slice(7));
 if(authError||!caller.user)return send({error:"جلسة الدخول غير صالحة."},401);
 let body:Record<string,unknown>;try{body=await req.json();}catch{return send({error:"بيانات الطلب غير صالحة."},400);}
 if(body.action==="complete"){
  const u=caller.user;if(u.app_metadata?.must_change_password!==true||u.app_metadata?.created_by_platform_admin!==true)return send({error:"لا يوجد تغيير إلزامي لهذا الحساب."},403);
  const newPassword=String(body.password||"");if(newPassword.length<8)return send({error:"أدخل كلمة المرور الجديدة."},400);
  const {data:stored,error:storedError}=await db.from("admin_managed_account_passwords").select("temporary_password_hash,password_salt").eq("user_id",u.id).maybeSingle();
  if(storedError||!stored)return send({error:"تعذر التحقق من كلمة المرور المؤقتة. تواصل مع مسؤول المنصة."},500);
  if(await hashPassword(newPassword,dec(stored.password_salt))===stored.temporary_password_hash)return send({error:"يجب اختيار كلمة مرور مختلفة عن كلمة المرور المؤقتة."},400);
  const verifier=createClient(url,anonKey,{auth:{persistSession:false}});
  const {data:verified,error:verifyError}=await verifier.auth.signInWithPassword({email:u.email!,password:newPassword});
  if(verifyError||verified.user?.id!==u.id)return send({error:"لم يتم تأكيد كلمة المرور الجديدة. حاول حفظها مرة أخرى."},400);
  const {error:updateError}=await db.auth.admin.updateUserById(u.id,{app_metadata:{...u.app_metadata,must_change_password:false}});
  if(updateError)return send({error:"تعذر إنهاء تغيير كلمة المرور."},500);
  await db.from("admin_managed_account_passwords").delete().eq("user_id",u.id);
  return send({success:true});
 }
 const {data:admin}=await db.from("platform_admins").select("user_id").eq("user_id",caller.user.id).maybeSingle();if(!admin)return send({error:"غير مصرح بإنشاء الحسابات."},403);
 const email=String(body.email||"").trim().toLowerCase(),password=String(body.temporary_password||""),displayName=String(body.display_name||"").trim(),orgName=String(body.organization_name||displayName).trim()||displayName,role=String(body.organization_type||"");
 const phone=String(body.phone||"").trim(),city=String(body.city||"").trim(),address=String(body.address||"").trim();
 if(!email.includes("@"))return send({error:"أدخل بريدًا إلكترونيًا صحيحًا."},400);if(password.length<8)return send({error:"كلمة المرور المؤقتة يجب ألا تقل عن 8 أحرف."},400);
 if(!displayName)return send({error:"اسم المستخدم مطلوب."},400);if(!["individual_owner","company","fleet_supplier"].includes(role))return send({error:"نوع الحساب غير صحيح."},400);
 const {data:created,error:createError}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:displayName,organization_name:orgName,organization_type:role,phone,email_contact:email,governorate:city,address,provisioned_by_platform_admin:true},app_metadata:{must_change_password:true,created_by_platform_admin:true}});
 if(createError||!created.user){const msg=createError?.message||"تعذر إنشاء الحساب.";return send({error:/already|registered|exists|duplicate/i.test(msg)?"هذا البريد الإلكتروني مسجل بالفعل.":msg},400);}
 const id=created.user.id;const salt=crypto.getRandomValues(new Uint8Array(16));
 try{
  const secret=await db.from("admin_managed_account_passwords").insert({user_id:id,temporary_password_hash:await hashPassword(password,salt),password_salt:enc(salt)});if(secret.error)throw secret.error;
  const p=await db.from("profiles").insert({id,display_name:displayName,locale:"ar",phone:phone||null,contact_email:email,address:address||null});if(p.error)throw p.error;
  const o=await db.from("organizations").insert({name:orgName,organization_type:role,created_by:id,city:city||null,contact_name:displayName,phone:phone||null,contact_email:email,address:address||null}).select("id").single();if(o.error)throw o.error;
  const m=await db.from("organization_memberships").insert({organization_id:o.data.id,user_id:id,role:"owner"});if(m.error)throw m.error;
 }catch(e){await db.auth.admin.deleteUser(id);return send({error:e instanceof Error?e.message:"تعذر إعداد ملف الحساب."},500);}
 return send({success:true,user_id:id,email,message:"تم إنشاء الحساب ويجب تغيير كلمة المرور عند أول دخول."});
});