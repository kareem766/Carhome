import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const enc=(v:Uint8Array)=>btoa(String.fromCharCode(...v));
const dec=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
async function hashPassword(password:string,salt:Uint8Array){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},key,256);return enc(new Uint8Array(bits));}
const randomPassword=()=>{const bytes=crypto.getRandomValues(new Uint8Array(18));return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g,"").slice(0,20)+"aA7!"};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 let action="unknown"; let stage="request_validation";
 const send=(body:unknown,status=200)=>{if(status>=500)console.error("[admin-managed-accounts]",JSON.stringify({action,stage,status}));return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});};
 if(req.method!=="POST")return send({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
 const auth=req.headers.get("Authorization")||"";if(!auth.startsWith("Bearer "))return send({error:"يجب تسجيل الدخول أولاً."},401);
 const db=createClient(url,key,{auth:{persistSession:false}});const {data:caller,error:authError}=await db.auth.getUser(auth.slice(7));
 if(authError||!caller.user)return send({error:"جلسة الدخول غير صالحة."},401);
 let body:Record<string,unknown>;try{body=await req.json();}catch{return send({error:"بيانات الطلب غير صالحة."},400);} action=String(body.action||"unknown");
 if(body.action==="complete"){
  stage="complete_password_change";
  const u=caller.user;if(u.app_metadata?.must_change_password!==true||!(u.app_metadata?.created_by_platform_admin===true||u.app_metadata?.created_by_company===true))return send({error:"لا يوجد تغيير إلزامي لهذا الحساب."},403);
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

 if(body.action==="create_company_member"){
  stage="create_company_member.validate";
  // Remove invisible characters commonly introduced by mobile keyboards/autofill.
  const email=String(body.email||"").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF\u00A0]/g,"").trim().toLowerCase();
  const displayName=String(body.display_name||"").trim();
  const role=String(body.role||"member");
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && !email.split("@")[0].startsWith(".")
    && !email.split("@")[0].endsWith(".")
    && !email.split("@")[0].includes("..");
  if(email.length>254||!validEmail)return send({error:"صيغة البريد الإلكتروني غير صحيحة. احذف أي مسافات أو رموز غير ظاهرة، وتأكد من كتابته بالشكل name@example.com."},400);
  if(displayName.length<2||displayName.length>120)return send({error:"اسم الموظف يجب أن يكون من حرفين إلى 120 حرفًا."},400);
  if(!["manager","member"].includes(role))return send({error:"الدور المطلوب غير صالح."},400);
  const {data:membership,error:membershipError}=await db.from("organization_memberships")
   .select("organization_id,role,organizations!inner(id,name,organization_type,approval_status)")
   .eq("user_id",caller.user.id).eq("role","owner").eq("organizations.organization_type","company").limit(1).maybeSingle();
  if(membershipError||!membership?.organization_id)return send({error:"إضافة الموظفين متاحة لمالك الشركة فقط."},403);
  const org=Array.isArray(membership.organizations)?membership.organizations[0]:membership.organizations;
  if(!org||org.organization_type!=="company")return send({error:"الحساب المرتبط ليس حساب شركة."},403);
  if(org.approval_status!=="approved")return send({error:"يجب اعتماد حساب الشركة أولًا قبل إدارة أعضاء الفريق."},403);
  // The free company tier is limited to the company owner: adding managers or employees requires an active paid plan.
  const nowIso=new Date().toISOString();
  const {data:activeSubscription,error:subscriptionError}=await db.from("company_subscriptions")
   .select("plan_id").eq("organization_id",membership.organization_id).eq("status","active")
   .in("payment_status",["verified","waived"]).lte("starts_at",nowIso).gt("ends_at",nowIso)
   .order("ends_at",{ascending:false}).limit(1).maybeSingle();
  if(subscriptionError)return send({error:"تعذر التحقق من اشتراك الشركة. حاول مرة أخرى."},500);
  if(!activeSubscription)return send({error:"إضافة أعضاء الفريق (مديرين أو موظفين) متاحة بعد تفعيل باقة مدفوعة. يمكنك الاشتراك من صفحة باقات الشركات."},403);
  if(activeSubscription){
   const {data:plan,error:planError}=await db.from("platform_subscription_plans").select("limits,is_active").eq("id",activeSubscription.plan_id).maybeSingle();
   if(planError||!plan?.is_active)return send({error:"تعذر التحقق من صلاحيات الباقة الحالية."},500);
   const rawLimit=plan.limits?.team_members;
   if(rawLimit!=="unlimited"){
    const teamLimit=Number(rawLimit);
    if(!Number.isInteger(teamLimit)||teamLimit<1)return send({error:"حد أعضاء الفريق غير مضبوط في إعدادات الباقة. تواصل مع مسؤول المنصة."},500);
    const {count:memberCount,error:countError}=await db.from("organization_memberships").select("user_id",{count:"exact",head:true})
     .eq("organization_id",membership.organization_id).neq("role","owner");
    if(countError)return send({error:"تعذر التحقق من عدد أعضاء الفريق."},500);
    if((memberCount||0)>=teamLimit)return send({error:"وصلت شركتك إلى الحد الأقصى لأعضاء الفريق في باقتك الحالية. يمكنك ترقية الباقة لإضافة أعضاء جدد."},403);
   }
  }
  const {data:existingUsers,error:listError}=await db.auth.admin.listUsers({page:1,perPage:1000});
  if(listError)return send({error:"تعذر التحقق من البريد الإلكتروني."},500);
  const existingUser=(existingUsers?.users||[]).find((u:any)=>String(u.email||"").toLowerCase()===email);
  if(existingUser){
   const appMeta=existingUser.app_metadata||{};
   if(appMeta.created_by_company!==true||appMeta.company_organization_id!==membership.organization_id)
    return send({error:"هذا البريد مرتبط بحساب موجود أو بشركة أخرى، ولا يمكن ضمه إلى شركتك. استخدم بريدًا آخر أو تواصل مع مسؤول المنصة."},409);
   const {data:currentMemberships,error:currentMembershipsError}=await db.from("organization_memberships").select("organization_id").eq("user_id",existingUser.id);
   if(currentMembershipsError)return send({error:"تعذر التحقق من ارتباطات حساب الموظف الحالي."},500);
   if((currentMemberships||[]).some((m:any)=>m.organization_id!==membership.organization_id))
    return send({error:"هذا الحساب مرتبط بعضوية شركة أخرى ولا يمكن نقله تلقائيًا."},409);
   if((currentMemberships||[]).some((m:any)=>m.organization_id===membership.organization_id))
    return send({error:"هذا الموظف موجود بالفعل ضمن فريق شركتك."},409);
   const existingUserId=existingUser.id;
   const {error:profileError}=await db.from("profiles").upsert({id:existingUserId,display_name:displayName,contact_email:email,locale:"ar"},{onConflict:"id"});
   if(profileError)return send({error:"تعذر تحديث الملف الشخصي للموظف: "+profileError.message},500);
   const {error:membershipInsertError}=await db.from("organization_memberships").insert({organization_id:membership.organization_id,user_id:existingUserId,role});
   if(membershipInsertError)return send({error:"تعذر إعادة ربط الموظف بالشركة: "+membershipInsertError.message},500);
   const {error:metadataError}=await db.auth.admin.updateUserById(existingUserId,{user_metadata:{...(existingUser.user_metadata||{}),display_name:displayName,organization_type:"company",organization_name:org.name,company_member_role:role}});
   if(metadataError){
    await db.from("organization_memberships").delete().eq("organization_id",membership.organization_id).eq("user_id",existingUserId);
    return send({error:"تم إيقاف إعادة الربط لحماية الحساب: "+metadataError.message},500);
   }
   return send({success:true,employee:{user_id:existingUserId,email,display_name:displayName,role},temporary_password:null,reused_existing_account:true,message:"تمت إعادة الموظف إلى فريق الشركة. يمكنه تسجيل الدخول بكلمة مروره الحالية؛ وإذا نسيها يستخدم خيار نسيت كلمة المرور."},200);
  }
  const temporaryPassword=randomPassword();
  const {data:created,error:createError}=await db.auth.admin.createUser({
   email,password:temporaryPassword,email_confirm:true,
   app_metadata:{must_change_password:true,created_by_company:true,company_organization_id:membership.organization_id},
   user_metadata:{display_name:displayName,organization_type:"company",organization_name:org.name,company_member_role:role}
  });
  if(createError){
    const message=createError.message||"";
    if(/invalid.*email|email.*invalid|invalid format/i.test(message))return send({error:"رفض نظام تسجيل الدخول صيغة البريد الإلكتروني. تأكد من عدم وجود مسافات أو رموز مخفية، واستخدم بريدًا صالحًا مثل name@example.com."},400);
    return send({error:/already|registered|exists|duplicate/i.test(message)?"هذا البريد الإلكتروني مسجل بالفعل.":message},400);
  }
  const newUserId=created.user.id;
  const rollback=async()=>{await db.from("organization_memberships").delete().eq("organization_id",membership.organization_id).eq("user_id",newUserId);await db.from("profiles").delete().eq("id",newUserId);await db.from("admin_managed_account_passwords").delete().eq("user_id",newUserId);await db.auth.admin.deleteUser(newUserId);};
  const {error:profileError}=await db.from("profiles").upsert({id:newUserId,display_name:displayName,contact_email:email,locale:"ar"},{onConflict:"id"});
  if(profileError){await rollback();return send({error:"تعذر إنشاء الملف الشخصي للموظف: "+profileError.message},500);}
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const {error:passwordError}=await db.from("admin_managed_account_passwords").upsert({user_id:newUserId,temporary_password_hash:await hashPassword(temporaryPassword,salt),password_salt:enc(salt)},{onConflict:"user_id"});
  if(passwordError){await rollback();return send({error:"تعذر إعداد تغيير كلمة المرور الإلزامي: "+passwordError.message},500);}
  const {error:memberInsertError}=await db.from("organization_memberships").insert({organization_id:membership.organization_id,user_id:newUserId,role});
  if(memberInsertError){await rollback();return send({error:"تعذر ربط الموظف بالشركة: "+memberInsertError.message},500);}
  return send({success:true,employee:{user_id:newUserId,email,display_name:displayName,role},temporary_password:temporaryPassword,message:"تم إنشاء حساب الموظف وربطه بالشركة. اعرض كلمة المرور المؤقتة للمالك مرة واحدة فقط."},201);
 }
 const {data:admin}=await db.from("platform_admins").select("user_id").eq("user_id",caller.user.id).maybeSingle();if(!admin)return send({error:"غير مصرح بإدارة الحسابات."},403);


 if(body.action==="list_companies"){
  stage="list_companies";
  const {data:companies,error:companiesError}=await db.from("organizations").select("id,name").eq("organization_type","company").eq("approval_status","approved").order("name");
  if(companiesError)return send({error:"تعذر تحميل الشركات المعتمدة."},500);
  return send({companies:companies||[]});
 }

 if(body.action==="create"){
  stage="create.validate";
  const email=String(body.email||"").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF\u00A0]/g,"").replace(/\s+/g,"").trim().toLowerCase();
  const displayName=String(body.display_name||"").trim();
  const requestedOrgName=String(body.organization_name||"").trim();
  const role=String(body.organization_type||"company");
  const password=String(body.temporary_password||"");
  const phone=String(body.phone||"").trim();
  const city=String(body.city||"").trim();
  const address=String(body.address||"").trim();
  const companyType=String(body.company_type||"").trim();
  const fleetCountRaw=String(body.fleet_vehicle_count??"").trim();
  const employmentType=String(body.employment_type||"independent");
  const employeeOrganizationId=String(body.employee_organization_id||"").trim();
  const activationStatus=String(body.activation_status||"active");
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!email.split("@")[0].startsWith(".")&&!email.split("@")[0].endsWith(".")&&!email.split("@")[0].includes("..");
  if(email.length>254||!validEmail)return send({error:"البريد الإلكتروني غير صحيح. تأكد من كتابة بريد صالح بدون مسافات أو رموز مخفية."},400);
  if(!displayName||displayName.length<2||displayName.length>120)return send({error:"الاسم مطلوب ويجب أن يكون من حرفين إلى 120 حرفًا."},400);
  if(!["individual_owner","company","fleet_supplier","employee"].includes(role))return send({error:"نوع الحساب غير صحيح."},400);
  if(password.length<8)return send({error:"كلمة المرور المؤقتة يجب ألا تقل عن 8 أحرف."},400);
  if(!["active","pending"].includes(activationStatus))return send({error:"حالة التفعيل غير صحيحة."},400);
  if(phone&&(phone.length<7||phone.length>30))return send({error:"رقم الهاتف يجب أن يكون من 7 إلى 30 رقمًا أو حرفًا."},400);
  if(city&&(city.length<2||city.length>120))return send({error:"اسم المحافظة يجب أن يكون من حرفين إلى 120 حرفًا."},400);
  if(address.length>500||companyType.length>120)return send({error:"تجاوز أحد الحقول الحد المسموح."},400);
  if(role==="company"||role==="fleet_supplier"){
   if(requestedOrgName.length<2||requestedOrgName.length>180)return send({error:"اسم الشركة أو المؤسسة مطلوب ويجب أن يكون من حرفين إلى 180 حرفًا."},400);
  }
  if(role==="fleet_supplier"&&fleetCountRaw&&(!Number.isInteger(Number(fleetCountRaw))||Number(fleetCountRaw)<0||Number(fleetCountRaw)>100000))return send({error:"عدد سيارات الأسطول غير صحيح."},400);
  if(role==="employee"&&!["independent","company_member"].includes(employmentType))return send({error:"نوع الموظف غير صحيح."},400);
  let employeeOrganization:any=null;
  if(role==="employee"&&employmentType==="company_member"){
   if(!employeeOrganizationId)return send({error:"اختر الشركة التي سيتبع لها الموظف."},400);
   const {data:org,error:orgLookupError}=await db.from("organizations").select("id,name,organization_type,approval_status").eq("id",employeeOrganizationId).maybeSingle();
   if(orgLookupError||!org||org.organization_type!=="company"||org.approval_status!=="approved")return send({error:"الشركة المختارة غير متاحة لربط الموظف بها."},400);
   employeeOrganization=org;
  }
  const organizationName=role==="employee"?(employeeOrganization?.name||""):requestedOrgName||displayName+" - "+(role==="individual_owner"?"مالك سيارة":"مؤسسة");
  const banned=activationStatus==="pending";
  stage="create.auth_user";
  const {data:createdUser,error:createError}=await db.auth.admin.createUser({
   email,password,email_confirm:true,ban_duration:banned?"876000h":"none",
   app_metadata:{must_change_password:true,created_by_platform_admin:true},
   user_metadata:{display_name:displayName,organization_name:organizationName,organization_type:role,phone,governorate:city,address,company_type:role==="company"?companyType:undefined,fleet_vehicle_count:role==="fleet_supplier"&&fleetCountRaw?Number(fleetCountRaw):undefined,employment_type:role==="employee"?employmentType:undefined}
  });
  if(createError)return send({error:/already|registered|exists|duplicate/i.test(createError.message)?"هذا البريد الإلكتروني مسجل بالفعل.":createError.message},400);
  const newUserId=createdUser.user.id;
  let createdOrganizationId:string|undefined;
  let membershipCreated=false;
  const rollback=async()=>{
   await db.from("employee_accounts").delete().eq("user_id",newUserId);
   await db.from("organization_memberships").delete().eq("user_id",newUserId);
   if(createdOrganizationId)await db.from("organizations").delete().eq("id",createdOrganizationId);
   await db.from("admin_managed_account_passwords").delete().eq("user_id",newUserId);
   await db.from("profiles").delete().eq("id",newUserId);
   await db.auth.admin.deleteUser(newUserId);
  };
  stage="create.profile";
  const {error:profileError}=await db.from("profiles").upsert({
   id:newUserId,display_name:displayName,phone:phone||null,contact_email:email,address:address||null,locale:"ar"
  },{onConflict:"id"});
  if(profileError){await rollback();return send({error:"تعذر إنشاء الملف الشخصي للحساب: "+profileError.message},500);}
  stage="create.temporary_password_record";
  const temporarySalt=crypto.getRandomValues(new Uint8Array(16));
  const {error:passwordRecordError}=await db.from("admin_managed_account_passwords").upsert({
   user_id:newUserId,temporary_password_hash:await hashPassword(password,temporarySalt),password_salt:enc(temporarySalt)
  },{onConflict:"user_id"});
  if(passwordRecordError){await rollback();return send({error:"تعذر إعداد تغيير كلمة المرور الإلزامي للحساب الجديد: "+passwordRecordError.message},500);}
  if(role==="employee"){
   // Auth triggers create an employee_accounts row for independent employees,
   // and the organization_memberships trigger creates/updates it for company members.
   // Upsert after those triggers so we never hit a duplicate key and still preserve pending status.
   if(employeeOrganization){
    stage="create.employee_membership";
    const {error:membershipError}=await db.from("organization_memberships").insert({organization_id:employeeOrganization.id,user_id:newUserId,role:"member"});
    if(membershipError){await rollback();return send({error:"تعذر ربط الموظف بالشركة: "+membershipError.message},500);}
    membershipCreated=true;
   }
   stage="create.employee_account";
   const {error:employeeError}=await db.from("employee_accounts").upsert({
    user_id:newUserId,employment_type:employmentType,organization_id:employeeOrganization?.id||null,account_status:banned?"suspended":"active"
   },{onConflict:"user_id"});
   if(employeeError){await rollback();return send({error:"تعذر حفظ ملف الموظف: "+employeeError.message},500);}
  }else{
   stage="create.organization";
   const {data:organization,error:organizationError}=await db.from("organizations").insert({
    name:organizationName,organization_type:role,created_by:newUserId,city:city||null,
    contact_name:displayName,phone:phone||null,contact_email:email,address:address||null,
    company_type:role==="company"?(companyType||null):null,
    fleet_vehicle_count:role==="fleet_supplier"&&fleetCountRaw?Number(fleetCountRaw):null,
    approval_status:"pending_review"
   }).select("id").single();
   if(organizationError){await rollback();return send({error:"تعذر إنشاء المؤسسة المرتبطة بالحساب: "+organizationError.message},500);}
   createdOrganizationId=organization.id;
   stage="create.owner_membership";
   const {error:membershipError}=await db.from("organization_memberships").insert({organization_id:organization.id,user_id:newUserId,role:"owner"});
   if(membershipError){await rollback();return send({error:"تعذر ربط المستخدم بالمؤسسة: "+membershipError.message},500);}
   membershipCreated=true;
  }
  const statusMessage=banned?"الحساب في انتظار التفعيل ولن يتمكن من تسجيل الدخول حتى تفعيله من لوحة التحكم.":"الحساب مفعّل ويمكنه تسجيل الدخول بعد تغيير كلمة المرور المؤقتة.";
  const typeMessage=role==="employee"?(employmentType==="independent"?"موظف مستقل":"موظف تابع للشركة "+employeeOrganization.name):"تم إنشاء الحساب وربطه بملفه المؤسسي";
  return send({success:true,user_id:newUserId,organization_id:createdOrganizationId||employeeOrganization?.id||null,activation_status:activationStatus,message:"تم إنشاء "+typeMessage+". "+statusMessage},201);
 }

 if(body.action==="list"){
  stage="list_users";
  const {data:users,error:userError}=await db.auth.admin.listUsers({page:1,perPage:1000});
  if(userError)return send({error:"تعذر تحميل حسابات المستخدمين."},500);
  const ids=(users?.users||[]).map(u=>u.id);
  if(!ids.length)return send({accounts:[]});
  stage="list_related_records";
  const [{data:profiles,error:profilesError},{data:memberships,error:membershipsError},{data:adminRows,error:adminsError},{data:employeeRows,error:employeesError}]=await Promise.all([
   db.from("profiles").select("id,display_name,phone,contact_email,address").in("id",ids),
   db.from("organization_memberships").select("user_id,organization_id,role,organizations(id,name,organization_type,city,phone,contact_email,address,approval_status)").in("user_id",ids),
   db.from("platform_admins").select("user_id").in("user_id",ids),
   db.from("employee_accounts").select("user_id,employment_type,account_status").in("user_id",ids)
  ]);
  if(profilesError||membershipsError||adminsError||employeesError)return send({error:"تعذر تحميل بيانات الحسابات وتصنيفاتها بالكامل. أعد المحاولة."},500);
  const adminIds=new Set((adminRows||[]).map(a=>a.user_id));
  const employeeMap=new Map((employeeRows||[]).map(e=>[e.user_id,e]));
  const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
  const orgMap=new Map<string,any[]>();
  const membershipMap=new Map<string,any[]>();
  for(const m of memberships||[]){const arr=orgMap.get(m.user_id)||[];if(m.organizations)arr.push(m.organizations);orgMap.set(m.user_id,arr);const memberRows=membershipMap.get(m.user_id)||[];memberRows.push(m);membershipMap.set(m.user_id,memberRows);}
  const accounts=(users?.users||[]).map(u=>{
   const p=profileMap.get(u.id) as any;const orgs=orgMap.get(u.id)||[];const org=orgs[0]||{};const employee=employeeMap.get(u.id);const memberRows=membershipMap.get(u.id)||[];
   const isCompanyEmployee=memberRows.some((m:any)=>m.role!=="owner"&&m.organizations?.organization_type==="company");
   const isEmployee=Boolean(employee||isCompanyEmployee||u.user_metadata?.organization_type==="employee");
   const bannedUntil=u.banned_until||null;const disabled=Boolean(bannedUntil&&new Date(bannedUntil).getTime()>Date.now());
   return {id:u.id,email:u.email||"",display_name:p?.display_name||u.user_metadata?.display_name||"",phone:p?.phone||u.user_metadata?.phone||org.phone||"",address:p?.address||u.user_metadata?.address||org.address||"",organization_name:org.name||u.user_metadata?.organization_name||"",organization_type:isEmployee?"employee":(u.user_metadata?.organization_type||org.organization_type||"individual_owner"),employee_kind:employee?(employee.employment_type==="independent"?"independent":"company_member"):isCompanyEmployee?"company_member":null,city:org.city||u.user_metadata?.governorate||"",approval_status:org.approval_status||null,created_at:u.created_at,status:disabled?"suspended":"active",banned_until:bannedUntil,must_change_password:u.app_metadata?.must_change_password===true,is_admin:adminIds.has(u.id),organization_count:orgs.length};
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
  stage="update_auth_user";
  const email=String(body.email||target.email||"").trim().toLowerCase();
  const displayName=String(body.display_name||"").trim();
  const role=String(body.organization_type||target.user_metadata?.organization_type||"individual_owner");
  if(!email.includes("@"))return send({error:"البريد الإلكتروني غير صحيح."},400);
  if(!displayName)return send({error:"اسم المستخدم مطلوب."},400);
  if(!["individual_owner","company","fleet_supplier","employee"].includes(role))return send({error:"نوع الحساب غير صحيح."},400);
  const metadata={...target.user_metadata,display_name:displayName,organization_name:String(body.organization_name||"").trim(),organization_type:role,phone:String(body.phone||"").trim(),governorate:String(body.city||"").trim(),address:String(body.address||"").trim()};
  const suspended=body.status==="suspended";
  const updatePayload:any={email,email_confirm:true,user_metadata:metadata,ban_duration:suspended?"876000h":"none"};
  const {error:updateError}=await db.auth.admin.updateUserById(userId,updatePayload);
  if(updateError)return send({error:/already|registered|exists|duplicate/i.test(updateError.message)?"البريد الإلكتروني مستخدم بالفعل.":updateError.message},400);
  const {error:employeeStatusError}=await db.from("employee_accounts").update({account_status:suspended?"suspended":"active",updated_at:new Date().toISOString()}).eq("user_id",userId);
  if(employeeStatusError)return send({error:"تم تحديث حالة الدخول لكن تعذر مزامنة حالة ملف الموظف: "+employeeStatusError.message},500);
  const {error:profileError}=await db.from("profiles").upsert({id:userId,display_name:displayName,phone:metadata.phone||null,contact_email:email,address:metadata.address||null,locale:"ar"},{onConflict:"id"});
  if(profileError)return send({error:"تم تحديث بيانات الدخول لكن تعذر تحديث الملف الشخصي: "+profileError.message},500);
  const {data:members}=await db.from("organization_memberships").select("organization_id,organizations(organization_type)").eq("user_id",userId);
  for(const member of members||[]){
   const existingOrg=Array.isArray(member.organizations)?member.organizations[0]:member.organizations;
   const organizationType=role==="employee"?(existingOrg?.organization_type||"company"):role;
   const {error:orgError}=await db.from("organizations").update({name:String(body.organization_name||displayName).trim(),organization_type:organizationType,city:metadata.governorate||null,contact_name:displayName,phone:metadata.phone||null,contact_email:email,address:metadata.address||null,updated_at:new Date().toISOString()}).eq("id",member.organization_id);
   if(orgError)return send({error:"تم تحديث بيانات المستخدم لكن تعذر تحديث بيانات المؤسسة: "+orgError.message},500);
  }
  return send({success:true,message:suspended?"تم إيقاف الحساب.":"تم تحديث الحساب وإتاحته."});
 }

 if(body.action==="reset_password"){
  stage="reset_password";
  const password=randomPassword(),salt=crypto.getRandomValues(new Uint8Array(16));
  const {error:pwError}=await db.auth.admin.updateUserById(userId,{password,app_metadata:{...target.app_metadata,must_change_password:true,created_by_platform_admin:true}});
  if(pwError)return send({error:"تعذر إعادة تعيين كلمة المرور."},500);
  const {error:secretError}=await db.from("admin_managed_account_passwords").upsert({user_id:userId,temporary_password_hash:await hashPassword(password,salt),password_salt:enc(salt)},{onConflict:"user_id"});
  if(secretError)return send({error:"تم تغيير كلمة المرور لكن تعذر تسجيل حالة التغيير الإلزامي. أعد المحاولة من لوحة الإدارة."},500);
  return send({success:true,temporary_password:password,message:"تم إنشاء كلمة مرور مؤقتة جديدة."});
 }

 if(body.action==="delete"){
  return send({error:"تم إيقاف الحذف النهائي مؤقتًا لحماية بيانات المستخدمين والمؤسسات. لم يتم حذف أي بيانات. استخدم إيقاف الحساب لحجب الوصول، وسيُتاح الحذف بعد استكمال آلية حذف آمنة تشمل جميع السجلات والملفات المرتبطة."},409);
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
