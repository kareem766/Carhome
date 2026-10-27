const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type SupportRequest = { method?: string; body?: unknown }
type SupportResponse = { setHeader(name: string, value: string): void; status(code: number): SupportResponse; json(value: unknown): unknown }

export default async function handler(req: SupportRequest, res: SupportResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'طريقة الطلب غير مدعومة.' })
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.SUPPORT_FROM_EMAIL
  const to = process.env.SUPPORT_TO_EMAIL
  if (!apiKey || !from || !to) {
    return res.status(503).json({ error: 'خدمة البريد غير مهيأة بعد. يرجى المحاولة لاحقًا.' })
  }

  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body) } catch { return null } })() : req.body
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'بيانات الرسالة غير صالحة.' })
  const payload = body as Record<string, unknown>
  if (typeof payload.website === 'string' && payload.website.trim()) return res.status(200).json({ ok: true })
  const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 100) : ''
  const email = typeof payload.email === 'string' ? payload.email.trim().slice(0, 254) : ''
  const subject = typeof payload.subject === 'string' ? payload.subject.trim().slice(0, 120) : ''
  const message = typeof payload.message === 'string' ? payload.message.trim().slice(0, 5000) : ''
  const allowedSubjects = new Set(['مشكلة في تسجيل الدخول أو الحساب','السيارات والطلبات والعروض','الاشتراكات والإعلانات والدفع','الإبلاغ عن مشكلة تقنية','استفسار عام','أخرى'])
  if (!emailPattern.test(email) || !allowedSubjects.has(subject) || message.length < 15 || !emailPattern.test(from) || !emailPattern.test(to)) {
    return res.status(400).json({ error: 'راجع البريد الإلكتروني وموضوع الرسالة وتفاصيلها.' })
  }

  const safeName = name.replace(/[\r\n<>]/g, ' ').trim() || 'غير مذكور'
  const textBody = [
    'رسالة دعم جديدة من منصة My Car',
    '',
    'الاسم: ' + safeName,
    'بريد المستخدم: ' + email,
    'الموضوع: ' + subject,
    '',
    'تفاصيل الرسالة:',
    message,
  ].join('\n')
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: '[My Car Support] ' + subject,
        text: textBody,
      }),
    })
    if (!response.ok) {
      await response.text()
      return res.status(502).json({ error: 'تعذر تسليم الرسالة إلى خدمة البريد. حاول مرة أخرى لاحقًا.' })
    }
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(502).json({ error: 'تعذر الاتصال بخدمة البريد الآن. حاول مرة أخرى لاحقًا.' })
  }
}
