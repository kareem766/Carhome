import { useEffect, useState } from 'react'
import { Building2, CheckCircle2, LogOut, Pencil, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type OrganizationRow = { id: string; name: string; organization_type: 'individual_owner' | 'company' | 'fleet_supplier'; city: string | null; contact_name: string | null; contact_email: string | null; address: string | null; company_type: string | null; fleet_vehicle_count: number | null; created_at: string }
type OrganizationForm = { name: string; organization_type: 'individual_owner' | 'company' | 'fleet_supplier'; city: string; contact_name: string; contact_email: string; address: string; company_type: string; fleet_vehicle_count: string }
const emptyOrganization: OrganizationForm = { name: '', organization_type: 'company', city: '', contact_name: '', contact_email: '', address: '', company_type: '', fleet_vehicle_count: '' }
type VehicleRow = { id: string; make: string; model: string; model_year: number; vehicle_type: string; transmission: string; seats: number; governorate: string; address: string; monthly_price_egp: number; yearly_price_egp: number | null; with_driver: boolean; notes: string | null; review_status: string; payment_status: string; organizations: { name: string } | { name: string }[] | null; images?: { url: string; alt_text: string }[] }
type PaymentRow = { id: string; vehicle_id: string; amount_egp: number; period_months: number; transfer_method: string; transfer_reference: string; review_status: string; created_at: string; vehicles: { make: string; model: string } | { make: string; model: string }[] | null; organizations: { name: string; organization_type?: string } | { name: string; organization_type?: string }[] | null }

export default function AdminReviewPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([])
  const [organizationForm, setOrganizationForm] = useState<OrganizationForm>(emptyOrganization)
  const [editingOrganizationId, setEditingOrganizationId] = useState<string | null>(null)
  const [savingOrganization, setSavingOrganization] = useState(false)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState('')
  async function load() {
    if (!supabase) { window.location.replace('/'); return }
    const client = supabase
    setLoading(true); setError('')
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) { window.location.replace('/?login=1'); return }
    const { data: admin, error: adminError } = await supabase.from('platform_admins').select('user_id').eq('user_id',auth.user.id).maybeSingle()
    if (adminError) { setError('تعذر التحقق من صلاحية الإدارة. تأكد من تطبيق Migration صلاحيات المراجعة.'); setLoading(false); return }
    if (!admin) { setError('هذا الحساب غير مفعّل كمسؤول للمنصة. لا يمكن فتح لوحة المراجعة.'); setAuthorized(false); setLoading(false); return }
    setAuthorized(true)
    const [vehicleResult,paymentResult,organizationResult] = await Promise.all([
      supabase.from('vehicles').select('id,make,model,model_year,vehicle_type,transmission,seats,governorate,address,monthly_price_egp,yearly_price_egp,with_driver,notes,review_status,payment_status,organizations(name)').in('review_status',['pending_review','rejected']).order('created_at',{ascending:false}),
      supabase.from('vehicle_payment_submissions').select('id,vehicle_id,amount_egp,period_months,transfer_method,transfer_reference,review_status,created_at,vehicles(make,model),organizations(name,organization_type)').eq('review_status','pending').order('created_at',{ascending:false}),
      supabase.from('organizations').select('id,name,organization_type,city,contact_name,contact_email,address,company_type,fleet_vehicle_count,created_at').order('created_at',{ascending:false})
    ])
    if (vehicleResult.error) setError(vehicleResult.error.message); else {
      const vehicleRows = (vehicleResult.data || []) as unknown as VehicleRow[]
      if (vehicleRows.length) {
        const imageResult = await supabase.from('vehicle_images').select('vehicle_id,storage_path,alt_text,sort_order').in('vehicle_id', vehicleRows.map(vehicle => vehicle.id)).order('sort_order', { ascending: true })
        if (imageResult.error) setError('تم تحميل بيانات السيارات، لكن تعذر تحميل الصور: ' + imageResult.error.message)
        const signedImages = await Promise.all((imageResult.data || []).map(async image => {
          const signed = await client.storage.from('vehicle-images').createSignedUrl(image.storage_path, 900)
          return signed.error || !signed.data?.signedUrl ? null : { vehicle_id: image.vehicle_id, url: signed.data.signedUrl, alt_text: image.alt_text || 'صورة السيارة' }
        }))
        setVehicles(vehicleRows.map(vehicle => ({ ...vehicle, images: signedImages.filter((image): image is { vehicle_id: string; url: string; alt_text: string } => Boolean(image && image.vehicle_id === vehicle.id)).map(image => ({ url: image.url, alt_text: image.alt_text })) })))
      } else setVehicles([])
    }
    if (paymentResult.error) setError(paymentResult.error.message); else setPayments((paymentResult.data || []) as unknown as PaymentRow[])
    if (organizationResult.error) setError('تعذر تحميل المؤسسات: ' + organizationResult.error.message); else setOrganizations((organizationResult.data || []) as OrganizationRow[])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])
  async function reviewVehicle(id: string, status: 'approved' | 'rejected') {
    if (!supabase) return
    setBusyId(id); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('vehicles').update({ review_status: status }).eq('id',id)
    setBusyId('')
    if (updateError) { setError(updateError.message); return }
    setNotice(status === 'approved' ? 'تم اعتماد بيانات السيارة.' : 'تم رفض السيارة وإعادتها للتعديل.')
    await load()
  }
  async function reviewPayment(row: PaymentRow, status: 'approved' | 'rejected') {
    if (!supabase) return
    setBusyId(row.id); setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const { error: paymentError } = await supabase.from('vehicle_payment_submissions').update({ review_status: status, reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString() }).eq('id',row.id)
    if (paymentError) { setBusyId(''); setError(paymentError.message); return }
    if (status === 'approved') {
      const { error: vehicleError } = await supabase.from('vehicles').update({ payment_status: 'verified' }).eq('id',row.vehicle_id)
      if (vehicleError) { setBusyId(''); setError('تم تسجيل قبول التحويل لكن تعذر تحديث حالة السيارة: '+vehicleError.message); return }
    }
    setBusyId('')
    setNotice(status === 'approved' ? 'تم قبول التحويل وتحديث حالة الدفع.' : 'تم رفض إثبات التحويل.')
    await load()
  }

  function startOrganizationEdit(row: OrganizationRow) {
    setEditingOrganizationId(row.id)
    setOrganizationForm({ name: row.name || '', organization_type: row.organization_type, city: row.city || '', contact_name: row.contact_name || '', contact_email: row.contact_email || '', address: row.address || '', company_type: row.company_type || '', fleet_vehicle_count: row.fleet_vehicle_count == null ? '' : String(row.fleet_vehicle_count) })
    setNotice('')
    setError('')
  }
  function resetOrganizationForm() {
    setEditingOrganizationId(null)
    setOrganizationForm(emptyOrganization)
  }
  async function saveOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !organizationForm.name.trim()) return
    const fleetCount = organizationForm.fleet_vehicle_count.trim() ? Number(organizationForm.fleet_vehicle_count) : null
    if (fleetCount !== null && (!Number.isInteger(fleetCount) || fleetCount < 0)) { setError('عدد سيارات الأسطول يجب أن يكون رقمًا صحيحًا غير سالب.'); return }
    setSavingOrganization(true); setError(''); setNotice('')
    const payload = {
      name: organizationForm.name.trim(),
      organization_type: organizationForm.organization_type,
      city: organizationForm.city.trim() || null,
      contact_name: organizationForm.contact_name.trim() || null,
      contact_email: organizationForm.contact_email.trim() || null,
      address: organizationForm.address.trim() || null,
      company_type: organizationForm.organization_type === 'company' ? (organizationForm.company_type.trim() || null) : null,
      fleet_vehicle_count: organizationForm.organization_type === 'fleet_supplier' ? fleetCount : null
    }
    const result = editingOrganizationId
      ? await supabase.from('organizations').update(payload).eq('id', editingOrganizationId)
      : await supabase.from('organizations').insert(payload)
    setSavingOrganization(false)
    if (result.error) { setError('تعذر حفظ المؤسسة: ' + result.error.message); return }
    setNotice(editingOrganizationId ? 'تم تحديث بيانات المؤسسة.' : 'تمت إضافة المؤسسة.')
    resetOrganizationForm()
    await load()
  }
  async function deleteOrganization(row: OrganizationRow) {
    if (!supabase || !window.confirm('هل تريد حذف مؤسسة "' + row.name + '"؟ قد يمنع وجود طلبات أو سيارات مرتبطة حذفها.')) return
    setBusyId(row.id); setError(''); setNotice('')
    const { error: deleteError } = await supabase.from('organizations').delete().eq('id', row.id)
    setBusyId('')
    if (deleteError) { setError('تعذر حذف المؤسسة. قد تكون مرتبطة بسيارات أو طلبات أو محادثات. التفاصيل: ' + deleteError.message); return }
    setNotice('تم حذف المؤسسة.')
    if (editingOrganizationId === row.id) resetOrganizationForm()
    await load()
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); window.location.replace('/') }
  const methodName: Record<string,string> = { instapay:'InstaPay', vodafone_cash:'Vodafone Cash', bank_transfer:'تحويل بنكي' }
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5"><div><p className="text-sm font-bold text-blue-700">Carhome · الإدارة</p><h1 className="mt-1 text-2xl font-extrabold">مراجعة السيارات والتحويلات</h1><p className="mt-2 text-sm text-slate-500">لا يتم اعتماد السيارة أو تأكيد الدفع إلا بمراجعة المسؤول.</p></div><div className="flex gap-2"><button onClick={() => void load()} className="rounded-xl border p-3" aria-label="تحديث"><RefreshCw size={17}/></button><button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><LogOut size={16}/> خروج</button></div></header>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}
    {loading ? <p className="py-12 text-center text-slate-500">جارٍ تحميل المراجعات...</p> : authorized && <>

      <section className="mt-7 rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-xl font-extrabold"><Building2 size={21}/> إدارة المؤسسات ({organizations.length})</h2><p className="mt-1 text-sm text-slate-500">إضافة وتعديل بيانات المؤسسة. الحذف متاح فقط عندما تسمح علاقات قاعدة البيانات بذلك.</p></div>
          <button onClick={() => { resetOrganizationForm(); setNotice(''); setError('') }} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white"><Plus size={16}/> مؤسسة جديدة</button>
        </div>
        <form onSubmit={saveOrganization} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <label className="text-sm font-bold">اسم المؤسسة *
            <input required value={organizationForm.name} onChange={e=>setOrganizationForm({...organizationForm,name:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={160}/>
          </label>
          <label className="text-sm font-bold">نوع الحساب
            <select value={organizationForm.organization_type} onChange={e=>setOrganizationForm({...organizationForm,organization_type:e.target.value as OrganizationForm['organization_type']})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal">
              <option value="individual_owner">مالك سيارة</option><option value="company">شركة طالبة</option><option value="fleet_supplier">مورد أسطول</option>
            </select>
          </label>
          <label className="text-sm font-bold">المدينة<input value={organizationForm.city} onChange={e=>setOrganizationForm({...organizationForm,city:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={100}/></label>
          <label className="text-sm font-bold">اسم مسؤول التواصل<input value={organizationForm.contact_name} onChange={e=>setOrganizationForm({...organizationForm,contact_name:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={160}/></label>
          <label className="text-sm font-bold">البريد الإلكتروني<input type="email" value={organizationForm.contact_email} onChange={e=>setOrganizationForm({...organizationForm,contact_email:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={254}/></label>
          <label className="text-sm font-bold">العنوان<input value={organizationForm.address} onChange={e=>setOrganizationForm({...organizationForm,address:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={300}/></label>
          {organizationForm.organization_type === 'company' && <label className="text-sm font-bold">نشاط الشركة<input value={organizationForm.company_type} onChange={e=>setOrganizationForm({...organizationForm,company_type:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={120}/></label>}
          {organizationForm.organization_type === 'fleet_supplier' && <label className="text-sm font-bold">عدد سيارات الأسطول<input type="number" min="0" step="1" value={organizationForm.fleet_vehicle_count} onChange={e=>setOrganizationForm({...organizationForm,fleet_vehicle_count:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"/></label>}
          <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={savingOrganization} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingOrganization ? 'جارٍ الحفظ...' : editingOrganizationId ? 'حفظ التعديلات' : 'إضافة المؤسسة'}</button><button type="button" onClick={resetOrganizationForm} className="rounded-xl border px-4 py-2 text-sm font-bold">إلغاء</button></div>
        </form>
        <div className="mt-4 space-y-2">
          {organizations.map(org=><article key={org.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div><h3 className="font-extrabold">{org.name}</h3><p className="mt-1 text-sm text-slate-600">{org.organization_type === 'individual_owner' ? 'مالك سيارة' : org.organization_type === 'fleet_supplier' ? 'مورد أسطول' : 'شركة طالبة'} · {org.city || 'المدينة غير محددة'}</p><p className="mt-1 text-xs text-slate-500">{org.contact_name || 'بدون مسؤول تواصل'} · {org.contact_email || 'بدون بريد مسجل'}{org.fleet_vehicle_count == null ? '' : ' · أسطول: ' + org.fleet_vehicle_count + ' سيارة'}</p></div>
            <div className="flex gap-2"><button onClick={()=>startOrganizationEdit(org)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-bold"><Pencil size={15}/> تعديل</button><button disabled={busyId===org.id} onClick={()=>void deleteOrganization(org)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50"><Trash2 size={15}/> حذف</button></div>
          </article>)}
          {organizations.length===0 && <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">لا توجد مؤسسات مسجلة.</p>}
        </div>
      </section>

      <section className="mt-7"><h2 className="text-xl font-extrabold">السيارات التي تحتاج مراجعة ({vehicles.length})</h2><div className="mt-4 space-y-3">{vehicles.map(v=><article key={v.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-extrabold">{v.make} {v.model} · {v.model_year}</h3><p className="mt-2 text-sm text-slate-600">{Array.isArray(v.organizations) ? v.organizations[0]?.name : v.organizations?.name} · {v.vehicle_type} · {v.governorate}</p><p className="mt-1 text-sm text-slate-500">سعر الإيجار: {Number(v.monthly_price_egp).toLocaleString('ar-EG')} جنيه شهريًا · الدفع: {v.payment_status === 'pending' ? 'لم يتم تأكيده' : v.payment_status}</p></div><span className="text-sm font-bold">{v.review_status === 'rejected' ? 'مرفوضة سابقًا' : 'قيد المراجعة'}</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{(v.images || []).map((image,index)=><a key={image.url} href={image.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border bg-slate-50"><img src={image.url} alt={image.alt_text || ('صورة السيارة ' + (index+1))} className="h-28 w-full object-cover" loading="lazy"/></a>)}{(!v.images || v.images.length===0) && <p className="col-span-2 rounded-xl border border-dashed p-3 text-sm text-slate-500 sm:col-span-4">لا توجد صور متاحة لهذه السيارة؛ لا تعتمدها قبل التحقق من الصور.</p>}</div><div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><p><strong>العنوان:</strong> {v.address || 'غير مسجل'}</p><p><strong>المقاعد:</strong> {v.seats || 'غير محدد'}</p><p><strong>ناقل الحركة:</strong> {v.transmission === 'automatic' ? 'أوتوماتيك' : v.transmission === 'manual' ? 'مانيوال' : v.transmission || 'غير محدد'}</p><p><strong>السائق:</strong> {v.with_driver ? 'متاح بسائق' : 'بدون سائق'}</p>{v.yearly_price_egp != null && <p><strong>السعر السنوي:</strong> {Number(v.yearly_price_egp).toLocaleString('ar-EG')} جنيه</p>}{v.notes && <p className="sm:col-span-2"><strong>ملاحظات المالك:</strong> {v.notes}</p>}</div><div className="mt-4 flex gap-2"><button disabled={busyId===v.id} onClick={() => void reviewVehicle(v.id,'approved')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white"><CheckCircle2 size={16}/> اعتماد بيانات السيارة</button><button disabled={busyId===v.id} onClick={() => void reviewVehicle(v.id,'rejected')} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700"><XCircle size={16}/> رفض / طلب تعديل</button></div></article>)}{vehicles.length===0 && <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">لا توجد سيارات تنتظر المراجعة.</p>}</div></section>
      <section className="mt-8"><h2 className="text-xl font-extrabold">التحويلات المالية للمراجعة ({payments.length})</h2><div className="mt-4 space-y-3">{payments.map(p=><article key={p.id} className="rounded-2xl border bg-white p-5"><h3 className="font-extrabold">{Array.isArray(p.vehicles) ? p.vehicles[0]?.make : p.vehicles?.make} {Array.isArray(p.vehicles) ? p.vehicles[0]?.model : p.vehicles?.model} · {Array.isArray(p.organizations) ? p.organizations[0]?.name : p.organizations?.name}</h3><p className="mt-2 text-sm text-slate-600">{methodName[p.transfer_method] || p.transfer_method} · مرجع التحويل: <bdi>{p.transfer_reference}</bdi></p><p className="mt-1 text-sm text-slate-600">المبلغ: {Number(p.amount_egp).toLocaleString('ar-EG')} جنيه · {((Array.isArray(p.organizations) ? p.organizations[0]?.organization_type : p.organizations?.organization_type) === 'fleet_supplier') ? 'رسوم تسجيل مرة واحدة' : `المدة: ${p.period_months} شهر`}</p><p className="mt-1 text-xs text-slate-500">تاريخ الإرسال: {new Date(p.created_at).toLocaleString('ar-EG')}</p><div className="mt-4 flex gap-2"><button disabled={busyId===p.id} onClick={() => void reviewPayment(p,'approved')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white"><CheckCircle2 size={16}/> قبول التحويل</button><button disabled={busyId===p.id} onClick={() => void reviewPayment(p,'rejected')} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700"><XCircle size={16}/> رفض التحويل</button></div></article>)}{payments.length===0 && <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">لا توجد تحويلات تنتظر المراجعة.</p>}</div></section>
    </>}
    <p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">لأسباب أمنية، لا يمكن لأي مستخدم تفعيل صلاحية الإدارة من داخل الواجهة. يجب إضافة حساب المسؤول إلى جدول platform_admins من خلال إجراء إداري موثوق.</p>
  </div></main>
}
