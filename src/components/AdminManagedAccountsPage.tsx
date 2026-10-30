import { useState, type FormEvent } from "react";
import { LoaderCircle, UserPlus, Copy, CheckCircle2 } from "lucide-react";
import PlatformBrand from "./PlatformBrand";
import AdminPageNavigation from "./AdminPageNavigation";
import { supabase } from "../lib/supabase";

type Role = "individual_owner" | "company" | "fleet_supplier";
export default function AdminManagedAccountsPage() {
  const [form, setForm] = useState({ display_name: "", email: "", phone: "", city: "", address: "", temporary_password: "", organization_type: "company" as Role });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{email:string;password:string}|null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setCreated(null);
    if (!supabase) { setError("خدمة الحسابات غير متاحة حاليًا."); return; }
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("سجّل الدخول بحساب صاحب المنصة أولاً.");
      const { data, error: invokeError } = await supabase.functions.invoke("admin-managed-accounts", { body: {
        action: "create", display_name: form.display_name,
        email: form.email, phone: form.phone, city: form.city, address: form.address,
        temporary_password: form.temporary_password, organization_type: form.organization_type,
      }});
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setCreated({email:form.email,password:form.temporary_password});
      setForm({...form,display_name:"",email:"",phone:"",city:"",address:"",temporary_password:""});
    } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر إنشاء الحساب."); }
    finally { setBusy(false); }
  }

  async function copyCredentials() {
    if (!created) return;
    await navigator.clipboard.writeText("البريد: "+created.email+"\nكلمة المرور المؤقتة: "+created.password);
    setCopied(true);
  }

  const field = "mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500";
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6"><div className="mx-auto max-w-5xl">
    <div className="mb-5 flex items-center justify-between rounded-2xl border bg-white p-4"><PlatformBrand/><span className="text-sm font-extrabold text-blue-800">إدارة حسابات المستخدمين</span></div>
    <AdminPageNavigation/>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><UserPlus size={23}/></span><div><h1 className="text-xl font-black text-slate-900 sm:text-2xl">إنشاء حساب مستخدم جديد</h1><p className="mt-1 text-sm leading-6 text-slate-500">أنشئ حسابًا للشركة أو مالك السيارة أو مورد الأسطول. سيُطلب من المستخدم تغيير كلمة المرور عند أول دخول.</p></div></div>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">اسم المستخدم الكامل *<input required maxLength={150} value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})} className={field}/></label>
        <label className="text-sm font-bold">البريد الإلكتروني *<input required type="email" autoComplete="off" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className={field} dir="ltr"/></label>
        <label className="text-sm font-bold">رقم الهاتف<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className={field} dir="ltr"/></label>
        <label className="text-sm font-bold">نوع الحساب<select value={form.organization_type} onChange={e=>setForm({...form,organization_type:e.target.value as Role})} className={field}><option value="company">شركة طالبة</option><option value="individual_owner">مالك سيارة</option><option value="fleet_supplier">مورد أسطول</option></select></label>
        <label className="text-sm font-bold">المحافظة / المدينة<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} className={field}/></label>
        <label className="text-sm font-bold sm:col-span-2">العنوان<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className={field}/></label>
        <label className="text-sm font-bold sm:col-span-2">كلمة المرور المؤقتة *<input required minLength={8} autoComplete="new-password" type="password" value={form.temporary_password} onChange={e=>setForm({...form,temporary_password:e.target.value})} className={field} dir="ltr"/><span className="mt-1 block text-xs font-normal text-slate-500">8 أحرف على الأقل. سلّمها للمستخدم بطريقة آمنة.</span></label>
        <div className="sm:col-span-2"><button disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 font-extrabold text-white disabled:opacity-60">{busy?<LoaderCircle className="animate-spin" size={18}/>:<UserPlus size={18}/>}إنشاء الحساب</button></div>
      </form>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
      {created && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 font-extrabold text-emerald-800"><CheckCircle2 size={19}/> تم إنشاء الحساب بنجاح</div><p className="mt-2 text-sm leading-6 text-emerald-900">بيانات الدخول التي تسلّمها للمستخدم:</p><p className="mt-2 text-sm">البريد: <bdi>{created.email}</bdi></p><p className="mt-1 text-sm">كلمة المرور المؤقتة: <bdi>{created.password}</bdi></p><button type="button" onClick={copyCredentials} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-800"><Copy size={15}/>{copied?"تم النسخ":"نسخ بيانات الدخول"}</button></div>}
    </section>
  </div></main>;
}
