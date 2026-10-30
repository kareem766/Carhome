import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const enc=(v:Uint8Array)=>btoa(String.fromCharCode(...v));
const dec=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
async function hashPassword(password:string,salt:Uint8Array){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},key,256);return enc(new Uint8Array(bits));}
const randomPassword=()=>{const bytes=crypto.getRandomValues(new Uint8Array(18));return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g,"").slice(0,20)+"aA7!"};
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
 const {data:admin}=await db.from("platform_admins").select("user_id").eq("user_id",caller.user.id).maybeSingle();if(!admin)return send({error:"غير مصرح بإدارة الحسابات."},403);


 if(body.action==="create"){
  const email=String(body.email||"").trim().toLowerCase();
  const displayName=String(body.display_name||"").trim();
  const requestedOrgName=String(body.organization_name||"").trim();
  const role=String(body.organization_type||"company");
  const password=String(body.temporary_password||"");
  const phone=String(body.phone||"").trim();
  const city=String(body.city||"").trim();
  const address=String(body.address||"").trim();
  const emailParts=email.split("@");
  if(emailParts.length!==2||!emailParts[0]||!emailParts[1].includes(".")||emailParts[1].startsWith(".")||emailParts[1].endsWith("."))return send({error:"البريد الإلكتروني غير صحيح."},400);
  if(!displayName||displayName.length>120)return send({error:"اسم المستخدم مطلوب وبحد أقصى 120 حرفًا."},400);
  if(!["individual_owner","company","fleet_supplier"].includes(role))return send({error:"نوع الحساب غير صحيح."},400);
  if(password.length<8)return send({error:"كلمة المرور المؤقتة يجب ألا تقل عن 8 أحرف."},400);
  if(phone&&(phone.length<7||phone.length>30))return send({error:"رقم الهاتف يجب أن يكون من 7 إلى 30 رقمًا أو حرفًا."},400);
  if(city&&(city.length<2||city.length>120))return send({error:"اسم المحافظة يجب أن يكون من حرفين إلى 120 حرفًا."},400);
  if(address.length>500)return send({error:"العنوان أطول من الحد المسموح."},400);
  const organizationName=requestedOrgName||displayName+" - "+(role==="individual_owner"?"مالك سيارة":role==="fleet_supplier"?"مورد أسطول":"شركة");
  if(organizationName.length<2||organizationName.length>180)return send({error:"اسم الشركة أو المؤسسة يجب أن يكون من حرفين إلى 180 حرفًا."},400);
  const {data:createdUser,error:createError}=await db.auth.admin.createUser({
   email,password,email_confirm:true,
   app_metadata:{must_change_password:true,created_by_platform_admin:true},
   user_metadata:{display_name:displayName,organization_name:organizationName,organization_type:role,phone,governorate:city,address}
  });
  if(createError)return send({error:/already|registered|exists|duplicate/i.test(createError.message)?"هذا البريد الإلكتروني مسجل بالفعل.":createError.message},400);
  const newUserId=createdUser.user.id;
  const rollback=async(orgId?:string)=>{
   if(orgId)await db.from("organizations").delete().eq("id",orgId);
   await db.auth.admin.deleteUser(newUserId);
  };
  const {error:profileError}=await db.from("profiles").upsert({
   id:newUserId,display_name:displayName,phone:phone||null,contact_email:email,address:address||null,locale:"ar"
  },{onConflict:"id"});
  if(profileError){await rollback();return send({error:"تم إنشاء بيانات الدخول لكن تعذر إنشاء الملف الشخصي: "+profileError.message},500);}
  const {data:organization,error:organizationError}=await db.from("organizations").insert({
   name:organizationName,organization_type:role,created_by:newUserId,city:city||null,
   contact_name:displayName,phone:phone||null,contact_email:email,address:address||null,
   approval_status:"pending_review"
  }).select("id").single();
  if(organizationError){await rollback();return send({error:"تعذر إنشاء المؤسسة المرتبطة بالحساب: "+organizationError.message},500);}
  const {error:membershipError}=await db.from("organization_memberships").insert({
   organization_id:organization.id,user_id:newUserId,role:"owner"
  });
  if(membershipError){await rollback(organization.id);return send({error:"تعذر ربط المستخدم بالمؤسسة: "+membershipError.message},500);}
  return send({success:true,user_id:newUserId,message:"تم إنشاء الحساب وربطه بالمؤسسة بنجاح، والحساب في انتظار مراجعة بيانات المؤسسة."},201);
 }

 if(body.action==="list"){
  const {data:users,error:userError}=await db.auth.admin.listUsers({page:1,perPage:1000});
  if(userError)return send({error:"تعذر تحميل حسابات المستخدمين."},500);
  const ids=(users?.users||[]).map(u=>u.id);
  if(!ids.length)return send({accounts:[]});
  const [{data:profiles},{data:memberships},{data:adminRows}]=await Promise.all([
   db.from("profiles").select("id,display_name,phone,contact_email,address").in("id",ids),
   db.from("organization_memberships").select("user_id,organization_id,role,organizations(id,name,organization_type,city,phone,contact_email,address,approval_status)").in("user_id",ids),
   db.from("platform_admins").select("user_id").in("user_id",ids)
  ]);
  const adminIds=new Set((adminRows||[]).map(a=>a.user_id));
  const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
  const orgMap=new Map<string,any[]>();
  for(const m of memberships||[]){const arr=orgMap.get(m.user_id)||[];if(m.organizations)arr.push(m.organizations);orgMap.set(m.user_id,arr);}
  const accounts=(users?.users||[]).map(u=>{
   const p=profileMap.get(u.id) as any;const orgs=orgMap.get(u.id)||[];const org=orgs[0]||{};
   const bannedUntil=u.banned_until||null;const disabled=Boolean(bannedUntil&&new Date(bannedUntil).getTime()>Date.now());
   return {id:u.id,email:u.email||"",display_name:p?.display_name||u.user_metadata?.display_name||"",phone:p?.phone||u.user_metadata?.phone||org.phone||"",address:p?.address||u.user_metadata?.address||org.address||"",organization_name:org.name||u.user_metadata?.organization_name||"",organization_type:u.user_metadata?.organization_type||org.organization_type||"individual_owner",city:org.city||u.user_metadata?.governorate||"",approval_status:org.approval_status||null,created_at:u.created_at,status:disabled?"suspended":"active",banned_until:bannedUntil,must_change_password:u.app_metadata?.must_change_password===true,is_admin:adminIds.has(u.id),organization_count:orgs.length};
  });
  return send({accounts});
 }

 const userId=String(body.user_id||"");
 if(!userId)return send({error:"معرّف الحساب مطلوب."},400);
 if(userId===caller.user.id)return send({error:"لا يمكن تنفيذ هذا الإجراء على حسابك الحالي."},403);
 const {data:targetAdmin}=await db.from("platform_admins").select("user_id").eq("user_id",userId).maybeSingle();
 if(targetAdmin)return send({error:"لا يمكن تعديل أو حذف حساب مسؤول المنصة من هذه الصفحة."},403);
 const {data:targetResult,error:targetError}=await db.auth.admin.getUserById(userId);
 if(targetError||!targetResult.user)return send({error:"الحساب المطلوب غير موجود."},404);
 const target=targetResult.user;

 if(body.action==="update"){
  const email=String(body.email||target.email||"").trim().toLowerCase();
  const displayName=String(body.display_name||"").trim();
  const role=String(body.organization_type||target.user_metadata?.organization_type||"individual_owner");
  if(!email.includes("@"))return send({error:"البريد الإلكتروني غير صحيح."},400);
  if(!displayName)return send({error:"اسم المستخدم مطلوب."},400);
  if(!["individual_owner","company","fleet_supplier"].includes(role))return send({error:"نوع الحساب غير صحيح."},400);
  const metadata={...target.user_metadata,display_name:displayName,organization_name:String(body.organization_name||"").trim(),organization_type:role,phone:String(body.phone||"").trim(),governorate:String(body.city||"").trim(),address:String(body.address||"").trim()};
  const suspended=body.status==="suspended";
  const updatePayload:any={email,email_confirm:true,user_metadata:metadata,ban_duration:suspended?"876000h":"none"};
  const {error:updateError}=await db.auth.admin.updateUserById(userId,updatePayload);
  if(updateError)return send({error:/already|registered|exists|duplicate/i.test(updateError.message)?"البريد الإلكتروني مستخدم بالفعل.":updateError.message},400);
  const {error:profileError}=await db.from("profiles").upsert({id:userId,display_name:displayName,phone:metadata.phone||null,contact_email:email,address:metadata.address||null,locale:"ar"},{onConflict:"id"});
  if(profileError)return send({error:"تم تحديث بيانات الدخول لكن تعذر تحديث الملف الشخصي: "+profileError.message},500);
  const {data:members}=await db.from("organization_memberships").select("organization_id").eq("user_id",userId);
  const orgIds=[...new Set((members||[]).map(m=>m.organization_id))];
  for(const orgId of orgIds){
   const {error:orgError}=await db.from("organizations").update({name:String(body.organization_name||displayName).trim(),organization_type:role,city:metadata.governorate||null,contact_name:displayName,phone:metadata.phone||null,contact_email:email,address:metadata.address||null,updated_at:new Date().toISOString()}).eq("id",orgId);
   if(orgError)return send({error:"تم تحديث بيانات المستخدم لكن تعذر تحديث بيانات المؤسسة: "+orgError.message},500);
  }
  return send({success:true,message:suspended?"تم إيقاف الحساب.":"تم تحديث الحساب وإتاحته."});
 }

 if(body.action==="reset_password"){
  const password=randomPassword(),salt=crypto.getRandomValues(new Uint8Array(16));
  const {error:pwError}=await db.auth.admin.updateUserById(userId,{password,app_metadata:{...target.app_metadata,must_change_password:true,created_by_platform_admin:true}});
  if(pwError)return send({error:"تعذر إعادة تعيين كلمة المرور."},500);
  const {error:secretError}=await db.from("admin_managed_account_passwords").upsert({user_id:userId,temporary_password_hash:await hashPassword(password,salt),password_salt:enc(salt)},{onConflict:"user_id"});
  if(secretError)return send({error:"تم تغيير كلمة المرور لكن تعذر تسجيل حالة التغيير الإلزامي. أعد المحاولة من لوحة الإدارة."},500);
  return send({success:true,temporary_password:password,message:"تم إنشاء كلمة مرور مؤقتة جديدة."});
 }

 if(body.action==="delete"){
  const {data:memberships}=await db.from("organization_memberships").select("organization_id,role").eq("user_id",userId);
  const {data:createdOrgs}=await db.from("organizations").select("id").eq("created_by",userId);
  const orgIds=[...new Set([...(memberships||[]).map(m=>m.organization_id),...(createdOrgs||[]).map(o=>o.id)])];
  for(const orgId of orgIds){
   const {data:otherMembers,error:memberError}=await db.from("organization_memberships").select("user_id").eq("organization_id",orgId).neq("user_id",userId);
   if(memberError)return send({error:"تعذر التحقق من أعضاء المؤسسة قبل الحذف."},500);
   if((otherMembers||[]).length){
    const wasOwner=(memberships||[]).some(m=>m.organization_id===orgId&&m.role==="owner");
    if(wasOwner)await db.from("organization_memberships").update({role:"owner"}).eq("organization_id",orgId).eq("user_id",otherMembers![0].user_id);
    await db.from("organizations").update({created_by:otherMembers![0].user_id}).eq("id",orgId).eq("created_by",userId);
    await db.from("organization_memberships").delete().eq("organization_id",orgId).eq("user_id",userId);
    continue;
   }
   const [{data:images},{data:payments},{data:org}]=await Promise.all([
    db.from("vehicle_images").select("storage_path").eq("organization_id",orgId),
    db.from("vehicle_payment_submissions").select("proof_path").eq("organization_id",orgId),
    db.from("organizations").select("logo_path").eq("id",orgId).maybeSingle()
   ]);
   const vehiclePaths=(images||[]).map(x=>x.storage_path).filter(Boolean);
   const proofPaths=(payments||[]).map(x=>x.proof_path).filter(Boolean);
   if(vehiclePaths.length){const {error}=await db.storage.from("vehicle-images").remove(vehiclePaths);if(error)return send({error:"تعذر حذف صور سيارات المؤسسة، لم يكتمل حذف الحساب."},500);}
   if(proofPaths.length){const {error}=await db.storage.from("payment-proofs").remove(proofPaths);if(error)return send({error:"تعذر حذف مستندات الدفع، لم يكتمل حذف الحساب."},500);}
   if(org?.logo_path){const {error}=await db.storage.from("organization-logos").remove([org.logo_path]);if(error)return send({error:"تعذر حذف شعار المؤسسة، لم يكتمل حذف الحساب."},500);}
   const {error:subsError}=await db.from("company_subscriptions").delete().eq("organization_id",orgId);
   if(subsError)return send({error:"تعذر حذف سجل اشتراكات المؤسسة، لم يكتمل حذف الحساب."},500);
   const {error:orgError}=await db.from("organizations").delete().eq("id",orgId);
   if(orgError)return send({error:"تعذر حذف بيانات المؤسسة المرتبطة بالحساب: "+orgError.message},500);
  }
  await db.from("organization_memberships").delete().eq("user_id",userId);
  await db.from("platform_notifications").delete().eq("user_id",userId);
  await db.from("admin_managed_account_passwords").delete().eq("user_id",userId);
  await db.from("profiles").delete().eq("id",userId);
  const {error:deleteError}=await db.auth.admin.deleteUser(userId);
  if(deleteError)return send({error:"تعذر حذف حساب الدخول: "+deleteError.message},500);
  return send({success:true,message:"تم حذف الحساب نهائيًا والبيانات التابعة للمؤسسات التي لا تضم أعضاء آخرين."});
 }

 return send({error:"الإجراء المطلوب غير معروف."},400);
});
