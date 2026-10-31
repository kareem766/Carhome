import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { LoaderCircle, UserPlus, Copy, CheckCircle2, Users, Search, Pencil, Trash2, Ban, KeyRound, RefreshCw, X, Save, Building2, CarFront, BriefcaseBusiness } from "lucide-react";
import PlatformBrand from "./PlatformBrand";
import AdminPageNavigation from "./AdminPageNavigation";
import { supabase } from "../lib/supabase";

type Role = "individual_owner" | "company" | "fleet_supplier";
type Account = {id:string;email:string;display_name:string;phone:string;address:string;organization_name:string;organization_type:Role;city:string;approval_status:string|null;created_at:string;status:"active"|"suspended";banned_until:string|null;must_change_password:boolean;is_admin:boolean;organization_count:number};
type FormData = {display_name:string;organization_name:string;email:string;phone:string;city:string;address:string;temporary_password:string;organization_type:Role};
const emptyForm:FormData={display_name:"",organization_name:"",email:"",phone:"",city:"",address:"",temporary_password:"",organization_type:"company"};
const roleLabel=(role:Role)=>role==="company"?"شركة طالبة":role==="fleet_supplier"?"مورد أسطول":"مالك سيارة";
const roleIcon=(role:Role)=>role==="company"?Building2:role==="fleet_supplier"?BriefcaseBusiness:CarFront;
const field="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
export default function AdminManagedAccountsPage() {
  const [form,setForm]=useState<FormData>(emptyForm);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [created,setCreated]=useState<{email:string;password:string}|null>(null);
  const [copied,setCopied]=useState(false);
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [loading,setLoading]=useState(true);
  const [listError,setListError]=useState("");
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [editing,setEditing]=useState<Account|null>(null);
  const [editForm,setEditForm]=useState({display_name:"",organization_name:"",email:"",phone:"",city:"",address:"",organization_type:"company" as Role,status:"active" as "active"|"suspended"});
  const [editBusy,setEditBusy]=useState(false);
  const [deleting,setDeleting]=useState<Account|null>(null);
  const [deleteConfirm,setDeleteConfirm]=useState("");
  const [deleteBusy,setDeleteBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [temporaryCredential,setTemporaryCredential]=useState<{email:string;password:string}|null>(null);
  const [actionBusy,setActionBusy]=useState("");

  const invoke=useCallback(async(body:Record<string,unknown>)=>{
    if(!supabase)throw new Error("خدمة الحسابات غير متاحة حاليًا.");
    const {data:session}=await supabase.auth.getSession();
    if(!session.session)throw new Error("انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.");
    const {data,error}=await supabase.functions.invoke("admin-managed-accounts",{body});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    return data;
  },[]);
  const loadAccounts=useCallback(async()=>{
    setLoading(true);setListError("");
    try{const data=await invoke({action:"list"});setAccounts((data.accounts||[]) as Account[]);}
    catch(e){setListError(e instanceof Error?e.message:"تعذر تحميل الحسابات.");}
    finally{setLoading(false);}
  },[invoke]);
  useEffect(()=>{void loadAccounts();},[loadAccounts]);

  const visible=useMemo(()=>accounts.filter(a=>{
    const term=search.trim().toLowerCase();
    const matches=!term||[a.display_name,a.email,a.phone,a.organization_name,a.city].some(v=>String(v||"").toLowerCase().includes(term));
    return matches&&(filter==="all"||filter===a.organization_type||filter===a.status);
  }),[accounts,search,filter]);
  const counts=useMemo(()=>({all:accounts.length,company:accounts.filter(a=>a.organization_type==="company").length,owner:accounts.filter(a=>a.organization_type==="individual_owner").length,supplier:accounts.filter(a=>a.organization_type==="fleet_supplier").length,suspended:accounts.filter(a=>a.status==="suspended").length}),[accounts]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError("");setCreated(null);
    if(!form.display_name.trim()||!form.email.trim()||form.temporary_password.length<8){setError("راجع البيانات المطلوبة وكلمة المرور المؤقتة (8 أحرف على الأقل).");return;}
    setBusy(true);
    try{await invoke({action:"create",...form});setCreated({email:form.email,password:form.temporary_password});setForm(emptyForm);await loadAccounts();}
    catch(e){setError(e instanceof Error?e.message:"تعذر إنشاء الحساب.");}
    finally{setBusy(false);}
  }
  async function copyCredentials(){
    if(!created)return;
    await navigator.clipboard.writeText("البريد: "+created.email+"\nكلمة المرور المؤقتة: "+created.password);
    setCopied(true);
  }
  function openEdit(account:Account){
    setEditing(account);
    setEditForm({display_name:account.display_name,organization_name:account.organization_name,email:account.email,phone:account.phone,city:account.city,address:account.address,organization_type:account.organization_type,status:account.status});
  }
  async function saveEdit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!editing)return;setEditBusy(true);setNotice("");setListError("");
    try{const data=await invoke({action:"update",user_id:editing.id,...editForm});setNotice(data.message||"تم حفظ التعديلات.");setEditing(null);await loadAccounts();}
    catch(e){setListError(e instanceof Error?e.message:"تعذر حفظ التعديلات.");}
    finally{setEditBusy(false);}
  }
  async function toggleStatus(account:Account){
    if(account.is_admin)return;
    setActionBusy(account.id);setNotice("");setListError("");
    try{const data=await invoke({action:"update",user_id:account.id,display_name:account.display_name,organization_name:account.organization_name,email:account.email,phone:account.phone,city:account.city,address:account.address,organization_type:account.organization_type,status:account.status==="active"?"suspended":"active"});setNotice(data.message||"تم تحديث حالة الحساب.");await loadAccounts();}
    catch(e){setListError(e instanceof Error?e.message:"تعذر تحديث حالة الحساب.");}
    finally{setActionBusy("");}
  }
  async function resetPassword(account:Account){
    if(account.is_admin)return;
    setActionBusy(account.id);setNotice("");setListError("");setTemporaryCredential(null);
    try{const data=await invoke({action:"reset_password",user_id:account.id});setTemporaryCredential({email:account.email,password:data.temporary_password});setNotice("تم إصدار كلمة مرور مؤقتة جديدة، وسيُطلب من المستخدم تغييرها عند الدخول التالي.");}
    catch(e){setListError(e instanceof Error?e.message:"تعذر إعادة تعيين كلمة المرور.");}
    finally{setActionBusy("");}
  }
  async function confirmDelete(){
    if(!deleting||deleteConfirm.trim().toLowerCase()!==deleting.email.toLowerCase())return;
    setDeleteBusy(true);setListError("");setNotice("");
    try{const data=await invoke({action:"delete",user_id:deleting.id});setNotice(data.message||"تم حذف الحساب نهائيًا.");setAccounts(old=>old.filter(a=>a.id!==deleting.id));setDeleting(null);setDeleteConfirm("");}
    catch(e){setListError(e instanceof Error?e.message:"تعذر حذف الحساب.");}
    finally{setDeleteBusy(false);}
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6"><div className="mx-auto max-w-7xl">
    <div className="mb-5 flex items-center justify-between rounded-2xl border bg-white p-4 shadow-sm"><PlatformBrand/><span className="text-sm font-extrabold text-blue-800">مركز إدارة الحسابات</span></div>
    <AdminPageNavigation/>
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Users size={23}/></span><div><h1 className="text-xl font-black text-slate-900 sm:text-2xl">إدارة حسابات المستخدمين</h1><p className="mt-1 text-sm text-slate-500">عرض الحسابات والتحكم في بياناتها وحالة الوصول وكلمات المرور.</p></div></div><button type="button" onClick={()=>void loadAccounts()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><RefreshCw size={16} className={loading?"animate-spin":""}/> تحديث القائمة</button></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[["كل الحسابات",counts.all],["الشركات",counts.company],["ملاك السيارات",counts.owner],["موردو الأساطيل",counts.supplier],["الموقوفة",counts.suspended]].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p></div>)}
      </div>
      {notice&&<p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold leading-6 text-emerald-800">{notice}</p>}
      {listError&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{listError}</p>}
      {temporaryCredential&&<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="font-extrabold text-amber-900">كلمة المرور المؤقتة الجديدة</div><p className="mt-2 text-sm">الحساب: <bdi>{temporaryCredential.email}</bdi></p><p className="mt-1 select-all font-mono text-lg font-black" dir="ltr">{temporaryCredential.password}</p><button type="button" onClick={()=>navigator.clipboard.writeText(temporaryCredential.password)} className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-900"><Copy size={14} className="ml-1 inline"/>نسخ كلمة المرور</button></div>}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search size={18} className="absolute right-3 top-3.5 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو البريد أو الهاتف أو الشركة..." className={field+" pr-10"}/></label><select value={filter} onChange={e=>setFilter(e.target.value)} className={field+" sm:max-w-56"}><option value="all">كل الحسابات</option><option value="company">الشركات</option><option value="individual_owner">ملاك السيارات</option><option value="fleet_supplier">موردو الأساطيل</option><option value="suspended">الحسابات الموقوفة</option><option value="active">الحسابات النشطة</option></select></div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        {loading?<div className="flex min-h-32 items-center justify-center gap-2 text-sm font-bold text-slate-500"><LoaderCircle className="animate-spin"/>جارٍ تحميل الحسابات...</div>:visible.length===0?<div className="p-8 text-center text-sm text-slate-500">لا توجد حسابات مطابقة لبحثك.</div>:<div className="divide-y divide-slate-100">{visible.map(account=>{const Icon=roleIcon(account.organization_type);return <article key={account.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon size={20}/></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold text-slate-900">{account.display_name||"بدون اسم"}</h3><span className={"rounded-full px-2.5 py-1 text-[11px] font-extrabold "+(account.status==="active"?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-700")}>{account.status==="active"?"نشط":"موقوف"}</span>{account.must_change_password&&<span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">بانتظار تغيير كلمة المرور</span>}{account.is_admin&&<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-600">مسؤول منصة</span>}</div><p className="mt-1 break-all text-sm text-slate-600" dir="ltr">{account.email}</p><p className="mt-1 text-xs text-slate-500">{roleLabel(account.organization_type)}{account.organization_name?" · "+account.organization_name:""}{account.city?" · "+account.city:""}</p><p className="mt-1 text-xs text-slate-400">{account.phone||"لا يوجد هاتف"} · تاريخ الإنشاء: {new Date(account.created_at).toLocaleDateString("ar-EG")}</p></div></div>
          <div className="flex flex-wrap items-center gap-2">{!account.is_admin&&<><button type="button" onClick={()=>openEdit(account)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><Pencil size={14}/>تعديل</button><button type="button" disabled={actionBusy===account.id} onClick={()=>void toggleStatus(account)} className={"inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold "+(account.status==="active"?"border-amber-200 text-amber-800 hover:bg-amber-50":"border-emerald-200 text-emerald-800 hover:bg-emerald-50")}>{actionBusy===account.id?<LoaderCircle size={14} className="animate-spin"/>:<Ban size={14}/>}{account.status==="active"?"إيقاف":"تفعيل"}</button><button type="button" disabled={actionBusy===account.id} onClick={()=>void resetPassword(account)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-200 px-3 text-xs font-bold text-blue-800 hover:bg-blue-50"><KeyRound size={14}/>إعادة كلمة المرور</button><button type="button" disabled title="الحذف النهائي متوقف مؤقتًا لحماية البيانات" className="inline-flex min-h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-400"><Trash2 size={14}/>الحذف متوقف مؤقتًا</button></>}</div>
        </article>})}</div>}
      </div>
      <p className="mt-3 text-xs leading-6 text-slate-500">ملاحظة: الحسابات الإدارية محمية من التعديل والحذف من هذه الصفحة. إيقاف الحساب يمنع تسجيل الدخول، وإعادة تعيين كلمة المرور تُصدر كلمة مؤقتة تُعرض مرة واحدة. تم إيقاف الحذف النهائي مؤقتًا لحماية البيانات لحين استكمال آلية حذف آمنة.</p>
    </section>

    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserPlus size={21}/></span><div><h2 className="text-lg font-black text-slate-900">إنشاء حساب مستخدم جديد</h2><p className="mt-1 text-sm text-slate-500">سيُطلب من المستخدم تغيير كلمة المرور عند أول تسجيل دخول.</p></div></div>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">اسم المستخدم الكامل *<input required maxLength={150} value={form.display_name} onChange={e=>setForm({...form,display_name:e.target.value})} className={field}/></label>
        <label className="text-sm font-bold">اسم الشركة أو المؤسسة{form.organization_type!=="individual_owner"?" *":""}<input required={form.organization_type!=="individual_owner"} maxLength={180} value={form.organization_name} onChange={e=>setForm({...form,organization_name:e.target.value})} placeholder="أدخل الاسم التجاري للشركة أو المؤسسة" className={field}/></label>
        <label className="text-sm font-bold">البريد الإلكتروني *<input required type="email" autoComplete="off" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className={field} dir="ltr"/></label>
        <label className="text-sm font-bold">رقم الهاتف<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className={field} dir="ltr"/></label>
        <label className="text-sm font-bold">نوع الحساب<select value={form.organization_type} onChange={e=>setForm({...form,organization_type:e.target.value as Role})} className={field}><option value="company">شركة طالبة</option><option value="individual_owner">مالك سيارة</option><option value="fleet_supplier">مورد أسطول</option></select></label>
        <label className="text-sm font-bold">المحافظة / المدينة<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} className={field}/></label>
        <label className="text-sm font-bold sm:col-span-2">العنوان<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} className={field}/></label>
        <label className="text-sm font-bold sm:col-span-2">كلمة المرور المؤقتة *<input required minLength={8} autoComplete="new-password" type="password" value={form.temporary_password} onChange={e=>setForm({...form,temporary_password:e.target.value})} className={field} dir="ltr"/><span className="mt-1 block text-xs font-normal text-slate-500">8 أحرف على الأقل. سلّمها للمستخدم بطريقة آمنة.</span></label>
        <div className="sm:col-span-2"><button disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 font-extrabold text-white disabled:opacity-60">{busy?<LoaderCircle className="animate-spin" size={18}/>:<UserPlus size={18}/>}إنشاء الحساب</button></div>
      </form>
      {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
      {created&&<div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 font-extrabold text-emerald-800"><CheckCircle2 size={19}/>تم إنشاء الحساب بنجاح</div><p className="mt-2 text-sm">البريد: <bdi>{created.email}</bdi></p><p className="mt-1 text-sm">كلمة المرور المؤقتة: <bdi>{created.password}</bdi></p><button type="button" onClick={copyCredentials} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-800"><Copy size={15}/>{copied?"تم النسخ":"نسخ بيانات الدخول"}</button></div>}
    </section>
  </div>

  {editing&&<div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6"><section className="my-auto w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-slate-900">تعديل بيانات الحساب</h2><p className="mt-1 text-sm text-slate-500">{editing.email}</p></div><button type="button" onClick={()=>setEditing(null)} className="grid h-10 w-10 place-items-center rounded-xl border"><X size={19}/></button></div><form onSubmit={saveEdit} className="mt-5 grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-bold">اسم المستخدم *<input required value={editForm.display_name} onChange={e=>setEditForm({...editForm,display_name:e.target.value})} className={field}/></label>
    <label className="text-sm font-bold">اسم الشركة / المؤسسة<input value={editForm.organization_name} onChange={e=>setEditForm({...editForm,organization_name:e.target.value})} className={field}/></label>
    <label className="text-sm font-bold">البريد الإلكتروني *<input required type="email" value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})} className={field} dir="ltr"/></label>
    <label className="text-sm font-bold">رقم الهاتف<input value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})} className={field} dir="ltr"/></label>
    <label className="text-sm font-bold">نوع الحساب<select value={editForm.organization_type} onChange={e=>setEditForm({...editForm,organization_type:e.target.value as Role})} className={field}><option value="company">شركة طالبة</option><option value="individual_owner">مالك سيارة</option><option value="fleet_supplier">مورد أسطول</option></select></label>
    <label className="text-sm font-bold">المحافظة / المدينة<input value={editForm.city} onChange={e=>setEditForm({...editForm,city:e.target.value})} className={field}/></label>
    <label className="text-sm font-bold sm:col-span-2">العنوان<input value={editForm.address} onChange={e=>setEditForm({...editForm,address:e.target.value})} className={field}/></label>
    <label className="text-sm font-bold sm:col-span-2">حالة الحساب<select value={editForm.status} onChange={e=>setEditForm({...editForm,status:e.target.value as "active"|"suspended"})} className={field}><option value="active">نشط</option><option value="suspended">موقوف</option></select></label>
    <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={()=>setEditing(null)} className="min-h-11 rounded-xl border px-4 text-sm font-bold">إلغاء</button><button disabled={editBusy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-extrabold text-white">{editBusy?<LoaderCircle size={17} className="animate-spin"/>:<Save size={17}/>}حفظ التعديلات</button></div>
  </form></section></div>}

  {deleting&&<div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-slate-950/70 p-3 sm:p-6"><section className="my-auto w-full max-w-xl rounded-3xl border border-red-100 bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700"><Trash2 size={24}/></span><h2 className="mt-3 text-xl font-black text-red-800">حذف الحساب نهائيًا</h2></div><button type="button" onClick={()=>{setDeleting(null);setDeleteConfirm("");}} className="grid h-10 w-10 place-items-center rounded-xl border"><X size={19}/></button></div><p className="mt-3 text-sm leading-7 text-slate-700">أنت على وشك حذف حساب <b>{deleting.display_name}</b> المرتبط بالبريد <bdi dir="ltr" className="font-bold">{deleting.email}</bdi>. هذا الإجراء لا يمكن التراجع عنه.</p><div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-900"><b>سيتم حذف نهائيًا:</b><ul className="mr-5 list-disc"><li>بيانات الدخول والملف الشخصي والإشعارات.</li><li>بيانات المؤسسة التي لا تضم أعضاء آخرين، وسياراتها وصورها وطلبات التأجير والعروض والمحادثات وسجلات الدفع والاشتراكات المرتبطة بها.</li><li>إذا كانت المؤسسة تضم أعضاء آخرين، ستظل المؤسسة وبياناتها موجودة وسيُزال هذا المستخدم فقط منها.</li></ul></div><label className="mt-4 block text-sm font-bold">اكتب البريد الإلكتروني للحساب لتأكيد الحذف<input value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)} placeholder={deleting.email} className={field} dir="ltr"/></label><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={()=>{setDeleting(null);setDeleteConfirm("");}} className="min-h-11 rounded-xl border px-5 text-sm font-bold">إلغاء</button><button type="button" disabled={deleteBusy||deleteConfirm.trim().toLowerCase()!==deleting.email.toLowerCase()} onClick={()=>void confirmDelete()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-extrabold text-white disabled:opacity-40">{deleteBusy?<LoaderCircle size={17} className="animate-spin"/>:<Trash2 size={17}/>}تأكيد الحذف النهائي</button></div></section></div>}
  </main>;
}
