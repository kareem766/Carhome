import { useState, type FormEvent, type ChangeEvent } from 'react'
import { ArrowRight, Building2, CarFront, CheckCircle2, ChevronDown, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isValidEmailAddress, normalizeEmailAddress } from '../lib/email'
import PlatformBrand from './PlatformBrand'

type Role = 'individual_owner' | 'company' | 'fleet_supplier' | 'employee'
type FieldKey = 'fullName' | 'authorizedName' | 'companyName' | 'phone' | 'email' | 'companyType' | 'governorate' | 'address' | 'password'

const governorates = ['القاهرة','الجيزة','الإسكندرية','القليوبية','البحيرة','مطروح','المنوفية','الغربية','كفر الشيخ','الدقهلية','دمياط','الشرقية','بورسعيد','الإسماعيلية','السويس','شمال سيناء','جنوب سيناء','بني سويف','الفيوم','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','الوادي الجديد']
const companyTypes = ['عقارات','بترول وطاقة','نقل ولوجستيات','تجارة وتوزيع','صناعة','مقاولات','خدمات','سياحة وفنادق','رعاية صحية','تقنية واتصالات','أخرى']
const roleInfo: Record<Role, { title: string; intro: string; marketing: string; icon: typeof CarFront }> = {
  individual_owner: { title: 'تسجيل مالك سيارة', intro: 'أدخل بياناتك الأساسية لإنشاء حسابك، ثم أضف سيارتك لتبدأ إجراءات المراجعة.', marketing: 'حوّل سيارتك إلى فرصة حقيقية؛ سجّل بياناتها واعرضها أمام الشركات الباحثة عن سيارات للتأجير طويل الأجل، وتابع الطلبات والعروض من حساب واحد.', icon: CarFront },
  company: { title: 'تسجيل شركة', intro: 'أنشئ حساب شركتك لإدارة احتياجات التأجير ومراجعة السيارات والعروض المتاحة.', marketing: 'وفّر وقت فريقك في البحث عن السيارات؛ استكشف الكتالوج، أرسل طلباتك، قارن العروض، أو فوّض My Car عربيتي للبحث نيابةً عن شركتك.', icon: Building2 },
  fleet_supplier: { title: 'تسجيل مورد أسطول', intro: 'أكمل بيانات المورد ثم أضف سيارات أسطولك وابدأ في استقبال طلبات الشركات.', marketing: 'وسّع فرص ظهور أسطولك أمام الشركات؛ اعرض سياراتك المعتمدة، واستقبل طلبات التأجير المناسبة، وأدر بيانات مركباتك من مساحة عمل واحدة.', icon: CarFront },
  employee: { title: 'تسجيل موظف', intro: 'أنشئ حسابك لطلب سيارة شهرية بسائق ومتابعة عروض الملاك وموردي الأساطيل.', marketing: 'اطلب سيارة شهرية بسائق بسهولة، واستقبل عروضًا متعددة وقارن بينها واختر الأنسب لاحتياجك وميزانيتك دون إضاعة وقتك في البحث.', icon: CarFront }
}

export default function RoleRegistrationPage({ role, onBack }: { role: Role; onBack: () => void }) {
  const [values, setValues] = useState<Record<FieldKey, string>>({ fullName: '', authorizedName: '', companyName: '', phone: '', email: '', companyType: '', governorate: '', address: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [companyLogo, setCompanyLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [fleetVehicleCount, setFleetVehicleCount] = useState('')
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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

  async function continueWithGoogle() {
    setError('')
    if (!acceptedLegal) { setError('يجب الموافقة على شروط الاستخدام وسياسة الخصوصية أولًا.'); return }
    if (!supabase) { setError('خدمة الحسابات غير متاحة حاليًا.'); return }
    setBusy(true)
    try {
      sessionStorage.setItem('mycar_google_pending_role', role)
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } }
      })
      if (oauthError) throw oauthError
    } catch (caught) {
      sessionStorage.removeItem('mycar_google_pending_role')
      setError(caught instanceof Error ? caught.message : 'تعذر بدء التسجيل باستخدام Google.')
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!acceptedLegal) { setError('يجب الموافقة على سياسة الخصوصية وشروط الاستخدام قبل إنشاء الحساب.'); return }
    if ((isCompany || role === 'fleet_supplier') && !companyLogo) { setError('يرجى إرفاق لوجو الشركة أو المكتب لاستكمال التسجيل.'); return }
    if (role === 'fleet_supplier' && (!Number.isInteger(Number(fleetVehicleCount)) || Number(fleetVehicleCount) < 1)) { setError('يرجى إدخال عدد سيارات صحيح لا يقل عن سيارة واحدة.'); return }
    const requiredValues = isCompany
      ? [values.authorizedName, values.companyName, values.phone, values.email, values.companyType, values.governorate, values.address]
      : isOwner
        ? [values.fullName, values.phone, values.email, values.governorate, values.address]
        : role === 'fleet_supplier'
        ? [values.fullName, values.companyName, values.phone, values.email, values.governorate, values.address, fleetVehicleCount]
        : [values.fullName, values.phone, values.email, values.governorate, values.address]
    if (requiredValues.some((value) => !value.trim())) { setError('من فضلك أكمل جميع الحقول المطلوبة قبل إنشاء الحساب. لا يمكن ترك أي حقل مطلوب فارغًا.'); return }
    const email = normalizeEmailAddress(values.email)
    if (!isValidEmailAddress(email)) { setError('من فضلك أدخل بريدًا إلكترونيًا صحيحًا.'); return }
    const phone = values.phone.replace(/\D/g, '')
    const phoneRequired = true
    if ((phoneRequired || phone.length > 0) && !/^01[0-9]{9}$/.test(phone)) {
      setError('من فضلك أدخل رقم موبايل مصري صحيح مكوّن من 11 رقمًا ويبدأ بـ 01.')
      return
    }
    const password = values.password
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError('كلمة المرور غير قوية. يجب أن تحتوي على 8 أحرف على الأقل، وحرف كبير وحرف صغير ورقم ورمز خاص.')
      return
    }
    if (!supabase) { setError('خدمة الحسابات غير مضبوطة حاليًا.'); return }
    setBusy(true)
    try {
      const displayName = isCompany ? values.authorizedName.trim() : values.fullName.trim()
      const organizationName = isCompany ? values.companyName.trim() : role === 'fleet_supplier' && values.companyName.trim() ? values.companyName.trim() : displayName
      const metadata = {
        display_name: displayName,
        organization_name: organizationName,
        organization_type: role,
        phone,
        email_contact: email,
        governorate: values.governorate,
        address: values.address.trim(),
        company_type: isCompany ? values.companyType : null,
        fleet_vehicle_count: role === 'fleet_supplier' && fleetVehicleCount !== '' ? Number(fleetVehicleCount) : null,
        onboarding_version: 2,
        legal_acceptance: { terms_version: '2026-10-25', privacy_version: '2026-10-25', accepted_at: new Date().toISOString() }
      }
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: metadata, emailRedirectTo: `${window.location.origin}/auth/callback` } })
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
        setConfirmationSent(true)
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'تعذر إكمال التسجيل. حاول مرة أخرى.'
      setError(/already registered|user already exists|already been registered|email exists|duplicate/i.test(message) ? 'هذا البريد مسجل بالفعل. انتقل إلى تسجيل الدخول أو استخدم «نسيت كلمة المرور».' : message)
    } finally { setBusy(false) }
  }

  if (confirmationSent) { return <main dir="rtl" className="grid min-h-screen place-items-center bg-blue-50 p-4"><section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-xl"><div className="mb-5 flex justify-center"><PlatformBrand /></div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700"><CheckCircle2 size={28}/></span><h1 className="mt-5 text-2xl font-extrabold text-slate-950">أكد بريدك الإلكتروني</h1><p className="mt-4 text-sm leading-7 text-slate-600">أرسلنا رسالة تأكيد إلى بريدك. افتح الرسالة واضغط على رابط التأكيد للعودة إلى My Car وإكمال إعداد حسابك.</p><p dir="ltr" className="mt-4 break-all rounded-xl bg-blue-50 p-3 font-bold text-blue-900">{normalizeEmailAddress(values.email)}</p><p className="mt-4 text-right text-sm leading-7 text-slate-600">افحص صندوق الوارد ومجلد الرسائل غير المرغوب فيها. احتفظ بهذه الصفحة مفتوحة حتى تؤكد بريدك.</p><button onClick={() => { setConfirmationSent(false); setNotice(''); setError('') }} className="mt-6 rounded-xl border px-5 py-3 text-sm font-bold text-slate-600">العودة لبيانات التسجيل</button></section></main> }

  const fieldClass = 'mt-2 min-h-12 w-full rounded-xl border border-slate-200/90 bg-white px-4 text-sm shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100/80'
  const field = (key: FieldKey, label: string, required: boolean, type = 'text', placeholder = '') => (
    <label className="block text-sm font-bold text-slate-700" key={key}>{label}{required ? ' *' : ' (اختياري)'}
      <input className={fieldClass} type={type} required={required} value={values[key]} onChange={(e) => update(key, e.target.value)} onBlur={key === 'email' ? (e) => update('email', normalizeEmailAddress(e.target.value)) : undefined} placeholder={placeholder} autoComplete={key === 'password' ? 'new-password' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'off'} dir={key === 'email' || key === 'phone' || key === 'password' ? 'ltr' : 'rtl'} minLength={key === 'password' ? 8 : undefined} />
    </label>
  )

  return <main dir="rtl" className="mc-registration-main min-h-screen bg-[radial-gradient(ellipse_at_top_right,_rgba(37,99,235,0.13),_transparent_38%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_52%,#eef2ff_100%)] px-3 py-6 sm:px-6 sm:py-10">
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><button onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white bg-white/90 px-4 py-2.5 text-sm font-extrabold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-800"><ArrowRight size={18}/> العودة لاختيار نوع الحساب</button><a href="/" className="inline-flex min-h-11 items-center rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-white/80 hover:text-blue-800">الرئيسية</a></div>
      <section className="overflow-hidden rounded-[2rem] border border-white/90 bg-white/95 shadow-[0_32px_90px_-38px_rgba(20,45,78,0.35)] ring-1 ring-blue-950/5 backdrop-blur-xl">
        <div className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.42),_transparent_45%),linear-gradient(125deg,#142D4E_0%,#173e70_58%,#0f2340_100%)] px-5 py-6 text-white sm:px-9 sm:py-9">
          <div aria-hidden="true" className="pointer-events-none absolute -left-10 -top-16 h-48 w-48 rounded-full border-[28px] border-white/5"></div>
          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl"></div>
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-inner shadow-white/5"><PlatformBrand /></div>
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-blue-500/20 text-blue-100"><Icon size={27}/></span>
          </div>
          <div className="relative mt-6"><p className="text-xs font-extrabold tracking-wide text-blue-200">إنشاء حساب جديد</p><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{info.title}</h1><p className="mt-3 max-w-xl text-sm leading-7 text-blue-100">{info.intro}</p><div className="mt-4 max-w-2xl rounded-2xl border border-amber-300/30 bg-white/10 p-4 text-sm font-semibold leading-7 text-white shadow-inner"><span className="mb-1 block text-xs font-black text-amber-300">لماذا تنضم إلى My Car عربيتي؟</span>{info.marketing}</div></div>
        </div>
        <form onSubmit={submit} className="mc-registration-form space-y-6 p-4 sm:p-8 lg:p-9">
          <div className="grid gap-4 sm:grid-cols-2">
            {isCompany ? <>{field('authorizedName','اسم المفوض',true)}{field('companyName','اسم الشركة',true)}</> : <>{field('fullName','الاسم بالكامل',true)}{role === 'fleet_supplier' && field('companyName','اسم المكتب / الشركة',true)}</>}
            {field('phone','رقم الموبايل',true,'tel','01xxxxxxxxx')}
            {field('email','البريد الإلكتروني',true,'email','name@example.com')}
            {(isCompany || role === 'fleet_supplier') && <div className="sm:col-span-2"><label className="block text-sm font-bold text-slate-700">{role === 'fleet_supplier' ? 'لوجو المكتب / الشركة *' : 'لوجو الشركة *'}<input required type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseLogo} className={fieldClass + ' file:ml-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-bold file:text-blue-700'} /></label><p className="mt-1 text-xs text-slate-500">PNG أو JPG أو WEBP، بحد أقصى 2 ميجابايت.</p>{logoPreview && <img src={logoPreview} alt="معاينة لوجو الشركة" className="mt-3 h-24 w-24 rounded-2xl border border-slate-200 bg-white object-contain p-2" />}</div>}
            {role === 'fleet_supplier' && <label className="block text-sm font-bold text-slate-700">عدد سيارات المكتب / الشركة *<input className={fieldClass} type="number" required min="1" step="1" inputMode="numeric" value={fleetVehicleCount} onChange={(e) => setFleetVehicleCount(e.target.value)} placeholder="مثال: 15" /></label>}
            {isCompany && <label className="block text-sm font-bold text-slate-700">نوع الشركة *<span className="relative block"><select required className={fieldClass} value={values.companyType} onChange={(e) => update('companyType',e.target.value)}><option value="">اختر نشاط الشركة</option>{companyTypes.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={17} className="pointer-events-none absolute left-4 top-4 text-slate-400"/></span></label>}
            <label className="block text-sm font-bold text-slate-700">المحافظة *<span className="relative block"><select required className={fieldClass} value={values.governorate} onChange={(e) => update('governorate',e.target.value)}><option value="">اختر المحافظة</option>{governorates.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={17} className="pointer-events-none absolute left-4 top-4 text-slate-400"/></span></label>
            {field('address',isCompany ? 'عنوان الشركة' : 'العنوان',true,'text','المركز / الشارع / رقم العقار')}
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-slate-700">كلمة المرور *
                <span className="relative mt-2 block">
                  <input className={fieldClass + ' pl-12'} type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={values.password} onChange={(e) => update('password', e.target.value)} placeholder="أنشئ كلمة مرور قوية" dir="ltr" minLength={8} />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} className="absolute left-3 top-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                </span>
              </label>
              <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
                {[
                  ['8 أحرف على الأقل', values.password.length >= 8],
                  ['حرف كبير وحرف صغير (A-Z / a-z)', /[a-z]/.test(values.password) && /[A-Z]/.test(values.password)],
                  ['رقم واحد على الأقل (0-9)', /[0-9]/.test(values.password)],
                  ['رمز خاص مثل ! @ # $ %', /[^A-Za-z0-9]/.test(values.password)]
                ].map(([label, valid]) => <span key={String(label)} className={'flex items-center gap-2 ' + (valid ? 'font-bold text-emerald-700' : 'text-slate-500')}><CheckCircle2 size={15} className={valid ? 'text-emerald-600' : 'text-slate-300'}/>{label}</span>)}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">لن يُقبل التسجيل إلا بعد استيفاء جميع شروط كلمة المرور.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-l from-blue-50 to-white p-4 text-sm leading-7 text-blue-950"><p className="flex items-center gap-2 font-extrabold"><ShieldCheck size={18}/> حماية بياناتك</p><p className="mt-1">تُستخدم البيانات لإعداد حسابك والتواصل بشأن طلبات التأجير. لا تتم أي مدفوعات بين أطراف التأجير عبر المنصة.</p></div>
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-l from-blue-50 to-white p-4 text-sm leading-7 text-slate-700"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" required checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-blue-700"/><span>قرأت ووافقت على <a href="/terms" target="_blank" rel="noreferrer" className="font-extrabold text-blue-700 underline underline-offset-4">شروط الاستخدام</a> و<a href="/privacy" target="_blank" rel="noreferrer" className="font-extrabold text-blue-700 underline underline-offset-4">سياسة الخصوصية</a>. أوافق على معالجة بياناتي وفق السياسة الموضحة، وأفهم أن الموافقة شرط لإنشاء الحساب.</span></label><p className="mt-2 text-xs text-slate-500">سيُسجّل وقت الموافقة وإصدار الوثيقتين ضمن بيانات التسجيل.</p></div>
          {isOwner && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950"><p className="font-extrabold">رسوم تسجيل السيارة</p><p>300 جنيه لكل سيارة شهريًا، ويُستكمل التسجيل بعد تحويل المبلغ ومراجعة الإدارة لبيانات السيارة. لن تُعرض السيارة كسيارة مسجلة أو معتمدة قبل الموافقة.</p><p className="mt-1 text-xs">هذه الخطوة لا تحصّل أي مبلغ تلقائيًا؛ تعليمات الدفع ومراجعة الإدارة تُستكمل في مرحلة تسجيل السيارة.</p></div>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{notice}</p>}
          <button type="button" onClick={continueWithGoogle} disabled={busy || !acceptedLegal} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 font-extrabold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60">G&nbsp; {role === 'employee' ? 'تسجيل دخول الموظف باستخدام Google' : 'المتابعة باستخدام Google'}</button>
          {role === 'employee' && <p className="text-center text-xs leading-6 text-slate-500">حساب الموظف مرتبط بشركة؛ يجب أن يضيفك مسؤول الشركة أولًا، ثم تستخدم بريدك المسجل لدى الشركة للدخول عبر Google.</p>}
          <div className="flex items-center gap-3 text-xs font-bold text-slate-400"><span className="h-px flex-1 bg-slate-200"/><span>أو بالبريد الإلكتروني</span><span className="h-px flex-1 bg-slate-200"/></div>
          <button type="submit" disabled={busy || !acceptedLegal} className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-800 to-blue-600 px-5 font-extrabold text-white shadow-[0_12px_25px_-12px_rgba(29,78,216,0.8)] transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب والمتابعة'} <ArrowRight size={18}/></button>
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
    { role: 'fleet_supplier', title: 'مورد أسطول', detail: 'إدارة سيارات الأسطول وتجهيزها للمراجعة', icon: CarFront },
    { role: 'employee', title: 'موظف', detail: 'اطلب سيارة شهرية بسائق وتابع العروض المقدمة لك', icon: CarFront }
  ]
  return <main dir="rtl" className="mc-role-chooser min-h-screen bg-[radial-gradient(ellipse_at_top_right,_rgba(37,99,235,0.13),_transparent_38%),linear-gradient(180deg,#eff6ff_0%,#f8fafc_55%,#eef2ff_100%)] px-3 py-7 sm:px-6 sm:py-12"><div className="mx-auto max-w-5xl"><section className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.42),_transparent_45%),linear-gradient(125deg,#142D4E_0%,#173e70_58%,#0f2340_100%)] px-5 py-7 text-white shadow-[0_32px_80px_-35px_rgba(20,45,78,0.55)] sm:px-10 sm:py-10"><div aria-hidden="true" className="pointer-events-none absolute -left-10 -top-16 h-52 w-52 rounded-full border-[30px] border-white/5"></div><div className="relative"><div className="flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-2xl border border-white/15 bg-white/10 px-4 py-3"><PlatformBrand /></div><a href="/" className="inline-flex min-h-10 items-center rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15">العودة للرئيسية</a></div><p className="mt-7 text-xs font-extrabold tracking-wide text-blue-200">ابدأ رحلتك مع My Car</p><h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">اختر نوع الحساب</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">اختر نوع الحساب الذي يتوافق مع نشاطك للوصول إلى الأدوات والخدمات المناسبة.</p></div></section><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{options.map(({role,title,detail,icon:Icon})=><button key={role} onClick={()=>onChoose(role)} className="group rounded-3xl border border-white bg-white/95 p-5 text-right text-slate-800 shadow-[0_18px_50px_-35px_rgba(20,45,78,0.32)] transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_24px_55px_-30px_rgba(20,45,78,0.3)] focus-visible:outline-blue-600 sm:p-6"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-100 bg-blue-50 text-[#2459A9] transition group-hover:bg-[#142D4E] group-hover:text-white"><Icon size={24}/></span><h2 className="mt-5 text-lg font-extrabold text-[#142D4E]">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{detail}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#2459A9]">متابعة <ArrowRight size={16}/></span></button>)}</div><button onClick={onLogin} className="mt-8 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-blue-50 hover:text-[#142D4E]"><CheckCircle2 size={17}/> لدي حساب بالفعل — تسجيل الدخول</button></div></main>
}
