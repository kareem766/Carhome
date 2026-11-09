import { useEffect, useState } from 'react'
import { Building2, CheckCircle2, LogOut, Pencil, Plus, RefreshCw, Settings, UserRound, XCircle, Trash2 } from 'lucide-react'
import PlatformBrand from './PlatformBrand'
import AccountNotifications from './AccountNotifications'
import AdminPageNavigation from './AdminPageNavigation'
import { supabase } from '../lib/supabase'

type ProfileRow = { id: string; display_name: string; phone: string | null; contact_email: string | null; address: string | null; created_at: string }
type ProfileForm = { display_name: string; phone: string; contact_email: string; address: string }
const emptyProfile: ProfileForm = { display_name: '', phone: '', contact_email: '', address: '' }
type OrganizationRow = { id: string; name: string; organization_type: 'individual_owner' | 'company' | 'fleet_supplier'; approval_status: 'pending_review' | 'approved' | 'rejected' | 'suspended'; city: string | null; contact_name: string | null; contact_email: string | null; address: string | null; company_type: string | null; fleet_vehicle_count: number | null; created_at: string }
type OrganizationForm = { name: string; organization_type: 'individual_owner' | 'company' | 'fleet_supplier'; city: string; contact_name: string; contact_email: string; address: string; company_type: string; fleet_vehicle_count: string }
const emptyOrganization: OrganizationForm = { name: '', organization_type: 'company', city: '', contact_name: '', contact_email: '', address: '', company_type: '', fleet_vehicle_count: '' }
type VehicleRow = { id: string; make: string; model: string; model_year: number; vehicle_type: string; transmission: string; seats: number; governorate: string; address: string; monthly_price_egp: number; yearly_price_egp: number | null; with_driver: boolean; notes: string | null; review_status: string; payment_status: string; organizations: { name: string } | { name: string }[] | null; images?: { url: string; alt_text: string }[] }
type VehicleEditForm = { make: string; model: string; model_year: string; monthly_price_egp: string; yearly_price_egp: string; address: string; notes: string; review_status: 'pending_review' | 'approved' | 'rejected' }
const emptyVehicleEdit: VehicleEditForm = { make: '', model: '', model_year: '', monthly_price_egp: '', yearly_price_egp: '', address: '', notes: '', review_status: 'pending_review' }
type RentalRequestRow = { id: string; title: string; vehicle_type: string; quantity: number; duration_type: string; duration_months: number; governorate: string; with_driver: boolean; details: string | null; status: string; created_at: string; organizations: { name: string } | { name: string }[] | null }
type RentalOfferRow = { id: string; request_id: string; monthly_price_egp: number; yearly_price_egp: number | null; vehicle_count: number; message: string | null; status: string; created_at: string; organizations: { name: string } | { name: string }[] | null; rental_requests: { title: string } | { title: string }[] | null }
type AdvertisingPlanOption = { id: string; name: string; duration_days: number; price_egp: number; placement_type: string; is_active: boolean }
type PromotionEditForm = { advertising_plan_id: string; starts_at: string; ends_at: string; admin_notes: string }
type PromotionRow = { id: string; vehicle_id: string; organization_id: string; advertising_plan_id: string; status: string; payment_status: string; payment_reference: string | null; previous_payment_reference: string | null; previous_payment_amount_egp: number | null; coupon_code: string | null; original_amount_egp: number | null; discount_amount_egp: number; final_amount_egp: number | null; payment_due_egp: number | null; previous_payment_credit_egp: number | null; plan_name_snapshot: string; plan_description_snapshot: string; plan_duration_days_snapshot: number; plan_price_egp_snapshot: number; plan_features_snapshot: string[]; plan_display_order_snapshot: number; plan_placement_type_snapshot: string; admin_notes: string | null; created_at: string; starts_at: string | null; ends_at: string | null; vehicles: { make: string; model: string; model_year: number; governorate: string } | { make: string; model: string; model_year: number; governorate: string }[] | null; organizations: { name: string; organization_type: string; contact_name: string | null; contact_email: string | null } | { name: string; organization_type: string; contact_name: string | null; contact_email: string | null }[] | null; advertising_plans: { name: string; duration_days: number; price_egp: number; placement_type: string } | { name: string; duration_days: number; price_egp: number; placement_type: string }[] | null }
type PaymentRow = { id: string; vehicle_id: string; amount_egp: number; period_months: number; transfer_method: string; transfer_reference: string; review_status: string; admin_notes: string | null; proof_path: string | null; created_at: string; vehicles: { make: string; model: string; model_year?: number; vehicle_type?: string; governorate?: string; monthly_price_egp?: number; review_status?: string } | { make: string; model: string; model_year?: number; vehicle_type?: string; governorate?: string; monthly_price_egp?: number; review_status?: string }[] | null; organizations: { name: string; organization_type?: string } | { name: string; organization_type?: string }[] | null }

function promotionTransferKeys(value: string | null | undefined) {
  return String(value || '').split(/\n---\n/).map(reference => reference.split('—')[1] || '')
    .map(reference => reference.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s/g, '').toLowerCase())
    .filter(Boolean)
}
function hasDuplicateTransferReference(row: PromotionRow, rows: PromotionRow[]) {
  const ownKeys = [...promotionTransferKeys(row.payment_reference), ...promotionTransferKeys(row.previous_payment_reference)]
  if (!ownKeys.length) return false
  return rows.some(other => other.id !== row.id && [...promotionTransferKeys(other.payment_reference), ...promotionTransferKeys(other.previous_payment_reference)].some(key => ownKeys.includes(key)))
}

export default function AdminReviewPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [vehicleEditForm, setVehicleEditForm] = useState<VehicleEditForm>(emptyVehicleEdit)
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile)
  const [savingProfile, setSavingProfile] = useState(false)
  const [organizationForm, setOrganizationForm] = useState<OrganizationForm>(emptyOrganization)
  const [editingOrganizationId, setEditingOrganizationId] = useState<string | null>(null)
  const [savingOrganization, setSavingOrganization] = useState(false)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [advertisingPlans, setAdvertisingPlans] = useState<AdvertisingPlanOption[]>([])
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null)
  const [promotionEditForm, setPromotionEditForm] = useState<PromotionEditForm>({ advertising_plan_id: '', starts_at: '', ends_at: '', admin_notes: '' })
  const [paymentProofUrls, setPaymentProofUrls] = useState<Record<string, string>>({})
  const [rentalRequests, setRentalRequests] = useState<RentalRequestRow[]>([])
  const [rentalOffers, setRentalOffers] = useState<RentalOfferRow[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState('')
  async function load() {
    if (!supabase) { window.location.replace('/?login=1'); return }
    const client = supabase
    setLoading(true); setError('')
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) { window.location.replace('/?login=1'); return }
    const { data: admin, error: adminError } = await supabase.from('platform_admins').select('user_id').eq('user_id',auth.user.id).maybeSingle()
    if (adminError) { setError('تعذر التحقق من صلاحية الإدارة. تأكد من تطبيق Migration صلاحيات المراجعة.'); setLoading(false); return }
    if (!admin) { setError('هذا الحساب غير مفعّل كمسؤول للمنصة. لا يمكن فتح لوحة المراجعة.'); setAuthorized(false); setLoading(false); return }
    setAuthorized(true)
    const [vehicleResult,paymentResult,organizationResult,profileResult,requestResult,offerResult,promotionResult,advertisingPlanResult] = await Promise.all([
      supabase.from('vehicles').select('id,make,model,model_year,vehicle_type,transmission,seats,governorate,address,monthly_price_egp,yearly_price_egp,with_driver,notes,review_status,payment_status,organizations(name)').order('created_at',{ascending:false}),
      supabase.from('vehicle_payment_submissions').select('id,vehicle_id,amount_egp,period_months,transfer_method,transfer_reference,review_status,admin_notes,proof_path,created_at,vehicles(make,model,model_year,vehicle_type,governorate,monthly_price_egp,review_status),organizations(name,organization_type)').order('created_at',{ascending:false}),
      supabase.from('organizations').select('id,name,organization_type,approval_status,city,contact_name,contact_email,address,company_type,fleet_vehicle_count,created_at').order('created_at',{ascending:false}),
      supabase.from('profiles').select('id,display_name,phone,contact_email,address,created_at').order('created_at',{ascending:false}),
      supabase.from('rental_requests').select('id,title,vehicle_type,quantity,duration_type,duration_months,governorate,with_driver,details,status,created_at,organizations(name)').order('created_at',{ascending:false}),
      supabase.from('rental_offers').select('id,request_id,monthly_price_egp,yearly_price_egp,vehicle_count,message,status,created_at,organizations(name),rental_requests(title)').order('created_at',{ascending:false}),
      supabase.from('vehicle_promotions').select('id,vehicle_id,organization_id,advertising_plan_id,status,payment_status,payment_reference,previous_payment_reference,previous_payment_amount_egp,coupon_code,original_amount_egp,discount_amount_egp,final_amount_egp,payment_due_egp,previous_payment_credit_egp,plan_name_snapshot,plan_description_snapshot,plan_duration_days_snapshot,plan_price_egp_snapshot,plan_features_snapshot,plan_display_order_snapshot,plan_placement_type_snapshot,admin_notes,created_at,starts_at,ends_at,vehicles(make,model,model_year,governorate),organizations(name,organization_type,contact_name,contact_email),advertising_plans(name,duration_days,price_egp,placement_type)').order('created_at',{ascending:false}),
      supabase.from('advertising_plans').select('id,name,duration_days,price_egp,placement_type,is_active').order('display_order',{ascending:true}).order('created_at',{ascending:true})
    ])
    if (promotionResult.error) setError('تعذر تحميل طلبات الإعلانات: ' + promotionResult.error.message); else setPromotions((promotionResult.data || []) as unknown as PromotionRow[])
    if (advertisingPlanResult.error) setError('تعذر تحميل باقات الإعلانات: ' + advertisingPlanResult.error.message); else setAdvertisingPlans((advertisingPlanResult.data || []) as AdvertisingPlanOption[])
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
    if (paymentResult.error) setError(paymentResult.error.message); else {
      const paymentRows = (paymentResult.data || []) as unknown as PaymentRow[]
      setPayments(paymentRows)
      const proofEntries = await Promise.all(paymentRows.filter(p => p.proof_path).map(async p => {
        const { data, error: proofError } = await client.storage.from('payment-proofs').createSignedUrl(p.proof_path!, 300)
        return !proofError && data?.signedUrl ? [p.id, data.signedUrl] as const : null
      }))
      setPaymentProofUrls(Object.fromEntries(proofEntries.filter((entry): entry is readonly [string, string] => entry !== null)))
    }
    if (organizationResult.error) setError('تعذر تحميل المؤسسات: ' + organizationResult.error.message); else setOrganizations((organizationResult.data || []) as OrganizationRow[])
    if (profileResult.error) setError('تعذر تحميل الحسابات: ' + profileResult.error.message); else setProfiles((profileResult.data || []) as ProfileRow[])
    if (requestResult.error) setError('تعذر تحميل طلبات التأجير: ' + requestResult.error.message); else setRentalRequests((requestResult.data || []) as unknown as RentalRequestRow[])
    if (offerResult.error) setError('تعذر تحميل عروض التأجير: ' + offerResult.error.message); else setRentalOffers((offerResult.data || []) as unknown as RentalOfferRow[])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])
  function startProfileEdit(row: ProfileRow) {
    setEditingProfileId(row.id)
    setProfileForm({ display_name: row.display_name || '', phone: row.phone || '', contact_email: row.contact_email || '', address: row.address || '' })
    setError(''); setNotice('')
  }
  async function deleteAdminRecord(table: 'organizations' | 'rental_requests' | 'rental_offers' | 'vehicle_payment_submissions', id: string, label: string) {
    if (!supabase) return
    const confirmed = window.confirm('هل تريد حذف ' + label + ' نهائيًا؟ قد يتعذر الحذف إذا كانت هناك سجلات مرتبطة أو قيود حماية. لا يمكن التراجع عن الحذف الناجح.')
    if (!confirmed) return
    setBusyId(id); setError(''); setNotice('')
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    setBusyId('')
    if (deleteError) { setError('تعذر حذف ' + label + ': ' + deleteError.message); return }
    setNotice('تم حذف ' + label + ' بنجاح.')
    await load()
  }

  async function deleteAccount(profile: ProfileRow) {
    if (!supabase) return
    const confirmed = window.confirm('حذف حساب الدخول نهائيًا للمستخدم "' + profile.display_name + '"؟ سيتم حذف الحساب من نظام تسجيل الدخول ولا يمكن التراجع عن ذلك. احتفظ بأي بيانات مطلوبة قبل المتابعة.')
    if (!confirmed) return
    setBusyId(profile.id); setError(''); setNotice('')
    const { error: deleteError } = await supabase.functions.invoke('admin-delete-user', { body: { user_id: profile.id } })
    setBusyId('')
    if (deleteError) {
      let detail = deleteError.message
      try {
        const response = (deleteError as any).context as Response | undefined
        if (response) {
          const payload = await response.clone().json()
          if (typeof payload?.error === 'string' && payload.error.trim()) detail = payload.error
        }
      } catch { /* Keep the SDK message when no structured response is available. */ }
      setError('تعذر حذف حساب الدخول: ' + detail)
      return
    }
    setNotice('تم حذف حساب المستخدم نهائيًا.')
    if (editingProfileId === profile.id) { setEditingProfileId(null); setProfileForm(emptyProfile) }
    await load()
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !editingProfileId || !profileForm.display_name.trim()) return
    setSavingProfile(true); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('profiles').update({ display_name: profileForm.display_name.trim(), phone: profileForm.phone.trim() || null, contact_email: profileForm.contact_email.trim() || null, address: profileForm.address.trim() || null }).eq('id', editingProfileId)
    setSavingProfile(false)
    if (updateError) { setError('تعذر تحديث بيانات الحساب: ' + updateError.message); return }
    setNotice('تم تحديث بيانات الحساب. لم يتم تغيير البريد الأساسي أو كلمة المرور.')
    setEditingProfileId(null); setProfileForm(emptyProfile)
    await load()
  }

  function startVehicleEdit(row: VehicleRow) {
    setEditingVehicleId(row.id)
    setVehicleEditForm({ make: row.make || '', model: row.model || '', model_year: String(row.model_year || ''), monthly_price_egp: String(row.monthly_price_egp ?? ''), yearly_price_egp: row.yearly_price_egp == null ? '' : String(row.yearly_price_egp), address: row.address || '', notes: row.notes || '', review_status: row.review_status === 'approved' || row.review_status === 'rejected' ? row.review_status : 'pending_review' })
    setError(''); setNotice('')
  }
  async function saveVehicle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !editingVehicleId) return
    const year = Number(vehicleEditForm.model_year), monthly = Number(vehicleEditForm.monthly_price_egp), yearly = vehicleEditForm.yearly_price_egp.trim() ? Number(vehicleEditForm.yearly_price_egp) : null
    if (!vehicleEditForm.make.trim() || !vehicleEditForm.model.trim() || !Number.isInteger(year) || year < 1950 || year > new Date().getFullYear()+1 || !Number.isFinite(monthly) || monthly <= 0 || (yearly !== null && (!Number.isFinite(yearly) || yearly <= 0))) { setError('راجع الماركة والموديل وسنة الصنع والأسعار. يجب أن تكون الأسعار أرقامًا موجبة.'); return }
    setSavingVehicle(true); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('vehicles').update({ make: vehicleEditForm.make.trim(), model: vehicleEditForm.model.trim(), model_year: year, monthly_price_egp: monthly, yearly_price_egp: yearly, address: vehicleEditForm.address.trim() || null, notes: vehicleEditForm.notes.trim() || null, review_status: vehicleEditForm.review_status }).eq('id', editingVehicleId)
    setSavingVehicle(false)
    if (updateError) { setError('تعذر حفظ تعديلات السيارة: ' + updateError.message); return }
    setNotice('تم تحديث بيانات السيارة وحالة المراجعة.')
    setEditingVehicleId(null); setVehicleEditForm(emptyVehicleEdit)
    await load()
  }
  async function updateRentalRequestStatus(row: RentalRequestRow, status: 'open' | 'closed') {
    if (!supabase || row.status === status) return
    if (status === 'closed' && !window.confirm('إغلاق الطلب سيوقف استقبال عروض جديدة. هل تريد المتابعة؟')) return
    setBusyId(row.id); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('rental_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', row.id)
    setBusyId('')
    if (updateError) { setError('تعذر تحديث حالة الطلب: ' + updateError.message); return }
    setNotice(status === 'open' ? 'تم فتح الطلب لاستقبال العروض.' : 'تم إغلاق الطلب.')
    await load()
  }
  async function deleteVehicle(row: VehicleRow) {
    if (!supabase) return
    const confirmed = window.confirm('حذف السيارة ' + row.make + ' ' + row.model + ' نهائيًا؟ سيتم حذف صورها وسجل تحويلات التسجيل المرتبط بها، ولا يمكن التراجع عن ذلك.')
    if (!confirmed) return
    setBusyId(row.id); setError(''); setNotice('')
    const { data: imageRows, error: imageLookupError } = await supabase.from('vehicle_images').select('storage_path').eq('vehicle_id', row.id)
    if (imageLookupError) { setBusyId(''); setError('تعذر تجهيز حذف صور السيارة: ' + imageLookupError.message); return }
    const paths = (imageRows || []).map(image => image.storage_path).filter(Boolean)
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from('vehicle-images').remove(paths)
      if (storageError) { setBusyId(''); setError('تعذر حذف صور السيارة من التخزين، لذلك لم يتم حذف سجل السيارة: ' + storageError.message); return }
    }
    const { error: deleteError } = await supabase.from('vehicles').delete().eq('id', row.id)
    setBusyId('')
    if (deleteError) { setError('تعذر حذف السيارة: ' + deleteError.message); return }
    if (editingVehicleId === row.id) { setEditingVehicleId(null); setVehicleEditForm(emptyVehicleEdit) }
    setNotice('تم حذف السيارة وصورها وسجل تحويلاتها المرتبط بها.')
    await load()
  }

  async function reviewPromotion(row: PromotionRow, status: 'approved' | 'rejected') {
    if (!supabase || row.status !== 'pending_review' || row.payment_status !== 'pending') return
    const priorAmount=Number(row.previous_payment_amount_egp??row.previous_payment_credit_egp??0)
    const dueAmount=Number(row.payment_due_egp??row.final_amount_egp??0)
    if(status==='approved'&&priorAmount>0&&!String(row.previous_payment_reference||'').trim()){
      setError('لا يمكن اعتماد رصيد تحويل سابق دون وجود مراجع التحويل المحفوظة.');return
    }
    if(status==='approved'&&hasDuplicateTransferReference(row,promotions)){
      setError('تم رصد رقم تحويل مكرر في سجل إعلان آخر. لا تعتمد الطلب قبل مطابقة الرقم مع كشف الحساب وحل التكرار.');return
    }
    if(status==='approved'&&dueAmount>0&&(!String(row.payment_reference||'').trim()||String(row.payment_reference||'').startsWith('لا يوجد فرق مستحق'))){
      setError('لا يمكن اعتماد الطلب قبل تسجيل مرجع التحويل الحالي.');return
    }
    if(status==='approved'&&priorAmount>0&&!window.confirm('هذا الطلب يتضمن تحويلات سابقة بقيمة '+priorAmount.toLocaleString('ar-EG')+' جنيه. هل تحققت يدويًا من جميع مراجع التحويل السابقة، بالإضافة إلى التحويل الحالي إن وُجد، قبل اعتماد الإعلان؟'))return
    const note = window.prompt(status === 'rejected' ? 'اكتب سبب رفض طلب الإعلان ليظهر لصاحب السيارة:' : 'ملاحظات الإدارة (اختياري):', '')
    if (note === null) return
    if (status === 'rejected' && !note.trim()) { setError('يجب كتابة سبب واضح لرفض طلب الإعلان.'); return }
    setBusyId(row.id); setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const { data: updated, error: updateError } = await supabase.from('vehicle_promotions').update({
      status,
      payment_status: status === 'approved' ? (Number(row.payment_due_egp ?? row.final_amount_egp ?? 0) > 0 ? 'verified' : 'waived') : 'rejected',
      admin_notes: [status==='approved'&&priorAmount>0?'أقر المسؤول بالتحقق اليدوي من جميع مراجع التحويلات السابقة والحالية.':'',note.trim()].filter(Boolean).join('\n') || null,
      reviewed_by: auth.user?.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', row.id).eq('status', 'pending_review').eq('payment_status', 'pending').select('id').maybeSingle()
    setBusyId('')
    if (updateError) { setError('تعذر تحديث طلب الإعلان: ' + updateError.message); return }
    if (!updated) { setError('لم يتم تحديث الطلب؛ ربما تمت مراجعته من مسؤول آخر. حدّث الصفحة للتحقق.'); return }
    setNotice(status === 'approved' ? 'تم اعتماد الإعلان وتأكيد الدفع وتفعيل مدة الباقة.' : 'تم رفض طلب الإعلان وتسجيل سبب الرفض.')
    await load()
  }

  function startPromotionEdit(row: PromotionRow) {
    setEditingPromotionId(row.id)
    const toLocalInput = (value: string | null) => {
      if (!value) return ''
      const date = new Date(value)
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      return local.toISOString().slice(0, 16)
    }
    setPromotionEditForm({
      advertising_plan_id: row.advertising_plan_id,
      starts_at: toLocalInput(row.starts_at),
      ends_at: toLocalInput(row.ends_at),
      admin_notes: row.admin_notes || ''
    })
    setError(''); setNotice('')
  }

  async function savePromotionEdit(row: PromotionRow) {
    if (!supabase || row.status !== 'approved' || !['verified', 'waived'].includes(row.payment_status)) return
    if (!promotionEditForm.advertising_plan_id || !promotionEditForm.starts_at || !promotionEditForm.ends_at) {
      setError('اختر باقة الإعلان وحدد تاريخ البداية والنهاية.'); return
    }
    const startsAt = new Date(promotionEditForm.starts_at)
    const endsAt = new Date(promotionEditForm.ends_at)
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
      setError('تاريخ نهاية الإعلان يجب أن يكون بعد تاريخ بدايته.'); return
    }
    const selectedPlan = advertisingPlans.find(plan => plan.id === promotionEditForm.advertising_plan_id)
    if (!selectedPlan) { setError('باقة الإعلان المحددة غير موجودة. حدّث الصفحة وحاول مرة أخرى.'); return }
    if (!selectedPlan.is_active && selectedPlan.id !== row.advertising_plan_id) {
      setError('لا يمكن نقل الإعلان إلى باقة غير مفعّلة. اختر باقة مفعّلة أو اترك الباقة الحالية كما هي.')
      return
    }
    setBusyId(row.id); setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const { data: updated, error: updateError } = await supabase.from('vehicle_promotions').update({
      advertising_plan_id: selectedPlan.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      admin_notes: promotionEditForm.admin_notes.trim() || null,
      reviewed_by: auth.user?.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', row.id).eq('status', 'approved').in('payment_status', ['verified', 'waived']).select('id').maybeSingle()
    setBusyId('')
    if (updateError) { setError('تعذر تعديل الإعلان: ' + updateError.message); return }
    if (!updated) { setError('لم يتم تعديل الإعلان؛ ربما تغيرت حالته. حدّث الصفحة للتحقق.'); return }
    setEditingPromotionId(null)
    setNotice('تم حفظ تعديلات الإعلان المنشور وإرسال إشعار لصاحب السيارة عند تغيير المدة.')
    await load()
  }

  async function removePublishedPromotion(row: PromotionRow) {
    if (!supabase || row.status !== 'approved' || !['verified', 'waived'].includes(row.payment_status)) return
    const reason = window.prompt('اكتب سبب حذف الإعلان من الكتالوج. سيُحفظ سجل الدفع والمراجعة لأغراض المتابعة:', '')
    if (reason === null) return
    if (!reason.trim()) { setError('اكتب سبب حذف الإعلان أولًا.'); return }
    if (!window.confirm('سيتم إيقاف ظهور الإعلان فورًا مع الاحتفاظ بسجل الدفع والبروموكود. هل تريد المتابعة؟')) return
    setBusyId(row.id); setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const { data: updated, error: updateError } = await supabase.from('vehicle_promotions').update({
      status: 'cancelled',
      admin_notes: [row.admin_notes, 'حذف إداري: ' + reason.trim()].filter(Boolean).join('\n'),
      reviewed_by: auth.user?.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', row.id).eq('status', 'approved').in('payment_status', ['verified', 'waived']).select('id').maybeSingle()
    setBusyId('')
    if (updateError) { setError('تعذر حذف الإعلان: ' + updateError.message); return }
    if (!updated) { setError('لم يتم حذف الإعلان؛ ربما تغيرت حالته. حدّث الصفحة للتحقق.'); return }
    if (editingPromotionId === row.id) setEditingPromotionId(null)
    setNotice('تم حذف الإعلان من الكتالوج مع الاحتفاظ بسجل الدفع والمراجعة، وإرسال إشعار لصاحب السيارة.')
    await load()
  }

  async function reviewPayment(row: PaymentRow, status: 'approved' | 'rejected') {
    if (!supabase || row.review_status !== 'pending') return
    const note = window.prompt(status === 'rejected' ? 'اكتب سبب رفض التحويل ليظهر في سجل المراجعة:' : 'ملاحظات الإدارة (اختياري):', '')
    if (note === null) return
    if (status === 'rejected' && !note.trim()) { setError('يجب كتابة سبب واضح لرفض التحويل.'); return }
    setBusyId(row.id); setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const { error: paymentError } = await supabase.from('vehicle_payment_submissions').update({ review_status: status, admin_notes: note.trim() || null, reviewed_by: auth.user?.id, reviewed_at: new Date().toISOString() }).eq('id',row.id).eq('review_status','pending')
    if (paymentError) { setBusyId(''); setError(paymentError.message); return }
    const { error: vehicleError } = await supabase.from('vehicles').update(
      status === 'approved'
        ? { review_status: 'approved', payment_status: 'verified' }
        : { review_status: 'rejected', payment_status: 'pending' }
    ).eq('id', row.vehicle_id)
    if (vehicleError) { setBusyId(''); setError('تم تسجيل قرار التحويل لكن تعذر تحديث حالة السيارة: ' + vehicleError.message + '. راجع الملف قبل إعادة المحاولة.'); return }
    setBusyId('')
    setNotice(status === 'approved' ? 'تم اعتماد ملف السيارة وقبول رسوم تسجيلها معًا.' : 'تم رفض ملف تسجيل السيارة وإثبات الدفع وإعادتهما للتصحيح.');
    await load()
  }

  async function reviewOrganization(id: string, status: 'approved' | 'rejected') {
    if (!supabase) return
    const note = status === 'rejected' ? window.prompt('اكتب سبب رفض الحساب (اختياري):', '') : null
    if (status === 'rejected' && note === null) return
    setBusyId(id); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('organizations').update({ approval_status: status }).eq('id', id)
    setBusyId('')
    if (updateError) { setError('تعذر تحديث حالة الحساب: ' + updateError.message); return }
    setNotice(status === 'approved' ? 'تم اعتماد الحساب بنجاح.' : 'تم رفض الحساب.')
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
  async function signOut() { if (supabase) await supabase.auth.signOut(); window.location.replace('/') }
  const methodName: Record<string,string> = { instapay:'InstaPay', vodafone_cash:'Vodafone Cash', bank_transfer:'تحويل بنكي' }
  return <main dir="rtl" className="mc-admin-main min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/60 px-4 py-6 sm:px-6 sm:py-8"><div className="mx-auto max-w-6xl">
    <header className="mc-admin-header flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white bg-white/95 p-5 shadow-md shadow-slate-200/50"><div><div className="flex items-center gap-2"><PlatformBrand compact /><span className="text-sm font-bold text-slate-500">· الإدارة</span></div><h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">مراجعة السيارات والتحويلات</h1><p className="mt-2 text-sm text-slate-500">لا يتم اعتماد السيارة أو تأكيد الدفع إلا بمراجعة المسؤول.</p></div><div className="mc-admin-actions flex flex-wrap items-center gap-2"><AccountNotifications/><a href="/workspace/admin/platform-settings" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"><Settings size={16}/> إعدادات المنصة</a><a href="/workspace/admin/subscription-plans" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"><Settings size={16}/> أسعار الاشتراكات</a><a href="/workspace/admin/advertising-plans" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"><Settings size={16}/> باقات الإعلانات</a><button onClick={() => void load()} className="rounded-xl border p-3" aria-label="تحديث"><RefreshCw size={17}/></button><button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><LogOut size={16}/> خروج</button></div></header>
    <AdminPageNavigation />
    <nav aria-label="أقسام لوحة الإدارة" className="mc-admin-anchor-nav sticky top-2 z-20 mt-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-sm backdrop-blur">{[{href:"#admin-accounts",label:"الحسابات"},{href:"#admin-organizations",label:"المؤسسات"},{href:"#admin-rental-requests",label:"طلبات التأجير"},{href:"#admin-rental-offers",label:"العروض"},{href:"#admin-vehicles",label:"السيارات"},{href:"#admin-payments",label:"طلبات تسجيل السيارات والدفع"}].map(item=><a key={item.href} href={item.href} className="inline-flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-800">{item.label}</a>)}</nav>
    {error && <p role="alert" className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-7 text-red-800">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">{notice}</p>}
    {loading ? <p className="py-12 text-center text-slate-500">جارٍ تحميل المراجعات...</p> : authorized && <>

      <section className="mt-7 rounded-3xl border border-white bg-white/95 p-5 shadow-md shadow-slate-200/50" id="admin-accounts">
        <div className="flex items-center gap-2"><UserRound size={21}/><h2 className="text-xl font-extrabold">إدارة بيانات الحسابات ({profiles.length})</h2></div>
        <p className="mt-1 text-sm text-slate-500">عرض وتعديل الاسم وبيانات التواصل فقط. تغيير البريد الأساسي أو كلمة المرور أو حذف حساب الدخول يحتاج إجراءً إداريًا آمنًا منفصلًا.</p>
        <div className="mt-4 space-y-3">
          {profiles.map(profile=><article key={profile.id} className="rounded-xl border p-4">
            {editingProfileId === profile.id ? <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">الاسم الظاهر *<input required maxLength={160} value={profileForm.display_name} onChange={e=>setProfileForm({...profileForm,display_name:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label>
              <label className="text-sm font-bold">هاتف التواصل<input maxLength={40} value={profileForm.phone} onChange={e=>setProfileForm({...profileForm,phone:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label>
              <label className="text-sm font-bold">بريد التواصل<input type="email" maxLength={254} value={profileForm.contact_email} onChange={e=>setProfileForm({...profileForm,contact_email:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label>
              <label className="text-sm font-bold">العنوان<input maxLength={300} value={profileForm.address} onChange={e=>setProfileForm({...profileForm,address:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label>
              <div className="flex gap-2 sm:col-span-2"><button disabled={savingProfile} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingProfile ? 'جارٍ الحفظ...' : 'حفظ بيانات الحساب'}</button><button type="button" onClick={()=>{setEditingProfileId(null);setProfileForm(emptyProfile)}} className="rounded-lg border px-4 py-2 text-sm font-bold">إلغاء</button></div>
            </form> : <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-extrabold">{profile.display_name}</h3><p className="mt-1 text-sm text-slate-600">{profile.contact_email || 'لا يوجد بريد تواصل'} · {profile.phone || 'لا يوجد هاتف'}</p><p className="mt-1 text-xs text-slate-500">{profile.address || 'لا يوجد عنوان'} · تاريخ إنشاء الملف: {new Date(profile.created_at).toLocaleDateString('ar-EG')}</p><p className="mt-1 break-all text-[11px] text-slate-400">معرّف الحساب: {profile.id}</p></div>
              <div className="flex flex-wrap gap-2"><button onClick={()=>startProfileEdit(profile)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-bold"><Pencil size={15}/> تعديل البيانات</button><button disabled={busyId===profile.id} onClick={()=>void deleteAccount(profile)} className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800 disabled:opacity-50"><Trash2 size={15}/> {busyId===profile.id ? "جارٍ الحذف..." : "حذف الحساب نهائيًا"}</button></div>
            </div>}
          </article>)}
          {profiles.length===0 && <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">لا توجد ملفات شخصية ظاهرة.</p>}
        </div>
      </section>
      <section className="mt-7 rounded-3xl border border-white bg-white/95 p-5 shadow-md shadow-slate-200/50" id="admin-organizations">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-xl font-extrabold"><Building2 size={21}/> مراجعة الحسابات والمؤسسات ({organizations.length})</h2><p className="mt-1 text-sm text-slate-500">راجع نوع الحساب وبيانات المؤسسة، ثم اعتمد الحساب أو ارفضه. اعتماد الحساب منفصل عن اعتماد السيارات والتحويلات.</p></div>
          <button onClick={() => { resetOrganizationForm(); setNotice(''); setError('') }} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white"><Plus size={16}/> مؤسسة جديدة</button>
        </div>
        <form onSubmit={saveOrganization} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <label className="text-sm font-bold">اسم المؤسسة *
            <input required value={organizationForm.name} onChange={e=>setOrganizationForm({...organizationForm,name:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={160}/>
          </label>
          <label className="text-sm font-bold">نوع الحساب
            {editingOrganizationId && <span className="mr-2 text-xs font-normal text-slate-500">لا يمكن تغيير نوع حساب مؤسسة قائمة لتجنب تعطيل وصول أعضائها.</span>}
            <select value={organizationForm.organization_type} disabled={Boolean(editingOrganizationId)} onChange={e=>setOrganizationForm({...organizationForm,organization_type:e.target.value as OrganizationForm['organization_type']})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
              <option value="individual_owner">مالك سيارة</option><option value="company">شركة طالبة</option><option value="fleet_supplier">مورد أسطول</option>
            </select>
          </label>
          <label className="text-sm font-bold">المدينة<input value={organizationForm.city} onChange={e=>setOrganizationForm({...organizationForm,city:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={100}/></label>
          <label className="text-sm font-bold">اسم مسؤول التواصل<input value={organizationForm.contact_name} onChange={e=>setOrganizationForm({...organizationForm,contact_name:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={160}/></label>
          <label className="text-sm font-bold">البريد الإلكتروني<input type="email" value={organizationForm.contact_email} onChange={e=>setOrganizationForm({...organizationForm,contact_email:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={254}/></label>
          <label className="text-sm font-bold">العنوان<input value={organizationForm.address} onChange={e=>setOrganizationForm({...organizationForm,address:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={300}/></label>
          {organizationForm.organization_type === 'company' && <label className="text-sm font-bold">نشاط الشركة<input value={organizationForm.company_type} onChange={e=>setOrganizationForm({...organizationForm,company_type:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" maxLength={120}/></label>}
          {organizationForm.organization_type === 'fleet_supplier' && <label className="text-sm font-bold">عدد سيارات الأسطول<input type="number" min="0" step="1" value={organizationForm.fleet_vehicle_count} onChange={e=>setOrganizationForm({...organizationForm,fleet_vehicle_count:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"/></label>}
          <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={savingOrganization} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingOrganization ? 'جارٍ الحفظ...' : editingOrganizationId ? 'حفظ التعديلات' : 'إضافة المؤسسة'}</button><button type="button" onClick={resetOrganizationForm} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">إلغاء</button></div>
        </form>
        <div className="mt-4 space-y-2">
          {organizations.map(org=><article key={org.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div><h3 className="font-extrabold">{org.name}</h3><p className="mt-1 text-sm text-slate-600">{org.organization_type === 'individual_owner' ? 'مالك سيارة' : org.organization_type === 'fleet_supplier' ? 'مورد أسطول' : 'شركة طالبة'} · {org.city || 'المدينة غير محددة'}</p><p className="mt-1 text-xs text-slate-500">{org.contact_name || 'بدون مسؤول تواصل'} · {org.contact_email || 'بدون بريد مسجل'}{org.fleet_vehicle_count == null ? '' : ' · أسطول: ' + org.fleet_vehicle_count + ' سيارة'}</p><p className="mt-2 text-sm font-bold">حالة الحساب: {org.approval_status === 'approved' ? 'معتمد' : org.approval_status === 'rejected' ? 'مرفوض' : org.approval_status === 'suspended' ? 'موقوف' : 'بانتظار المراجعة'}</p></div>
            <div className="flex flex-wrap gap-2"><button onClick={()=>startOrganizationEdit(org)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-bold"><Pencil size={15}/> تعديل</button><button disabled={busyId===org.id} onClick={()=>void deleteAdminRecord("organizations",org.id,"المؤسسة")} className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800 disabled:opacity-50"><Trash2 size={15}/> حذف</button>{org.approval_status !== 'approved' && <button disabled={busyId===org.id} onClick={()=>void reviewOrganization(org.id,'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 size={15}/> اعتماد الحساب</button>}{org.approval_status !== 'rejected' && <button disabled={busyId===org.id} onClick={()=>void reviewOrganization(org.id,'rejected')} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50"><XCircle size={15}/> رفض الحساب</button>}</div>
          </article>)}
          {organizations.length===0 && <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">لا توجد مؤسسات مسجلة.</p>}
        </div>
      </section>

      <section className="mt-7 rounded-3xl border border-white bg-white/95 p-5 shadow-md shadow-slate-200/50" id="admin-rental-requests">
        <h2 className="text-xl font-extrabold">إدارة طلبات التأجير ({rentalRequests.length})</h2>
        <p className="mt-1 text-sm text-slate-500">متابعة الطلبات الواردة وفتحها أو إغلاقها. إغلاق الطلب يوقف استقبال عروض جديدة دون حذف سجل الطلب أو عروضه السابقة.</p>
        <div className="mt-4 space-y-3">
          {rentalRequests.map(row=><article key={row.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-extrabold">{row.title}</h3><p className="mt-1 text-sm text-slate-600">{(Array.isArray(row.organizations)?row.organizations[0]?.name:row.organizations?.name) || 'شركة غير محددة'} · {row.vehicle_type} · {row.quantity} سيارة</p><p className="mt-1 text-sm text-slate-500">{row.duration_type === 'yearly' ? 'سنوي' : 'شهري'} · {row.duration_months} شهر · {row.governorate} · {row.with_driver ? 'بسائق' : 'بدون سائق'}</p>{row.details && <p className="mt-2 text-sm leading-6">{row.details}</p>}<p className="mt-2 text-xs text-slate-400">{new Date(row.created_at).toLocaleString('ar-EG')} · عروض مرتبطة: {rentalOffers.filter(offer=>offer.request_id===row.id).length}</p></div>
              <div className="flex items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{row.status === 'open' ? 'مفتوح' : row.status === 'closed' ? 'مغلق' : row.status}</span><button disabled={busyId===row.id} onClick={()=>void updateRentalRequestStatus(row,row.status==='open'?'closed':'open')} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50">{busyId===row.id?'جارٍ الحفظ...':row.status==='open'?'إغلاق الطلب':'إعادة فتح الطلب'}</button><button disabled={busyId===row.id} onClick={()=>void deleteAdminRecord("rental_requests",row.id,"طلب التأجير")} className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800 disabled:opacity-50"><Trash2 size={15}/> حذف الطلب</button></div>
            </div>
          </article>)}
          {rentalRequests.length===0 && <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">لا توجد طلبات تأجير مسجلة حتى الآن.</p>}
        </div>
      </section>
      <section className="mt-7 rounded-3xl border border-white bg-white/95 p-5 shadow-md shadow-slate-200/50" id="admin-rental-offers">
        <h2 className="text-xl font-extrabold">متابعة عروض الموردين ({rentalOffers.length})</h2>
        <p className="mt-1 text-sm text-slate-500">عرض الأسعار والحالة المرتبطة بكل طلب. لا يتم تعديل أو حذف العروض هنا لتجنب التأثير على المفاوضات والمحادثات القائمة.</p>
        <div className="mt-4 space-y-3">
          {rentalOffers.map(row=><article key={row.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-extrabold">{(Array.isArray(row.organizations)?row.organizations[0]?.name:row.organizations?.name) || 'مورد غير محدد'}</h3><p className="mt-1 text-sm text-slate-600">الطلب: {(Array.isArray(row.rental_requests)?row.rental_requests[0]?.title:row.rental_requests?.title) || 'طلب غير محدد'}</p><p className="mt-1 text-sm text-slate-600">{row.vehicle_count} سيارة · {Number(row.monthly_price_egp).toLocaleString('ar-EG')} جنيه شهريًا{row.yearly_price_egp == null?'':' · '+Number(row.yearly_price_egp).toLocaleString('ar-EG')+' جنيه سنويًا'}</p>{row.message && <p className="mt-2 text-sm leading-6">{row.message}</p>}<p className="mt-2 text-xs text-slate-400">{new Date(row.created_at).toLocaleString('ar-EG')}</p></div><div className="flex flex-wrap items-start gap-2"><span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">الحالة: {row.status}</span><button disabled={busyId===row.id} onClick={()=>void deleteAdminRecord("rental_offers",row.id,"عرض المورد")} className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800 disabled:opacity-50"><Trash2 size={15}/> حذف العرض</button></div></div></article>)}
          {rentalOffers.length===0 && <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">لا توجد عروض مسجلة حتى الآن.</p>}
        </div>
      </section>
      <section className="mt-7" id="admin-vehicles"><h2 className="text-xl font-extrabold">بيانات السيارات المسجلة ({vehicles.length})</h2><div className="mt-4 space-y-3">{vehicles.map(v=><article key={v.id} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-6"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-extrabold">{v.make} {v.model} · {v.model_year}</h3><p className="mt-2 text-sm text-slate-600">{Array.isArray(v.organizations) ? v.organizations[0]?.name : v.organizations?.name} · {v.vehicle_type} · {v.governorate}</p><p className="mt-1 text-sm text-slate-500">سعر الإيجار: {Number(v.monthly_price_egp).toLocaleString('ar-EG')} جنيه شهريًا · الدفع: {v.payment_status === 'pending' ? 'لم يتم تأكيده' : v.payment_status}</p></div><span className={`rounded-full px-3 py-1 text-sm font-extrabold ${v.review_status === 'pending_payment' ? 'bg-amber-100 text-amber-800' : v.review_status === 'approved' ? 'bg-emerald-100 text-emerald-800' : v.review_status === 'rejected' ? 'bg-red-100 text-red-800' : v.review_status === 'paused' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>{v.review_status === 'pending_payment' ? 'بانتظار تأكيد الدفع' : v.review_status === 'approved' ? 'معتمدة' : v.review_status === 'rejected' ? 'مرفوضة / تحتاج تعديل' : v.review_status === 'paused' ? 'موقوفة' : 'قيد المراجعة'}</span></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{(v.images || []).map((image,index)=><a key={image.url} href={image.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border bg-slate-50"><img src={image.url} alt={image.alt_text || ('صورة السيارة ' + (index+1))} className="h-28 w-full object-cover" loading="lazy"/></a>)}{(!v.images || v.images.length===0) && <p className="col-span-2 rounded-xl border border-dashed p-3 text-sm text-slate-500 sm:col-span-4">لا توجد صور متاحة لهذه السيارة؛ لا تعتمدها قبل التحقق من الصور.</p>}</div><div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><p><strong>العنوان:</strong> {v.address || 'غير مسجل'}</p><p><strong>المقاعد:</strong> {v.seats || 'غير محدد'}</p><p><strong>ناقل الحركة:</strong> {v.transmission === 'automatic' ? 'أوتوماتيك' : v.transmission === 'manual' ? 'مانيوال' : v.transmission || 'غير محدد'}</p><p><strong>السائق:</strong> {v.with_driver ? 'متاح بسائق' : 'بدون سائق'}</p>{v.yearly_price_egp != null && <p><strong>السعر السنوي:</strong> {Number(v.yearly_price_egp).toLocaleString('ar-EG')} جنيه</p>}{v.notes && <p className="sm:col-span-2"><strong>ملاحظات المالك:</strong> {v.notes}</p>}</div><div className="mt-4 flex flex-wrap gap-2">  <button disabled={busyId===v.id} onClick={() => void startVehicleEdit(v)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><Pencil size={16}/> تعديل البيانات</button>  <button disabled={busyId===v.id} onClick={() => void deleteVehicle(v)} className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 disabled:opacity-50"><Trash2 size={16}/> حذف السيارة</button></div>{editingVehicleId === v.id && <form onSubmit={saveVehicle} className="mt-4 grid gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 sm:grid-cols-2">  <label className="text-sm font-bold">الماركة *<input required maxLength={80} value={vehicleEditForm.make} onChange={e=>setVehicleEditForm({...vehicleEditForm,make:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"/></label>  <label className="text-sm font-bold">الموديل *<input required maxLength={100} value={vehicleEditForm.model} onChange={e=>setVehicleEditForm({...vehicleEditForm,model:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"/></label>  <label className="text-sm font-bold">سنة الصنع *<input required type="number" min="1950" max={new Date().getFullYear()+1} step="1" value={vehicleEditForm.model_year} onChange={e=>setVehicleEditForm({...vehicleEditForm,model_year:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"/></label>  <label className="text-sm font-bold">السعر الشهري (جنيه) *<input required type="number" min="1" step="0.01" value={vehicleEditForm.monthly_price_egp} onChange={e=>setVehicleEditForm({...vehicleEditForm,monthly_price_egp:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"/></label>  <label className="text-sm font-bold">السعر السنوي (جنيه)<input type="number" min="1" step="0.01" value={vehicleEditForm.yearly_price_egp} onChange={e=>setVehicleEditForm({...vehicleEditForm,yearly_price_egp:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"/></label>  <label className="text-sm font-bold">حالة المراجعة<select value={vehicleEditForm.review_status} onChange={e=>setVehicleEditForm({...vehicleEditForm,review_status:e.target.value as VehicleEditForm["review_status"]})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"><option value="pending_review">قيد المراجعة</option><option value="approved">معتمدة</option><option value="rejected">مرفوضة / تحتاج تعديل</option></select></label>  <label className="text-sm font-bold sm:col-span-2">العنوان<input maxLength={300} value={vehicleEditForm.address} onChange={e=>setVehicleEditForm({...vehicleEditForm,address:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"/></label>  <label className="text-sm font-bold sm:col-span-2">ملاحظات<textarea rows={3} maxLength={2000} value={vehicleEditForm.notes} onChange={e=>setVehicleEditForm({...vehicleEditForm,notes:e.target.value})} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"/></label>  <div className="flex gap-2 sm:col-span-2"><button disabled={savingVehicle} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingVehicle ? "جارٍ الحفظ..." : "حفظ تعديلات السيارة"}</button><button type="button" onClick={()=>{setEditingVehicleId(null);setVehicleEditForm(emptyVehicleEdit)}} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">إلغاء</button></div></form>}</article>)}{vehicles.length===0 && <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">لا توجد سيارات تنتظر المراجعة.</p>}</div></section>
      <section className="mt-8" id="admin-payments"><h2 className="text-xl font-extrabold">طلبات تسجيل السيارات ورسومها ({payments.filter(p=>p.review_status==="pending").length} قيد المراجعة)</h2><p className="mt-1 text-sm text-slate-500">كل بطاقة تمثل ملفًا واحدًا يجمع بيانات السيارة وصورها وبيانات التحويل. قرار القبول أو الرفض يطبّق على السيارة والدفع معًا.</p><div className="mt-4 space-y-3">{payments.map(p=><article key={p.id} className="rounded-3xl border border-white bg-white/95 p-5 shadow-md shadow-slate-200/50"><h3 className="font-extrabold">طلب تسجيل: {Array.isArray(p.vehicles) ? p.vehicles[0]?.make : p.vehicles?.make} {Array.isArray(p.vehicles) ? p.vehicles[0]?.model : p.vehicles?.model} · {Array.isArray(p.organizations) ? p.organizations[0]?.name : p.organizations?.name}</h3><p className="mt-1 text-sm text-slate-600">{Array.isArray(p.vehicles) ? p.vehicles[0]?.model_year : p.vehicles?.model_year} · {Array.isArray(p.vehicles) ? p.vehicles[0]?.vehicle_type : p.vehicles?.vehicle_type} · {Array.isArray(p.vehicles) ? p.vehicles[0]?.governorate : p.vehicles?.governorate} · الإيجار الشهري: {Number(Array.isArray(p.vehicles) ? p.vehicles[0]?.monthly_price_egp : p.vehicles?.monthly_price_egp || 0).toLocaleString("ar-EG")} جنيه</p><p className="mt-1 text-xs font-bold text-blue-800">قرار المراجعة يشمل بيانات السيارة وإثبات الدفع معًا.</p><p className="mt-2 text-sm text-slate-600">{methodName[p.transfer_method] || p.transfer_method} · مرجع التحويل: <bdi>{p.transfer_reference}</bdi></p><p className="mt-1 text-sm text-slate-600">المبلغ: {Number(p.amount_egp).toLocaleString('ar-EG')} جنيه · {((Array.isArray(p.organizations) ? p.organizations[0]?.organization_type : p.organizations?.organization_type) === 'fleet_supplier') ? 'رسوم تسجيل مرة واحدة' : `المدة: ${p.period_months} شهر`}</p><p className="mt-1 text-xs text-slate-500">تاريخ الإرسال: {new Date(p.created_at).toLocaleString('ar-EG')}</p><p className="mt-2 text-sm font-bold">حالة المراجعة: {p.review_status === 'pending' ? 'بانتظار المراجعة' : p.review_status === 'approved' ? 'مقبول' : p.review_status === 'rejected' ? 'مرفوض' : p.review_status}</p><button disabled={busyId===p.id} onClick={()=>void deleteAdminRecord("vehicle_payment_submissions",p.id,"سجل التحويل")} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 disabled:opacity-50"><Trash2 size={16}/> حذف سجل التحويل</button>{p.admin_notes && <p className="mt-2 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm">ملاحظة الإدارة: {p.admin_notes}</p>}{p.proof_path && (paymentProofUrls[p.id] ? <a href={paymentProofUrls[p.id]} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl border border-blue-200 px-4 py-2 text-sm font-bold text-blue-800">فتح إثبات التحويل (رابط مؤقت)</a> : <p className="mt-2 text-xs text-slate-500">تعذر إنشاء رابط آمن للإثبات؛ تحقق من صلاحيات التخزين.</p>)}{p.review_status === 'pending' && <div className="mt-4 flex gap-2"><button disabled={busyId===p.id} onClick={() => void reviewPayment(p,'approved')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white"><CheckCircle2 size={16}/> قبول التحويل</button><button disabled={busyId===p.id} onClick={() => void reviewPayment(p,'rejected')} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700"><XCircle size={16}/> رفض التحويل</button></div>}</article>)}{payments.length===0 && <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">لا توجد تحويلات مسجلة.</p>}</div></section>
      <section className="mt-8" id="admin-advertising-reviews"><h2 className="text-xl font-extrabold">طلبات مراجعة الإعلانات ({promotions.filter(p=>p.status==='pending_review' && p.payment_status==='pending').length} بانتظار المراجعة)</h2><p className="mt-1 text-sm text-slate-500">مراجعة باقات ترويج السيارات وبيانات التحويل وأكواد الخصم. اعتماد الطلب يؤكد الدفع ويبدأ مدة الإعلان تلقائيًا.</p><div className="mt-4 space-y-3">{promotions.map(p=>{const vehicle=Array.isArray(p.vehicles)?p.vehicles[0]:p.vehicles;const org=Array.isArray(p.organizations)?p.organizations[0]:p.organizations;const plan=Array.isArray(p.advertising_plans)?p.advertising_plans[0]:p.advertising_plans;const planName=p.plan_name_snapshot||plan?.name;const planDuration=p.plan_duration_days_snapshot??plan?.duration_days??0;const planPrice=p.plan_price_egp_snapshot??plan?.price_egp??0;const planPlacement=p.plan_placement_type_snapshot||plan?.placement_type;return <article key={p.id} className="rounded-3xl border border-white bg-white/95 p-5 shadow-md shadow-slate-200/50"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{vehicle?.make || 'سيارة'} {vehicle?.model || ''} · {vehicle?.model_year || ''}</h3><p className="mt-1 text-sm text-slate-600">{org?.name || 'مالك غير محدد'} · {org?.contact_name || 'بدون مسؤول تواصل'} · {org?.contact_email || 'بدون بريد مسجل'}</p><p className="mt-1 text-sm text-slate-600">{vehicle?.governorate || 'المحافظة غير محددة'} · {planName || 'باقة إعلانية'} · {planDuration} يوم · {planPlacement==='premium'?'إعلان مميز':'إعلان عادي'}</p></div><span className={'rounded-full px-3 py-1 text-xs font-extrabold '+(p.status==='approved'?'bg-emerald-100 text-emerald-800':p.status==='rejected'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-900')}>{p.status==='pending_review'?'بانتظار المراجعة':p.status==='approved'?'معتمد':p.status==='rejected'?'مرفوض':p.status}</span></div><div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><p><strong>مرجع التحويل الحالي:</strong> <bdi>{p.payment_reference || 'لا يوجد تحويل إضافي'}</bdi></p>{hasDuplicateTransferReference(p,promotions)&&<p role="alert" className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 font-bold text-red-800">تنبيه: رقم التحويل مكرر في سجل إعلان آخر. يلزم مطابقة كشف الحساب قبل اعتماد هذا الطلب أو احتساب أي رصيد منه.</p>}{Number(p.previous_payment_amount_egp??p.previous_payment_credit_egp??0)>0&&<p className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><strong>التحويلات السابقة المطلوب التحقق منها ({Number(p.previous_payment_amount_egp??p.previous_payment_credit_egp??0).toLocaleString('ar-EG')} جنيه):</strong><br/><bdi className="whitespace-pre-wrap">{p.previous_payment_reference}</bdi></p>}<p><strong>المبلغ الأصلي:</strong> {Number(p.original_amount_egp ?? planPrice ?? 0).toLocaleString('ar-EG')} جنيه</p><p><strong>الخصم:</strong> {Number(p.discount_amount_egp || 0).toLocaleString('ar-EG')} جنيه {p.coupon_code ? '· كود: '+p.coupon_code : '· بدون كود خصم'}</p><p><strong>قيمة الباقة بعد الخصم:</strong> {Number(p.final_amount_egp ?? planPrice ?? 0).toLocaleString('ar-EG')} جنيه</p><p className="font-extrabold text-blue-800"><strong>المطلوب تحويله الآن:</strong> {Number(p.payment_due_egp ?? p.final_amount_egp ?? planPrice ?? 0).toLocaleString('ar-EG')} جنيه</p><p><strong>حالة الدفع:</strong> {p.payment_status==='pending'?'بانتظار التحقق':p.payment_status==='verified'?'تم التحقق':p.payment_status==='waived'?'لا يوجد مبلغ إضافي':p.payment_status==='rejected'?'مرفوض':p.payment_status}</p><p><strong>تاريخ الطلب:</strong> {new Date(p.created_at).toLocaleString('ar-EG')}</p>{p.starts_at&&<p><strong>بداية الإعلان:</strong> {new Date(p.starts_at).toLocaleDateString('ar-EG')}</p>}{p.ends_at&&<p><strong>نهاية الإعلان:</strong> {new Date(p.ends_at).toLocaleDateString('ar-EG')}</p>}</div>{p.admin_notes&&<p className="mt-3 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm">ملاحظات الإدارة: {p.admin_notes}</p>}{p.status==='pending_review'&&p.payment_status==='pending'&&<div className="mt-4 flex flex-wrap gap-2"><button disabled={busyId===p.id} onClick={()=>void reviewPromotion(p,'approved')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 size={16}/> اعتماد الإعلان وتأكيد الدفع</button><button disabled={busyId===p.id} onClick={()=>void reviewPromotion(p,'rejected')} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50"><XCircle size={16}/> رفض الطلب</button></div>}</article>})}{promotions.length===0&&<p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">لا توجد طلبات إعلانية حتى الآن.</p>}</div></section>
      <section className="mt-8" id="admin-published-advertisements">
        <h2 className="text-xl font-extrabold">إدارة الإعلانات المنشورة ({promotions.filter(p=>p.status==='approved' && ['verified','waived'].includes(p.payment_status)).length})</h2>
        <p className="mt-1 text-sm text-slate-500">يمكنك تعديل الباقة وفترة الظهور أو حذف الإعلان من الكتالوج. الحذف إداري غير نهائي ويحافظ على سجل الدفع والخصم.</p>
        <div className="mt-4 space-y-3">
          {promotions.filter(p=>p.status==='approved' && ['verified','waived'].includes(p.payment_status)).map(p=>{const vehicle=Array.isArray(p.vehicles)?p.vehicles[0]:p.vehicles;const org=Array.isArray(p.organizations)?p.organizations[0]:p.organizations;const plan=Array.isArray(p.advertising_plans)?p.advertising_plans[0]:p.advertising_plans;return <article key={p.id} className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-extrabold">{vehicle?.make || 'سيارة'} {vehicle?.model || ''} · {vehicle?.model_year || ''}</h3><p className="mt-1 text-sm text-slate-600">{org?.name || 'مالك غير محدد'} · {plan?.name || 'باقة إعلانية'} · {plan?.placement_type==='premium'?'إعلان مميز':'إعلان عادي'}</p><p className="mt-1 text-sm text-slate-500">بداية الظهور: {p.starts_at?new Date(p.starts_at).toLocaleString('ar-EG'):'غير محددة'} · النهاية: {p.ends_at?new Date(p.ends_at).toLocaleString('ar-EG'):'غير محددة'}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">منشور</span></div>
            <div className="mt-4 flex flex-wrap gap-2"><button disabled={busyId===p.id} onClick={()=>startPromotionEdit(p)} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-bold text-blue-800 disabled:opacity-50"><Pencil size={16}/> تعديل الإعلان</button><button disabled={busyId===p.id} onClick={()=>void removePublishedPromotion(p)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50"><Trash2 size={16}/> حذف من الكتالوج</button></div>
            {editingPromotionId===p.id&&<form onSubmit={e=>{e.preventDefault();void savePromotionEdit(p)}} className="mt-4 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:grid-cols-2">
              <label className="text-sm font-bold sm:col-span-2">الباقة الإعلانية<select required value={promotionEditForm.advertising_plan_id} onChange={e=>setPromotionEditForm({...promotionEditForm,advertising_plan_id:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3">{advertisingPlans.map(planOption=><option key={planOption.id} value={planOption.id}>{planOption.name} · {planOption.placement_type==='premium'?'مميز':'عادي'} · {planOption.duration_days} يوم{!planOption.is_active?' (غير مفعّلة حاليًا)':''}</option>)}</select></label>
              <label className="text-sm font-bold">بداية الإعلان<input required type="datetime-local" value={promotionEditForm.starts_at} onChange={e=>setPromotionEditForm({...promotionEditForm,starts_at:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3"/></label>
              <label className="text-sm font-bold">نهاية الإعلان<input required type="datetime-local" value={promotionEditForm.ends_at} onChange={e=>setPromotionEditForm({...promotionEditForm,ends_at:e.target.value})} className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3"/></label>
              <p className="text-xs leading-6 text-slate-500 sm:col-span-2">تغيير الباقة لا يغيّر تواريخ الظهور تلقائيًا؛ عدّل تاريخ النهاية إذا أردت تمديد المدة أو تقليلها. أي تغيير في فترة الإعلان يُرسل إشعارًا لصاحب السيارة.</p>
              <label className="text-sm font-bold sm:col-span-2">ملاحظات الإدارة<textarea rows={2} maxLength={1000} value={promotionEditForm.admin_notes} onChange={e=>setPromotionEditForm({...promotionEditForm,admin_notes:e.target.value})} className="mt-1 w-full rounded-xl border bg-white p-3 font-normal"/></label>
              <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={busyId===p.id} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busyId===p.id?'جارٍ الحفظ...':'حفظ التعديلات'}</button><button type="button" onClick={()=>setEditingPromotionId(null)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">إلغاء</button></div>
            </form>}
          </article>})}
          {promotions.filter(p=>p.status==='approved' && ['verified','waived'].includes(p.payment_status)).length===0&&<p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">لا توجد إعلانات منشورة حاليًا.</p>}
        </div>
      </section>
    </>}
    <p className="mt-8 rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm leading-8 text-sky-900">لأسباب أمنية، لا يمكن لأي مستخدم تفعيل صلاحية الإدارة من داخل الواجهة. يجب إضافة حساب المسؤول إلى جدول platform_admins من خلال إجراء إداري موثوق.</p>
  </div></main>
}
