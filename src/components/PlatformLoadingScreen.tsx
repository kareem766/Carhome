type Props = { fullscreen?: boolean }

export default function PlatformLoadingScreen({ fullscreen = false }: Props) {
  return (
    <div
      className={fullscreen ? 'mc-platform-loading mc-platform-loading-fullscreen' : 'mc-platform-loading'}
      role="status"
      aria-label="جارٍ تحميل المنصة"
      aria-live="polite"
    >
      <img src="/carhome-icon.svg" alt="" className="mc-platform-loading-logo" />
      <span className="sr-only">جارٍ تحميل المنصة</span>
    </div>
  )
}
