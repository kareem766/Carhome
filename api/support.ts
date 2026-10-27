import type { VercelRequest, VercelResponse } from '@vercel/node'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
  if (typeof body.website === 'string' && body.website.trim()) return res.status(200).json({ ok: true })
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : ''
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : ''
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 120) : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : ''
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
