import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Building2, CarFront, Wrench, ClipboardList, FileText, ImagePlus, LogOut, MessageCircle, Plus, RefreshCw, X, Clock3, CheckCircle2, XCircle, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { vehicleCatalog } from '../data/vehicleCatalog'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'

type Role = 'company' | 'owner' | 'supplier'
type Organization = { id: string; name: string; organization_type: string }
type Vehicle = { id: string; make: string; model: string; model_year: number; vehicle_type: string; governorate: string; monthly_price_egp: number; review_status: string; payment_status: string; images?: { url: string; alt_text: string }[] }
type RentalOffer = { id: string; monthly_price_egp: number; yearly_price_egp: number | null; vehicle_count: number; message: string | null; status: string; organizations: { id: string; name: string } | { id: string; name: string }[] | null }
type RentalRequest = { id: string; title: string; details: string | null; vehicle_type: string; quantity: number; duration_type: string; duration_months: number; governorate: string; with_driver: boolean; status: string; created_at: string; rental_offers?: RentalOffer[] }
type SubmittedOffer = { id: string; monthly_price_egp: number; yearly_price_egp: number | null; vehicle_count: number; message: string | null; status: 'submitted' | 'accepted' | 'rejected' | 'withdrawn' | string; created_at: string; updated_at: string; rental_requests: { id: string; title: string; vehicle_type: string; quantity: number; governorate: string; status: string } | null }

const names: Record<Role, string> = { company: 'مساحة الشركة', owner: 'مساحة مالك السيارة', supplier: 'مساحة مورد الأسطول' }
const governorates = ['الإسكندرية','القاهرة','الجيزة']
const vehicleTypes = ['سيدان','SUV','ميكروباص','ميني باص','أتوبيس','نقل خفيف','نقل ثقيل','فان','أخرى']

function requestAgeLabel(createdAt: string, now = Date.now()) {
  const publishedAt = new Date(createdAt).getTime()
  if (!Number.isFinite(publishedAt)) return 'تاريخ النشر غير متاح'
  const elapsed = Math.max(0, now - publishedAt)
  const minutes = Math.floor(elapsed / 60000)
  if (minutes < 60) return minutes < 5 ? 'جديد' : `منذ ${minutes} دقيقة`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours < 2 ? 'منذ ساعة' : `منذ ${hours} ساعة`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'منذ يوم'
  if (days < 11) return `منذ ${days} أيام`
  return `منذ ${days} يومًا`
}

function inferVehicleProfile(make: string, model: string): { type: string; seats: number; confidence: 'high' | 'medium' | 'low' } {
  const text = `${make} ${model}`.toLowerCase()
  const has = (terms: string[]) => terms.some(term => text.includes(term.toLowerCase()))
  if (has(['hiace','urvan','staria','h-1','sprinter','transit','ducato','daily','toano','sunray','view','gran max','doblo','kangoo','dokker','berlingo','partner','expert','boxer','citan','v-class','carnival','odyssey','pacifica','voyager','carens','xpander','ertiga','xl7','apv','innova','avanza','veloz','livina','confero','g10','g50','g9','dream'])) return { type: 'فان', seats: has(['hiace','urvan','sprinter','transit','daily','toano','sunray','view','ducato','boxer','expert']) ? 12 : 7, confidence: 'medium' }
  if (has(['coaster','county','rosa','civilian','higer','king long','yutong','tourismo','marcopolo','school bus','minibus','ميني باص'])) return { type: 'ميني باص', seats: 24, confidence: 'high' }
  if (has(['bus','أتوبيس','autobus','coach','volvo b'])) return { type: 'أتوبيس', seats: 45, confidence: 'high' }
  if (has(['f-150','ranger','hilux','l200','d-max','poer','wingle','tunland','ram ','1500','2500','3500','canyon','sierra','yodha','pik up','pickup'])) return { type: 'نقل خفيف', seats: 5, confidence: 'medium' }
  if (has(['f-series','eurocargo','s-way','stralis','n-series','t-series','n300','proMaster','cargo','truck','نقل ثقيل'])) return { type: 'نقل ثقيل', seats: 3, confidence: 'medium' }
  if (has(['land cruiser','prado','fortuner','palisade','santa fe','sorento','telluride','pilot','highlander','pathfinder','patrol','terra','explorer','expedition','tahoe','suburban','yukon','durango','grand cherokee','commander','gls','gle','x7','x5','xc90','q7','q8','rx8','tiggo 8','h9','tank 500','okavango','teramont','touareg','cayenne','range rover','defender','discovery','mohave','ev9'])) return { type: 'SUV', seats: has(['palisade','santa fe','sorento','telluride','pilot','highlander','pathfinder','patrol','explorer','expedition','tahoe','suburban','yukon','gls','x7','xc90','q7','land cruiser','prado','fortuner','teramont','ev9','tank 500']) ? 7 : 5, confidence: 'medium' }
  if (has(['suv','crossover','tucson','sportage','creta','duster','captiva','captur','kicks','qashqai','x-trail','rav4','rush','raize','chr','c-hr','kona','venue','jolion','h6','tiggo 3','tiggo 4','tiggo 7','mg zs','mg hs','rx5','rx8','coolray','cs35','cs55','cs75','emzoom','emkoo','dashing','x70','x90','asx','outlander','pajero','eclipse cross','cx-3','cx-30','cx-5','cx-60','cx-9','cx-90','x1','x2','x3','x4','x6','x5','gla','glb','glc','eqa','eqb','q2','q3','q5','macan','ux','nx','rx','gx','lx','model y','model x','id.4','id.6','eletre'])) return { type: 'SUV', seats: 5, confidence: 'medium' }
  if (has(['microbus','ميكروباص','jumper','ducato passenger','n300','gran max'])) return { type: 'ميكروباص', seats: 14, confidence: 'medium' }
  if (has(['lorry','tractor','prime mover','heavy duty'])) return { type: 'نقل ثقيل', seats: 3, confidence: 'low' }
  if (has(['corolla','yaris','sunny','sentra','elantra','accent','cerato','picanto','rio','optra','aveo','lanos','cruze','logan','megane','flu ence','fluenc','symbol','301','206','208','tipo','linea','city','civic','accord','mazda 2','mazda 3','mazda 6','lancer','attrage','swift','baleno','ciaz','octavia','rapid','jetta','golf','polo','passat','c-class','e-class','a-class','3 series','5 series','series 3','series 5','a3','a4','a6','camry','verna','f3','mg 5','mg 6','mg 7','emgrand','arrizo','model 3','model s','model 7','s-class','is ','es ','gs ','ls '])) return { type: 'سيدان', seats: 5, confidence: 'medium' }
  return { type: 'سيدان', seats: 5, confidence: 'low' }
}
const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
const primaryClass = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-extrabold text-white hover:bg-blue-800 disabled:opacity-50'

export default function WorkspacePage({ role }: { role: Role }) {
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [requests, setRequests] = useState<RentalRequest[]>([])
  const [submittedOffers, setSubmittedOffers] = useState<SubmittedOffer[]>([])
  const [offeredRequestIds, setOfferedRequestIds] = useState<Set<string>>(new Set())
  const [ageClock, setAgeClock] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingStage, setSavingStage] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [offerRequest, setOfferRequest] = useState<string | null>(null)
  const [paymentVehicle, setPaymentVehicle] = useState<string | null>(null)
  const [paymentSubmissions, setPaymentSubmissions] = useState<Record<string, string>>({})
  const [photoPreviews, setPhotoPreviews] = useState<{ file: File; url: string }[]>([])
  const [selectedMake, setSelectedMake] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [inferredType, setInferredType] = useState('')
  const [inferredSeats, setInferredSeats] = useState(5)
  const [profileConfidence, setProfileConfidence] = useState<'high' | 'medium' | 'low'>('low')
  const path = window.location.pathname
  const isVehicleForm = path.endsWith('/vehicles/new')
  const isRequestForm = path.endsWith('/requests/new')
  const isCompanyVehicles = role === 'company' && path.includes('/vehicles')
  const isRequestList = path.includes('/requests') && !isRequestForm
  const isSupplierRequestList = role !== 'company' && path.includes('/requests')
  const isOfferTracking = role !== 'company' && path.endsWith('/offers')

  async function loadWorkspace() {
    if (!supabase) { window.location.replace('/?login=1'); return }
    const client = supabase
    setLoading(true)
    setError('')
    const { data: authData, error: authError } = await client.auth.getUser()
    if (authError || !authData.user) { window.location.replace('/?login=1'); return }
    const authUser = authData.user
    setUser({ id: authUser.id, name: String(authUser.user_metadata?.display_name || authUser.user_metadata?.organization_name || 'مستخدم My Car'), email: authUser.email || authUser.phone || '' })
    const welcomePending = localStorage.getItem('mycar_welcome_banner') === '1'
    if (welcomePending) {
      setNotice('أهلًا بك في My Car! تم تأكيد بريدك وتجهيز حسابك بنجاح. نتمنى لك تجربة موفقة.')
    }
    const { data: memberships, error: membershipError } = await client.from('organization_memberships').select('organization_id, organizations(id,name,organization_type)').eq('user_id', authUser.id).limit(1)
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
    if (welcomePending) localStorage.removeItem('mycar_welcome_banner')
    if (role === 'company') {
      if (isCompanyVehicles) {
        const result = await client.from('vehicles').select('id,make,model,model_year,vehicle_type,governorate,monthly_price_egp,review_status,payment_status').eq('review_status','approved').eq('payment_status','verified').order('created_at',{ascending:false})
        if (result.error) setError(result.error.message); else setVehicles((result.data || []) as Vehicle[])
      } else {
        const result = await client.from('rental_requests').select('id,title,details,vehicle_type,quantity,duration_type,duration_months,governorate,with_driver,status,created_at,rental_offers(id,monthly_price_egp,yearly_price_egp,vehicle_count,message,status,organizations(id,name))').eq('organization_id', member.organization_id).order('created_at',{ascending:false})
        if (result.error) setError(result.error.message); else setRequests((result.data || []) as unknown as RentalRequest[])
        if (path === '/workspace/company') {
          const cars = await client.from('vehicles').select('id,make,model,model_year,vehicle_type,governorate,monthly_price_egp,review_status,payment_status').eq('review_status','approved').eq('payment_status','verified').order('created_at',{ascending:false}).limit(4)
          if (!cars.error) setVehicles((cars.data || []) as Vehicle[])
        }
      }
    } else if (isOfferTracking) {
      const result = await client.from('rental_offers').select('id,monthly_price_egp,yearly_price_egp,vehicle_count,message,status,created_at,updated_at,rental_requests(id,title,vehicle_type,quantity,governorate,status)').eq('organization_id', member.organization_id).order('created_at', { ascending: false })
      if (result.error) setError('تعذر تحميل عروضك المقدمة: ' + result.error.message)
      else setSubmittedOffers((result.data || []) as unknown as SubmittedOffer[])
    } else if (!isRequestForm && !isRequestList) {
      const result = await client.from('vehicles').select('id,make,model,model_year,vehicle_type,governorate,monthly_price_egp,review_status,payment_status').eq('organization_id',member.organization_id).order('created_at',{ascending:false})
      if (result.error) setError(result.error.message)
      else {
        const vehicleRows = (result.data || []) as Vehicle[]
        if (path === '/workspace/owner/vehicles' || path === '/workspace/supplier/vehicles') {
          const openRequests = await client.from('rental_requests').select('id,title,details,vehicle_type,quantity,duration_type,duration_months,governorate,with_driver,status,created_at').eq('status','open').order('created_at',{ascending:false}).limit(5)
          if (!openRequests.error) setRequests((openRequests.data || []) as RentalRequest[])
        }
        if (vehicleRows.length) {
          const paymentResult = await client.from('vehicle_payment_submissions').select('vehicle_id,review_status,created_at').in('vehicle_id', vehicleRows.map(vehicle => vehicle.id)).order('created_at', { ascending: false })
          if (!paymentResult.error) {
            const latest: Record<string, string> = {}
            for (const submission of paymentResult.data || []) {
              if (!latest[submission.vehicle_id]) latest[submission.vehicle_id] = submission.review_status
            }
            setPaymentSubmissions(latest)
          }
        } else setPaymentSubmissions({})
        if (vehicleRows.length) {
          const imageResult = await client.from('vehicle_images').select('vehicle_id,storage_path,alt_text,sort_order').in('vehicle_id', vehicleRows.map(vehicle => vehicle.id)).order('sort_order', { ascending: true })
          if (imageResult.error) setError('تم تحميل السيارات، لكن تعذر تحميل صورها: ' + imageResult.error.message)
          const imageRows = imageResult.data || []
          const signedImages = await Promise.all(imageRows.map(async image => {
            const signed = await client.storage.from('vehicle-images').createSignedUrl(image.storage_path, 3600)
            return signed.error || !signed.data?.signedUrl ? null : { vehicle_id: image.vehicle_id, url: signed.data.signedUrl, alt_text: image.alt_text || 'صورة السيارة' }
          }))
          setVehicles(vehicleRows.map(vehicle => ({ ...vehicle, images: signedImages.filter((image): image is { vehicle_id: string; url: string; alt_text: string } => Boolean(image && image.vehicle_id === vehicle.id)).map(image => ({ url: image.url, alt_text: image.alt_text })) })))
        } else setVehicles([])
      }
    } else {
      const result = await client.from('rental_requests').select('id,title,details,vehicle_type,quantity,duration_type,duration_months,governorate,with_driver,status,created_at').eq('status','open').order('created_at',{ascending:false})
      if (result.error) setError(result.error.message); else {
        const openRequests = (result.data || []) as RentalRequest[]
        setRequests(openRequests)
        if (openRequests.length) {
          const offerResult = await client.from('rental_offers').select('request_id').eq('organization_id', member.organization_id).in('request_id', openRequests.map(request => request.id))
          if (offerResult.error) setError('تعذر التحقق من العروض السابقة: ' + offerResult.error.message)
          else setOfferedRequestIds(new Set((offerResult.data || []).map((offer: { request_id: string }) => offer.request_id)))
        } else setOfferedRequestIds(new Set())
      }
    }
    setLoading(false)
  }

  useEffect(() => { void loadWorkspace() }, [])
  useEffect(() => { const timer = window.setInterval(() => setAgeClock(Date.now()), 60000); return () => window.clearInterval(timer) }, [])

  async function signOut() { if (supabase) await supabase.auth.signOut(); window.location.replace('/') }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user || !organization) { setError('انتهت جلسة الدخول أو لم يتم تحميل بيانات الحساب. حدّث الصفحة وسجّل الدخول مرة أخرى.'); return }
    setSaving(true); setSavingStage('جارٍ التحقق من البيانات...'); setError(''); setNotice('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const payload = {
      organization_id: organization.id, created_by: user.id,
      make: String(form.get('make') === 'أخرى / ماركة غير موجودة' ? form.get('custom_make') : form.get('make') || '').trim(), model: String(form.get('make') === 'أخرى / ماركة غير موجودة' || form.get('model') === 'أخرى / موديل غير موجود' ? form.get('custom_model') : form.get('model') || '').trim(),
      model_year: Number(form.get('model_year')), vehicle_type: String(form.get('vehicle_type') || ''),
      transmission: String(form.get('transmission') || 'automatic'), seats: Number(form.get('seats')),
      governorate: String(form.get('governorate') || ''), address: String(form.get('address') || '').trim(),
      monthly_price_egp: Number(form.get('monthly_price_egp')), yearly_price_egp: form.get('yearly_price_egp') ? Number(form.get('yearly_price_egp')) : null,
      with_driver: form.get('with_driver') === 'on', has_gps: form.get('has_gps') === 'yes', notes: String(form.get('notes') || '').trim() || null,
      review_status: 'pending_review', payment_status: 'pending'
    }
    const photos = photoPreviews.map(photo => photo.file)
    if (photos.length < 1 || photos.length > 8) { setError('أضف صورة واحدة على الأقل، وبحد أقصى 8 صور للسيارة.'); setSaving(false); setSavingStage(''); return }
    if (photos.some(photo => !['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size > 8 * 1024 * 1024)) { setError('الصور المقبولة JPG أو PNG أو WEBP، وبحد أقصى 8 ميجابايت للصورة الواحدة.'); setSaving(false); setSavingStage(''); return }
    let savedVehicleId = ''
    const uploadedPaths: string[] = []
    try {
      setSavingStage('جارٍ حفظ بيانات السيارة...')
      const insertPromise = supabase.from('vehicles').insert(payload).select('id').single()
      const insertResult = await Promise.race([
        insertPromise,
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('انتهت مهلة حفظ البيانات. تحقق من اتصال الإنترنت ثم حدّث الصفحة قبل إعادة المحاولة.')), 30000))
      ])
      if (insertResult.error || !insertResult.data) {
        const message = insertResult.error?.message || 'تعذر حفظ بيانات السيارة.'
        setError(message.includes('Could not find the table') ? 'قاعدة بيانات السيارات لم تُفعّل بعد. يلزم تطبيق Migration السيارات والطلبات أولًا.' : 'تعذر حفظ بيانات السيارة: ' + message)
        return
      }
      savedVehicleId = insertResult.data.id
      setSavingStage('تم حفظ بيانات السيارة. جارٍ رفع الصور (قد يستغرق ذلك بعض الوقت)...')
      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index]
        const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'vehicle-photo'
        const storagePath = organization.id + '/' + savedVehicleId + '/' + crypto.randomUUID() + '-' + safeName
        const uploadPromise = supabase.storage.from('vehicle-images').upload(storagePath, photo, { contentType: photo.type, upsert: false })
        const upload = await Promise.race([
          uploadPromise,
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('تأخر رفع الصورة رقم ' + (index + 1) + '. بيانات السيارة محفوظة بالفعل؛ يمكنك إعادة فتح الصفحة والتواصل مع الدعم لإكمال الصور.')), 45000))
        ])
        if (upload.error) throw new Error('تم حفظ بيانات السيارة، لكن تعذر رفع الصورة رقم ' + (index + 1) + ': ' + upload.error.message)
        uploadedPaths.push(storagePath)
        setSavingStage('تم رفع ' + uploadedPaths.length + ' من ' + photos.length + ' صور...')
      }
      setSavingStage('جارٍ إنهاء حفظ صور السيارة...')
      const imageRows = uploadedPaths.map((storage_path, index) => ({ vehicle_id: savedVehicleId, organization_id: organization.id, storage_path, alt_text: payload.make + ' ' + payload.model, sort_order: index, created_by: user.id }))
      const imageInsertPromise = supabase.from('vehicle_images').insert(imageRows)
      const imageInsert = await Promise.race([
        imageInsertPromise,
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('تم حفظ بيانات السيارة ورفع الصور، لكن تأخر ربط الصور بالسجل. حدّث الصفحة قبل أي محاولة جديدة.')), 30000))
      ])
      if (imageInsert.error) throw new Error('تم حفظ بيانات السيارة، لكن تعذر ربط الصور بها: ' + imageInsert.error.message)
      setNotice('تم حفظ السيارة ورفع ' + photos.length + ' صور بنجاح. السيارة قيد مراجعة الإدارة وحالة الدفع معلّقة؛ لم يتم تحصيل أي مبلغ من خلال المنصة. المبلغ المطلوب مقابل الاشتراك وعرض السيارة أمام الشركات فقط، ولا تضمن المنصة تشغيل السيارة أو الحصول على عقد تأجير.')
      formElement.reset()
      photoPreviews.forEach(photo => URL.revokeObjectURL(photo.url))
      setPhotoPreviews([])
      setSelectedMake(''); setSelectedModel(''); setInferredType(''); setInferredSeats(5); setProfileConfidence('low')
      await loadWorkspace()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'حدث خطأ غير متوقع أثناء حفظ السيارة.'
      if (savedVehicleId) {
        setError(message + ' رقم سجل السيارة: ' + savedVehicleId + '. لا تعِد إرسال النموذج قبل تحديث الصفحة والتحقق من ظهور السيارة.')
        await loadWorkspace()
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
      setSavingStage('')
    }
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
    setNotice('تم إرسال عرضك للشركة بنجاح. يمكنك متابعة حالة العرض من صفحة «متابعة العروض».')
    window.location.href = role === 'owner' ? '/workspace/owner/offers' : '/workspace/supplier/offers'
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
    const proof = form.get('payment_proof')
    let proofPath: string | null = null
    if (proof instanceof File && proof.size > 0) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      if (!allowed.includes(proof.type) || proof.size > 5 * 1024 * 1024) {
        setSaving(false); setError('ملف الإثبات يجب أن يكون صورة JPG أو PNG أو WEBP أو PDF وبحجم لا يتجاوز 5 ميجابايت.'); return
      }
      const extension = proof.type === 'application/pdf' ? 'pdf' : proof.type.split('/')[1].replace('jpeg','jpg')
      proofPath = organization.id + '/' + vehicle.id + '/' + crypto.randomUUID() + '.' + extension
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(proofPath, proof, { contentType: proof.type, upsert: false })
      if (uploadError) { setSaving(false); setError('تعذر رفع إثبات التحويل: ' + uploadError.message); return }
    }
    const payload = {
      vehicle_id: vehicle.id, organization_id: organization.id, submitted_by: user.id,
      amount_egp: role === 'supplier' ? 150 : 300 * months, period_months: role === 'supplier' ? 1 : months,
      transfer_method: String(form.get('transfer_method') || 'instapay'),
      transfer_reference: [
        'رقم العملية: ' + String(form.get('transfer_reference') || '').trim(),
        'تاريخ التحويل: ' + String(form.get('transfer_date') || '').trim(),
        'الملاحظات: ' + String(form.get('transfer_notes') || '').trim()
      ].join(' | '),
      proof_path: proofPath,
      review_status: 'pending'
    }
    const { error: saveError } = await supabase.from('vehicle_payment_submissions').insert(payload)
    setSaving(false)
    if (saveError) {
      if (proofPath) await supabase.storage.from('payment-proofs').remove([proofPath])
      setError(saveError.message.includes('Could not find the table') ? 'نموذج التحويل لم يُفعّل بعد. يلزم تطبيق Migration مراجعة التحويلات.' : saveError.message); return
    }
    setPaymentVehicle(null)
    setPaymentSubmissions(current => ({ ...current, [vehicle.id]: 'pending' }))
    setNotice('تم إرسال بيانات التحويل بنجاح، وحاليًا في انتظار المراجعة. المبلغ مقابل الاشتراك وعرض السيارة أمام الشركات فقط، ولا تضمن المنصة تشغيل السيارة أو الحصول على عقد تأجير.')
  }

  if (loading || !user) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">جارٍ تحميل مساحة العمل...</main>

  const isWorkspaceHome = (role === 'company' && path === '/workspace/company') || (role === 'owner' && path === '/workspace/owner/vehicles') || (role === 'supplier' && path === '/workspace/supplier/vehicles')
  const activeVehicles = vehicles.filter(vehicle => vehicle.review_status === 'approved' && vehicle.payment_status === 'verified').length
  const pendingVehicles = vehicles.filter(vehicle => vehicle.review_status === 'pending_review' || vehicle.payment_status === 'pending').length
  const receivedOffers = requests.reduce((total, request) => total + (request.rental_offers?.length || 0), 0)
  const dashboard = isWorkspaceHome ? <section className="mc-dashboard mt-6 space-y-5">
    <div className="mc-dashboard-hero relative overflow-hidden rounded-[1.75rem] bg-gradient-to-l from-[#0b2545] via-[#123b68] to-[#155e91] p-6 text-white shadow-xl sm:p-8">
      <div className="pointer-events-none absolute -left-12 -top-16 h-56 w-56 rounded-full border-[28px] border-white/5" />
      <div className="pointer-events-none absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-cyan-100"><Building2 size={14}/> لوحة إدارة حسابك</span>
          <h2 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">مرحبًا، {user.name.split(' ')[0]} 👋</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-blue-100">{role === 'company' ? 'تابع احتياجات شركتك، أنشئ طلبات التأجير، وقارن عروض الملاك وموردي الأساطيل من مكان واحد.' : role === 'supplier' ? 'أدر سيارات أسطولك، تابع حالة المراجعة والتفعيل، واستجب لطلبات الشركات المناسبة.' : 'أدر سياراتك وبياناتها، تابع المراجعة والتحويلات، واطّلع على طلبات الشركات المتاحة.'}</p>
        </div>
        <a href={role === 'company' ? '/workspace/company/requests/new' : role === 'supplier' ? '/workspace/supplier/vehicles/new' : '/workspace/owner/vehicles/new'} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 font-extrabold text-[#123b68] shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-50"><Plus size={18}/>{role === 'company' ? 'إنشاء طلب تأجير' : 'إضافة سيارة جديدة'}</a>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {(role === 'company' ? [
        {label:'إجمالي طلباتك',value:requests.length,detail:'طلبات التأجير المسجلة',icon:ClipboardList,tone:'bg-blue-50 text-blue-700'},
        {label:'العروض المستلمة',value:receivedOffers,detail:'عروض من الملاك والموردين',icon:FileText,tone:'bg-emerald-50 text-emerald-700'},
        {label:'طلبات مفتوحة',value:requests.filter(item=>item.status==='open').length,detail:'تستقبل عروضًا حاليًا',icon:MessageCircle,tone:'bg-amber-50 text-amber-700'}
      ] : [
        {label:'إجمالي السيارات',value:vehicles.length,detail:'سيارات مسجلة بحسابك',icon:CarFront,tone:'bg-blue-50 text-blue-700'},
        {label:'سيارات نشطة',value:activeVehicles,detail:'معتمدة ومفعّلة للشركات',icon:Building2,tone:'bg-emerald-50 text-emerald-700'},
        {label:'تحت المراجعة',value:pendingVehicles,detail:'تحتاج متابعة الإدارة',icon:ClipboardList,tone:'bg-amber-50 text-amber-700'}
      ]).map(item=><article key={item.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-slate-600">{item.label}</span><span className={`grid h-10 w-10 place-items-center rounded-xl ${item.tone}`}><item.icon size={19}/></span></div><strong className="mt-3 block text-3xl font-black tracking-tight text-slate-950">{item.value.toLocaleString('ar-EG')}</strong><p className="mt-1 text-xs text-slate-500">{item.detail}</p></article>)}
    </div>
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-lg font-extrabold text-slate-950">اختصارات سريعة</h3><p className="mt-1 text-sm text-slate-500">انتقل مباشرةً إلى أهم المهام في حسابك</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">مساحة عملك</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(role === 'company' ? [
          {href:'/workspace/company/managed-sourcing',title:'فوّض My Car للبحث عن السيارات',desc:'دع فريق المنصة يبحث ويتواصل ويجهز عروضًا مقارنة نيابةً عن شركتك',icon:Wrench},
          {href:'/workspace/company/requests/new',title:'طلب سيارات جديد',desc:'حدد احتياج شركتك واستقبل عروضًا مناسبة',icon:Plus},
          {href:'/workspace/company/requests',title:'متابعة طلباتي',desc:'راجع الطلبات والعروض الواردة',icon:ClipboardList},
          {href:'/workspace/catalog',title:'استكشاف السيارات',desc:'تصفح السيارات المعتمدة والمتاحة',icon:CarFront},
          {href:'/messages',title:'المحادثات',desc:'تواصل داخل المنصة مع الأطراف الأخرى',icon:MessageCircle}
        ] : [
          {href:role === 'supplier' ? '/workspace/supplier/vehicles/new' : '/workspace/owner/vehicles/new',title:'إضافة سيارة',desc:'سجّل سيارة جديدة مع بياناتها وصورها',icon:Plus},
          {href:role === 'supplier' ? '/workspace/supplier/vehicles' : '/workspace/owner/vehicles',title:'إدارة السيارات',desc:'راجع بيانات السيارات وحالاتها',icon:CarFront},
          {href:role === 'supplier' ? '/workspace/supplier/requests' : '/workspace/owner/requests',title:'طلبات الشركات',desc:'استكشف احتياجات الشركات وقدّم عروضك',icon:ClipboardList},
          {href:role === 'supplier' ? '/workspace/supplier/offers' : '/workspace/owner/offers',title:'متابعة العروض المقدمة',desc:'تابع رد الشركات وحالة كل عرض أرسلته',icon:Clock3},
          {href:'/messages',title:'المحادثات',desc:'تابع رسائلك وتواصل بأمان',icon:MessageCircle},
          {href:'/workspace/catalog',title:'كتالوج السيارات',desc:'تعرّف على السيارات المنشورة',icon:Building2}
        ]).map(item=><a key={item.href} href={item.href} className="group flex min-h-[88px] items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 hover:shadow-sm"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white"><item.icon size={20}/></span><span className="min-w-0"><strong className="block text-sm font-extrabold text-slate-900">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{item.desc}</span></span><ArrowLeft size={16} className="mr-auto shrink-0 text-slate-400 transition group-hover:-translate-x-1 group-hover:text-blue-700"/></a>)}
      </div>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,.8fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-extrabold text-slate-950">{role==='company'?'السيارات المتاحة حديثًا':'أحدث طلبات الشركات'}</h3><p className="mt-1 text-xs text-slate-500">{role==='company'?'سيارات معتمدة وجاهزة للاستعراض':'فرص تشغيل منشورة على المنصة'}</p></div><a href={role==='company'?'/workspace/catalog':role==='supplier'?'/workspace/supplier/requests':'/workspace/owner/requests'} className="text-xs font-extrabold text-blue-700">عرض الكل ←</a></div>
        {role==='company' ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{vehicles.slice(0,4).map(v=><article key={v.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-blue-700"><CarFront size={20}/></span><div className="min-w-0"><strong className="block truncate text-sm">{v.make} {v.model}</strong><span className="text-xs text-slate-500">{v.model_year} · {v.governorate}</span></div></div><p className="mt-2 text-xs font-bold text-blue-800">{Number(v.monthly_price_egp).toLocaleString('ar-EG')} جنيه / شهر</p></article>)}{vehicles.length===0&&<p className="col-span-2 py-6 text-center text-sm text-slate-500">لا توجد سيارات معتمدة للعرض حاليًا.</p>}</div> : <div className="mt-4 divide-y divide-slate-100">{requests.slice(0,4).map(r=><div key={r.id} className="py-3"><strong className="block text-sm text-slate-800">{r.title}</strong><span className="mt-1 block text-xs text-slate-500">{r.vehicle_type} · {r.quantity} سيارة · {r.governorate} · {r.duration_months} شهر</span></div>)}{requests.length===0&&<p className="py-6 text-center text-sm text-slate-500">لا توجد طلبات مفتوحة حاليًا.</p>}</div>}
      </section>
      <section className="rounded-2xl border border-cyan-200/70 bg-gradient-to-br from-[#0e3260] via-[#0b2b50] to-[#071a32] p-5 text-white shadow-sm"><Wrench size={27} className="text-cyan-200"/><h3 className="mt-3 font-extrabold">{role==='company'?'خدمة البحث عن السيارات نيابةً عن شركتك':'زد فرص ظهور سياراتك'}</h3><p className="mt-2 text-sm leading-6 text-blue-100">{role==='company'?'فوّض فريق My Car لتحديد السيارات المناسبة لاحتياج شركتك، والبحث لدى الملاك وموردي الأساطيل، وتجهيز عروض مقارنة لتختار منها.':'اكتشف باقات الإعلان المميزة لزيادة ظهور سياراتك أمام الشركات.'}</p><a href={role==='company'?'/workspace/company/managed-sourcing':'/workspace/advertising-plans'} className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-white px-4 text-sm font-extrabold text-blue-900">{role==='company'?'ابدأ طلب البحث والتفويض':'استكشف الباقات'}</a></section>
    </div>
  </section> : null
  const isWelcomeNotice = notice.startsWith('أهلًا بك في My Car')
  const nextStepHref = role === 'company' ? '/workspace/company/requests/new' : role === 'supplier' ? '/workspace/supplier/vehicles/new' : '/workspace/owner/vehicles/new'
  const nextStepLabel = role === 'company' ? 'إنشاء أول طلب تأجير' : role === 'supplier' ? 'إضافة أول سيارة للأسطول' : 'إضافة أول سيارة'
  const feedback = <>{error && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-800"><strong className="block">نحتاج إلى مساعدتك لإكمال الخطوة</strong>{error}<div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => void loadWorkspace()} className="rounded-lg border border-red-200 bg-white px-4 py-2 font-bold">إعادة المحاولة</button><a href="/?login=1" className="rounded-lg border border-red-200 bg-white px-4 py-2 font-bold">تسجيل الدخول مجددًا</a></div></div>}{notice && <div role="status" className={`mt-4 rounded-2xl border p-5 text-sm leading-7 ${isWelcomeNotice ? 'border-blue-200 bg-gradient-to-l from-blue-50 via-white to-sky-50 text-blue-950 shadow-sm' : 'border-emerald-100 bg-emerald-50 p-4 text-emerald-800'}`}>{isWelcomeNotice ? <><strong className="mb-1 block text-lg">أهلًا بك في My Car 👋</strong><p>{notice}</p><p className="mt-2 font-bold">حسابك جاهز. يمكنك البدء من الخطوة التالية:</p><div className="mt-4 flex flex-wrap gap-3"><a href={nextStepHref} className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 py-2 font-extrabold text-white">{nextStepLabel}</a><a href={role === 'company' ? '/workspace/catalog' : role === 'supplier' ? '/workspace/supplier/requests' : '/workspace/owner/requests'} className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-white px-4 py-2 font-bold text-blue-800">{role === 'company' ? 'استكشاف السيارات' : 'عرض طلبات الشركات'}</a></div></> : notice}</div>}</>
  const vehicleForm = <section className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 sm:p-8"><button onClick={() => { window.location.href = role === 'owner' ? '/workspace/owner/vehicles' : '/workspace/supplier/vehicles' }} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700"><ArrowLeft size={17}/> رجوع لمساحة العمل</button><h2 className="text-2xl font-extrabold text-slate-950">تسجيل سيارة جديدة</h2><p className="mt-2 text-sm leading-7 text-slate-600">أدخل البيانات بدقة. ستظهر السيارة للشركات بعد اعتماد الإدارة واستيفاء متطلبات الدفع خارج المنصة.</p><form onSubmit={saveVehicle} className="mt-6 grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-bold">ماركة السيارة *<select name="make" required value={selectedMake} onChange={event => { setSelectedMake(event.target.value); setSelectedModel(''); setInferredType(''); setInferredSeats(5); setProfileConfidence('low') }} className={fieldClass}><option value="">اختر الماركة</option>{Object.keys(vehicleCatalog).map(make => <option key={make} value={make}>{make}</option>)}</select></label>
    {selectedMake === 'أخرى / ماركة غير موجودة' && <label className="text-sm font-bold">اكتب اسم الماركة *<input name="custom_make" required maxLength={80} className={fieldClass} placeholder="اكتب اسم الماركة"/></label>}
    <label className="text-sm font-bold">موديل السيارة *<select name="model" required value={selectedModel} onChange={event => { const model = event.target.value; setSelectedModel(model); if (selectedMake && model && model !== 'أخرى / موديل غير موجود' && selectedMake !== 'أخرى / ماركة غير موجودة') { const profile = inferVehicleProfile(selectedMake, model); setInferredType(profile.type); setInferredSeats(profile.seats); setProfileConfidence(profile.confidence) } else { setInferredType(''); setInferredSeats(5); setProfileConfidence('low') } }} disabled={!selectedMake || selectedMake === 'أخرى / ماركة غير موجودة'} className={fieldClass}><option value="">اختر الموديل</option>{(vehicleCatalog[selectedMake] || []).map(model => <option key={model} value={model}>{model}</option>)}{selectedMake && <option value="أخرى / موديل غير موجود">موديل غير موجود بالقائمة</option>}</select></label>
    {(selectedMake === 'أخرى / ماركة غير موجودة' || selectedModel === 'أخرى / موديل غير موجود') && <label className="text-sm font-bold">اكتب اسم الموديل *<input name="custom_model" required maxLength={100} className={fieldClass} placeholder="اكتب اسم الموديل"/></label>}
    <label className="text-sm font-bold">سنة الصنع *<select name="model_year" required defaultValue={String(new Date().getFullYear())} className={fieldClass}><option value="">اختر سنة الصنع</option>{Array.from({length: new Date().getFullYear() - 1949 + 1}, (_, index) => new Date().getFullYear() + 1 - index).map(year => <option key={year} value={year}>{year}</option>)}</select></label>
    <label className="text-sm font-bold">نوع السيارة *<select name="vehicle_type" required value={inferredType} onChange={event => setInferredType(event.target.value)} className={fieldClass}><option value="">اختر النوع</option>{vehicleTypes.map(v=><option key={v}>{v}</option>)}</select>{inferredType && <span className="mt-1 block text-xs font-medium text-emerald-700">تم اقتراح النوع تلقائيًا من الماركة والموديل — يمكنك تعديله عند الحاجة.</span>}</label>
    <label className="text-sm font-bold">ناقل الحركة *<select name="transmission" className={fieldClass}><option value="automatic">أوتوماتيك</option><option value="manual">مانيوال</option></select></label>
    <label className="text-sm font-bold">عدد المقاعد *<input name="seats" type="number" required min={2} max={60} value={inferredSeats} onChange={event => setInferredSeats(Number(event.target.value))} className={fieldClass}/>{selectedModel && selectedModel !== 'أخرى / موديل غير موجود' && <span className="mt-1 block text-xs font-medium text-slate-500">{profileConfidence === 'high' ? 'تقدير مبني على فئة الموديل.' : profileConfidence === 'medium' ? 'عدد مقاعد مقترح حسب الفئة الشائعة للموديل؛ راجعه حسب تجهيز سيارتك.' : 'لم نحدد هذا الموديل بدقة؛ تحقق من عدد المقاعد الفعلي.'}</span>}</label>
    <label className="text-sm font-bold">المحافظة *<select name="governorate" required className={fieldClass}><option value="">اختر المحافظة</option>{governorates.map(g=><option key={g}>{g}</option>)}</select></label>
    <label className="text-sm font-bold">العنوان التفصيلي *<input name="address" required maxLength={300} className={fieldClass} placeholder="المنطقة والشارع"/></label>
    <label className="text-sm font-bold">السعر الشهري بالجنيه *<input name="monthly_price_egp" type="number" required min={0} step="0.01" className={fieldClass}/></label>
    <label className="text-sm font-bold">السعر السنوي بالجنيه (اختياري)<input name="yearly_price_egp" type="number" min={0} step="0.01" className={fieldClass}/></label>
    <label className="text-sm font-bold">نظام GPS *<select name="has_gps" required defaultValue="" className={fieldClass}><option value="" disabled>حدد حالة GPS</option><option value="yes">نعم، السيارة مزودة بجهاز GPS</option><option value="no">لا، السيارة غير مزودة بجهاز GPS</option></select><span className="mt-1 block text-xs font-medium text-slate-500">تساعد هذه المعلومة الشركات على اختيار السيارة المناسبة لمتطلبات التشغيل.</span></label>\n    <label className="flex items-center gap-3 rounded-xl border p-4 text-sm font-bold"><input type="checkbox" name="with_driver" className="h-4 w-4"/> السيارة متاحة بسائق</label>
    <label className="text-sm font-bold sm:col-span-2">صور السيارة *<span className="mt-2 block rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-5"><span className="flex items-center gap-3 text-blue-800"><ImagePlus size={24}/><span><span className="block font-extrabold">ارفع صور سيارتك</span><span className="mt-1 block text-xs font-medium text-slate-500">من 1 إلى 8 صور · JPG أو PNG أو WEBP · 8 ميجابايت كحد أقصى للصورة</span></span></span><input name="vehicle_photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(event) => { photoPreviews.forEach(photo => URL.revokeObjectURL(photo.url)); const files = Array.from(event.currentTarget.files || []).slice(0, 8); setPhotoPreviews(files.map(file => ({ file, url: URL.createObjectURL(file) }))); if ((event.currentTarget.files?.length || 0) > 8) setError('تم اختيار أكثر من 8 صور؛ سيتم استخدام أول 8 صور فقط.') }} className="mt-4 block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:font-bold file:text-white"/></span></label>
    {photoPreviews.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:col-span-2">{photoPreviews.map((photo,index)=><div key={photo.url} className="relative overflow-hidden rounded-xl border bg-slate-50"><img src={photo.url} alt={'معاينة صورة السيارة '+(index+1)} className="h-32 w-full object-cover"/><button type="button" onClick={() => { URL.revokeObjectURL(photo.url); setPhotoPreviews(current => current.filter(item => item.url !== photo.url)); }} className="absolute left-2 top-2 rounded-full bg-white/95 p-1 text-slate-700 shadow" aria-label="حذف الصورة من الاختيار"><X size={16}/></button><p className="truncate px-2 py-1 text-xs text-slate-600">{photo.file.name}</p></div>)}</div>}
    <label className="text-sm font-bold sm:col-span-2">ملاحظات إضافية<textarea name="notes" maxLength={2000} rows={3} className={fieldClass} placeholder="حالة السيارة أو شروط التأجير"/></label>
    {(role === 'owner' || role === 'supplier') && <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm leading-8 text-sky-900 sm:col-span-2"><strong>رسوم التسجيل:</strong> {role === 'supplier' ? '150 جنيهًا لكل سيارة، تُدفع مرة واحدة لكل تسجيل.' : '300 جنيه لكل سيارة شهريًا.'} بعد حفظ البيانات، ستظل السيارة قيد المراجعة والدفع معلّقًا حتى التحويل والتحقق الإداري. لا يوجد دفع إلكتروني داخل المنصة حاليًا. المبلغ مقابل اشتراك تسجيل السيارة وعرضها أمام الشركات فقط، ولا تضمن المنصة تشغيل السيارة أو الحصول على عقد تأجير.</div>}
    <button disabled={saving} className={primaryClass+' sm:col-span-2'}>{saving ? (savingStage || 'جارٍ الحفظ...') : 'حفظ وإرسال للمراجعة'} <CarFront size={18}/></button>
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

  const workspaceLinks = role === 'company' ? [{href:'/workspace/company',label:'الرئيسية',icon:Building2},{href:'/workspace/company/requests',label:'طلبات التأجير',icon:ClipboardList},{href:'/workspace/company/requests/new',label:'طلب جديد',icon:Plus},{href:'/workspace/catalog',label:'السيارات المتاحة',icon:CarFront},{href:'/services',label:'خدمات السيارات',icon:Wrench},{href:'/messages',label:'المحادثات',icon:MessageCircle},{href:'/workspace/advertising-plans',label:'باقات الإعلانات',icon:FileText}] : role === 'supplier' ? [{href:'/workspace/supplier/vehicles',label:'سيارات الأسطول',icon:CarFront},{href:'/workspace/supplier/vehicles/new',label:'إضافة سيارة',icon:Plus},{href:'/workspace/supplier/requests',label:'طلبات الشركات',icon:ClipboardList},{href:'/workspace/supplier/offers',label:'متابعة العروض',icon:Clock3},{href:'/workspace/catalog',label:'كتالوج السيارات',icon:Building2},{href:'/messages',label:'المحادثات',icon:MessageCircle},{href:'/workspace/advertising-plans',label:'باقات الإعلانات',icon:Wrench}] : [{href:'/workspace/owner/vehicles',label:'سياراتي',icon:CarFront},{href:'/workspace/owner/vehicles/new',label:'إضافة سيارة',icon:Plus},{href:'/workspace/owner/requests',label:'طلبات الشركات',icon:ClipboardList},{href:'/workspace/owner/offers',label:'متابعة العروض',icon:Clock3},{href:'/workspace/catalog',label:'كتالوج السيارات',icon:Building2},{href:'/messages',label:'المحادثات',icon:MessageCircle},{href:'/workspace/advertising-plans',label:'باقات الإعلانات',icon:Wrench}]
  const sideNavigation = <nav aria-label="التنقل داخل مساحة العمل" className="mc-sidebar-nav">{workspaceLinks.map(({href,label,icon:Icon})=><a key={href} href={href} aria-current={path===href?'page':undefined} className={'mc-sidebar-link '+(path===href?'is-active':'')}><Icon size={19}/><span>{label}</span></a>)}<div className="mc-sidebar-divider"/><button type="button" onClick={()=>void signOut()} className="mc-sidebar-link mc-sidebar-logout"><LogOut size={19}/><span>تسجيل الخروج</span></button></nav>
  return <main dir="rtl" className="mc-workspace-main min-h-screen bg-[#f3f6fb]">
    <aside className="mc-workspace-sidebar"><div className="mc-sidebar-brand"><PlatformBrand compact/><span className="mc-sidebar-tag">مساحة العمل</span></div>{sideNavigation}<div className="mc-sidebar-promo"><CarFront size={27}/><strong>كل خدمات السيارات في مكان واحد</strong><p>إدارة أسهل وفرص تشغيل أكثر مع CarHome.</p><a href="/workspace/catalog">استكشف الكتالوج ←</a></div></aside>
    <div className="mc-workspace-content min-w-0">
      <header className="mc-workspace-topbar">
        <div className="mc-workspace-heading"><span className="text-xs font-bold text-slate-400">My Car / مساحة العمل</span><h1 className="mt-1 text-lg font-extrabold text-slate-900">{names[role]}</h1><p className="mc-workspace-subtitle">كل ما تحتاجه لإدارة سياراتك وطلباتك من مكان واحد.</p></div>
        <div className="mc-workspace-header-actions"><a href="/messages" aria-label="المحادثات" title="المحادثات" className="mc-top-icon"><MessageCircle size={18}/><span>المحادثات</span></a><button type="button" onClick={()=>void loadWorkspace()} aria-label="تحديث البيانات" title="تحديث البيانات" className="mc-top-icon"><RefreshCw size={17}/><span>تحديث</span></button><AccountNotifications/></div>
      </header>
      <div className="mc-workspace-mobile-nav">{sideNavigation}</div>
      <div className="mc-workspace-page">
    {dashboard}
    {feedback}
    {isVehicleForm ? vehicleForm : isRequestForm ? requestForm : role === 'company' ? <>{!isWorkspaceHome && !isCompanyVehicles && !isRequestList ? <section className="mt-6 rounded-3xl bg-slate-950 p-7 text-white"><h2 className="text-2xl font-extrabold">إدارة احتياجات تأجير السيارات</h2><p className="mt-3 text-sm leading-7 text-slate-300">أنشئ طلبات التأجير، وتابع الطلبات والعروض، واستعرض السيارات المعتمدة.</p><div className="mt-5 flex flex-wrap gap-3"><a className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-extrabold text-slate-950" href="/workspace/company/requests/new"><Plus size={18}/> إنشاء طلب</a><a className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-5 font-bold text-white" href="/workspace/company/requests"><ClipboardList size={18}/> طلباتي</a><a className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-5 font-bold text-white" href="/workspace/catalog"><CarFront size={18}/> السيارات المتاحة</a></div></section> : <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-extrabold">{isCompanyVehicles ? 'السيارات المعتمدة المتاحة' : 'طلبات التأجير'}</h2>{isRequestList && <a className={primaryClass} href="/workspace/company/requests/new"><Plus size={17}/> طلب جديد</a>}</div>}
      {isCompanyVehicles ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{vehicles.map(v=><article key={v.id} className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold text-emerald-700">{v.governorate}</p><h3 className="mt-2 text-lg font-extrabold">{v.make} {v.model} · {v.model_year}</h3><p className="mt-2 text-sm text-slate-600">{v.vehicle_type}</p><p className="mt-4 font-extrabold text-blue-800">{Number(v.monthly_price_egp).toLocaleString('ar-EG')} جنيه / شهر</p></article>)}</div> : isRequestList ? <div className="mt-5 space-y-3">{requests.map(r=><article key={r.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{r.title}</h3><p className="mt-2 text-sm text-slate-600">{r.vehicle_type} · {r.quantity} سيارة · {r.governorate}</p><p className="mt-1 text-sm text-slate-500">{r.duration_type === 'yearly' ? 'سنوي' : 'شهري'} · {r.duration_months} شهر · {r.with_driver ? 'بسائق' : 'بدون سائق'}</p>{r.details && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{r.details}</p>}</div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{r.status === 'open' ? 'مفتوح لاستقبال العروض' : r.status}</span></div><div className="mt-4 border-t pt-4"><h4 className="font-bold">العروض المستلمة ({r.rental_offers?.length || 0})</h4>{(r.rental_offers || []).map(o=><div key={o.id} className="mt-3 rounded-xl bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{(Array.isArray(o.organizations) ? o.organizations[0]?.name : o.organizations?.name) || 'مورد أسطول'}</strong><strong className="text-blue-800">{Number(o.monthly_price_egp).toLocaleString('ar-EG')} جنيه / شهر</strong></div><p className="mt-1 text-sm text-slate-600">عدد السيارات المعروضة: {o.vehicle_count}</p>{o.yearly_price_egp ? <p className="mt-1 text-sm text-slate-600">السعر السنوي: {Number(o.yearly_price_egp).toLocaleString('ar-EG')} جنيه</p> : null}{o.message && <p className="mt-2 text-sm leading-6 text-slate-600">{o.message}</p>}<button onClick={() => void startConversation(r.id,(Array.isArray(o.organizations) ? o.organizations[0]?.id : o.organizations?.id) || '')} disabled={!(Array.isArray(o.organizations) ? o.organizations[0]?.id : o.organizations?.id)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-800 disabled:opacity-50"><MessageCircle size={16}/> بدء مراسلة داخل المنصة</button></div>)}{(!r.rental_offers || r.rental_offers.length===0) && <p className="mt-2 text-sm text-slate-500">لم تصل عروض لهذا الطلب حتى الآن.</p>}</div></article>)}{requests.length===0 && <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-slate-600">لا توجد طلبات بعد. أنشئ أول طلب لتبدأ استقبال العروض.</div>}</div> : <div className="mt-5 rounded-2xl border bg-white p-6 text-sm text-slate-600">مرحبًا بك. اختر أحد المسارات من القائمة.</div>}
    </> : isOfferTracking ? <><section className="mt-6 rounded-3xl border border-blue-100 bg-gradient-to-l from-[#0b2545] via-[#123b68] to-[#155e91] p-6 text-white shadow-lg"><div className="flex flex-wrap items-center justify-between gap-4"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-cyan-100"><Clock3 size={14}/> مركز متابعة العروض</span><h2 className="mt-3 text-2xl font-black">عروضي المقدمة للشركات</h2><p className="mt-2 text-sm leading-6 text-blue-100">تابع حالة كل عرض، واعرف إذا كانت الشركة تراجعه أو وافقت عليه أو اعتذرت عنه.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center"><strong className="block text-3xl font-black">{submittedOffers.length.toLocaleString('ar-EG')}</strong><span className="text-xs text-blue-100">إجمالي العروض</span></div></div></section><div className="mt-5 grid gap-3 sm:grid-cols-3">{[{label:'قيد مراجعة الشركة',count:submittedOffers.filter(o=>o.status==='submitted').length,icon:Clock3,tone:'bg-amber-50 text-amber-700'},{label:'عروض مقبولة',count:submittedOffers.filter(o=>o.status==='accepted').length,icon:CheckCircle2,tone:'bg-emerald-50 text-emerald-700'},{label:'عروض لم تتم',count:submittedOffers.filter(o=>o.status==='rejected'||o.status==='withdrawn').length,icon:XCircle,tone:'bg-slate-100 text-slate-600'}].map(item=><article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-600">{item.label}</span><span className={'grid h-10 w-10 place-items-center rounded-xl '+item.tone}><item.icon size={19}/></span></div><strong className="mt-2 block text-2xl font-black text-slate-950">{item.count.toLocaleString('ar-EG')}</strong></article>)}</div><div className="mt-5 flex items-center justify-between gap-3"><h3 className="text-lg font-extrabold text-slate-950">سجل العروض</h3><button type="button" onClick={()=>void loadWorkspace()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-800"><RefreshCw size={15}/> تحديث الحالات</button></div><div className="mt-3 space-y-4">{submittedOffers.map(offer=>{const status=offer.status==='accepted'?{label:'تمت الموافقة على العرض',description:'الشركة وافقت على عرضك. يمكنك متابعة التفاصيل والتواصل من خلال محادثات المنصة.',icon:CheckCircle2,classes:'border-emerald-200 bg-emerald-50 text-emerald-800',step:2}:offer.status==='rejected'?{label:'لم يتم قبول العرض',description:'الشركة اعتذرت عن العرض. يمكنك متابعة طلبات أخرى وتقديم عروض جديدة.',icon:XCircle,classes:'border-rose-200 bg-rose-50 text-rose-800',step:2}:offer.status==='withdrawn'?{label:'تم سحب العرض',description:'هذا العرض لم يعد نشطًا ضمن عروضك المقدمة.',icon:XCircle,classes:'border-slate-200 bg-slate-50 text-slate-700',step:2}:{label:'بانتظار رد الشركة',description:'تم استلام عرضك بنجاح وهو متاح للشركة للمراجعة.',icon:Clock3,classes:'border-amber-200 bg-amber-50 text-amber-800',step:1};const StatusIcon=status.icon;const request=offer.rental_requests;return <article key={offer.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-5"><div className="min-w-0"><p className="text-xs font-bold text-slate-500">طلب شركة · {request?.governorate || 'المحافظة غير محددة'}</p><h4 className="mt-1 text-lg font-extrabold text-slate-950">{request?.title || 'طلب تأجير'}</h4><p className="mt-1 text-sm text-slate-500">{request?.vehicle_type || 'نوع غير محدد'} · {offer.vehicle_count} سيارة من أصل {request?.quantity || '—'}</p></div><span className={'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-extrabold '+status.classes}><StatusIcon size={15}/>{status.label}</span></div><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-xs text-slate-500">السعر الشهري</span><strong className="mt-1 block text-base font-extrabold text-blue-800">{Number(offer.monthly_price_egp).toLocaleString('ar-EG')} جنيه</strong></div><div><span className="text-xs text-slate-500">السعر السنوي</span><strong className="mt-1 block text-base font-extrabold text-slate-900">{offer.yearly_price_egp?Number(offer.yearly_price_egp).toLocaleString('ar-EG')+' جنيه':'غير محدد'}</strong></div><div><span className="text-xs text-slate-500">تاريخ الإرسال</span><strong className="mt-1 block text-sm font-bold text-slate-800">{new Date(offer.created_at).toLocaleDateString('ar-EG')}</strong></div><div><span className="text-xs text-slate-500">آخر تحديث</span><strong className="mt-1 block text-sm font-bold text-slate-800">{new Date(offer.updated_at).toLocaleDateString('ar-EG')}</strong></div></div>{offer.message&&<div className="mx-5 mb-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"><strong className="mb-1 block">رسالتك للشركة</strong>{offer.message}</div>}<div className="border-t border-slate-100 px-5 py-4"><div className="flex items-center gap-2 text-xs font-bold text-slate-600"><span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Send size={14}/></span> تم إرسال العرض</div><div className="me-3 mt-2 h-5 border-r-2 border-dashed border-slate-200"/><div className="flex items-center gap-2 text-xs font-bold"><span className={'grid h-7 w-7 place-items-center rounded-full '+(status.step===2?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700')}><StatusIcon size={14}/></span><span className={status.step===2?'text-slate-800':'text-amber-800'}>{status.label}</span></div></div><div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/70 p-4"><a href="/messages" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white"><MessageCircle size={15}/> فتح المحادثات</a><a href={role==='owner'?'/workspace/owner/requests':'/workspace/supplier/requests'} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">استعراض طلبات أخرى</a></div></article>})}{submittedOffers.length===0&&<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><FileText size={25}/></span><h3 className="mt-3 font-extrabold text-slate-900">لا توجد عروض مقدمة حتى الآن</h3><p className="mt-2 text-sm leading-6 text-slate-500">عندما ترسل عرضًا على أحد طلبات الشركات، ستظهر تفاصيله وحالته هنا تلقائيًا.</p><a href={role==='owner'?'/workspace/owner/requests':'/workspace/supplier/requests'} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 font-bold text-white"><ClipboardList size={16}/> تصفح طلبات الشركات</a></div>}</div></> : isSupplierRequestList ? <><h2 className="mt-6 text-xl font-extrabold">طلبات الشركات المفتوحة</h2><div className="mt-4 space-y-3">{requests.map(r=><article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-extrabold text-slate-950">{r.title}</h3><div className="flex flex-wrap gap-2"><span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-extrabold ${offeredRequestIds.has(r.id) ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{offeredRequestIds.has(r.id) ? '✓ تم إرسال عرض بالفعل' : 'لم يتم إرسال عرض'}</span><span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${requestAgeLabel(r.created_at, ageClock) === 'جديد' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><Clock3 size={13}/>{requestAgeLabel(r.created_at, ageClock)}</span></div></div><p className="mt-2 text-sm text-slate-600">{r.vehicle_type} · {r.quantity} سيارة · {r.governorate} · {r.duration_months} شهر</p><p className="mt-1 text-xs text-slate-500">تاريخ النشر: {new Date(r.created_at).toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'})}</p><p className="mt-1 text-sm text-slate-500">{r.with_driver ? 'مطلوب بسائق' : 'بدون سائق محدد'}</p>{r.details && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{r.details}</p>}{offeredRequestIds.has(r.id) ? <a href={role === 'owner' ? '/workspace/owner/offers' : '/workspace/supplier/offers'} className="mt-4 me-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-extrabold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"><CheckCircle2 size={16}/> متابعة حالة الطلب</a> : null}<button onClick={() => setOfferRequest(offerRequest === r.id ? null : r.id)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white"><FileText size={16}/>{offerRequest === r.id ? 'إغلاق نموذج العرض' : 'تقديم عرض للشركة'}</button>{offerRequest === r.id && <form onSubmit={(event) => void saveOffer(event,r.id)} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"><label className="text-sm font-bold">السعر الشهري بالجنيه *<input name="monthly_price_egp" type="number" min={0} step="0.01" required className={fieldClass}/></label><label className="text-sm font-bold">السعر السنوي (اختياري)<input name="yearly_price_egp" type="number" min={0} step="0.01" className={fieldClass}/></label><label className="text-sm font-bold">عدد السيارات التي تعرضها *<input name="vehicle_count" type="number" min={1} max={500} defaultValue={r.quantity} required className={fieldClass}/></label><label className="text-sm font-bold sm:col-span-2">رسالة توضيحية<textarea name="message" rows={2} maxLength={2000} className={fieldClass} placeholder="وضح تفاصيل العرض وشروطه"/></label><button disabled={saving} className={primaryClass+" sm:col-span-2"}>{saving ? 'جارٍ إرسال العرض...' : 'إرسال العرض'}</button></form>}</article>)}{requests.length===0 && <p className="rounded-2xl border bg-white p-6 text-slate-600">لا توجد طلبات مفتوحة حاليًا.</p>}</div></> : <><section className="mt-6 rounded-3xl bg-slate-950 p-7 text-white"><h2 className="text-2xl font-extrabold">{role === 'owner' ? 'إدارة سياراتك' : 'إدارة سيارات الأسطول'}</h2><p className="mt-3 text-sm leading-7 text-slate-300">{role === 'owner' ? 'رسوم تسجيل السيارة 300 جنيه شهريًا لكل سيارة. لا تُعتمد السيارة إلا بعد التحويل ومراجعة الإدارة.' : 'رسوم تسجيل سيارة الأسطول 150 جنيهًا لكل سيارة، تُدفع مرة واحدة لكل تسجيل. تُراجع الإدارة بيانات السيارة والتحويل قبل تفعيلها للشركات.'}</p><a href={role === 'owner' ? '/workspace/owner/vehicles/new' : '/workspace/supplier/vehicles/new'} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-extrabold text-slate-950"><Plus size={18}/> تسجيل سيارة جديدة</a><a href={role === 'owner' ? '/workspace/owner/requests' : '/workspace/supplier/requests'} className="mt-5 me-3 inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/30 px-5 font-bold text-white"><ClipboardList size={18}/> طلبات الشركات</a></section><div className="mt-6 flex items-center justify-between"><h2 className="text-xl font-extrabold">سياراتك المسجلة</h2><span className="text-sm text-slate-500">{vehicles.length} سيارة</span></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{vehicles.map(v=><article key={v.id} className="overflow-hidden rounded-2xl border bg-white"><div className="grid grid-cols-2 gap-1 bg-slate-100">{(v.images || []).slice(0,4).map((image,index)=><img key={image.url} src={image.url} alt={image.alt_text || (v.make+' '+v.model)} className={index===0 && (v.images?.length || 0)===1 ? 'col-span-2 h-44 w-full object-cover' : 'h-28 w-full object-cover'}/>)}{(!v.images || v.images.length===0) && <div className="col-span-2 grid h-32 place-items-center text-sm text-slate-400"><ImagePlus size={24}/><span>لا توجد صور متاحة</span></div>}</div><div className="p-5"><h3 className="font-extrabold">{v.make} {v.model} · {v.model_year}</h3><p className="mt-2 text-sm text-slate-600">{v.vehicle_type} · {v.governorate}</p><p className="mt-3 text-sm font-bold text-blue-800">{Number(v.monthly_price_egp).toLocaleString('ar-EG')} جنيه / شهر</p><p className="mt-3 text-xs text-slate-500">حالة السيارة: {v.review_status === 'pending_review' ? 'قيد مراجعة الإدارة' : v.review_status === 'approved' ? 'معتمدة' : v.review_status === 'rejected' ? 'تحتاج تعديلًا' : 'متوقفة'} · الدفع: {v.payment_status === 'verified' ? 'نشط' : v.payment_status === 'pending' ? 'معلّق' : v.payment_status}</p>{(role === 'owner' || role === 'supplier') && v.payment_status === 'verified' && <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">نشط</span>}{(role === 'owner' || role === 'supplier') && paymentSubmissions[v.id] === 'pending' && v.payment_status !== 'verified' && <p className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold text-sky-800">تم إرسال بيانات التحويل بنجاح، وحاليًا في انتظار المراجعة.</p>}</div>{(role === 'owner' || role === 'supplier') && v.payment_status !== 'verified' && paymentSubmissions[v.id] !== 'pending' && <><button onClick={() => setPaymentVehicle(paymentVehicle===v.id ? null : v.id)} className="mt-4 min-h-10 rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-800">{paymentVehicle===v.id ? 'إغلاق نموذج التحويل' : 'ادفع رسوم تسجيل السيارة الآن'}</button>{paymentVehicle===v.id && <form onSubmit={(event)=>void submitTransfer(event,v)} className="mt-4 space-y-3 border-t pt-4"><div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7"><h4 className="font-extrabold text-slate-900">ادفع رسوم تسجيل السيارة الآن</h4><p className="mt-1 text-slate-700">رسوم التسجيل: {role === 'supplier' ? '150 جنيهًا لكل سيارة (مرة واحدة).' : '300 جنيه شهريًا لكل سيارة.'}</p><div className="mt-3 space-y-2"><p><strong>Vodafone Cash:</strong> <span dir="ltr" className="font-extrabold">01096656281</span></p><p><strong>InstaPay:</strong> <span dir="ltr" className="font-extrabold">01208987035</span></p></div><p className="mt-2 text-xs text-slate-600">حوّل المبلغ أولًا إلى إحدى الوسيلتين، ثم سجّل بيانات العملية لإرسالها إلى الإدارة للمراجعة. المنصة لا تنفّذ التحويل تلقائيًا.</p></div>{role === 'owner' && <label className="block text-sm font-bold">مدة الرسوم بالشهور *<select name="period_months" defaultValue="1" className={fieldClass}><option value="1">شهر واحد — 300 جنيه</option><option value="3">3 شهور — 900 جنيه</option><option value="6">6 شهور — 1,800 جنيه</option><option value="12">12 شهرًا — 3,600 جنيه</option></select></label>}<label className="block text-sm font-bold">طريقة التحويل *<select name="transfer_method" className={fieldClass}><option value="instapay">InstaPay</option><option value="vodafone_cash">Vodafone Cash</option><option value="bank_transfer">تحويل بنكي</option></select></label><label className="block text-sm font-bold">رقم العملية *<input name="transfer_reference" required minLength={3} maxLength={100} className={fieldClass} placeholder="أدخل رقم العملية كما يظهر في تطبيق التحويل"/></label><label className="block text-sm font-bold">تاريخ التحويل *<input name="transfer_date" type="date" required max={new Date().toISOString().slice(0,10)} className={fieldClass}/></label><label className="block text-sm font-bold">إثبات التحويل (اختياري)<input name="payment_proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className={fieldClass}/><span className="mt-1 block text-xs font-normal text-slate-500">صورة أو PDF، بحد أقصى 5 ميجابايت. يُتاح الملف لصاحب الطلب ومسؤولي المنصة فقط.</span></label><label className="block text-sm font-bold">الملاحظات<textarea name="transfer_notes" rows={2} maxLength={1000} className={fieldClass} placeholder="ملاحظات إضافية (اختياري)"/></label><button disabled={saving} className={primaryClass+" w-full"}>{saving ? 'جارٍ الإرسال...' : 'إرسال للتحقق الإداري'}</button></form>}</>}</article>)}{vehicles.length===0 && <p className="rounded-2xl border border-dashed bg-white p-6 text-sm text-slate-600">لم تسجل سيارات بعد. ابدأ بإضافة أول سيارة.</p>}</div></>}
    <footer className="mt-8 flex flex-wrap gap-4 border-t py-5 text-sm text-slate-500">{role === 'company' && <><a href="/workspace/company/requests" className="hover:text-blue-700">طلبات التأجير</a><a href="/workspace/catalog" className="hover:text-blue-700">السيارات المتاحة</a></>}<span className="inline-flex items-center gap-2"><Building2 size={15}/> مساحة عمل آمنة</span><a href={'/workspace/'+role+'/messages'} className="inline-flex items-center gap-2 hover:text-blue-700"><MessageCircle size={15}/> المراسلات الداخلية</a><span><FileText size={15} className="inline"/> مع My Car، طريقك أسهل للوصول إلى فرص تأجير السيارات المناسبة لأعمالك.</span></footer>
  </div></div></main>
}
