import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Bell, ChevronDown, Home, LogOut, Pencil, UserRound, X, CheckCheck, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PlatformEntryBanner from './PlatformEntryBanner'

type Role = 'مالك سيارة' | 'شركة' | 'مورد أسطول' | 'إدارة المنصة' | 'مستخدم'
type NotificationRow = { id: string; title: string; body: string; notification_type: string; action_url: string | null; read_at: string | null; created_at: string }
type Props = { children: React.ReactNode; platformName?: string; logoUrl?: string | null }

export default function GlobalAppNavigation({ children, platformName = 'My Car', logoUrl }: Props) {
  const [user, setUser] = useState<{ id: string; name: string; email: string; phone: string; role: Role; organizationId: string | null } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [phoneDraft, setPhoneDraft] = useState('')

  useEffect(() => {
    let alive = true
    async function loadUser() {
      if (!supabase) return
      const { data } = await supabase.auth.getUser()
      if (!alive || !data.user) return
      const authUser = data.user
      const meta = authUser.user_metadata || {}
      let role: Role = 'مستخدم'
      let organizationId: string | null = null
      let organizationName = ''
      const { data: memberships } = await supabase.from('organization_memberships')
        .select('organization_id,organizations(id,name,organization_type)')
        .eq('user_id', authUser.id).limit(1)
      const membership = memberships?.[0] as unknown as { organization_id: string; organizations: { name?: string; organization_type?: string } | { name?: string; organization_type?: string }[] | null } | undefined
      const org = Array.isArray(membership?.organizations) ? membership.organizations[0] : membership?.organizations
      if (membership?.organization_id) organizationId = membership.organization_id
      organizationName = org?.name || ''
      if (org?.organization_type === 'individual_owner') role = 'مالك سيارة'
      else if (org?.organization_type === 'company') role = 'شركة'
      else if (org?.organization_type === 'fleet_supplier') role = 'مورد أسطول'
      const { data: adminRow } = await supabase.from('platform_admins').select('user_id').eq('user_id', authUser.id).maybeSingle()
      if (adminRow) role = 'إدارة المنصة'
      const name = String(meta.display_name || organizationName || authUser.email || 'مستخدم My Car')
      const phone = String(meta.phone || '')
      setUser({ id: authUser.id, name, email: authUser.email || '', phone, role, organizationId })
      setNameDraft(name)
      setPhoneDraft(phone)
    }
    void loadUser()
    const authListener = supabase?.auth.onAuthStateChange(() => { void loadUser() })
    return () => { alive = false; authListener?.data.subscription.unsubscribe() }
  }, [])

  async function loadNotifications() {
    if (!supabase || !user) return
    const { data, error: notificationError } = await supabase.from('platform_notifications')
      .select('id,title,body,notification_type,action_url,read_at,created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(15)
    if (!notificationError) setNotifications((data || []) as NotificationRow[])
  }

  useEffect(() => { void loadNotifications() }, [user?.id])

  async function markNotificationRead(item: NotificationRow) {
    if (!supabase || !user) return
    if (!item.read_at) {
      const readAt = new Date().toISOString()
      const { error: updateError } = await supabase.from('platform_notifications').update({ read_at: readAt }).eq('id', item.id).eq('user_id', user.id)
      if (!updateError) setNotifications(current => current.map(row => row.id === item.id ? { ...row, read_at: readAt } : row))
    }
    if (item.action_url) window.location.assign(item.action_url)
  }

  const unreadCount = notifications.filter(item => !item.read_at).length

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !user) return
    const name = nameDraft.trim()
    const phone = phoneDraft.trim()
    if (!name) { setError('اكتب الاسم قبل الحفظ.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const authUpdate = await supabase.auth.updateUser({ data: { display_name: name, phone } })
      if (authUpdate.error) throw authUpdate.error
      const profileUpdate = await supabase.from('profiles').upsert({ id: user.id, display_name: name, phone: phone || null }, { onConflict: 'id' })
      if (profileUpdate.error && !/column|schema cache|could not find/i.test(profileUpdate.error.message)) throw profileUpdate.error
      if (user.organizationId) {
        const orgUpdate = await supabase.from('organizations').update({ contact_name: name, phone: phone || null }).eq('id', user.organizationId)
        if (orgUpdate.error && !/column|schema cache|could not find/i.test(orgUpdate.error.message)) throw orgUpdate.error
      }
      setUser({ ...user, name, phone })
      setNotice('تم حفظ بيانات الحساب.')
      setEditOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ البيانات. حاول مرة أخرى.')
    } finally { setSaving(false) }
  }

  async function signOut() {
    if (!supabase) { window.location.assign('/'); return }
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) { setError(signOutError.message); return }
    window.location.replace('/')
  }

  const homePath = user ? '/workspace/catalog' : '/'
  const initials = (user?.name || 'م').trim().slice(0, 1)
  const showNav = window.location.pathname !== '/privacy' && window.location.pathname !== '/terms' && window.location.pathname !== '/auth/callback'

  return <>
    {showNav && <header dir="rtl" className="mc-global-nav sticky top-0 z-40 w-full border-b border-blue-100/70 bg-white/90 px-3 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-3">
        <a href={homePath} className="flex min-w-0 items-center gap-3" aria-label={platformName + ' - الصفحة الرئيسية'}>
          <span className="mc-brand-logo grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white p-1.5">
            {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-contain" /> : <img src="/carhome-icon.svg" alt="" className="h-full w-full object-contain" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-black leading-tight text-slate-900 sm:text-xl">{platformName}</span>
            <span className="hidden text-[11px] font-bold text-slate-500 sm:block">منصة السيارات للشركات والأساطيل</span>
          </span>
        </a>
        <nav className="flex shrink-0 items-center gap-2" aria-label="التنقل الرئيسي">
          <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.assign(homePath) }} className="mc-neon-button" title="الرجوع للخلف"><ArrowRight size={17}/><span className="hidden sm:inline">رجوع</span></button>
          <a href={homePath} className="mc-neon-button" title="الصفحة الرئيسية"><Home size={17}/><span className="hidden sm:inline">الرئيسية</span></a>
          {user && <div className="relative">
            <button type="button" onClick={() => { const next = !notificationOpen; setNotificationOpen(next); setMenuOpen(false); if (next) void loadNotifications() }} aria-label={`الإشعارات ${unreadCount ? '(' + unreadCount + ' غير مقروءة)' : ''}`} aria-expanded={notificationOpen} className="mc-neon-button mc-notification-trigger">
              <Bell size={17}/>{unreadCount > 0 && <span className="mc-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {notificationOpen && <div className="mc-notification-menu absolute left-0 top-[calc(100%+12px)] z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><strong className="text-slate-900">الإشعارات</strong><p className="mt-0.5 text-xs text-slate-500">{unreadCount} غير مقروءة</p></div><button type="button" onClick={async()=>{if(!supabase||!user||!unreadCount)return;const ids=notifications.filter(n=>!n.read_at).map(n=>n.id);const readAt=new Date().toISOString();const result=await supabase.from('platform_notifications').update({read_at:readAt}).in('id',ids).eq('user_id',user.id);if(!result.error)setNotifications(current=>current.map(n=>({...n,read_at:n.read_at||readAt})))}} className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-700"><CheckCheck size={15}/> قراءة الكل</button></div>
              <div className="max-h-[min(60vh,440px)] overflow-y-auto">
                {notifications.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">لا توجد إشعارات حتى الآن.</p> : notifications.map(item=><button key={item.id} type="button" onClick={()=>void markNotificationRead(item)} className={`block w-full border-b border-slate-100 p-4 text-right transition hover:bg-blue-50 ${item.read_at ? 'bg-white' : 'bg-blue-50/60'}`}>
                  <span className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? 'bg-slate-300' : 'bg-blue-600'}`}/><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900">{item.title}</strong>{item.body && <span className="mt-1 block text-xs leading-5 text-slate-600">{item.body}</span>}<span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400"><span>{new Date(item.created_at).toLocaleString('ar-EG')}</span>{item.action_url && <ExternalLink size={13}/>}</span></span></span>
                </button>)}
              </div>
            </div>}
          </div>}
          {user ? <div className="relative">
            <button type="button" onClick={() => { setMenuOpen(!menuOpen); setError(''); setNotice('') }} aria-expanded={menuOpen} className="mc-profile-trigger" title="ملف الحساب">
              <span className="mc-avatar">{initials}</span>
              <span className="hidden max-w-32 text-right sm:block"><span className="block truncate text-sm font-extrabold text-slate-900">{user.name}</span><span className="block text-xs font-bold text-blue-700">{user.role}</span></span>
              <ChevronDown size={16} className="hidden text-blue-700 sm:block"/>
            </button>
            {menuOpen && <div className="mc-profile-menu absolute left-0 top-[calc(100%+12px)] z-50 w-[min(88vw,340px)] rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="mc-avatar mc-avatar-large">{initials}</span><span className="min-w-0"><strong className="block truncate text-slate-900">{user.name}</strong><span className="mt-1 block text-xs font-bold text-blue-700">{user.role}</span></span>
              </div>
              <p className="mt-3 break-all text-sm text-slate-600" dir="ltr">{user.email || 'لا يوجد بريد إلكتروني'}</p>
              {user.phone && <p className="mt-1 text-sm text-slate-600" dir="ltr">{user.phone}</p>}
              <button type="button" onClick={() => { setNameDraft(user.name); setPhoneDraft(user.phone); setEditOpen(true); setMenuOpen(false) }} className="mc-menu-action mt-4"><Pencil size={17}/> تعديل بيانات الحساب</button>
              <button type="button" onClick={signOut} className="mc-menu-action mc-signout"><LogOut size={17}/> تسجيل الخروج</button>
            </div>}
          </div> : <a href="/?login=1" className="mc-neon-button"><UserRound size={17}/><span className="hidden sm:inline">تسجيل الدخول</span></a>}
        </nav>
      </div>
      {notice && <p role="status" className="mx-auto mt-2 max-w-[96rem] text-sm font-bold text-emerald-700">{notice}</p>}
      {error && !editOpen && <p role="alert" className="mx-auto mt-2 max-w-[96rem] text-sm font-bold text-red-700">{error}</p>}
    </header>}
    <PlatformEntryBanner />
    {children}
    {editOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="mc-profile-edit-title">
      <form onSubmit={saveProfile} className="w-full max-w-md rounded-3xl border border-blue-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between"><h2 id="mc-profile-edit-title" className="text-xl font-black text-slate-900">تعديل بيانات الحساب</h2><button type="button" onClick={() => setEditOpen(false)} aria-label="إغلاق" className="rounded-xl p-2 hover:bg-slate-100"><X size={19}/></button></div>
        <label className="mb-4 block text-sm font-bold text-slate-700">اسم صاحب الحساب<input value={nameDraft} onChange={e => setNameDraft(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>
        <label className="mb-4 block text-sm font-bold text-slate-700">البريد الإلكتروني <input value={user?.email || ''} readOnly dir="ltr" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"/></label>
        <p className="mb-4 text-xs leading-5 text-slate-500">تغيير البريد الإلكتروني يتطلب تحققًا منفصلًا؛ لذلك يظهر هنا للعرض فقط.</p>
        <label className="mb-5 block text-sm font-bold text-slate-700">رقم الهاتف<input value={phoneDraft} onChange={e => setPhoneDraft(e.target.value)} dir="ltr" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-left"/></label>
        {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-3"><button type="button" onClick={() => { setEditOpen(false); setError('') }} className="mc-neon-button flex-1 justify-center">إلغاء</button><button disabled={saving} type="submit" className="mc-neon-button mc-neon-primary flex-1 justify-center">{saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</button></div>
      </form>
    </div>}
  </>
}
