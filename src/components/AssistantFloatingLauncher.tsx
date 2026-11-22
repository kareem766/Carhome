import { createPortal } from 'react-dom'
import { Bot } from 'lucide-react'

export default function AssistantFloatingLauncher() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  if (window.location.pathname === '/assistant') return null

  // Render at the document root so transformed/overflowing account navigation
  // containers cannot pull the fixed launcher into the header or clip it.
  return createPortal(
    <a
      href="/assistant"
      aria-label="مساعد My Car الذكي"
      title="مساعد My Car الذكي"
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+16px)] left-4 z-[100] inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-cyan-200/80 bg-gradient-to-l from-[#08294f] via-[#10518a] to-[#1479ad] px-3.5 text-xs font-black text-white shadow-[0_6px_20px_rgba(7,29,53,.28),0_0_12px_rgba(34,211,238,.14)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_9px_25px_rgba(7,29,53,.34)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/60 sm:bottom-6 sm:left-6 sm:px-4"
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-amber-300">
        <Bot size={17} />
      </span>
      <span className="whitespace-nowrap">مساعد My Car الذكي</span>
    </a>,
    document.body,
  )
}
