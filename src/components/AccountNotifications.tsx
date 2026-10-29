import { useCallback, useEffect, useState } from 'react'
import { Bell, CircleUserRound, LogOut, MessageCircle, ChevronDown, X, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'

type PlatformNotification = {
  id: string
  title: string
  body: string | null
  notification_type: string
  action_url: string | null
  read_at: string | null
  created_at: string
}

export default function AccountNotifications() {
  const [open, setOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [identity, setIdentity] = useState({ name: 'الحساب', email: '', organization: '', role: 'مستخدم' })
  const [notifications, setNotifications] = useState<PlatformNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const unreadCount = notifications.filter(item => !item.read_at).length

  const loadNotifications = useCallback(async () => {
    if (!supabase) return
    setNotificationsLoading(true)
    setNotificationsError('')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setNotificationsError('سجّل الدخول لعرض إشعارات حسابك.')
      setNotificationsLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('platform_notifications')
      .select('id,title,body,notification_type,action_url,read_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    if (error) {
      setNotificationsError('تعذر تحميل الإشعارات حاليًا. حاول مرة أخرى.')
    } else {
      setNotifications((data || []) as PlatformNotification[])
    }
    setNotificationsLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    async function loadIdentity() {
      if (!supabase) { setAuthChecked(true); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (!user) { setAuthenticated(false); setAuthChecked(true); return }
      setAuthenticated(true)
      const meta = user.user_metadata || {}
      const { data: membership } = await supabase.from('organization_memberships').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle()
      let organization = '', role = 'مستخدم'
      if (membership?.organization_id) {
        const { data: org } = await supabase.from('organizations').select('name,organization_type').eq('id', membership.organization_id).maybeSingle()
        organization = org?.name || ''
        const type = String(org?.organization_type || '')
        role = type === 'company' ? 'حساب شركة' : type === 'fleet_supplier' ? 'مورد أسطول' : type === 'individual_owner' ? 'مالك سيارة' : type === 'admin' ? 'مدير المنصة' : 'مستخدم'
      }
      if (active) {
        setIdentity({ name: String(meta.full_name || meta.name || user.email?.split('@')[0] || 'الحساب'), email: user.email || '', organization, role })
        setAuthChecked(true)
      }
    }
    void loadIdentity()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (notificationsOpen) void loadNotifications()
  }, [notificationsOpen, loadNotifications])

  async function markAsRead(notification: PlatformNotification) {
    if (!supabase || notification.read_at) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const readAt = new Date().toISOString()
    const { error } = await supabase.from('platform_notifications').update({ read_at: readAt }).eq('id', notification.id).eq('user_id', user.id)
    if (!error) setNotifications(items => items.map(item => item.id === notification.id ? { ...item, read_at: readAt } : item))
  }

  async function openNotification(notification: PlatformNotification) {
    await markAsRead(notification)
    if (notification.action_url) window.location.href = notification.action_url
  }

  async function logout() {
    if (!supabase) return
    await supabase.auth.signOut()
    window.location.href = '/?login=1'
  }

  if (!authChecked || !authenticated) return null

  return <div className="relative flex items-center gap-2" dir="rtl">
    <button type="button" aria-label={unreadCount ? `الإشعارات، ${unreadCount} غير مقروءة` : 'فتح الإشعارات'} title="الإشعارات" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(v => !v); setOpen(false) }} className="relative grid h-11 w-11 place-items-center rounded-full border border-sky-200 bg-sky-50 text-sky-800 transition hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-300">
      <Bell size={19} />
      {unreadCount > 0 && <span aria-label={`${unreadCount} إشعارات غير مقروءة`} className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
    </button>
    <button type="button" aria-expanded={open} aria-label="تفاصيل الحساب" onClick={() => { setOpen(v => !v); setNotificationsOpen(false) }} className="flex items-center gap-2 rounded-full border border-cyan-200 bg-slate-950 px-2 py-1.5 text-white shadow-[0_0_16px_rgba(34,211,238,.18)] hover:border-cyan-300 sm:px-3">
      <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-cyan-300 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,.45)]"><CircleUserRound size={19}/></span>
      <span className="hidden max-w-36 text-right sm:block"><span className="block truncate text-xs font-extrabold">{identity.name}</span><span className="block truncate text-[10px] text-cyan-100">{identity.organization || identity.role}</span></span><ChevronDown size={14} className="text-cyan-200"/>
    </button>
    {notificationsOpen && <div className="absolute left-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 text-right text-slate-800 shadow-xl">
      <div className="flex items-center justify-between"><h3 className="font-black">الإشعارات {unreadCount > 0 && <span className="mr-1 text-xs font-bold text-red-600">({unreadCount} جديدة)</span>}</h3><button type="button" aria-label="إغلاق الإشعارات" onClick={() => setNotificationsOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={17}/></button></div>
      {notificationsLoading ? <p role="status" className="py-6 text-center text-sm text-slate-500">جارٍ تحميل الإشعارات...</p> : notificationsError ? <div className="py-4"><p role="alert" className="text-sm leading-6 text-red-700">{notificationsError}</p><button type="button" onClick={() => void loadNotifications()} className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold">إعادة المحاولة</button></div> : notifications.length === 0 ? <p className="py-6 text-center text-sm leading-6 text-slate-500">لا توجد إشعارات جديدة لحسابك حاليًا.</p> : <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {notifications.map(notification => <button key={notification.id} type="button" onClick={() => void openNotification(notification)} className={notification.read_at ? "block w-full rounded-xl border border-slate-100 bg-white p-3 text-right transition hover:border-sky-200 hover:bg-sky-50" : "block w-full rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-right transition hover:border-sky-200 hover:bg-sky-50"}>
          <span className="flex items-start justify-between gap-2"><span className="text-sm font-extrabold">{notification.title}</span>{!notification.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="غير مقروء"/>}</span>
          {notification.body && <span className="mt-1 block text-xs leading-5 text-slate-600">{notification.body}</span>}
          <span className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400"><span>{new Date(notification.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</span>{notification.action_url && <ExternalLink size={13}/>}</span>
        </button>)}
      </div>}
      <a href="/workspace/messages" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-sm font-bold text-sky-800 hover:bg-sky-100"><MessageCircle size={16}/> الانتقال إلى المحادثات</a>
    </div>}
    {open && <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-right text-slate-800 shadow-xl"><p className="font-black">{identity.name}</p><p className="mt-1 break-all text-xs text-slate-500">{identity.email}</p><p className="mt-2 text-sm font-bold text-sky-800">{identity.organization || 'لم يتم ربط مؤسسة'}</p><p className="mt-1 text-xs text-slate-500">{identity.role}</p><a href="/workspace/messages" className="mt-3 flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm font-bold text-sky-800"><MessageCircle size={16}/> فتح المحادثات</a><button onClick={() => void logout()} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold hover:bg-slate-50"><LogOut size={16}/> تسجيل الخروج</button></div>}
  </div>
}
