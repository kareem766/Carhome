import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldCheck, X, FileSearch, Building2, CarFront, CreditCard, Megaphone, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AdminPageNavigation from './AdminPageNavigation'

type Vehicle = { id: string; organization_id: string; make: string; model: string; model_year: number; vehicle_type: string | null; transmission: string | null; seats: number | null; governorate: string | null; address: string | null; monthly_price_egp: number | null; yearly_price_egp: number | null; review_status: string; payment_status: string; created_at: string; organizations: { name: string } | { name: string }[] | null }
type VehicleImage = { vehicle_id: string; storage_path: string; alt_text: string }
type FileAudit = { entity_type: string; entity_id: string; file_path: string; file_exists: boolean; content_type: string; file_size_bytes: number | null }
type Organization = { id: string; name: string; organization_type: string; approval_status: string; city: string | null; contact_name: string | null; phone: string | null; contact_email: string | null; address: string | null; created_at: string }
type Payment = { id: string; vehicle_id: string; amount_egp: number; period_months: number; transfer_method: string; transfer_reference: string | null; review_status: string; proof_path: string | null; created_at: string; vehicles: { make: string; model: string } | { make: string; model: string }[] | null }
type Promotion = { id: string; status: string; payment_status: string; payment_reference: string | null; previous_payment_reference: string | null; payment_due_egp: number | null; final_amount_egp: number | null; plan_name_snapshot: string; created_at: string; vehicles: { make: string; model: string } | { make: string; model: string }[] | null; organizations: { name: string } | { name: string }[] | null }
type Provider = { id: string; provider_name: string; category: string; governorate: string; address: string; contact_name: string; phone: string; email: string | null; website_url: string | null; official_source_url: string | null; description: string | null; status: string; created_at: string }
type Finding = { id: string; kind: 'vehicle' | 'account' | 'payment' | 'ad' | 'service'; title: string; subtitle: string; status: string; score: number; level: 'ready' | 'review' | 'blocked'; reasons: string[]; created_at: string; hasVisionFiles?: boolean }
type ReviewSetting = { category: string; analysis_enabled: boolean; auto_approval_enabled: boolean; risk_threshold: number; updated_at: string }
type AuditRow = { id: number; entity_type: string; entity_id: string; action: string; actor_id: string | null; previous_state: Record<string, unknown>; new_state: Record<string, unknown>; created_at: string }
type VisionResult = { analysis?: Record<string, unknown>; warning?: string; error?: string; code?: string; model?: string; analyzed_at?: string }

const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] || null : value || null
const isPending = (value: string | null | undefined) => ['pending', 'pending_review', 'under_review', 'awaiting_review'].includes(String(value || '').toLowerCase())
const cleanRef = (value: string | null | undefined) => String(value || '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s/g, '').toLowerCase()
const normalizeEgyptianMobile = (value: string | null | undefined) => { const digits = String(value || '').replace(/\D/g, ''); const normalized = digits.startsWith('20') ? '0' + digits.slice(2) : digits; return /^01[0125]\d{8}$/.test(normalized) ? normalized : '' }
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

function assessVehicle(row: Vehicle, duplicates: Set<string>, imageCount: number, duplicateImagePath: boolean, imageIssues: string[]): Finding {
  const reasons: string[] = []
  if (!row.make?.trim() || !row.model?.trim()) reasons.push('بيانات الماركة أو الموديل غير مكتملة')
  if (!row.model_year || row.model_year < 1950 || row.model_year > new Date().getFullYear() + 1) reasons.push('سنة الصنع تحتاج مراجعة')
  if (!row.vehicle_type || !row.governorate || !row.address) reasons.push('بيانات التصنيف أو الموقع غير مكتملة')
  if (!row.monthly_price_egp || row.monthly_price_egp <= 0) reasons.push('السعر الشهري غير صالح')
  if (duplicates.has(row.id)) reasons.push('احتمال وجود سيارة مكررة بنفس الماركة والموديل والسنة')
  if (imageCount === 0) reasons.push('لا توجد صور مسجلة للسيارة')
  if (duplicateImagePath) reasons.push('ملف صورة مستخدم في أكثر من سيارة')
  reasons.push(...imageIssues)
  if (!['verified', 'waived'].includes(String(row.payment_status).toLowerCase())) reasons.push('حالة الدفع لا تثبت اكتمال السداد')
  const level = reasons.some(x => x.includes('مكررة') || x.includes('الدفع')) ? 'review' : reasons.length ? 'blocked' : 'ready'
  return { id: row.id, kind: 'vehicle', title: [row.make, row.model, row.model_year].filter(Boolean).join(' '), subtitle: one(row.organizations)?.name || 'مالك سيارة', status: row.review_status, score: Math.max(0, 100 - reasons.length * 22), level, reasons: reasons.length ? reasons : ['البيانات الأساسية مكتملة؛ يلزم التحقق البشري من الصور والملكية قبل الاعتماد'], created_at: row.created_at, hasVisionFiles: imageCount > 0 }
}

function assessAccount(row: Organization, duplicatePhones: Set<string>, duplicateEmails: Set<string>): Finding {
  const reasons: string[] = []
  if (!row.name?.trim()) reasons.push('اسم الحساب غير مكتمل')
  if (!row.contact_name?.trim()) reasons.push('اسم مسؤول التواصل غير مكتمل')
  if (!row.city?.trim() || !row.address?.trim()) reasons.push('العنوان أو المحافظة غير مكتمل')
  if (['company', 'fleet_supplier'].includes(row.organization_type) && !row.contact_email?.trim()) reasons.push('البريد الإلكتروني مطلوب لهذا النوع من الحسابات')
  if (row.contact_email?.trim() && !validEmail(row.contact_email)) reasons.push('صيغة البريد الإلكتروني غير صحيحة')
  const phone = normalizeEgyptianMobile(row.phone)
  if (!phone) reasons.push('رقم التواصل لا يطابق صيغة رقم محمول مصري')
  else if (duplicatePhones.has(phone)) reasons.push('رقم الموبايل مستخدم في أكثر من حساب')
  const email = cleanRef(row.contact_email)
  if (email && duplicateEmails.has(email)) reasons.push('البريد الإلكتروني مستخدم في أكثر من حساب')
  const level = reasons.some(x => x.includes('مستخدم في أكثر من حساب')) ? 'review' : reasons.length ? 'blocked' : 'ready'
  return { id: row.id, kind: 'account', title: row.name || 'حساب بدون اسم', subtitle: row.organization_type === 'company' ? 'شركة' : row.organization_type === 'fleet_supplier' ? 'مورد أسطول' : 'مالك سيارة', status: row.approval_status, score: Math.max(0, 100 - reasons.length * 25), level, reasons: reasons.length ? reasons : ['الحقول المطلوبة مكتملة؛ لا يثبت ذلك هوية صاحب الحساب أو مستنداته'], created_at: row.created_at }
}

function assessPayment(row: Payment, refs: Set<string>, proofAudit?: FileAudit): Finding {
  const reasons: string[] = []
  const ref = cleanRef(row.transfer_reference)
  if (!ref) reasons.push('رقم التحويل غير موجود')
  else if (refs.has(ref)) reasons.push('رقم التحويل مكرر في طلب دفع آخر')
  if (!row.amount_egp || row.amount_egp <= 0) reasons.push('قيمة التحويل غير صالحة')
  if (!row.transfer_method?.trim()) reasons.push('وسيلة الدفع غير محددة')
  if (!row.proof_path) reasons.push('لا يوجد إيصال مرفق')
  else if (!proofAudit) reasons.push('تعذر التحقق من وجود ملف الإيصال في التخزين')
  else if (!proofAudit.file_exists) reasons.push('مسار الإيصال لا يقابله ملف محفوظ فعليًا')
  else if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(proofAudit.content_type)) reasons.push('نوع ملف الإيصال غير مسموح به')
  if (proofAudit?.file_size_bytes && proofAudit.file_size_bytes > 5 * 1024 * 1024) reasons.push('حجم الإيصال يتجاوز الحد المسموح')
  const level = reasons.some(x => x.includes('مكرر')) ? 'review' : reasons.length ? 'blocked' : 'review'
  const vehicle = one(row.vehicles)
  return { id: row.id, kind: 'payment', title: vehicle ? vehicle.make + ' ' + vehicle.model : 'طلب دفع تسجيل سيارة', subtitle: row.amount_egp + ' جنيه · ' + (row.transfer_method || 'وسيلة غير محددة'), status: row.review_status, score: Math.max(0, 100 - reasons.length * 20), level, reasons: reasons.length ? reasons : ['المرفقات والبيانات مكتملة، لكن يلزم إثبات التحويل من مصدر مالي موثوق'], created_at: row.created_at, hasVisionFiles: Boolean(row.proof_path) }
}

function assessPromotion(row: Promotion, duplicateRefs: Set<string>): Finding {
  const reasons: string[] = []
  const allRefs = [row.payment_reference, row.previous_payment_reference].map(cleanRef).filter(Boolean)
  if (!allRefs.length) reasons.push('رقم التحويل غير موجود')
  if (allRefs.some(ref => duplicateRefs.has(ref))) reasons.push('رقم التحويل مكرر في طلب إعلان آخر')
  if (!row.plan_name_snapshot?.trim()) reasons.push('بيانات باقة الإعلان غير مكتملة')
  if ((row.payment_due_egp ?? row.final_amount_egp ?? 0) > 0 && !allRefs.length) reasons.push('لا يوجد مرجع دفع للمبلغ المستحق')
  const vehicle = one(row.vehicles)
  const org = one(row.organizations)
  const level = reasons.some(x => x.includes('مكرر')) ? 'review' : reasons.length ? 'blocked' : 'review'
  return { id: row.id, kind: 'ad', title: row.plan_name_snapshot || 'طلب إعلان', subtitle: (vehicle ? vehicle.make + ' ' + vehicle.model : 'سيارة') + ' · ' + (org?.name || 'حساب'), status: row.status + ' / ' + row.payment_status, score: Math.max(0, 100 - reasons.length * 22), level, reasons: reasons.length ? reasons : ['بيانات الطلب مكتملة؛ يلزم تحقق مستقل من التحويل قبل التفعيل'], created_at: row.created_at }
}

function assessProvider(row: Provider): Finding {
  const reasons: string[] = []
  if (!row.provider_name?.trim() || !row.contact_name?.trim() || !row.phone?.trim() || !row.address?.trim() || !row.governorate?.trim()) reasons.push('بيانات المنشأة أو مسؤول التواصل غير مكتملة')
  if (!row.official_source_url?.trim() && !row.website_url?.trim()) reasons.push('لا يوجد موقع أو مصدر رسمي للتحقق من النشاط')
  if (!row.description?.trim()) reasons.push('لا توجد نبذة كافية عن النشاط')
  return { id: row.id, kind: 'service', title: row.provider_name || 'مقدم خدمة', subtitle: row.category + ' · ' + row.governorate, status: row.status, score: Math.max(0, 100 - reasons.length * 25), level: reasons.length ? 'review' : 'ready', reasons: reasons.length ? reasons : ['البيانات ومصدر النشاط متاحان للفحص؛ يلزم التحقق من المصدر قبل النشر'], created_at: row.created_at }
}

const kindLabel: Record<Finding['kind'], string> = { vehicle: 'سيارة', account: 'حساب', payment: 'مدفوعات', ad: 'إعلان', service: 'مقدم خدمة' }
const levelLabel: Record<Finding['level'], string> = { ready: 'بيانات مكتملة', review: 'تحتاج مراجعة', blocked: 'استكمال مطلوب' }
const levelClass: Record<Finding['level'], string> = { ready: 'border-emerald-200 bg-emerald-50 text-emerald-800', review: 'border-amber-200 bg-amber-50 text-amber-800', blocked: 'border-rose-200 bg-rose-50 text-rose-800' }
const settingLabels: Record<string, string> = { vehicle: 'السيارات', account: 'الحسابات', payment: 'المدفوعات', ad: 'الإعلانات', service: 'مقدمو الخدمات' }
const auditTypeLabels: Record<string, string> = { vehicle: 'سيارة', account: 'حساب', payment: 'مدفوعات', advertisement: 'إعلان', service_provider: 'مقدم خدمة' }
const stateText = (state: Record<string, unknown>) => Object.entries(state || {}).map(([key, value]) => ({ review_status: 'مراجعة', approval_status: 'اعتماد الحساب', status: 'الحالة', payment_status: 'الدفع', analysis_enabled: 'الفحص الآلي', risk_threshold: 'حد المخاطر' }[key] || key) + ': ' + String(value)).join(' · ') || '—'

export default function AdminAutomationReviewPage({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [findings, setFindings] = useState<Finding[]>([])
  const [filter, setFilter] = useState<'all' | Finding['kind']>('all')
  const [refreshedAt, setRefreshedAt] = useState('')
  const [settings, setSettings] = useState<Record<string, ReviewSetting>>({})
  const [auditRows, setAuditRows] = useState<AuditRow[]>([])
  const [savingSetting, setSavingSetting] = useState<string | null>(null)
  const [visionResults, setVisionResults] = useState<Record<string, VisionResult>>({})
  const [visionLoading, setVisionLoading] = useState<string | null>(null)

  async function load() {
    if (!supabase) { setError('اتصال قاعدة البيانات غير متاح.'); setLoading(false); return }
    setLoading(true); setError('')
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) { setError('يجب تسجيل الدخول بحساب الإدارة.'); setLoading(false); return }
    const { data: admin, error: adminError } = await supabase.from('platform_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle()
    if (adminError || !admin) { setError('لا توجد صلاحية لعرض مركز المراجعة الذكية.'); setAuthorized(false); setLoading(false); return }
    setAuthorized(true)
    const [v, o, p, a, s, imageResult, fileAuditResult, settingResult, auditResult] = await Promise.all([
      supabase.from('vehicles').select('id,organization_id,make,model,model_year,vehicle_type,transmission,seats,governorate,address,monthly_price_egp,yearly_price_egp,review_status,payment_status,created_at,organizations(name)').order('created_at', { ascending: false }).limit(150),
      supabase.from('organizations').select('id,name,organization_type,approval_status,city,contact_name,phone,contact_email,address,created_at').order('created_at', { ascending: false }).limit(150),
      supabase.from('vehicle_payment_submissions').select('id,vehicle_id,amount_egp,period_months,transfer_method,transfer_reference,review_status,proof_path,created_at,vehicles(make,model)').order('created_at', { ascending: false }).limit(150),
      supabase.from('vehicle_promotions').select('id,status,payment_status,payment_reference,previous_payment_reference,payment_due_egp,final_amount_egp,plan_name_snapshot,created_at,vehicles(make,model),organizations(name)').order('created_at', { ascending: false }).limit(150),
      supabase.from('service_provider_submissions').select('id,provider_name,category,governorate,address,contact_name,phone,email,website_url,official_source_url,description,status,created_at').order('created_at', { ascending: false }).limit(150),
      supabase.from('vehicle_images').select('vehicle_id,storage_path,alt_text').order('created_at', { ascending: false }).limit(1000),
      supabase.rpc('mycar_admin_get_review_file_audit'),
      supabase.from('admin_review_settings').select('category,analysis_enabled,auto_approval_enabled,risk_threshold,updated_at'),
      supabase.from('admin_review_audit_log').select('id,entity_type,entity_id,action,actor_id,previous_state,new_state,created_at').order('created_at', { ascending: false }).limit(40)
    ])
    const errors = [v.error, o.error, p.error, a.error, s.error, imageResult.error, fileAuditResult.error, settingResult.error, auditResult.error].filter(Boolean)
    if (errors.length) { setError('تعذر تحميل بعض سجلات المراجعة: ' + errors.map(x => x!.message).join(' · ')); setLoading(false); return }
    const settingRows = (settingResult.data || []) as ReviewSetting[]
    setSettings(Object.fromEntries(settingRows.map(item => [item.category, item])))
    setAuditRows((auditResult.data || []) as AuditRow[])
    const imageRows = (imageResult.data || []) as VehicleImage[]
    const fileAudits = (fileAuditResult.data || []) as FileAudit[]
    const imageIssuesByVehicle = new Map<string, string[]>()
    for (const file of fileAudits.filter(item => item.entity_type === 'vehicle')) {
      const issues = imageIssuesByVehicle.get(file.entity_id) || []
      if (!file.file_exists) issues.push('ملف الصورة غير موجود فعليًا في التخزين')
      else if (!['image/jpeg','image/png','image/webp'].includes(file.content_type)) issues.push('نوع ملف الصورة غير مسموح به')
      if (file.file_size_bytes && file.file_size_bytes > 8 * 1024 * 1024) issues.push('حجم الصورة يتجاوز الحد المسموح')
      imageIssuesByVehicle.set(file.entity_id, issues)
    }
    const proofAuditBySubmission = new Map(fileAudits.filter(item => item.entity_type === 'payment').map(item => [item.entity_id, item]))
    const imageCounts = new Map<string, number>()
    const imagePathOwners = new Map<string, Set<string>>()
    for (const image of imageRows) {
      imageCounts.set(image.vehicle_id, (imageCounts.get(image.vehicle_id) || 0) + 1)
      const owners = imagePathOwners.get(image.storage_path) || new Set<string>()
      owners.add(image.vehicle_id); imagePathOwners.set(image.storage_path, owners)
    }
    const duplicateImageVehicles = new Set([...imagePathOwners.values()].filter(owners => owners.size > 1).flatMap(owners => [...owners]))
    const allVehicles = (v.data || []) as unknown as Vehicle[]
    const vehicles = allVehicles.filter(x => isPending(x.review_status))
    const allOrganizations = (o.data || []) as Organization[]
    const accounts = allOrganizations.filter(x => isPending(x.approval_status))
    const phoneCounts = new Map<string, number>()
    const emailCounts = new Map<string, number>()
    for (const account of allOrganizations) {
      const phone = normalizeEgyptianMobile(account.phone); if (phone) phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1)
      const email = cleanRef(account.contact_email); if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1)
    }
    const duplicatePhones = new Set([...phoneCounts].filter(([, count]) => count > 1).map(([value]) => value))
    const duplicateEmails = new Set([...emailCounts].filter(([, count]) => count > 1).map(([value]) => value))
    const allPayments = (p.data || []) as unknown as Payment[]
    const payments = allPayments.filter(x => isPending(x.review_status))
    const allPromotions = (a.data || []) as unknown as Promotion[]
    const promotions = allPromotions.filter(x => isPending(x.status) || isPending(x.payment_status))
    const providers = ((s.data || []) as Provider[]).filter(x => isPending(x.status))
    const duplicateGroups = new Map<string, string[]>()
    for (const item of allVehicles) {
      const key = [item.organization_id, item.make, item.model, item.model_year, item.address, item.monthly_price_egp].map(x => String(x || '').trim().toLowerCase()).join('|')
      if (item.organization_id && item.make && item.model && item.model_year && item.address && item.monthly_price_egp && key.replace(/\|/g, '').length) duplicateGroups.set(key, [...(duplicateGroups.get(key) || []), item.id])
    }
    const duplicateVehicleIds = new Set([...duplicateGroups.values()].filter(ids => ids.length > 1).flat())
    const referenceOwners = new Map<string, Set<string>>()
    const addReferenceOwner = (reference: string | null | undefined, owner: string) => {
      const normalized = cleanRef(reference)
      if (!normalized) return
      const owners = referenceOwners.get(normalized) || new Set<string>()
      owners.add(owner); referenceOwners.set(normalized, owners)
    }
    for (const item of allPayments) addReferenceOwner(item.transfer_reference, 'payment:' + item.id)
    for (const item of allPromotions) for (const reference of new Set([item.payment_reference, item.previous_payment_reference].map(cleanRef).filter(Boolean))) addReferenceOwner(reference, 'ad:' + item.id)
    const duplicateRefs = new Set([...referenceOwners].filter(([, owners]) => owners.size > 1).map(([reference]) => reference))
    const results = [
      ...vehicles.map(item => assessVehicle(item, duplicateVehicleIds, imageCounts.get(item.id) || 0, duplicateImageVehicles.has(item.id), imageIssuesByVehicle.get(item.id) || [])), 
      ...accounts.map(item => assessAccount(item, duplicatePhones, duplicateEmails)),
      ...payments.map(item => assessPayment(item, duplicateRefs, proofAuditBySubmission.get(item.id))),
      ...promotions.map(item => assessPromotion(item, duplicateRefs)),
      ...providers.map(assessProvider)
    ].sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
    setFindings(results.filter(item => settingRows.find(setting => setting.category === item.kind)?.analysis_enabled !== false)); setRefreshedAt(new Date().toLocaleString('ar-EG')); setLoading(false)
  }

  async function toggleAnalysis(category: string) {
    if (!supabase || savingSetting) return
    setSavingSetting(category); setError('')
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setError('انتهت جلسة الإدارة. سجل الدخول مرة أخرى.'); setSavingSetting(null); return }
    const current = settings[category]?.analysis_enabled !== false
    const { error: updateError } = await supabase.from('admin_review_settings').update({ analysis_enabled: !current, updated_by: auth.user.id, updated_at: new Date().toISOString() }).eq('category', category)
    if (updateError) { setError('تعذر حفظ إعداد الفحص: ' + updateError.message); setSavingSetting(null); return }
    setSavingSetting(null)
    await load()
  }

  async function runVisionReview(item: Finding) {
    if (!supabase || !['vehicle', 'payment'].includes(item.kind) || visionLoading) return
    const key = item.kind + ':' + item.id
    setVisionLoading(key)
    setVisionResults(previous => ({ ...previous, [key]: {} }))
    const { data, error: invokeError } = await supabase.functions.invoke('mycar-admin-vision-review', {
      body: { entity_type: item.kind, entity_id: item.id }
    })
    if (invokeError || data?.error) {
      const message = data?.error || invokeError?.message || 'تعذر تشغيل الفحص الذكي.'
      setVisionResults(previous => ({ ...previous, [key]: { error: message, code: data?.code } }))
    } else {
      setVisionResults(previous => ({ ...previous, [key]: data as VisionResult }))
    }
    setVisionLoading(null)
  }

  useEffect(() => { void load() }, [])
  const visible = useMemo(() => findings.filter(item => filter === 'all' || item.kind === filter), [findings, filter])
  const counts = useMemo(() => ({
    all: findings.length,
    ready: findings.filter(x => x.level === 'ready').length,
    review: findings.filter(x => x.level === 'review').length,
    blocked: findings.filter(x => x.level === 'blocked').length,
    vehicles: findings.filter(x => x.kind === 'vehicle').length,
    accounts: findings.filter(x => x.kind === 'account').length,
    payments: findings.filter(x => x.kind === 'payment').length,
    ads: findings.filter(x => x.kind === 'ad').length,
    services: findings.filter(x => x.kind === 'service').length
  }), [findings])

  return <div dir="rtl" className={embedded ? 'relative overflow-visible rounded-2xl bg-slate-100 text-slate-900' : 'fixed inset-0 z-[100] overflow-y-auto bg-slate-100 text-slate-900'}>
    {!embedded && <div className="[&_.mc-admin-sidebar]:!z-[120]"><AdminPageNavigation /></div>}
    <header className={embedded ? 'relative z-10 rounded-t-2xl border-b border-slate-200 bg-[#102b47] px-4 py-4 text-white shadow-lg sm:px-7' : 'sticky top-0 z-20 border-b border-slate-200 bg-[#102b47] px-4 py-4 text-white shadow-lg sm:px-7'}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400 text-[#102b47]"><ShieldCheck size={24}/></span><div><h1 className="text-lg font-black sm:text-xl">مركز المراجعة الذكية</h1><p className="text-xs text-slate-300">My Car Intelligent Operations · توصيات آلية مع سجل واضح للأسباب</p></div></div>
        <div className="flex items-center gap-2"><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm font-bold hover:bg-white/10 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> تحديث</button>{!embedded && onClose && <button onClick={onClose} aria-label="إغلاق مركز المراجعة" className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 hover:bg-white/10"><X size={19}/></button>}</div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-7">
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center"><Info size={22} className="shrink-0"/><div><strong className="block">وضع آمن: توصيات فقط</strong><p className="mt-1 text-sm leading-6">المركز لا يعتمد أو يرفض أو يغيّر أي سجل. اكتمال البيانات لا يثبت ملكية السيارة أو صحة التحويل البنكي؛ لذلك تبقى القرارات النهائية الحالية كما هي لحين ربط مصادر تحقق موثوقة ومراجعة قواعد الاعتماد.</p></div></div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</div>}
      {!authorized && !loading && !error && <div className="rounded-xl bg-white p-5">لا يمكن عرض البيانات.</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[{label:'إجمالي الطلبات المعلقة',value:counts.all,icon:FileSearch},{label:'بيانات مكتملة مبدئيًا',value:counts.ready,icon:CheckCircle2},{label:'تحتاج مراجعة بشرية',value:counts.review,icon:AlertTriangle},{label:'تحتاج استكمالًا',value:counts.blocked,icon:Clock3}].map(card=><article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-sm font-bold text-slate-500"><span>{card.label}</span><card.icon size={19}/></div><strong className="mt-2 block text-3xl font-black text-[#102b47]">{loading ? '—' : card.value}</strong></article>)}
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[{kind:'vehicle' as const,label:'السيارات',count:counts.vehicles,icon:CarFront},{kind:'account' as const,label:'الحسابات',count:counts.accounts,icon:Building2},{kind:'payment' as const,label:'المدفوعات',count:counts.payments,icon:CreditCard},{kind:'ad' as const,label:'الإعلانات',count:counts.ads,icon:Megaphone},{kind:'service' as const,label:'مقدمو الخدمات',count:counts.services,icon:Building2}].map(card=><button key={card.kind} onClick={() => setFilter(filter === card.kind ? 'all' : card.kind)} className={`flex items-center justify-between rounded-xl border p-4 text-right transition ${filter === card.kind ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}><span className="flex items-center gap-2 font-extrabold"><card.icon size={19} className="text-[#1d4ed8]"/>{card.label}</span><strong className="text-xl">{card.count}</strong></button>)}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-black text-[#102b47]">إعدادات الفحص حسب نوع الطلب</h2><p className="mt-1 text-xs text-slate-500">يمكن إيقاف التحليل التوصيفي لكل فئة دون التأثير على إجراءات المراجعة الأصلية.</p></div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-800">الاعتماد التلقائي متوقف لجميع الفئات</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(['vehicle','account','payment','ad','service'] as const).map(category => {
            const enabled = settings[category]?.analysis_enabled !== false
            return <div key={category} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
              <div><strong className="block text-sm text-slate-800">{settingLabels[category]}</strong><span className="mt-1 block text-xs text-slate-500">{enabled ? 'الفحص التوصيفي يعمل' : 'الفحص متوقف لهذه الفئة'}</span></div>
              <button type="button" onClick={() => void toggleAnalysis(category)} disabled={loading || savingSetting !== null} className={`min-w-24 rounded-lg px-3 py-2 text-xs font-extrabold transition disabled:opacity-50 ${enabled ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>{savingSetting === category ? 'جارٍ الحفظ...' : enabled ? 'إيقاف الفحص' : 'تفعيل الفحص'}</button>
            </div>
          })}
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">لا يوجد مفتاح لتشغيل الاعتماد التلقائي في هذه المرحلة. سيظل مغلقًا على مستوى قاعدة البيانات حتى ربط تحقق موثوق للملكية والمستندات والمدفوعات واعتماد قواعد المخاطر.</p>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4"><div><h2 className="font-black">نتائج الفحص الأولي</h2><p className="mt-1 text-xs text-slate-500">مرتبة بالأحدث · آخر 150 سجلًا لكل نوع · لا يتم تنفيذ أي قرار تلقائي</p></div><button onClick={() => setFilter('all')} className="text-sm font-bold text-blue-700">عرض الكل</button></div>
        {loading ? <div className="p-10 text-center text-slate-500">جارٍ تحليل سجلات المراجعة...</div> : visible.length === 0 ? <div className="p-10 text-center text-slate-500">لا توجد طلبات معلقة ضمن هذا التصنيف حاليًا.</div> : <div className="divide-y divide-slate-100">{visible.map(item=><article key={item.kind + item.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_150px] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-600">{kindLabel[item.kind]}</span><h3 className="font-black text-[#102b47]">{item.title}</h3><span className={`rounded-full border px-2.5 py-1 text-xs font-extrabold ${levelClass[item.level]}`}>{levelLabel[item.level]}</span></div><p className="mt-1 text-sm text-slate-500">{item.subtitle} · الحالة الحالية: {item.status}</p><ul className="mt-2 flex flex-wrap gap-2">{item.reasons.map(reason=><li key={reason} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs leading-5 text-slate-700">{reason}</li>)}</ul>{['vehicle','payment'].includes(item.kind) && <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">{item.hasVisionFiles ? <button type="button" onClick={() => void runVisionReview(item)} disabled={visionLoading !== null} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-indigo-800 disabled:opacity-50">{visionLoading === item.kind + ':' + item.id ? 'جارٍ فحص الملفات...' : 'تشغيل الفحص البصري بالذكاء الاصطناعي'}</button> : <p className="text-xs font-bold text-amber-800">{item.kind === 'payment' ? 'لا يمكن تشغيل فحص الإيصال: لا يوجد إيصال مرفق بطلب الدفع.' : 'لا يمكن تشغيل الفحص البصري: لا توجد صور مرفقة بالسيارة.'}</p>}{visionResults[item.kind + ':' + item.id]?.error && <p className="mt-2 text-xs font-bold text-rose-700">{visionResults[item.kind + ':' + item.id]?.error}</p>}{visionResults[item.kind + ':' + item.id]?.analysis && <div className="mt-3 space-y-2 text-xs leading-6 text-slate-700"><p className="font-bold text-indigo-950">{String(visionResults[item.kind + ':' + item.id]?.analysis?.summary || 'اكتمل الفحص.')}</p><p>مستوى المخاطر المقترح: <strong>{String(visionResults[item.kind + ':' + item.id]?.analysis?.risk_level || 'غير محدد')}</strong></p>{Array.isArray(visionResults[item.kind + ':' + item.id]?.analysis?.human_review_reasons) && <ul className="list-disc space-y-1 pr-5">{(visionResults[item.kind + ':' + item.id]?.analysis?.human_review_reasons as string[]).map((reason, index) => <li key={index}>{reason}</li>)}</ul>}{Array.isArray(visionResults[item.kind + ':' + item.id]?.analysis?.limitations) && <p className="text-slate-500">حدود الفحص: {(visionResults[item.kind + ':' + item.id]?.analysis?.limitations as string[]).join(' · ')}</p>}<p className="font-bold text-amber-800">{visionResults[item.kind + ':' + item.id]?.warning}</p></div>}</div>}<p className="mt-2 text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString('ar-EG')} · رقم السجل: {item.id.slice(0, 8)}</p></div><div className="rounded-xl bg-slate-50 p-3 text-center"><strong className="block text-2xl font-black text-[#102b47]">{item.score}%</strong><span className="text-xs text-slate-500">اكتمال مبدئي للبيانات</span></div></article>)}</div>}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>آخر تحديث: {refreshedAt || '—'}</span><span>عدد السجلات المعروضة: {visible.length}</span></div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4"><h2 className="font-black text-[#102b47]">سجل تدقيق قرارات المراجعة</h2><p className="mt-1 text-xs text-slate-500">يسجل الطلبات الجديدة وتغييرات الحالات للسيارات والحسابات والمدفوعات والإعلانات ومقدمي الخدمات، مع الحالة السابقة والجديدة. يبدأ التسجيل من وقت تفعيل النظام ولا يسترجع الأحداث القديمة.</p></div>
        {auditRows.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">لا توجد تغييرات مسجلة حتى الآن. سيظهر السجل عند حدوث أول تغيير في حالة طلب.</p> : <div className="divide-y divide-slate-100">{auditRows.map(row => <article key={row.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-extrabold text-slate-600">{auditTypeLabels[row.entity_type] || row.entity_type}</span><strong className="text-sm text-slate-800">{row.action === 'review_settings_changed' ? 'تعديل إعدادات الفحص' : row.action === 'submitted' ? 'تقديم طلب جديد' : 'تغيير حالة الطلب'}</strong><span className="text-xs text-slate-400">#{row.id}</span></div>
            <p className="mt-1 text-xs leading-5 text-slate-600">قبل: {stateText(row.previous_state)}</p><p className="text-xs leading-5 text-slate-600">بعد: {stateText(row.new_state)}</p><p className="mt-1 text-[11px] text-slate-400">معرّف السجل: {row.entity_id}</p></div>
          <div className="text-xs text-slate-500 sm:text-left"><span className="block">{new Date(row.created_at).toLocaleString('ar-EG')}</span><span className="mt-1 block">المنفذ: {row.actor_id ? row.actor_id.slice(0,8) : 'نظام / غير محدد'}</span></div>
        </article>)}</div>}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-black text-[#102b47]">حدود المراجعة الآلية الحالية</h2><ul className="mt-2 list-disc space-y-1 pr-5 text-sm leading-6 text-slate-600"><li>فحص الحقول والتكرار لا يثبت ملكية المركبة أو صحة المستندات.</li><li>مراجع التحويل والإيصالات تحتاج تكامل تحقق مباشر مع مزود الدفع أو مراجعة كشف الحساب.</li><li>تمت إضافة فحوصات وجود ملفات الصور والإيصالات ونوعها وحجمها؛ أما فهم محتوى الصور وقراءة الإيصالات ضوئيًا فيحتاج خدمة ذكاء اصطناعي ومفتاح تشغيل مخصص.</li><li>الطلبات غير الموجودة في الجداول المعروضة لا تتأثر بهذا المركز ولا يتغير مسارها الحالي.</li></ul></section>
    </main>
  </div>
}
