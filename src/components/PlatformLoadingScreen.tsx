type Props = { fullscreen?: boolean }

export default function PlatformLoadingScreen({ fullscreen = false }: Props) {
  const logoUrl = typeof document !== 'undefined'
    ? document.documentElement.dataset.platformLogo || '/mycar-logo.svg'
    : '/mycar-logo.svg'

  return (
    <div className={fullscreen ? 'mc-platform-loading mc-platform-loading-fullscreen' : 'mc-platform-loading'} role="status" aria-label="جارٍ تحميل منصة My Car" aria-live="polite">
      <div className="mc-loader-orbit" aria-hidden="true">
        <span className="mc-loader-orbit-core" />
        <span className="mc-loader-orbit-dot" />
        <img src={logoUrl} alt="" className="mc-platform-loading-logo" />
      </div>
      <span className="sr-only">جارٍ تحميل المنصة</span>
    </div>
  )
}
