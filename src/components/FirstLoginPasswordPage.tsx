import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, ShieldCheck, Sparkles, LockKeyhole } from "lucide-react";
import PlatformBrand from "./PlatformBrand";
import { supabase } from "../lib/supabase";

export default function FirstLoginPasswordPage() {
 const [password,setPassword]=useState("");
 const [confirm,setConfirm]=useState("");
 const [displayName,setDisplayName]=useState("مرحبًا بك في فريق My Car");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{let active=true;void supabase?.auth.getUser().then(({data})=>{if(active&&data.user?.user_metadata?.display_name)setDisplayName(String(data.user.user_metadata.display_name))});return()=>{active=false}},[]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError("");
  if(!supabase){setError("خدمة الحسابات غير متاحة.");return;}
  if(password.length<8){setError("كلمة المرور يجب ألا تقل عن 8 أحرف.");return;}
  if(password!==confirm){setError("تأكيد كلمة المرور غير مطابق.");return;}
  setBusy(true);
  try{
   const {data:s}=await supabase.auth.getSession();
   if(!s.session?.user?.app_metadata?.must_change_password)throw new Error("جلسة الحساب غير صالحة. سجّل الدخول مرة أخرى.");
   const {error:updateError}=await supabase.auth.updateUser({password});
   if(updateError)throw updateError;
   const {data,error:invokeError}=await supabase.functions.invoke("admin-managed-accounts",{body:{action:"complete",password}});
   if(invokeError)throw invokeError;
   if(data?.error)throw new Error(data.error);
   const {data:refreshed,error:refreshError}=await supabase.auth.refreshSession();
   if(refreshError)throw refreshError;
   const user=refreshed.session?.user;
   if(!user||user.app_metadata?.must_change_password===true)throw new Error("تم تحديث كلمة المرور، لكن تعذر إنهاء تفعيل الحساب. سجّل الدخول مرة أخرى.");
   const role=user.user_metadata?.organization_type;
   window.location.replace(role==="company"?"/workspace/company":role==="fleet_supplier"?"/workspace/supplier/vehicles":"/workspace/owner/vehicles");
  }catch(e){setError(e instanceof Error?e.message:"تعذر تغيير كلمة المرور.");}
  finally{setBusy(false);}
 }
 return <main dir="rtl" className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,transparent_36%),linear-gradient(145deg,#f7faff_0%,#edf4fc_55%,#e7f0fb_100%)] px-4 py-8">
  <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full border-[34px] border-blue-200/30"/>
  <div className="pointer-events-none absolute -bottom-28 -left-24 h-80 w-80 rounded-full border-[38px] border-cyan-200/25"/>
  <section className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_28px_90px_-35px_rgba(15,45,85,.35)] backdrop-blur sm:p-10">
   <div className="mb-8 flex justify-center"><PlatformBrand/></div>
   <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-100 text-blue-700 shadow-inner"><Sparkles size={30}/></div>
   <p className="mt-6 text-center text-xs font-black tracking-wide text-blue-700">أهلًا بك في My Car</p>
   <h1 className="mt-2 text-center text-2xl font-black leading-tight text-slate-950 sm:text-3xl">سعداء بانضمامك، {displayName}</h1>
   <p className="mx-auto mt-3 max-w-md text-center text-sm leading-7 text-slate-600">هذه أول مرة تدخل فيها إلى مساحة عمل شركتك. قبل أن تبدأ، أنشئ كلمة مرور خاصة بك للحفاظ على أمان حسابك.</p>
   <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
    <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><LockKeyhole size={19}/></span><div><p className="text-sm font-extrabold text-slate-900">خطوة أمان لمرة واحدة</p><p className="mt-1 text-xs leading-5 text-slate-600">لن تُطلب منك هذه الشاشة مرة أخرى بعد حفظ كلمة المرور الجديدة.</p></div></div>
   </div>
   <form onSubmit={submit} className="mt-6 space-y-4">
    <label className="block text-sm font-bold text-slate-800">كلمة المرور الجديدة<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="8 أحرف على الأقل" className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-normal outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" dir="ltr"/></label>
    <label className="block text-sm font-bold text-slate-800">تأكيد كلمة المرور<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="أعد كتابة كلمة المرور" className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-normal outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" dir="ltr"/></label>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
    <button disabled={busy} className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-800 to-blue-600 px-4 py-3 font-extrabold text-white shadow-lg shadow-blue-900/15 transition hover:brightness-105 disabled:opacity-60">{busy?<LoaderCircle className="animate-spin" size={19}/>:<ShieldCheck size={19}/>}حفظ كلمة المرور والدخول إلى حسابي</button>
   </form>
   <p className="mt-5 text-center text-xs leading-6 text-slate-400">حسابك مرتبط بشركة العمل، وستظهر لك الأدوات وفق الصلاحيات التي حددها مالك الشركة.</p>
  </section>
 </main>;
}
