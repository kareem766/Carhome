import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, CarFront, ClipboardList, FileText, MessageCircle, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Role = 'company' | 'owner' | 'supplier'
const names: Record<Role, string> = { company: 'مساحة الشركة', owner: 'مساحة مالك السيارة', supplier: 'مساحة مورد الأسطول' }

export default function WorkspacePage({ role }: { role: Role }) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  useEffect(() => {
    if (!supabase) { window.location.replace('/'); return }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.replace('/'); return }
      setUser({ name: String(data.user.user_metadata?.display_name || ''), email: data.user.email || data.user.phone || '' })
    })
  }, [])
  async function signOut() { if (supabase) await supabase.auth.signOut(); window.location.replace('/') }
  if (!user) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50">جارٍ تحميل مساحة العمل...</main>
  const company = role === 'company'
  const cards = company ? [
    ['إنشاء طلب تأجير','حدد نوع السيارات والعدد والمدة والمحافظة المطلوبة.',ClipboardList],
    ['السيارات المتاحة','استعراض السيارات المعتمدة بعد تجهيز بيانات السيارات.',CarFront],
    ['الطلبات والعروض','متابعة الطلبات الواردة والصادرة والعروض المقدمة.',FileText],
    ['المراسلات','مراسلة مالك السيارة داخل المنصة.',MessageCircle],
    ['بيانات الشركة','مراجعة بيانات الشركة والمفوض.',Building2],
    ['إدارة الفريق','إدارة العمل والصلاحيات في مراحل لاحقة.',Users]
  ] as const : []
  const vehicleUrl = role === 'owner' ? '/workspace/owner/vehicles/new' : '/workspace/supplier/vehicles/new'
  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><p className="text-sm font-bold text-blue-700">Carhome</p><h1 className="mt-1 text-2xl font-extrabold">{names[role]}</h1><p className="mt-2 text-sm text-slate-500">{user.name} · {user.email}</p></div><button onClick={signOut} className="rounded-xl border px-4 py-2 text-sm font-bold">تسجيل الخروج</button></header>
    {company ? <><section className="mt-6 rounded-3xl bg-slate-950 p-7 text-white"><h2 className="text-2xl font-extrabold">إدارة احتياجات تأجير السيارات</h2><p className="mt-3 text-sm leading-7 text-slate-300">أنشئ طلبات التأجير وراجع السيارات والعروض وتواصل مع الملاك من مساحة واحدة.</p><button onClick={() => window.location.href='/workspace/company/requests/new'} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-extrabold text-slate-950"><ClipboardList size={19}/> إنشاء طلب تأجير <ArrowLeft size={17}/></button></section><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([title,detail,Icon])=><article key={title} className="rounded-2xl border bg-white p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon size={22}/></span><h3 className="mt-4 font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></article>)}</div><p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">لوحة العمل منفصلة، لكن إنشاء الطلبات الفعلية والرسائل والعروض واستعراض السيارات يتطلب تنفيذ وربط وظائفها في مراحل لاحقة. لن نعرض بيانات تجريبية على أنها حقيقية.</p></> :
    <><section className="mt-6 rounded-3xl bg-slate-950 p-7 text-white"><h2 className="text-2xl font-extrabold">{role === 'owner' ? 'سجّل بيانات سيارتك' : 'سجّل سيارات الأسطول'}</h2><p className="mt-3 text-sm leading-7 text-slate-300">{role === 'owner' ? 'رسوم تسجيل السيارة 300 جنيه شهريًا لكل سيارة، ولا يكتمل التسجيل إلا بعد تحويل المبلغ ومراجعة الإدارة واعتماد بيانات السيارة.' : 'أضف بيانات سيارات الأسطول لتجهيزها للمراجعة قبل ظهورها للشركات.'}</p><a href={vehicleUrl} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-extrabold text-slate-950"><CarFront size={19}/> بدء تسجيل سيارة <ArrowLeft size={17}/></a></section><div className="mt-6 grid gap-4 sm:grid-cols-3">{['السيارات المسجلة','قيد مراجعة الإدارة','طلبات الشركات'].map((item)=><article key={item} className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">{item}</p><p className="mt-2 text-2xl font-extrabold">—</p></article>)}</div><p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">هذه صفحة انتقال إلى تسجيل السيارة وليست تسجيلًا نهائيًا. حفظ السيارة والدفع ومراجعة الإدارة تُنفّذ في مرحلة السيارات.</p></>}
  </div></main>
}
