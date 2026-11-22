import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const outputDir = join(process.cwd(), 'dist')
const source = await readFile(join(outputDir, 'index.html'), 'utf8')
const origin = 'https://carhome-lime.vercel.app'
const image = 'https://i.ibb.co/LDtVLtkT/3-E4722-EB-3946-4526-80-D0-87-A0-E48133-C7.png'
const imageAlt = 'My Car عربيتي — منصة السيارات للشركات والأساطيل في مصر'

const pages = [
  { path: '/services', file: 'services.html', title: 'خدمات السيارات والأساطيل في مصر | My Car عربيتي', description: 'اكتشف خدمات السيارات والأساطيل عبر My Car عربيتي، من الصيانة والتأمين وقطع الغيار إلى خدمات دعم وتشغيل الأساطيل ومقدمي الخدمات.' },
  { path: '/privacy', file: 'privacy.html', title: 'سياسة الخصوصية وحماية البيانات | My Car عربيتي', description: 'اطّلع على سياسة الخصوصية في My Car عربيتي وكيفية التعامل مع بيانات الحسابات والمعلومات الشخصية داخل المنصة.' },
  { path: '/terms', file: 'terms.html', title: 'شروط الاستخدام | My Car عربيتي', description: 'راجع شروط استخدام منصة My Car عربيتي لتنظيم التواصل والطلبات والعروض بين الشركات وملاك السيارات وموردي الأساطيل.' }
]

function replaceMeta(html, key, replacement) {
  const marker = '<meta ' + key
  const start = html.indexOf(marker)
  if (start < 0) return html.replace('</head>', replacement + '\n  </head>')
  const end = html.indexOf('>', start)
  if (end < 0) throw new Error('Malformed meta element: ' + key)
  return html.slice(0, start) + replacement + html.slice(end + 1)
}

for (const page of pages) {
  let html = source
  const titleStart = html.indexOf('<title>')
  const titleEnd = html.indexOf('</title>', titleStart)
  if (titleStart < 0 || titleEnd < 0) throw new Error('Could not locate document title')
  html = html.slice(0, titleStart) + '<title>' + page.title + '</title>' + html.slice(titleEnd + 8)

  html = replaceMeta(html, 'name="description"', '<meta name="description" content="' + page.description + '" />')
  html = replaceMeta(html, 'name="robots"', '<meta name="robots" content="index,follow,max-image-preview:large" />')
  html = replaceMeta(html, 'name="googlebot"', '<meta name="googlebot" content="index,follow,max-image-preview:large" />')
  html = replaceMeta(html, 'property="og:title"', '<meta property="og:title" content="' + page.title + '" />')
  html = replaceMeta(html, 'property="og:description"', '<meta property="og:description" content="' + page.description + '" />')
  html = replaceMeta(html, 'property="og:url"', '<meta property="og:url" content="' + origin + page.path + '" />')
  html = replaceMeta(html, 'property="og:image"', '<meta property="og:image" content="' + image + '" />')
  html = replaceMeta(html, 'property="og:image:alt"', '<meta property="og:image:alt" content="' + imageAlt + '" />')
  html = replaceMeta(html, 'name="twitter:title"', '<meta name="twitter:title" content="' + page.title + '" />')
  html = replaceMeta(html, 'name="twitter:description"', '<meta name="twitter:description" content="' + page.description + '" />')
  html = replaceMeta(html, 'name="twitter:image"', '<meta name="twitter:image" content="' + image + '" />')
  html = replaceMeta(html, 'name="twitter:image:alt"', '<meta name="twitter:image:alt" content="' + imageAlt + '" />')

  const canonicalMarker = '<link rel="canonical"'
  const canonicalStart = html.indexOf(canonicalMarker)
  const canonicalEnd = html.indexOf('>', canonicalStart)
  if (canonicalStart < 0 || canonicalEnd < 0) throw new Error('Could not locate canonical link')
  html = html.slice(0, canonicalStart) + '<link rel="canonical" href="' + origin + page.path + '" />' + html.slice(canonicalEnd + 1)

  const jsonStart = html.indexOf('<script type="application/ld+json">')
  const jsonOpenEnd = html.indexOf('>', jsonStart)
  const jsonEnd = html.indexOf('</script>', jsonOpenEnd)
  if (jsonStart < 0 || jsonOpenEnd < 0 || jsonEnd < 0) throw new Error('Could not locate structured data')
  const schema = JSON.parse(html.slice(jsonOpenEnd + 1, jsonEnd))
  schema['@graph'] = schema['@graph'].filter((entry) => entry['@type'] !== 'FAQPage')
  html = html.slice(0, jsonOpenEnd + 1) + JSON.stringify(schema) + html.slice(jsonEnd)

  await writeFile(join(outputDir, page.file), html, 'utf8')
}
console.log('Generated route-specific SEO HTML documents:', pages.map((page) => page.path).join(', '))
