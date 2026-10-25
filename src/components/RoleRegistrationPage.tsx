import { useState, type FormEvent, type ChangeEvent } from 'react'
import { ArrowRight, Building2, CarFront, CheckCircle2, ChevronDown, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformBrand from './PlatformBrand'

type Role = 'individual_owner' | 'company' | 'fleet_supplier'
type FieldKey = 'fullName' | 'authorizedName' | 'companyName' | 'phone' | 'email' | 'companyType' | 'governorate' | 'address' | 'password'

const governorates = ['القاهرة','الجيزة','الإسكندرية','القليوبية','البحيرة','مطروح','المنوفية','الغربية','كفر الشيخ','الدقهلية','دمياط','الشرقية','بورسعيد','الإسماعيلية','السويس','شمال سيناء','جنوب سيناء','بني سويف','الفيوم','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','الوادي الجديد']
const companyTypes = ['عقارات','بترول وطاقة','نقل ولوجستيات','تجارة وتوزيع','صناعة','مقاولات','خدمات','سياحة وفنادق','رعاية صحية','تقنية واتصالات','أخرى']
const roleInfo: Record<Role, { title: string; intro: string; icon: typeof CarFront }> = {
  individual_owner: { title: 'تسجيل مالك سيارة', intro: 'أدخل بياناتك الأساسية لإنشاء حسابك، ثم أضف سيارتك لتبدأ إجراءات المراجعة.', icon: CarFront },
  company: { title: 'تسجيل شركة', intro: 'أنشئ حساب شركتك لإدارة احتياجات التأجير ومراجعة السيارات والعروض المتاحة.', icon: Building2 },
  fleet_supplier: { title: 'تسجيل مورد أسطول', intro: 'أكمل بيانات المورد ثم أضف سيارات أسطولك وابدأ في استقبال طلبات الشركات.', icon: CarFront }
}

export default function RoleRegistrationPage({ role, onBack }: { role: Role; onBack: () => void }) {
  const [values, setValues] = useState<Record<FieldKey, string>>({ fullName: '', authorizedName: '', companyName: '', phone: '', email: '', companyType: '', governorate: '', address: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [companyLogo, setCompanyLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [fleetVehicleCount, setFleetVehicleCount] = useState('')
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const isCompany = role === 'company'
  const isOwner = role === 'individual_owner'
  const info = roleInfo[role]
  const Icon = info.icon
  const update = (key: FieldKey, value: string) => setValues((current) => ({ ...current, [key]: value }))
  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('صيغة اللوجو يجب أن تكون PNG أو JPG أو WEBP.')
      event.target.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('حجم لوجو الشركة يجب ألا يتجاوز 2 ميجابايت.')
      event.target.value = ''
      return
    }
    setError('')
    setCompanyLogo(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!acceptedLegal) { setError('يجب الموافقة على سياسة الخصوصية وشروط الاستخدام قبل إنشاء الحساب.'); return }
    if (!supabase) { setError('خدمة الحسابات غير مضبوطة حاليًا.'); return }
    setBusy(true)
    try {
      const displayName = isCompany ? values.authorizedName.trim() : values.fullName.trim()
      const organizationName = isCompany ? values.companyName.trim() : role === 'fleet_supplier' && values.companyName.trim() ? values.companyName.trim() : displayName
      const metadata = {
        display_name: displayName,
        organization_name: organizationName,
        organization_type: role,
        phone: values.phone.trim(),
        email_contact: values.email.trim() || null,
        governorate: values.governorate,
        address: values.address.trim(),
        company_type: isCompany ? values.companyType : null,
        fleet_vehicle_count: role === 'fleet_supplier' && fleetVehicleCount !== '' ? Number(fleetVehicleCount) : null,
        onboarding_version: 2,
        legal_acceptance: { terms_version: '2026-10-25', privacy_version: '2026-10-25', accepted_at: new Date().toISOString() }
      }
      const credentials = values.email.trim()
        ? { email: values.email.trim().toLowerCase(), password: values.password, options: { data: metadata } }
        : { phone: values.phone.trim(), password: values.password, options: { data: metadata } }
      const { data, error: signUpError } = await supabase.auth.signUp({ ...(credentials as Parameters<typeof supabase.auth.signUp>[0]), options: { data: metadata, emailRedirectTo: `${window.location.origin}/auth/callback` } })
      if (signUpError) throw signUpError
      if (data.session && data.user) {
        if ((isCompany || role === 'fleet_supplier') && companyLogo) {
          const reader = new FileReader()
          const dataUrl: string = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(new Error('تعذر قراءة ملف اللوجو. حاول اختيار الصورة مرة أخرى.'))
            reader.readAsDataURL(companyLogo)
          })
          localStorage.setItem('carhome_pending_company_logo', dataUrl)
        }
        window.location.replace('/auth/callback')
        return
      } else {
        if ((isCompany || role === 'fleet_supplier') && companyLogo) {
          const reader = new FileReader()
          const dataUrl: string = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = () => reject(new Error('تعذر قراءة ملف اللوجو.'))
            reader.readAsDataURL(companyLogo)
          })
          localStorage.setItem('carhome_pending_company_logo', dataUrl)
        }
        setNotice(values.email.trim() ? 'تم إرسال طلب التسجيل. أكّد البريد الإلكتروني من الرسالة. احتفظ بنفس المتصفح لإكمال إعداد الحساب وحفظ اللوجو.' : 'تم إرسال طلب التسجيل برقم الهاتف. أكّد رمز SMS إذا كانت الخدمة مفعّلة، ثم سجّل الدخول لإكمال إعداد الحساب.')
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'تعذر إكمال التسجيل. حاول مرة أخرى.'
      setError(message.includes('User already registered') ? 'هذا البريد مسجل بالفعل. ارجع إلى تسجيل الدخول.' : message)
    } finally { setBusy(false) }
  }

  const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
  const field = (key: FieldKey, label: string, required: boolean, type = 'text', placeholder = '') => (
    <label className="block text-sm font-bold text-slate-700" key={key}>{label}{required ? ' *' : ' (اختياري)'}
      <input className={fieldClass} type={type} required={required} value={values[key]} onChange={(e) => update(key, e.target.value)} placeholder={placeholder} autoComplete={key === 'password' ? 'new-password' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'off'} dir={key === 'email' || key === 'phone' || key === 'password' ? 'ltr' : 'rtl'} minLength={key === 'password' ? 6 : undefined} />
    </label>
  )

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-3xl">
      <button onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700"><ArrowRight size={18}/> العودة لاختيار نوع الحساب</button>
      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="bg-slate-950 px-6 py-7 text-white sm:px-9">
          <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Icon size={25}/></span><div><p className="text-sm font-bold text-blue-200">MY CAR · منصة تأجير السيارات</p><h1 className="mt-1 text-2xl font-extrabold">{info.title}</h1></div></div>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">{info.intro}</p>
        </div>
        <form onSubmit={submit} className="space-y-6 p-6 sm:p-9">
          <div className="grid gap-4 sm:grid-cols-2">
            {isCompany ? <>{field('authorizedName','اسم المفوض',true)}{field('companyName','اسم الشركة',true)}</> : <>{field('fullName','الاسم بالكامل',true)}{role === 'fleet_supplier' && field('companyName','اسم المكتب / الشركة',true)}</>}
            {field('phone','رقم الموبايل',true,'tel','01xxxxxxxxx')}
            {field('email','البريد الإلكتروني',isCompany || role === 'fleet_supplier','email','name@example.com')}
            {(isCompany || role === 'fleet_supplier') && <div className="sm:col-span-2"><label className="block text-sm font-bold text-slate-700">{role === 'fleet_supplier' ? 'لوجو المكتب / الشركة (اختياري)' : 'لوجو الشركة (اختياري)'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseLogo} className={fieldClass + ' file:ml-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-bold file:text-blue-700'} /></label><p className="mt-1 text-xs text-slate-500">PNG أو JPG أو WEBP، بحد أقصى 2 ميجابايت.</p>{logoPreview && <img src={logoPreview} alt="معاينة لوجو الشركة" className="mt-3 h-24 w-24 rounded-2xl border border-slate-200 bg-white object-contain p-2" />}</div>}
            {role === 'fleet_supplier' && <label className="block text-sm font-bold text-slate-700">عدد عربيات المكتب / الشركة (اختياري)<input className={fieldClass} type="number" min="0" step="1" inputMode="numeric" value={fleetVehicleCount} onChange={(e) => setFleetVehicleCount(e.target.value)} placeholder="مثال: 15" /></label>}
            {isCompany && <label className="block text-sm font-bold text-slate-700">نوع الشركة *<span className="relative block"><select required className={fieldClass} value={values.companyType} onChange={(e) => update('companyType',e.target.value)}><option value="">اختر نشاط الشركة</option>{companyTypes.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={17} className="pointer-events-none absolute left-4 top-4 text-slate-400"/></span></label>}
            <label className="block text-sm font-bold text-slate-700">المحافظة *<span className="relative block"><select required className={fieldClass} value={values.governorate} onChange={(e) => update('governorate',e.target.value)}><option value="">اختر المحافظة</option>{governorates.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={17} className="pointer-events-none absolute left-4 top-4 text-slate-400"/></span></label>
            {field('address',isCompany ? 'عنوان الشركة' : 'العنوان',true,'text','المركز / الشارع / رقم العقار')}
            {field('password','كلمة المرور',true,'password','٦ أحرف على الأقل')}
          </div>
          <div className="rounded-2xl bg-blue-50 p-4 text-sm leading-7 text-blue-950"><p className="flex items-center gap-2 font-extrabold"><ShieldCheck size={18}/> حماية بياناتك</p><p className="mt-1">تُستخدم البيانات لإعداد حسابك والتواصل بشأن طلبات التأجير. لا تتم أي مدفوعات بين أطراف التأجير عبر المنصة.</p></div>
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-l from-blue-50 to-white p-4 text-sm leading-7 text-slate-700"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" required checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-blue-700"/><span>قرأت ووافقت على <a href="/terms" target="_blank" rel="noreferrer" className="font-extrabold text-blue-700 underline underline-offset-4">شروط الاستخدام</a> و<a href="/privacy" target="_blank" rel="noreferrer" className="font-extrabold text-blue-700 underline underline-offset-4">سياسة الخصوصية</a>. أوافق على معالجة بياناتي وفق السياسة الموضحة، وأفهم أن الموافقة شرط لإنشاء الحساب.</span></label><p className="mt-2 text-xs text-slate-500">سيُسجّل وقت الموافقة وإصدار الوثيقتين ضمن بيانات التسجيل.</p></div>
          {isOwner && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950"><p className="font-extrabold">رسوم تسجيل السيارة</p><p>300 جنيه لكل سيارة شهريًا، ويُستكمل التسجيل بعد تحويل المبلغ ومراجعة الإدارة لبيانات السيارة. لن تُعرض السيارة كسيارة مسجلة أو معتمدة قبل الموافقة.</p><p className="mt-1 text-xs">هذه الخطوة لا تحصّل أي مبلغ تلقائيًا؛ تعليمات الدفع ومراجعة الإدارة تُستكمل في مرحلة تسجيل السيارة.</p></div>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{notice}</p>}
          <button type="submit" disabled={busy || !acceptedLegal} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-extrabold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب والمتابعة'} <ArrowRight size={18}/></button>
          <p className="text-center text-xs leading-6 text-slate-400">الحقول المطلوبة موضحة بعلامة (*). لا يتم تحصيل رسوم من خلال هذه الصفحة.</p>
        </form>
      </section>
    </div>
  </main>
}

export function RoleChooserPage({ onChoose, onLogin }: { onChoose: (role: Role) => void; onLogin: () => void }) {
  const options: { role: Role; title: string; detail: string; icon: typeof CarFront }[] = [
    { role: 'individual_owner', title: 'مالك سيارة', detail: 'تسجيل بياناتك ثم تسجيل السيارة للمراجعة', icon: CarFront },
    { role: 'company', title: 'شركة', detail: 'طلبات التأجير، عروض الموردين، ومراسلات منظمة', icon: Building2 },
    { role: 'fleet_supplier', title: 'مورد أسطول', detail: 'إدارة سيارات الأسطول وتجهيزها للمراجعة', icon: CarFront }
  ]
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-4xl"><div className="mb-8"><PlatformBrand /></div><h1 className="mt-2 text-3xl font-extrabold text-slate-950">اختر نوع الحساب</h1><p className="mt-3 text-slate-600">اختر نوع الحساب الذي يتوافق مع نشاطك للوصول إلى الأدوات والخدمات المناسبة.</p><div className="mt-8 grid gap-4 md:grid-cols-3">{options.map(({role,title,detail,icon:Icon})=><button key={role} onClick={()=>onChoose(role)} className="rounded-2xl border border-slate-200 bg-white p-6 text-right text-slate-800 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon size={24}/></span><h2 className="mt-5 text-lg font-extrabold text-slate-900">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{detail}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-blue-700">متابعة <ArrowRight size={16}/></span></button>)}</div><button onClick={onLogin} className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700"><CheckCircle2 size={17}/> لدي حساب بالفعل — تسجيل الدخول</button></div></main>
}
