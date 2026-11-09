import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, CarFront, Users, Megaphone, CreditCard, BriefcaseBusiness, UserCheck, Headset, ArrowUpRight, LayoutDashboard, RefreshCw, Search, X, ChevronRight, ChevronLeft, ExternalLink, Clock3, History } from 'lucide-react'
import AdminPageNavigation from './AdminPageNavigation'
import { supabase } from '../lib/supabase'

type QueueItem = {
  id: string
  type: string
  title: string
  subtitle: string
  status: string
  createdAt: string
  href: string
  details: string[]
  vehicleId?: string
}
type AuditItem = { id: string; type: string; status: string; reviewedAt: string; reviewer: string | null; note: string | null }\ntype EvidenceItem = { label: string; url: string; kind: 'image' | 'file' }
const groups = [
  { title: 'مراجعة التسجيل والاعتماد', description: 'طلبات تحتاج فحص بيانات أو اتخاذ قرار اعتماد.', items: [
    { label: 'السيارات والتحويلات', detail: 'مراجعة بيانات السيارات والصور ورسوم التسجيل وإثباتات الدفع.', href: '/workspace/admin/vehicle-reviews', icon: CarFront },
    { label: 'الحسابات والمؤسسات', detail: 'مراجعة حسابات الملاك والشركات وموردي الأساطيل.', href: '/workspace/admin/vehicle-reviews', icon: Users },
    { label: 'الإعلانات', detail: 'مراجعة طلبات الإعلانات العادية والمميزة والتحقق من الدفع.', href: '/workspace/admin/vehicle-reviews', icon: Megaphone },
    { label: 'اشتراكات الشركات', detail: 'مراجعة طلبات الاشتراك والمدفوعات وتفعيل الباقات.', href: '/workspace/admin/company-subscriptions', icon: CreditCard },
  ]},
  { title: 'مراجعة الخدمات والطلبات', description: 'طلبات الخدمات والتشغيل التي تصل إلى الإدارة.', items: [
    { label: 'طلبات الموظفين', detail: 'مراجعة طلبات الموظفين المنشورة من الشركات.', href: '/workspace/admin/employee-requests', icon: UserCheck },
    { label: 'تفويضات البحث', detail: 'متابعة طلبات البحث نيابةً عن الشركات ومراحلها.', href: '/workspace/admin/managed-sourcing', icon: BriefcaseBusiness },
    { label: 'الدعم والتذاكر', detail: 'متابعة استفسارات ومشكلات المستخدمين.', href: '/workspace/admin/support', icon: Headset },
  ]},
]
const dateLabel = (value: string) => new Date(value).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
const relationField = (value: unknown, field: string) => {\n  if (Array.isArray(value)) return String((value[0] as Record<string, unknown> | undefined)?.[field] || '')\n  return String((value as Record<string, unknown> | null)?.[field] || '')\n}\nconst relationName = (value: unknown) => {
  if (Array.isArray(value)) return String((value[0] as { name?: string } | undefined)?.name || '')
  return String((value as { name?: string } | null)?.name || '')
}
export default function AdminReviewCenterPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [audit, setAudit] = useState<AuditItem[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('oldest')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [loadError, setLoadError] = useState('')
  const [page, setPage] = useState(0)\n  const [evidence, setEvidence] = useState<EvidenceItem[]>([])\n  const [evidenceLoading, setEvidenceLoading] = useState(false)\n  const [evidenceError, setEvidenceError] = useState('')
  const pageSize = 25
  const loadQueues = useCallback(async () => {
    const client = supabase
    if (!client) return
    setRefreshing(true)
    setLoadError('')
    try {
      const [vehicles, payments, promotions, subscriptions, employeeRequests, sourcingSubscriptions, organizations, tickets, paymentAudit, promotionAudit, subscriptionAudit, employeeAudit, sourcingAudit] = await Promise.all([
        client.from('vehicles').select('id,make,model,model_year,vehicle_type,transmission,seats,governorate,address,monthly_price_egp,yearly_price_egp,with_driver,notes,review_status,payment_status,created_at,organizations(name,contact_name,contact_email,city)',{count:'exact'}).in('review_status', ['pending_review','pending_payment']).order('created_at',{ascending:true}).range(0,199),
        client.from('vehicle_payment_submissions').select('id,vehicle_id,amount_egp,period_months,transfer_method,transfer_reference,proof_path,admin_notes,review_status,created_at,vehicles(make,model,model_year,vehicle_type,governorate),organizations(name,contact_name,contact_email)',{count:'exact'}).in('review_status',['pending','pending_review']).order('created_at',{ascending:true}).range(0,199),
        client.from('vehicle_promotions').select('id,vehicle_id,plan_name_snapshot,status,payment_status,payment_reference,created_at,vehicles(make,model),organizations(name,contact_name,contact_email,city)',{count:'exact'}).eq('status','pending_review').eq('payment_status','pending').order('created_at',{ascending:true}).range(0,199),
        client.from('company_subscriptions').select('id,plan_name,billing_cycle,amount_egp,payment_reference,payment_transfer_date,payment_status,status,created_at,organizations(name)',{count:'exact'}).in('payment_status',['submitted','pending']).order('created_at',{ascending:true}).range(0,199),
        client.from('employee_rental_requests').select('id,title,vehicle_type,seats,governorate,pickup_address,duration_months,start_date,work_days_per_week,daily_hours,budget_min_egp,budget_max_egp,with_driver,details,status,created_at',{count:'exact'}).eq('status','pending_review').order('created_at',{ascending:true}).range(0,199),
        client.from('managed_sourcing_subscriptions').select('id,monthly_price_egp,requests_included,payment_reference,payment_status,status,created_at,organizations!managed_sourcing_subscriptions_organization_id_fkey(name)',{count:'exact'}).eq('status','pending_review').order('created_at',{ascending:true}).range(0,199),
        client.from('organizations').select('id,name,organization_type,approval_status,city,contact_name,contact_email,phone,address,company_type,fleet_vehicle_count,created_at',{count:'exact'}).eq('approval_status','pending_review').order('created_at',{ascending:true}).range(0,199),
        client.from('support_tickets').select('id,ticket_number,subject,category,priority,status,created_at',{count:'exact'}).in('status',['open','in_progress','waiting_user']).order('created_at',{ascending:true}).range(0,199),
        client.from('vehicle_payment_submissions').select('id,review_status,reviewed_at,reviewed_by,admin_notes').not('reviewed_at','is',null).order('reviewed_at',{ascending:false}).limit(8),
        client.from('vehicle_promotions').select('id,status,reviewed_at,reviewed_by,admin_notes').not('reviewed_at','is',null).order('reviewed_at',{ascending:false}).limit(8),
        client.from('company_subscriptions').select('id,status,payment_status,reviewed_at,reviewed_by,admin_notes').not('reviewed_at','is',null).order('reviewed_at',{ascending:false}).limit(8),
        client.from('employee_rental_requests').select('id,status,reviewed_at,reviewed_by,admin_notes').not('reviewed_at','is',null).order('reviewed_at',{ascending:false}).limit(8),
        client.from('managed_sourcing_subscriptions').select('id,status,payment_status,reviewed_at,reviewed_by').not('reviewed_at','is',null).order('reviewed_at',{ascending:false}).limit(8),
      ])
      const results = [vehicles,payments,promotions,subscriptions,employeeRequests,sourcingSubscriptions,organizations,tickets]
      const labels = ['السيارات','تحويلات تسجيل السيارات','الإعلانات','اشتراكات الشركات','طلبات الموظفين','اشتراكات تفويض البحث','الحسابات والمؤسسات','تذاكر الدعم']
      const failed = results.map((r,i)=>r.error?labels[i]+': '+r.error.message:'').filter(Boolean)
      setLoadError(failed.length ? 'تعذر تحميل بعض قوائم المراجعة: '+failed.join(' — ') : '')
      const items: QueueItem[] = []
      const pendingVehicles = new Map<string, any>()
      const paymentsByVehicle = new Map<string, any>()
      for (const row of (vehicles.data||[]) as any[]) pendingVehicles.set(String(row.id), row)
      for (const row of (payments.data||[]) as any[]) if (row.vehicle_id) paymentsByVehicle.set(String(row.vehicle_id), row)
      for (const row of (vehicles.data||[]) as any[]) {
        const payment = paymentsByVehicle.get(String(row.id))
        items.push({id:row.id,vehicleId:row.id,type:'vehicles',title:[row.make,row.model,row.model_year].filter(Boolean).join(' '),subtitle:relationName(row.organizations)||'مالك سيارة',status:row.review_status+' · '+row.payment_status,createdAt:row.created_at,href:'/workspace/admin/vehicle-reviews',details:['حالة المراجعة: '+row.review_status,'حالة الدفع: '+row.payment_status,'صاحب السيارة: '+(relationName(row.organizations)||'غير محدد'),'مسؤول التواصل: '+(relationField(row.organizations,'contact_name')||'غير مسجل'),'بريد التواصل: '+(relationField(row.organizations,'contact_email')||'غير مسجل'),'نوع السيارة: '+(row.vehicle_type||'غير محدد'),'سنة الصنع: '+(row.model_year||'غير محددة'),'ناقل الحركة: '+(row.transmission||'غير محدد'),'عدد المقاعد: '+(row.seats??'غير محدد'),'المحافظة: '+(row.governorate||'غير محددة'),'العنوان: '+(row.address||'غير مسجل'),'السعر الشهري: '+(row.monthly_price_egp??'غير مسجل')+' جنيه','السعر السنوي: '+(row.yearly_price_egp??'غير مسجل')+' جنيه','بسائق: '+(row.with_driver?'نعم':'لا'),'جهة الاتصال: '+(relationName(row.organizations)||'غير محدد'),...(payment?['طلب الدفع مرتبط بنفس السيارة','المبلغ: '+Number(payment.amount_egp||0).toLocaleString('ar-EG')+' جنيه','مدة السداد: '+(payment.period_months||'—')+' شهر','وسيلة التحويل: '+(payment.transfer_method||'غير محددة'),'رقم التحويل: '+(payment.transfer_reference||'غير مسجل'),'حالة إثبات الدفع: '+payment.review_status,'ملاحظات الدفع: '+(payment.admin_notes||'لا توجد')]:[])]})
      }
      for (const row of (payments.data||[]) as any[]) {
        if (row.vehicle_id && pendingVehicles.has(String(row.vehicle_id))) continue
        const vehicle=Array.isArray(row.vehicles)?row.vehicles[0]:row.vehicles
        items.push({id:row.id,vehicleId:row.vehicle_id||undefined,type:'payments',title:'تحويل تسجيل سيارة',subtitle:[vehicle?.make,vehicle?.model].filter(Boolean).join(' ')||relationName(row.organizations)||'طلب تحويل',status:row.review_status,createdAt:row.created_at,href:'/workspace/admin/vehicle-reviews',details:['المبلغ: '+Number(row.amount_egp||0).toLocaleString('ar-EG')+' جنيه','رقم التحويل: '+(row.transfer_reference||'غير مسجل'),'السيارة: '+[vehicle?.make,vehicle?.model].filter(Boolean).join(' ')]})
      }
      for (const row of (promotions.data||[]) as any[]) { const vehicle=Array.isArray(row.vehicles)?row.vehicles[0]:row.vehicles; items.push({id:row.id,vehicleId:row.vehicle_id||undefined,type:'promotions',title:row.plan_name_snapshot||'طلب إعلان',subtitle:[vehicle?.make,vehicle?.model].filter(Boolean).join(' ')||relationName(row.organizations)||'إعلان سيارة',status:row.status+' · '+row.payment_status,createdAt:row.created_at,href:'/workspace/admin/vehicle-reviews',details:['الباقة: '+(row.plan_name_snapshot||'غير محددة'),'رقم التحويل: '+(row.payment_reference||'غير مسجل'),'السيارة: '+[vehicle?.make,vehicle?.model].filter(Boolean).join(' ')]}) }
      for (const row of (subscriptions.data||[]) as any[]) items.push({id:row.id,type:'subscriptions',title:row.plan_name||'اشتراك شركة',subtitle:relationName(row.organizations)||'شركة',status:row.payment_status,createdAt:row.created_at,href:'/workspace/admin/company-subscriptions',details:['دورة الفوترة: '+(row.billing_cycle==='yearly'?'سنوي':'شهري'),'المبلغ: '+Number(row.amount_egp||0).toLocaleString('ar-EG')+' جنيه','رقم التحويل: '+(row.payment_reference||'غير مسجل'),'تاريخ التحويل: '+(row.payment_transfer_date||'غير مسجل')]})
      for (const row of (employeeRequests.data||[]) as any[]) items.push({id:row.id,type:'employees',title:row.title||'طلب موظف',subtitle:[row.vehicle_type,row.governorate].filter(Boolean).join(' · '),status:row.status,createdAt:row.created_at,href:'/workspace/admin/employee-requests',details:['نوع السيارة: '+(row.vehicle_type||'غير محدد'),'عدد المقاعد: '+(row.seats??'غير محدد'),'المحافظة: '+(row.governorate||'غير محددة'),'عنوان الاستلام: '+(row.pickup_address||'غير مسجل'),'تاريخ البداية: '+(row.start_date||'غير محدد'),'المدة: '+(row.duration_months||'—')+' شهر','أيام العمل أسبوعيًا: '+(row.work_days_per_week??'—'),'ساعات العمل يوميًا: '+(row.daily_hours??'—'),'الميزانية: '+(row.budget_min_egp??'—')+' إلى '+(row.budget_max_egp??'—')+' جنيه','بسائق: '+(row.with_driver?'نعم':'لا'),'تفاصيل إضافية: '+(row.details||'لا توجد')]})
      for (const row of (sourcingSubscriptions.data||[]) as any[]) items.push({id:row.id,type:'sourcing',title:'اشتراك تفويض البحث',subtitle:relationName(row.organizations)||'شركة',status:row.payment_status+' · '+row.status,createdAt:row.created_at,href:'/workspace/admin/managed-sourcing',details:['قيمة الاشتراك: '+Number(row.monthly_price_egp||0).toLocaleString('ar-EG')+' جنيه','عدد الطلبات: '+(row.requests_included??'—'),'رقم التحويل: '+(row.payment_reference||'غير مسجل')]})
      for (const row of (organizations.data||[]) as any[]) items.push({id:row.id,type:'organizations',title:row.name||'حساب جديد',subtitle:row.organization_type||'حساب',status:row.approval_status,createdAt:row.created_at,href:'/workspace/admin/vehicle-reviews',details:['نوع الحساب: '+(row.organization_type||'غير محدد'),'حالة الاعتماد: '+row.approval_status,'المحافظة: '+(row.city||'غير محددة'),'مسؤول التواصل: '+(row.contact_name||'غير مسجل'),'رقم الهاتف: '+(row.phone||'غير مسجل'),'البريد الإلكتروني: '+(row.contact_email||'غير مسجل'),'العنوان: '+(row.address||'غير مسجل'),'نشاط الشركة: '+(row.company_type||'غير محدد'),'عدد سيارات الأسطول: '+(row.fleet_vehicle_count??'—')]})
      for (const row of (tickets.data||[]) as any[]) items.push({id:row.id,type:'tickets',title:'تذكرة #'+row.ticket_number+' · '+row.subject,subtitle:row.category+' · '+row.priority,status:row.status,createdAt:row.created_at,href:'/workspace/admin/support',details:['رقم التذكرة: '+row.ticket_number,'التصنيف: '+row.category,'الأولوية: '+row.priority]})
      items.sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime())
      setQueue(items)
      setCounts({
        vehicles: vehicles.error?null:(vehicles.count??0),
        payments: payments.error?null:(payments.count??0),
        promotions: promotions.error?null:(promotions.count??0),
        companySubscriptions: subscriptions.error?null:(subscriptions.count??0),
        employeeRequests: employeeRequests.error?null:(employeeRequests.count??0),
        sourcingSubscriptions: sourcingSubscriptions.error?null:(sourcingSubscriptions.count??0),
        organizations: organizations.error?null:(organizations.count??0),
        tickets: tickets.error?null:(tickets.count??0),
      })
      const audits: AuditItem[] = []
      const auditRows = [
        ...(paymentAudit.data||[]).map((r:any)=>({id:r.id,type:'تحويل تسجيل سيارة',status:r.review_status,reviewedAt:r.reviewed_at,reviewer:r.reviewed_by,note:r.admin_notes})),
        ...(promotionAudit.data||[]).map((r:any)=>({id:r.id,type:'إعلان',status:r.status,reviewedAt:r.reviewed_at,reviewer:r.reviewed_by,note:r.admin_notes})),
        ...(subscriptionAudit.data||[]).map((r:any)=>({id:r.id,type:'اشتراك شركة',status:r.payment_status+' · '+r.status,reviewedAt:r.reviewed_at,reviewer:r.reviewed_by,note:r.admin_notes})),
        ...(employeeAudit.data||[]).map((r:any)=>({id:r.id,type:'طلب موظف',status:r.status,reviewedAt:r.reviewed_at,reviewer:r.reviewed_by,note:r.admin_notes})),
        ...(sourcingAudit.data||[]).map((r:any)=>({id:r.id,type:'اشتراك تفويض البحث',status:r.payment_status+' · '+r.status,reviewedAt:r.reviewed_at,reviewer:r.reviewed_by,note:null})),
      ]
      audits.push(...auditRows.filter(r=>r.reviewedAt).map(r=>({...r,reviewedAt:String(r.reviewedAt)})))
      audits.sort((a,b)=>new Date(b.reviewedAt).getTime()-new Date(a.reviewedAt).getTime())
      setAudit(audits.slice(0,12))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'تعذر تحميل مركز المراجعات.')
    } finally {
      setRefreshing(false)
    }
  }, [])
  useEffect(() => {
    let active = true
    async function verify() {
      const client = supabase
      if (!client) { window.location.replace('/?login=1'); return }
      const { data: auth } = await client.auth.getUser()
      if (!auth.user) { window.location.replace('/?login=1'); return }
      const { data, error } = await client.from('platform_admins').select('user_id').eq('user_id', auth.user.id).maybeSingle()
      if (!active) return
      if (error || !data) { window.location.replace('/'); return }
      setAuthorized(true)
      setLoading(false)
      void loadQueues()
    }
    void verify()
    return () => { active = false }
  }, [loadQueues])
  const filteredQueue = useMemo(() => queue.filter(item => {
    const term=query.trim().toLocaleLowerCase()
    const matchesTerm=!term||[item.title,item.subtitle,item.type,item.status].join(' ').toLocaleLowerCase().includes(term)
    const matchesFilter=filter==='all'||item.type===filter
    const matchesStatus=statusFilter==='all'||item.status.toLocaleLowerCase().includes(statusFilter)
    return matchesTerm&&matchesFilter&&matchesStatus
  }).sort((a,b)=>sortOrder==='newest'?new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime():new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime()),[queue,query,filter,statusFilter,sortOrder])
  const visibleQueue = useMemo(()=>filteredQueue.slice(page*pageSize,(page+1)*pageSize),[filteredQueue,page])
  const selectedItem = selectedIndex===null ? null : visibleQueue[selectedIndex]||null\n  useEffect(() => {
    let active = true
    async function loadEvidence() {
      setEvidence([])
      setEvidenceError('')
      if (!selectedItem || !supabase || !selectedItem.vehicleId) return
      setEvidenceLoading(true)
      try {
        const client = supabase
        const [images, paymentRows] = await Promise.all([
          client.from('vehicle_images').select('storage_path,alt_text,sort_order').eq('vehicle_id',selectedItem.vehicleId).order('sort_order',{ascending:true}),
          selectedItem.type==='promotions'?Promise.resolve({data:[],error:null}):client.from('vehicle_payment_submissions').select('id,proof_path,transfer_reference,review_status').eq('vehicle_id',selectedItem.vehicleId).in('review_status',['pending','pending_review']).order('created_at',{ascending:false}).limit(1)
        ])
        if (images.error) throw new Error('تعذر تحميل صور السيارة: '+images.error.message)
        if (paymentRows.error) throw new Error('تعذر تحميل إثبات التحويل: '+paymentRows.error.message)
        const signedImages = await Promise.all((images.data||[]).map(async row => {
          const signed = await client.storage.from('vehicle-images').createSignedUrl(row.storage_path,900)
          return signed.error||!signed.data?.signedUrl?null:{label:row.alt_text||'صورة السيارة',url:signed.data.signedUrl,kind:'image' as const}
        }))
        const proofPath = paymentRows.data?.[0]?.proof_path
        let proof: EvidenceItem|null = null
        if (proofPath) {
          const signed = await client.storage.from('payment-proofs').createSignedUrl(proofPath,900)
          if (!signed.error&&signed.data?.signedUrl) proof={label:'إثبات تحويل رسوم التسجيل',url:signed.data.signedUrl,kind:'file'}
          else throw new Error('تعذر إنشاء رابط آمن لإثبات التحويل.')
        }
        if (active) setEvidence([...signedImages.filter((item):item is EvidenceItem=>Boolean(item)),...(proof?[proof]:[])])
      } catch (error) {
        if (active) setEvidenceError(error instanceof Error?error.message:'تعذر تحميل المرفقات.')
      } finally {
        if (active) setEvidenceLoading(false)
      }
    }
    void loadEvidence()
    return ()=>{active=false}
  },[selectedItem?.id,selectedItem?.type,selectedItem?.vehicleId])

  const queueFilters=[{value:'all',label:'الكل'},{value:'vehicles',label:'سيارات'},{value:'payments',label:'تحويلات'},{value:'promotions',label:'إعلانات'},{value:'subscriptions',label:'اشتراكات'},{value:'employees',label:'موظفين'},{value:'sourcing',label:'تفويض البحث'},{value:'organizations',label:'حسابات'},{value:'tickets',label:'دعم'}]
  const moveSelection=(direction:number)=>setSelectedIndex(current=>current===null?null:Math.max(0,Math.min(visibleQueue.length-1,current+direction)))
  if (loading || !authorized) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50"><p className="font-bold text-slate-600">جارٍ التحقق من صلاحيات الإدارة...</p></main>
  return <><AdminPageNavigation/><main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 sm:px-7 lg:px-9">
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="rounded-3xl bg-gradient-to-l from-[#102b47] to-[#17466b] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-cyan-100"><ClipboardCheck size={15}/> مركز المراجعات الموحد</div><h1 className="text-2xl font-black sm:text-3xl">راجع الطلبات المتراكمة من شاشة واحدة</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">قائمة موحدة للطلبات المنتظرة، مع معاينة سريعة والتنقل بين الطلبات. قرارات الاعتماد تظل داخل شاشاتها الأصلية للحفاظ على ضوابط كل خدمة.</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => void loadQueues()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold disabled:opacity-60"><RefreshCw size={16} className={refreshing ? "animate-spin" : ""}/> تحديث البيانات</button><a href="/workspace/admin" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/15"><LayoutDashboard size={17}/> لوحة التحكم</a></div>
        </div>
      </header>
      {loadError&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{loadError}</div>}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:"السيارات المنتظرة",value:counts.vehicles},{label:"تحويلات التسجيل",value:counts.payments},{label:"الحسابات والمؤسسات",value:counts.organizations},{label:"الإعلانات",value:counts.promotions},{label:"اشتراكات الشركات",value:counts.companySubscriptions},{label:"طلبات الموظفين",value:counts.employeeRequests},{label:"تفويضات البحث",value:counts.sourcingSubscriptions},{label:"الدعم والتذاكر",value:counts.tickets}].map(item=><div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-bold text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-black text-slate-900">{item.value===null||item.value===undefined?'—':item.value}</p><p className="mt-1 text-xs text-slate-400">سجلات مطابقة لحالة المراجعة</p></div>)}</section>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">قائمة المراجعة الموحدة</h2><p className="text-xs text-slate-500">الأقدم أولًا لمساعدتك على إنهاء الطلبات حسب أسبقية الوصول</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{filteredQueue.length} طلب</span></div>
        <div className="flex flex-wrap gap-2">{queueFilters.map(option=><button key={option.value} onClick={()=>{setFilter(option.value);setSelectedIndex(null);setPage(0)}} className={'rounded-full px-3 py-2 text-xs font-bold '+(filter===option.value?'bg-[#102b47] text-white':'border border-slate-200 bg-white text-slate-600')}>{option.label}</button>)}</div>
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_180px]"><div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3"><Search size={18} className="text-slate-400"/><input value={query} onChange={event=>{setQuery(event.target.value);setSelectedIndex(null);setPage(0)}} placeholder="ابحث باسم الطلب أو الجهة أو الحالة..." className="w-full bg-transparent text-sm outline-none" aria-label="البحث في قائمة المراجعة"/></div><select aria-label="تصفية حسب الحالة" value={statusFilter} onChange={event=>{setStatusFilter(event.target.value);setPage(0);setSelectedIndex(null)}} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="all">كل الحالات</option><option value="pending">قيد الانتظار</option><option value="pending_review">بانتظار المراجعة</option><option value="submitted">تم الإرسال</option><option value="open">مفتوحة</option><option value="in_progress">قيد المعالجة</option><option value="waiting_user">بانتظار المستخدم</option></select><select aria-label="ترتيب الطلبات" value={sortOrder} onChange={event=>{setSortOrder(event.target.value);setPage(0);setSelectedIndex(null)}} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="oldest">الأقدم أولًا</option><option value="newest">الأحدث أولًا</option></select></div>
        {visibleQueue.length===0?<div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">لا توجد طلبات مطابقة للفلاتر الحالية.</div>:<div className="divide-y divide-slate-100">{visibleQueue.map((item,index)=><button key={item.type+item.id} onClick={()=>setSelectedIndex(index)} className={'flex w-full flex-wrap items-center justify-between gap-3 px-2 py-4 text-right transition hover:bg-blue-50/70 '+(selectedIndex===index?'bg-blue-50':'')}><div className="min-w-0"><p className="font-extrabold text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.subtitle} · {item.type==='tickets'?'دعم':item.type==='vehicles'?'سيارة':item.type==='payments'?'تحويل':item.type==='promotions'?'إعلان':item.type==='subscriptions'?'اشتراك شركة':item.type==='employees'?'طلب موظف':item.type==='sourcing'?'تفويض بحث':'حساب'}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{item.status}</span><span className="text-xs text-slate-400">{dateLabel(item.createdAt)}</span><ChevronLeft size={17} className="text-slate-400"/></div></button>)}</div>}
        {filteredQueue.length>pageSize&&<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">صفحة {page+1} من {Math.ceil(filteredQueue.length/pageSize)} · تعرض القائمة أول 200 عنصر من كل نوع في هذه المرحلة</p><div className="flex gap-2"><button onClick={()=>{setPage(p=>Math.max(0,p-1));setSelectedIndex(null)}} disabled={page===0} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40">السابق</button><button onClick={()=>{setPage(p=>Math.min(Math.ceil(filteredQueue.length/pageSize)-1,p+1));setSelectedIndex(null)}} disabled={(page+1)*pageSize>=filteredQueue.length} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40">التالي</button></div></div>}
      </section>
      {selectedItem&&<div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-5" role="presentation" onClick={()=>setSelectedIndex(null)}><section role="dialog" aria-modal="true" aria-labelledby="review-preview-title" onClick={event=>event.stopPropagation()} className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-blue-700">معاينة سريعة · {selectedIndex!+1} من {visibleQueue.length}</p><h2 id="review-preview-title" className="mt-1 text-xl font-black text-slate-900">{selectedItem.title}</h2><p className="mt-1 text-sm text-slate-500">{selectedItem.subtitle}</p></div><button onClick={()=>setSelectedIndex(null)} className="rounded-xl border border-slate-200 p-2" aria-label="إغلاق"><X size={18}/></button></div><div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">الحالة الحالية</p><p className="mt-1 font-extrabold text-slate-900">{selectedItem.status}</p><p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14}/>{dateLabel(selectedItem.createdAt)}</p></div><ul className="mt-4 space-y-2">{selectedItem.details.map((detail,index)=><li key={index} className="rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700">{detail}</li>)}</ul>{selectedItem.vehicleId&&<section className="mt-4 rounded-2xl border border-slate-200 p-3"><h3 className="font-extrabold text-slate-800">صور السيارة وإثباتات الدفع</h3>{evidenceLoading?<p className="mt-2 text-xs text-slate-500">جارٍ تحميل المرفقات...</p>:evidenceError?<p className="mt-2 text-xs text-rose-700">{evidenceError}</p>:evidence.length===0?<p className="mt-2 text-xs text-slate-500">لا توجد مرفقات متاحة في هذا الطلب.</p>:<div className="mt-3 grid grid-cols-2 gap-2">{evidence.map((item,index)=><a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200"><span className="block bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700">{item.label}</span>{item.kind==='image'?<img src={item.url} alt={item.label} className="h-32 w-full object-cover"/>:<span className="block p-3 text-sm font-bold text-blue-700">فتح إثبات التحويل</span>}</a>)}</div>}</section>}<div className="mt-5 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><button disabled={selectedIndex===0} onClick={()=>moveSelection(-1)} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-40"><ChevronRight size={16}/> السابق</button><button disabled={selectedIndex===visibleQueue.length-1} onClick={()=>moveSelection(1)} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-40">التالي <ChevronLeft size={16}/></button></div><a href={selectedItem.href} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-extrabold text-white"><ExternalLink size={16}/> فتح شاشة الإجراء</a></div></section></div>}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><History size={18} className="text-blue-700"/><h2 className="text-lg font-black">آخر قرارات المراجعة المسجلة</h2></div><p className="text-xs leading-6 text-slate-500">يعرض السجل بيانات المراجعة المحفوظة حاليًا في جداول الخدمات (المراجع، وقت المراجعة، والحالة). لا يمثل سجل تدقيق مستقلًا غير قابل للتعديل.</p>{audit.length===0?<p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">لا توجد قرارات مراجعة مسجلة بعد.</p>:<div className="divide-y divide-slate-100">{audit.map(item=><div key={item.type+item.id} className="flex flex-wrap items-start justify-between gap-3 py-3"><div><p className="font-bold text-slate-800">{item.type}</p><p className="mt-1 text-xs text-slate-500">الحالة: {item.status} · رقم الطلب: {item.id.slice(0,8)}</p>{item.note&&<p className="mt-1 text-xs text-slate-500">ملاحظة: {item.note}</p>}</div><div className="text-left text-xs text-slate-500"><p>{dateLabel(item.reviewedAt)}</p><p className="mt-1">معرف المراجع: {item.reviewer||'غير مسجل'}</p></div></div>)}</div>}</section>
      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-950"><b>ملاحظة تشغيلية:</b> المعاينة والتنقل والسجل الموحد للبيانات المتاحة مفعّلة. اعتماد أو رفض كل طلب يظل من شاشة الخدمة الأصلية؛ لم نضف توزيعًا للطلبات على الموظفين لأن قاعدة البيانات الحالية لا تحتوي على حقل مسؤول/مكلّف بالمراجعة، وإضافته تتطلب تصميم صلاحيات ومخطط تدقيق مستقل قبل تفعيلها.</section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{groups.map(group=><div key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-black text-slate-900">{group.title}</h2><p className="mt-1 text-xs leading-6 text-slate-500">{group.description}</p>{group.items.map(item=><a key={item.label} href={item.href} className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50"><span className="flex items-center gap-2"><item.icon size={17}/>{item.label}</span><ArrowUpRight size={16}/></a>)}</div>)}</section>
      <footer className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500">لم يتم حذف أي شاشة قديمة أو تغيير منطق اعتماد الدفع أو الاشتراكات أو الإعلانات. الإجراءات النهائية ما زالت تستخدم ضوابطها الحالية.</footer>
    </div>
  </main></>
}
