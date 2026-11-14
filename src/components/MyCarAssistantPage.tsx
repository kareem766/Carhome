import { useState, type FormEvent } from 'react'
import { ArrowRight, Bot, Send, Sparkles, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Message = { role: 'user' | 'assistant'; content: string }

export default function MyCarAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'أهلًا بيك في مساعد My Car عربيتي. أقدر أشرح لك وظائف المنصة وأساعدك تفهم بيانات مساحة عملك حسب صلاحيات حسابك.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    const value = input.trim()
    if (!value || loading) return
    if (!supabase) { setError('خدمة المنصة غير متاحة حاليًا.'); return }
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) { setError('سجّل الدخول أولًا لاستخدام المساعد.'); return }

    const next = [...messages, { role: 'user' as const, content: value }]
    setMessages(next)
    setInput('')
    setError('')
    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mycar-ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ messages: next.slice(-12) })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'تعذر الحصول على رد المساعد.')
      setMessages([...next, { role: 'assistant', content: String(payload.answer || 'لم يصل رد من المساعد.') }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع.')
    } finally {
      setLoading(false)
    }
  }

  return <main dir="rtl" className="!min-h-screen !bg-[#071426] px-4 py-6 !text-white sm:px-8">
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col overflow-hidden rounded-3xl border border-blue-400/30 !bg-[#10243d] !text-slate-100 shadow-2xl shadow-blue-950/40">
      <header className="flex items-center justify-between border-b border-white/10 bg-gradient-to-l from-blue-950 to-slate-900 p-5 sm:p-6">
        <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400 text-slate-950"><Bot size={26}/></span><div><h1 className="text-xl font-black">مساعد My Car عربيتي</h1><p className="mt-1 text-xs text-blue-200">مدعوم بتقنية Google Gemini</p></div></div>
        <a href="/workspace" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-bold hover:bg-white/10"><ArrowRight size={16}/> مساحة العمل</a>
      </header>
      <section aria-live="polite" className="flex-1 space-y-4 overflow-y-auto !bg-[#10243d] p-4 sm:p-6">
        <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-6 text-amber-100"><Sparkles size={15} className="ml-1 inline"/> المساعد يجيب عن أسئلة المنصة ويقرأ الملخصات المسموح بها لحسابك. تنفيذ التعديلات والإجراءات سيُضاف بعد استكمال بوابة الصلاحيات واختبارها.</div>
        {messages.map((message, index) => <div key={index} className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}><article className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === 'user' ? '!bg-[#1558a6] !text-white' : 'border border-blue-200/15 !bg-[#1b3554] !text-[#f1f6ff]'}`}><div className="mb-1 flex items-center gap-2 text-[11px] font-bold opacity-70">{message.role === 'user' ? <UserRound size={13}/> : <Bot size={13}/>} {message.role === 'user' ? 'أنت' : 'مساعد My Car'}</div><p className="whitespace-pre-wrap">{message.content}</p></article></div>)}
        {loading && <div className="text-sm text-blue-200">المساعد الذكي بيجهز الرد...</div>}
        {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
      </section>
      <form onSubmit={sendMessage} className="border-t border-white/10 !bg-[#09182b] p-3 sm:p-4">
        <div className="flex items-end gap-2"><textarea value={input} onChange={event=>setInput(event.target.value)} rows={2} maxLength={4000} placeholder="اكتب سؤالك عن المنصة أو حسابك..." className="!min-h-12 flex-1 resize-y rounded-2xl border border-blue-200/30 !bg-[#203b5c] px-4 py-3 text-sm !text-white !caret-white outline-none placeholder:!text-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30"/><button disabled={loading || !input.trim()} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-400 text-slate-950 disabled:opacity-50" aria-label="إرسال"><Send size={19}/></button></div>
      </form>
    </div>
  </main>
}
