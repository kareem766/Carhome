import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const outputDir = join(process.cwd(), 'dist')
const source = await readFile(join(outputDir, 'index.html'), 'utf8')
const origin = 'https://carhome-lime.vercel.app'
const image = 'https://i.ibb.co/LDtVLtkT/3-E4722-EB-3946-4526-80-D0-87-A0-E48133-C7.png'
const imageAlt = 'My Car عربيتي — منصة السيارات للشركات والأساطيل في مصر'

const pages = [
  {
    path: '/services',
    file: 'services.html',
    title: 'خدمات السيارات والأساطيل في مصر | My Car عربيتي',
    description: 'اكتشف خدمات السيارات والأساطيل عبر My Car عربيتي، من الصيانة والتأمين وقطع الغيار إلى خدمات دعم وتشغيل الأساطيل ومقدمي الخدمات.'
  },
  {
    path: '/privacy',
    file: 'privacy.html',
    title: 'سياسة الخصوصية وحماية البيانات | My Car عربيتي',
    description: 'اطّلع على سياسة الخصوصية في My Car عربيتي وكيفية التعامل مع بيانات الحسابات والمعلومات الشخصية داخل المنصة.'
  },
  {
    path: '/terms',
    file: 'terms.html',
    title: 'شروط الاستخدام | My Car عربيتي',
    description: 'راجع شروط استخدام منصة My Car عربيتي لتنظيم التواصل والطلبات والعروض بين الشركات وملاك السيارات وموردي الأساطيل.'
  }
]

function setMeta(html, selector, replacement) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp('<meta(?=[^>]*' + escaped + ')[^>]*>', 'i')
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', replacement + '\\n  </head>')
}

for (const page of pages) {
  let html = source
  html = html.replace(/<title>[\\s\\S]*?<\\/title>/i, '<title>' + page.title + '</title>')
  html = setMeta(html, 'name="description"', '<meta name="description" content="' + page.description + '" />')
  html = setMeta(html, 'name="robots"', '<meta name="robots" content="index,follow,max-image-preview:large" />')
  html = setMeta(html, 'name="googlebot"', '<meta name="googlebot" content="index,follow,max-image-preview:large" />')
  html = setMeta(html, 'property="og:title"', '<meta property="og:title" content="' + page.title + '" />')
  html = setMeta(html, 'property="og:description"', '<meta property="og:description" content="' + page.description + '" />')
  html = setMeta(html, 'property="og:url"', '<meta property="og:url" content="' + origin + page.path + '" />')
  html = setMeta(html, 'property="og:image"', '<meta property="og:image" content="' + image + '" />')
  html = setMeta(html, 'property="og:image:alt"', '<meta property="og:image:alt" content="' + imageAlt + '" />')
  html = setMeta(html, 'name="twitter:title"', '<meta name="twitter:title" content="' + page.title + '" />')
  html = setMeta(html, 'name="twitter:description"', '<meta name="twitter:description" content="' + page.description + '" />')
  html = setMeta(html, 'name="twitter:image"', '<meta name="twitter:image" content="' + image + '" />')
  html = setMeta(html, 'name="twitter:image:alt"', '<meta name="twitter:image:alt" content="' + imageAlt + '" />')
  html = html.replace(/<link rel="canonical" href="[^"]*"\\s*\\/>/i, '<link rel="canonical" href="' + origin + page.path + '" />')

  // Keep Organization and WebSite schema globally, but FAQPage schema only on the homepage.
  html = html.replace(/<script type="application\\/ld\\+json">([\\s\\S]*?)<\\/script>/i, (_match, json) => {
    const data = JSON.parse(json)
    data['@graph'] = data['@graph'].filter((entry) => entry['@type'] !== 'FAQPage')
    return '<script type="application/ld+json">' + JSON.stringify(data) + '</script>'
  })

  await writeFile(join(outputDir, page.file), html, 'utf8')
}
console.log('Generated route-specific SEO HTML documents:', pages.map((page) => page.path).join(', '))
