import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Building2, CarFront, ClipboardList, FileText, ImagePlus, LogOut, MessageCircle, Plus, RefreshCw, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Role = 'company' | 'owner' | 'supplier'
type Organization = { id: string; name: string; organization_type: string }
type Vehicle = { id: string; make: string; model: string; model_year: number; vehicle_type: string; governorate: string; monthly_price_egp: number; review_status: string; payment_status: string; images?: { url: string; alt_text: string }[] }
type RentalOffer = { id: string; monthly_price_egp: number; yearly_price_egp: number | null; vehicle_count: number; message: string | null; status: string; organizations: { id: string; name: string } | { id: string; name: string }[] | null }
type RentalRequest = { id: string; title: string; vehicle_type: string; quantity: number; duration_type: string; duration_months: number; governorate: string; with_driver: boolean; status: string; created_at: string; rental_offers?: RentalOffer[] }

const names: Record<Role, string> = { company: 'مساحة الشركة', owner: 'مساحة مالك السيارة', supplier: 'مساحة مورد الأسطول' }
const governorates = ['القاهرة','الجيزة','الإسكندرية','القليوبية','البحيرة','مطروح','المنوفية','الغربية','كفر الشيخ','الدقهلية','دمياط','الشرقية','بورسعيد','الإسماعيلية','السويس','شمال سيناء','جنوب سيناء','بني سويف','الفيوم','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','الوادي الجديد']
const vehicleTypes = ['سيدان','SUV','ميكروباص','ميني باص','أتوبيس','نقل خفيف','نقل ثقيل','فان','أخرى']
const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
const primaryClass = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-extrabold text-white hover:bg-blue-800 disabled:opacity-50'

export default function WorkspacePage({ role }: { role: Role }) {
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [requests, setRequests] = useState<RentalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [offerRequest, setOfferRequest] = useState<string | null>(null)
  const [paymentVehicle, setPaymentVehicle] = useState<string | null>(null)
  const [photoPreviews, setPhotoPreviews] = useState<{ file: File; url: string }[]>([])
  const path = window.location.pathname
  const isVehicleForm = path.endsWith('/vehicles/new')
  const isRequestForm = path.endsWith('/requests/new')
  const isCompanyVehicles = role === 'company' && path.includes('/vehicles')
  const isRequestList = path.includes('/requests') && !isRequestForm
  const isSupplierRequestList = role !== 'company' && path.includes('/requests')

  async function loadWorkspace() {
    if (!supabase) { window.location.replace('/'); return }
    setLoading(true)
    setError('')
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) { window.location.replace('/?login=1'); return }
    const authUser = authData.user
    setUser({ id: authUser.id, name: String(authUser.user_metadata?.display_name || authUser.user_metadata?.organization_name || 'مستخدم Carhome'), email: authUser.email || authUser.phone || '' })
    const { data: memberships, error: membershipError } = await supabase.from('organization_memberships').select('organization_id, organizations(id,name,organization_type)').eq('user_id', authUser.id).limit(1)
    if (membershipError) { setError(membershipError.message); setLoading(false); return }
    const member = memberships?.[0] as unknown as { organization_id: string; organizations: Organization | Organization[] | null } | undefined
    const org = Array.isArray(member?.organizations) ? member?.organizations[0] : member?.organizations
    if (!member?.organization_id || !org) { setError('لم يتم ربط حسابك بمؤسسة بعد. سجّل الخروج ثم ادخل مجددًا، أو أعد إكمال التسجيل.'); setLoading(false); return }
    const expectedType = role === 'owner' ? 'individual_owner' : role === 'supplier' ? 'fleet_supplier' : 'company'
    if (org.organization_type !== expectedType) {
      const correctPath = org.organization_type === 'company' ? '/workspace/company' : org.organization_type === 'fleet_supplier' ? '/workspace/supplier/vehicles' : '/workspace/owner/vehicles'
      window.location.replace(correctPath)
      return
    }
    setOrganization({ ...org, id: member.organization_id })
    if (role === 'company') {
      if (isCompanyVehicles) {
        const result = await supabase.from('vehicles').select('id,make,model,model_year,vehicle_type,governorate,monthly_price_egp,review_status,payment_status').eq('review_status','approved').order('created_at',{ascending:false})
        if (result.error) setError(result.error.message); else setVehicles((result.data || []) as Vehicle[])
      } else {
        const result = await supabase.from('rental_requests').select('id,title,vehicle_type,quantity,duration_type,duration_months,governorate,with_driver,status,created_at,rental_offers(id,monthly_price_egp,yearly_price_egp,vehicle_count,message,status,organizations(id,name))').order('created_at',{ascending:false})
        if (result.error) setError(result.error.message); else setRequests((result.data || []) as unknown as RentalRequest[])
      }
    } else if (!isRequestForm && !isRequestList) {
      const result = await supabase.from('vehicles').select('id,make,model,model_year,vehicle_type,governorate,monthly_price_egp,review_status,payment_status').eq('organization_id',member.organization_id).order('created_at',{ascending:false})
      if (result.error) setError(result.error.message)
      else {
        const vehicleRows = (result.data || []) as Vehicle[]
        if (vehicleRows.length) {
          const imageResult = await supabase.from('vehicle_images').select('vehicle_id,storage_path,alt_text,sort_order').in('vehicle_id', vehicleRows.map(vehicle => vehicle.id)).order('sort_order', { ascending: true })
          if (imageResult.error) setError('تم تحميل السيارات، لكن تعذر تحميل صورها: ' + imageResult.error.message)
          const imageRows = imageResult.data || []
          const signedImages = await Promise.all(imageRows.map(async image => {
            const signed = await supabase.storage.from('vehicle-images').createSignedUrl(image.storage_path, 3600)
            return signed.error || !signed.data?.signedUrl ? null : { vehicle_id: image.vehicle_id, url: signed.data.signedUrl, alt_text: image.alt_text || 'صورة السيارة' }
          }))
          setVehicles(vehicleRows.map(vehicle => ({ ...vehicle, images: signedImages.filter((image): image is { vehicle_id: string; url: string; alt_text: string } => Boolean(image && image.vehicle_id === vehicle.id)).map(image => ({ url: image.url, alt_text: image.alt_text })) })))
        } else setVehicles([])
      }
    } else {
      const result = await supabase.from('rental_requests').select('id,title,vehicle_type,quantity,duration_type,duration_months,governorate,with_driver,status,created_at').eq('status','open').order('created_at',{ascending:false})
      if (result.error) setError(result.error.message); else setRequests((result.data || []) as RentalRequest[])
    }
    setLoading(false)
  }

  useEffect(() => { void loadWorkspace() }, [])

  async function signOut() { if (supabase) await supabase.auth.signOut(); window.location.replace('/') }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user || !organization) return
    setSaving(true); setError(''); setNotice('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const payload = {
      organization_id: organization.id, created_by: user.id,
      make: String(form.get('make') || '').trim(), model: String(form.get('model') || '').trim(),
      model_year: Number(form.get('model_year')), vehicle_type: String(form.get('vehicle_type') || ''),
      transmission: String(form.get('transmission') || 'automatic'), seats: Number(form.get('seats')),
      governorate: String(form.get('governorate') || ''), address: String(form.get('address') || '').trim(),
      monthly_price_egp: Number(form.get('monthly_price_egp')), yearly_price_egp: form.get('yearly_price_egp') ? Number(form.get('yearly_price_egp')) : null,
      with_driver: form.get('with_driver') === 'on', notes: String(form.get('notes') || '').trim() || null,
      review_status: 'pending_review', payment_status: 'pending'
    }
    const photos = photoPreviews.map(photo => photo.file)
    if (photos.length < 1 || photos.length > 8) { setError('أضف صورة واحدة على الأقل، وبحد أقصى 8 صور للسيارة.'); setSaving(false); return }
    if (photos.some(photo => !['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size > 8 * 1024 * 1024)) { setError('الصور المقبولة JPG أو PNG أو WEBP، وبحد أقصى 8 ميجابايت للصورة الواحدة.'); setSaving(false); return }
    const { data: savedVehicle, error: saveError } = await supabase.from('vehicles').insert(payload).select('id').single()
    if (saveError || !savedVehicle) { setSaving(false); setError(saveError?.message.includes('Could not find the table') ? 'قاعدة بيانات السيارات لم تُفعّل بعد. يلزم تطبيق Migration السيارات والطلبات أولًا.' : saveError?.message || 'تعذر حفظ السيارة.'); return }
    const uploadedPaths: string[] = []
    let photoError = ''
    for (const [index, photo] of photos.entries()) {
      const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'vehicle-photo'
      const storagePath = organization.id + '/' + savedVehicle.id + '/' + crypto.randomUUID() + '-' + safeName
      const upload = await supabase.storage.from('vehicle-images').upload(storagePath, photo, { contentType: photo.type, upsert: false })
      if (upload.error) { photoError = upload.error.message; break }
      uploadedPaths.push(storagePath)
    }
    if (!photoError) {
      const imageRows = uploadedPaths.map((storage_path, index) => ({ vehicle_id: savedVehicle.id, organization_id: organization.id, storage_path, alt_text: payload.make + ' ' + payload.model, sort_order: index, created_by: user.id }))
      const { error: imageInsertError } = await supabase.from('vehicle_images').insert(imageRows)
      if (imageInsertError) photoError = imageInsertError.message
    }
    if (photoError && uploadedPaths.length) await supabase.storage.from('vehicle-images').remove(uploadedPaths)
    setSaving(false)
    if (photoError) {
      setError('تم حفظ بيانات السيارة، لكن تعذر حفظ الصور. جرّب رفعها مرة أخرى أو تواصل مع الدعم. التفاصيل: ' + photoError)
      formElement.reset()
      photoPreviews.forEach(photo => URL.revokeObjectURL(photo.url))
      setPhotoPreviews([])
      await loadWorkspace()
      return
    }
    setNotice('تم حفظ السيارة ورفع ' + photos.length + ' صور بنجاح. السيارة قيد مراجعة الإدارة وحالة الدفع معلّقة؛ لم يتم تحصيل أي مبلغ من خلال المنصة.')
    formElement.reset()
    photoPreviews.forEach(photo => URL.revokeObjectURL(photo.url))
    setPhotoPreviews([])
    await loadWorkspace()
  }

  async function saveRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user || !organization) return
    setSaving(true); setError(''); setNotice('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const durationType = String(form.get('duration_type') || 'monthly')
    const payload = {
      organization_id: organization.id, created_by: user.id,
      title: String(form.get('title') || '').trim(), vehicle_type: String(form.get('vehicle_type') || ''),
      quantity: Number(form.get('quantity')), duration_type: durationType,
      duration_months: durationType === 'yearly' ? Number(form.get('duration_months') || 12) : Number(form.get('duration_months') || 1),
      governorate: String(form.get('governorate') || ''), with_driver: form.get('with_driver') === 'on',
      details: String(form.get('details') || '').trim() || null, status: 'open'
    }
    const { error: saveError } = await supabase.from('rental_requests').insert(payload)
    setSaving(false)
    if (saveError) { setError(saveError.message.includes('Could not find the table') ? 'قاعدة بيانات الطلبات لم تُفعّل بعد. يلزم تطبيق Migration السيارات والطلبات أولًا.' : saveError.message); return }
    setNotice('تم نشر طلب التأجير بنجاح، ويمكن لملاك السيارات وموردي الأساطيل الاطلاع عليه وتقديم عروض.')
    formElement.reset()
    await loadWorkspace()
  }

  async function saveOffer(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault()
    if (!supabase || !user || !organization) return
    setSaving(true); setError(''); setNotice('')
    const form = new FormData(event.currentTarget)
    const payload = {
      request_id: requestId, organization_id: organization.id, created_by: user.id,
      monthly_price_egp: Number(form.get('monthly_price_egp')),
      yearly_price_egp: form.get('yearly_price_egp') ? Number(form.get('yearly_price_egp')) : null,
      vehicle_count: Number(form.get('vehicle_count')),
      message: String(form.get('message') || '').trim() || null, status: 'submitted'
    }
    const { error: saveError } = await supabase.from('rental_offers').insert(payload)
    setSaving(false)
    if (saveError) { setError(saveError.code === '23505' ? 'سبق أن قدمت عرضًا لهذا الطلب.' : saveError.message.includes('Could not find the table') ? 'قاعدة بيانات العروض لم تُفعّل بعد. يلزم تطبيق Migration السيارات والطلبات أولًا.' : saveError.message); return }
    setOfferRequest(null)
    setNotice('تم إرسال عرضك للشركة. يمكنك متابعة الاتفاق والتواصل في الخطوات التالية من المنصة.')
  }

  async function startConversation(requestId: string, providerOrganizationId: string) {
    if (!supabase || !user || !organization) return
    setError(''); setNotice('')
    const { data: existing, error: lookupError } = await supabase.from('conversations').select('id').eq('request_id',requestId).eq('company_organization_id',organization.id).eq('provider_organization_id',providerOrganizationId).maybeSingle()
    if (lookupError) { setError(lookupError.message); return }
    if (existing?.id) { window.location.href='/workspace/company/messages?conversation='+existing.id; return }
    const { data, error: createError } = await supabase.from('conversations').insert({ request_id:requestId, company_organization_id:organization.id, provider_organization_id:providerOrganizationId, created_by:user.id }).select('id').single()
    if (createError) { setError(createError.message); return }
    window.location.href='/workspace/company/messages?conversation='+data.id
  }

  async function submitTransfer(event: FormEvent<HTMLFormElement>, vehicle: Vehicle) {
    event.preventDefault()
    if (!supabase || !user || !organization) return
    setSaving(true); setError(''); setNotice('')
    const form = new FormData(event.currentTarget)
    const months = Number(form.get('period_months') || 1)
    const payload = {
      vehicle_id: vehicle.id, organization_id: organization.id, submitted_by: user.id,
      amount_egp: 300 * months, period_months: months,
      transfer_method: String(form.get('transfer_method') || 'instapay'),
      transfer_reference: String(form.get('transfer_reference') || '').trim(),
      review_status: 'pending'
    }
    const { error: saveError } = await supabase.from('vehicle_payment_submissions').insert(payload)
    setSaving(false)
    if (saveError) { setError(saveError.message.includes('Could not find the table') ? 'نموذج التحويل لم يُفعّل بعد. يلزم تطبيق Migration مراجعة التحويلات.' : saveError.message); return }
    setPaymentVehicle(null)
    setNotice('تم تسجيل بيانات التحويل للمراجعة الإدارية. لن تُعتمد حالة الدفع حتى يراجع المسؤول المرجع.')
  }

  if (loading || !user) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">جارٍ تحميل مساحة العمل...</main>

  const header = <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5"><div><p className="text-sm font-bold text-blue-700">Carhome</p><h1 className="mt-1 text-2xl font-extrabold text-slate-950">{names[role]}</h1><p className="mt-2 text-sm text-slate-500">{user.name} · {user.email} · {organization?.name}</p></div><div className="flex gap-2"><button onClick={() => void loadWorkspace()} className="rounded-xl border px-3 py-2 text-sm font-bold"><RefreshCw size={16}/></button><button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><LogOut size={16}/> تسجيل الخروج</button></div></header>
  const feedback = <>{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}</>
  const vehicleForm = <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 sm:p-8"><button onClick={() => { window.location.href = role === 'owner' ? '/workspace/owner/vehicles' : '/workspace/supplier/vehicles' }} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700"><ArrowLeft size={17}/> رجوع لمساحة العمل</button><h2 className="text-2xl font-extrabold text-slate-950">تسجيل سيارة جديدة</h2><p className="mt-2 text-sm leading-7 text-slate-600">أدخل البيانات بدقة. ستظهر السيارة للشركات بعد اعتماد الإدارة واستيفاء متطلبات الدفع خارج المنصة.</p><form onSubmit={saveVehicle} className="mt-6 grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-bold">الماركة *<input name="make" required maxLength={80} className={fieldClass} placeholder="مثال: Toyota"/></label>
    <label className="text-sm font-bold">الموديل *<input name="model" required maxLength={100} className={fieldClass} placeholder="مثال: Corolla"/></label>
    <label className="text-sm font-bold">سنة الصنع *<input name="model_year" type="number" required min={1990} max={2100} defaultValue={new Date().getFullYear()} className={fieldClass}/></label>
    <label className="text-sm font-bold">نوع السيارة *<select name="vehicle_type" required className={fieldClass}><option value="">اختر النوع</option>{vehicleTypes.map(v=><option key={v}>{v}</option>)}</select></label>
    <label className="text-sm font-bold">ناقل الحركة *<select name="transmission" className={fieldClass}><option value="automatic">أوتوماتيك</option><option value="manual">مانيوال</option></select></label>
    <label className="text-sm font-bold">عدد المقاعد *<input name="seats" type="number" required min={2} max={60} defaultValue={5} className={fieldClass}/></label>
    <label className="text-sm font-bold">المحافظة *<select name="governorate" required className={fieldClass}><option value="">اختر المحافظة</option>{governorates.map(g=><option key={g}>{g}</option>)}</select></label>
    <label className="text-sm font-bold">العنوان التفصيلي *<input name="address" required maxLength={300} className={fieldClass} placeholder="المنطقة والشارع"/></label>
    <label className="text-sm font-bold">السعر الشهري بالجنيه *<input name="monthly_price_egp" type="number" required min={0} step="0.01" className={fieldClass}/></label>
    <label className="text-sm font-bold">السعر السنوي بالجنيه (اختياري)<input name="yearly_price_egp" type="number" min={0} step="0.01" className={fieldClass}/></label>
    <label className="flex items-center gap-3 rounded-xl border p-4 text-sm font-bold sm:col-span-2"><input type="checkbox" name="with_driver" className="h-4 w-4"/> السيارة متاحة بسائق</label>
    <label className="text-sm font-bold sm:col-span-2">صور السيارة *<span className="mt-2 block rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-5"><span className="flex items-center gap-3 text-blue-800"><ImagePlus size={24}/><span><span className="block font-extrabold">ارفع صور سيارتك</span><span className="mt-1 block text-xs font-medium text-slate-500">من 1 إلى 8 صور · JPG أو PNG أو WEBP · 8 ميجابايت كحد أقصى للصورة</span></span></span><input name="vehicle_photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(event) => { photoPreviews.forEach(photo => URL.revokeObjectURL(photo.url)); const files = Array.from(event.currentTarget.files || []).slice(0, 8); setPhotoPreviews(files.map(file => ({ file, url: URL.createObjectURL(file) }))); if ((event.currentTarget.files?.length || 0) > 8) setError('تم اختيار أكثر من 8 صور؛ سيتم استخدام أول 8 صور فقط.') }} className="mt-4 block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:font-bold file:text-white"/></span></label>
    {photoPreviews.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:col-span-2">{photoPreviews.map((photo,index)=><div key={photo.url} className="relative overflow-hidden rounded-xl border bg-slate-50"><img src={photo.url} alt={'معاينة صورة السيارة '+(index+1)} className="h-32 w-full object-cover"/><button type="button" onClick={() => { URL.revokeObjectURL(photo.url); setPhotoPreviews(current => current.filter(item => item.url !== photo.url)); }} className="absolute left-2 top-2 rounded-full bg-white/95 p-1 text-slate-700 shadow" aria-label="حذف الصورة من الاختيار"><X size={16}/></button><p className="truncate px-2 py-1 text-xs text-slate-600">{photo.file.name}</p></div>)}</div>}
    <label className="text-sm font-bold sm:col-span-2">ملاحظات إضافية<textarea name="notes" maxLength={2000} rows={3} className={fieldClass} placeholder="حالة السيارة أو شروط التأجير"/></label>
    {role === 'owner' && <div className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900 sm:col-span-2"><strong>رسوم التسجيل:</strong> 300 جنيه لكل سيارة شهريًا. بعد حفظ البيانات، ستظل حالة السيارة «قيد المراجعة» وحالة الدفع «معلّق» إلى أن يتم التحويل والتحقق الإداري. لا يوجد دفع إلكتروني داخل المنصة حاليًا.</div>}
    <button disabled={saving} className={primaryClass+' sm:col-span-2'}>{saving ? 'جارٍ الحفظ...' : 'حفظ وإرسال للمراجعة'} <CarFront size={18}/></button>
  </form></section>
  const requestForm = <section className="mt-6 rounded-3xl border bg-white p-6 sm:p-8"><button onClick={() => { window.location.href='/workspace/company/requests' }} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700"><ArrowLeft size={17}/> رجوع لطلبات الشركة</button><h2 className="text-2xl font-extrabold">إنشاء طلب تأجير سيارات</h2><p className="mt-2 text-sm leading-7 text-slate-600">وضّح احتياج شركتك ليتمكن الملاك وموردو الأساطيل من تقديم عروض مناسبة.</p><form onSubmit={saveRequest} className="mt-6 grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-bold">عنوان الطلب *<input name="title" required minLength={3} maxLength={140} className={fieldClass} placeholder="مثال: سيارات لفريق المبيعات"/></label>
    <label className="text-sm font-bold">نوع السيارة *<select name="vehicle_type" required className={fieldClass}><option value="">اختر النوع</option>{vehicleTypes.map(v=><option key={v}>{v}</option>)}</select></label>
    <label className="text-sm font-bold">عدد السيارات *<input name="quantity" type="number" required min={1} max={500} defaultValue={1} className={fieldClass}/></label>
    <label className="text-sm font-bold">مدة التأجير *<select name="duration_type" className={fieldClass}><option value="monthly">شهري</option><option value="yearly">سنوي</option></select></label>
    <label className="text-sm font-bold">مدة العقد بالأشهر *<input name="duration_months" type="number" required min={1} max={60} defaultValue={12} className={fieldClass}/></label>
    <label className="text-sm font-bold">المحافظة *<select name="governorate" required className={fieldClass}><option value="">اختر المحافظة</option>{governorates.map(g=><option key={g}>{g}</option>)}</select></label>
    <label className="flex items-center gap-3 rounded-xl border p-4 text-sm font-bold sm:col-span-2"><input type="checkbox" name="with_driver" className="h-4 w-4"/> مطلوب سيارات بسائق</label>
    <label className="text-sm font-bold sm:col-span-2">تفاصيل الطلب<textarea name="details" rows={4} maxLength={3000} className={fieldClass} placeholder="مواعيد التشغيل، عدد أيام العمل، متطلبات إضافية..."/></label>
    <button disabled={saving} className={primaryClass+' sm:col-span-2'}>{saving ? 'جارٍ النشر...' : 'نشر طلب التأجير'} <Plus size={18}/></button>
  </form></section>

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl">{header}
    {feedback}
    {isVehicleForm ? vehicleForm : isRequestForm ? requestForm : role === 'company' ? <>{!isCompanyVehicles && !isRequestList ? <section className="mt-6 rounded-3xl bg-slate-950 p-7 text-white"><h2 className="text-2xl font-extrabold">إدارة احتياجات تأجير السيارات</h2><p className="mt-3 text-sm leading-7 text-slate-300">أنشئ طلبات التأجير، وتابع الطلبات والعروض، واستعرض السيارات المعتمدة.</p><div className="mt-5 flex flex-wrap gap-3"><a className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-extrabold text-slate-950" href="/workspace/company/requests/new"><Plus size={18}/> إنشاء طلب</a><a className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-5 font-bold text-white" href="/workspace/company/requests"><ClipboardList size={18}/> طلباتي</a><a className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-5 font-bold text-white" href="/workspace/company/vehicles"><CarFront size={18}/> السيارات المتاحة</a></div></section> : <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-extrabold">{isCompanyVehicles ? 'السيارات المعتمدة المتاحة' : 'طلبات التأجير'}</h2>{isRequestList && <a className={primaryClass} href="/workspace/company/requests/new"><Plus size={17}/> طلب جديد</a>}</div>}
      {isCompanyVehicles ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{vehicles.map(v=><article key={v.id} className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold text-emerald-700">{v.governorate}</p><h3 className="mt-2 text-lg font-extrabold">{v.make} {v.model} · {v.model_year}</h3><p className="mt-2 text-sm text-slate-600">{v.vehicle_type}</p><p className="mt-4 font-extrabold text-blue-800">{Number(v.monthly_price_egp).toLocaleString('ar-EG')} جنيه / شهر</p></article>)}</div> : isRequestList ? <div className="mt-5 space-y-3">{requests.map(r=><article key={r.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{r.title}</h3><p className="mt-2 text-sm text-slate-600">{r.vehicle_type} · {r.quantity} سيارة · {r.governorate}</p><p className="mt-1 text-sm text-slate-500">{r.duration_type === 'yearly' ? 'سنوي' : 'شهري'} · {r.duration_months} شهر · {r.with_driver ? 'بسائق' : 'بدون سائق'}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{r.status === 'open' ? 'مفتوح لاستقبال العروض' : r.status}</span></div><div className="mt-4 border-t pt-4"><h4 className="font-bold">العروض المستلمة ({r.rental_offers?.length || 0})</h4>{(r.rental_offers || []).map(o=><div key={o.id} className="mt-3 rounded-xl bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{(Array.isArray(o.organizations) ? o.organizations[0]?.name : o.organizations?.name) || 'مورد أسطول'}</strong><strong className="text-blue-800">{Number(o.monthly_price_egp).toLocaleString('ar-EG')} جنيه / شهر</strong></div><p className="mt-1 text-sm text-slate-600">عدد السيارات المعروضة: {o.vehicle_count}</p>{o.yearly_price_egp ? <p className="mt-1 text-sm text-slate-600">السعر السنوي: {Number(o.yearly_price_egp).toLocaleString('ar-EG')} جنيه</p> : null}{o.message && <p className="mt-2 text-sm leading-6 text-slate-600">{o.message}</p>}<button onClick={() => void startConversation(r.id,(Array.isArray(o.organizations) ? o.organizations[0]?.id : o.organizations?.id) || '')} disabled={!(Array.isArray(o.organizations) ? o.organizations[0]?.id : o.organizations?.id)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-800 disabled:opacity-50"><MessageCircle size={16}/> بدء مراسلة داخل المنصة</button></div>)}{(!r.rental_offers || r.rental_offers.length===0) && <p className="mt-2 text-sm text-slate-500">لم تصل عروض لهذا الطلب حتى الآن.</p>}</div></article>)}{requests.length===0 && <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-slate-600">لا توجد طلبات بعد. أنشئ أول طلب لتبدأ استقبال العروض.</div>}</div> : <div className="mt-5 rounded-2xl border bg-white p-6 text-sm text-slate-600">مرحبًا بك. اختر أحد المسارات من القائمة.</div>}
    </> : isSupplierRequestList ? <><h2 className="mt-6 text-xl font-extrabold">طلبات الشركات المفتوحة</h2><div className="mt-4 space-y-3">{requests.map(r=><article key={r.id} className="rounded-2xl border bg-white p-5"><h3 className="font-extrabold">{r.title}</h3><p className="mt-2 text-sm text-slate-600">{r.vehicle_type} · {r.quantity} سيارة · {r.governorate} · {r.duration_months} شهر</p><p className="mt-1 text-sm text-slate-500">{r.with_driver ? 'مطلوب بسائق' : 'بدون سائق محدد'}</p><button onClick={() => setOfferRequest(offerRequest === r.id ? null : r.id)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white"><FileText size={16}/>{offerRequest === r.id ? 'إغلاق نموذج العرض' : 'تقديم عرض للشركة'}</button>{offerRequest === r.id && <form onSubmit={(event) => void saveOffer(event,r.id)} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"><label className="text-sm font-bold">السعر الشهري بالجنيه *<input name="monthly_price_egp" type="number" min={0} step="0.01" required className={fieldClass}/></label><label className="text-sm font-bold">السعر السنوي (اختياري)<input name="yearly_price_egp" type="number" min={0} step="0.01" className={fieldClass}/></label><label className="text-sm font-bold">عدد السيارات التي تعرضها *<input name="vehicle_count" type="number" min={1} max={500} defaultValue={r.quantity} required className={fieldClass}/></label><label className="text-sm font-bold sm:col-span-2">رسالة توضيحية<textarea name="message" rows={2} maxLength={2000} className={fieldClass} placeholder="وضح تفاصيل العرض وشروطه"/></label><button disabled={saving} className={primaryClass+" sm:col-span-2"}>{saving ? 'جارٍ إرسال العرض...' : 'إرسال العرض'}</button></form>}</article>)}{requests.length===0 && <p className="rounded-2xl border bg-white p-6 text-slate-600">لا توجد طلبات مفتوحة حاليًا.</p>}</div></> : <><section className="mt-6 rounded-3xl bg-slate-950 p-7 text-white"><h2 className="text-2xl font-extrabold">{role === 'owner' ? 'إدارة سياراتك' : 'إدارة سيارات الأسطول'}</h2><p className="mt-3 text-sm leading-7 text-slate-300">{role === 'owner' ? 'رسوم تسجيل السيارة 300 جنيه شهريًا لكل سيارة. لا تُعتمد السيارة إلا بعد التحويل ومراجعة الإدارة.' : 'سجّل سيارات الأسطول وأرسل بياناتها للمراجعة قبل ظهورها للشركات.'}</p><a href={role === 'owner' ? '/workspace/owner/vehicles/new' : '/workspace/supplier/vehicles/new'} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-extrabold text-slate-950"><Plus size={18}/> تسجيل سيارة جديدة</a><a href={role === 'owner' ? '/workspace/owner/requests' : '/workspace/supplier/requests'} className="mt-5 me-3 inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-5 font-bold text-white"><ClipboardList size={18}/> طلبات الشركات</a></section><div className="mt-6 flex items-center justify-between"><h2 className="text-xl font-extrabold">سياراتك المسجلة</h2><span className="text-sm text-slate-500">{vehicles.length} سيارة</span></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{vehicles.map(v=><article key={v.id} className="overflow-hidden rounded-2xl border bg-white"><div className="grid grid-cols-2 gap-1 bg-slate-100">{(v.images || []).slice(0,4).map((image,index)=><img key={image.url} src={image.url} alt={image.alt_text || (v.make+' '+v.model)} className={index===0 && (v.images?.length || 0)===1 ? 'col-span-2 h-44 w-full object-cover' : 'h-28 w-full object-cover'}/>)}{(!v.images || v.images.length===0) && <div className="col-span-2 grid h-32 place-items-center text-sm text-slate-400"><ImagePlus size={24}/><span>لا توجد صور متاحة</span></div>}</div><div className="p-5"><h3 className="font-extrabold">{v.make} {v.model} · {v.model_year}</h3><p className="mt-2 text-sm text-slate-600">{v.vehicle_type} · {v.governorate}</p><p className="mt-3 text-sm font-bold text-blue-800">{Number(v.monthly_price_egp).toLocaleString('ar-EG')} جنيه / شهر</p><p className="mt-3 text-xs text-slate-500">حالة السيارة: {v.review_status === 'pending_review' ? 'قيد مراجعة الإدارة' : v.review_status === 'approved' ? 'معتمدة' : v.review_status === 'rejected' ? 'تحتاج تعديلًا' : 'متوقفة'} · الدفع: {v.payment_status === 'pending' ? 'معلّق' : v.payment_status}</p></div>{role === 'owner' && v.payment_status !== 'verified' && <><button onClick={() => setPaymentVehicle(paymentVehicle===v.id ? null : v.id)} className="mt-4 min-h-10 rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-800">{paymentVehicle===v.id ? 'إغلاق نموذج التحويل' : 'تسجيل تحويل رسوم السيارة'}</button>{paymentVehicle===v.id && <form onSubmit={(event)=>void submitTransfer(event,v)} className="mt-4 space-y-3 border-t pt-4"><p className="text-sm leading-6 text-slate-600">300 جنيه لكل شهر لكل سيارة. أدخل مرجع التحويل الفعلي؛ هذا النموذج لا ينفذ التحويل بنفسه.</p><label className="block text-sm font-bold">مدة الرسوم بالشهور *<select name="period_months" defaultValue="1" className={fieldClass}><option value="1">شهر واحد — 300 جنيه</option><option value="3">3 شهور — 900 جنيه</option><option value="6">6 شهور — 1,800 جنيه</option><option value="12">12 شهرًا — 3,600 جنيه</option></select></label><label className="block text-sm font-bold">طريقة التحويل *<select name="transfer_method" className={fieldClass}><option value="instapay">InstaPay</option><option value="vodafone_cash">Vodafone Cash</option><option value="bank_transfer">تحويل بنكي</option></select></label><label className="block text-sm font-bold">رقم مرجع التحويل *<input name="transfer_reference" required minLength={3} maxLength={160} className={fieldClass} placeholder="أدخل رقم العملية كما يظهر في تطبيق التحويل"/></label><button disabled={saving} className={primaryClass+" w-full"}>{saving ? 'جارٍ الإرسال...' : 'إرسال للتحقق الإداري'}</button></form>}</>}</article>)}{vehicles.length===0 && <p className="rounded-2xl border border-dashed bg-white p-6 text-sm text-slate-600">لم تسجل سيارات بعد. ابدأ بإضافة أول سيارة.</p>}</div></>}
    <footer className="mt-8 flex flex-wrap gap-4 border-t py-5 text-sm text-slate-500"><a href="/" className="hover:text-blue-700">الرئيسية</a>{role === 'company' && <><a href="/workspace/company/requests" className="hover:text-blue-700">طلبات التأجير</a><a href="/workspace/company/vehicles" className="hover:text-blue-700">السيارات المتاحة</a></>}<span className="inline-flex items-center gap-2"><Building2 size={15}/> مساحة عمل آمنة</span><a href={'/workspace/'+role+'/messages'} className="inline-flex items-center gap-2 hover:text-blue-700"><MessageCircle size={15}/> المراسلات الداخلية</a><span><FileText size={15} className="inline"/> لا توجد بيانات تجريبية معروضة</span></footer>
  </div></main>
}
