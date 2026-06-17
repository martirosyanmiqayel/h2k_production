// Scrape all live product pages: capture canonical title + featured image.
import fs from 'fs'
import https from 'https'
const sitemap = JSON.parse(fs.readFileSync('product_sitemap.json', 'utf-8'))

function get(url, redirects = 5) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Accept': 'text/html' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume(); const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href
        get(next, redirects - 1).then(resolve); return
      }
      if (res.statusCode !== 200) { res.resume(); resolve({ s: res.statusCode, h: '' }); return }
      let h = ''; res.on('data', c => { h += c; if (h.length > 500000) req.destroy() }); res.on('end', () => resolve({ s: 200, h }))
      res.on('error', () => resolve({ s: 0, h: '' }))
    })
    req.on('error', () => resolve({ s: 0, h: '' }))
    req.setTimeout(25000, () => { req.destroy(); resolve({ s: 0, h: '' }) })
  })
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
function decode(s){return s.replace(/&amp;/g,'&').replace(/&#0?39;/g,"'").replace(/&#8211;/g,'–').replace(/&quot;/g,'"').replace(/&#8220;|&#8221;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim()}

const out = []
let i = 0
for (const url of sitemap) {
  let r = await get(url)
  for (let a = 0; a < 2 && r.s !== 200; a++) { await sleep(900); r = await get(url) }
  let title = null, image = null
  if (r.s === 200) {
    const t = r.h.match(/<h1[^>]*class=["'][^"']*product_title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
    title = t ? decode(t[1].replace(/<[^>]+>/g, '')) : null
    const tag = r.h.match(/<img[^>]*wp-post-image[^>]*>/i)
    if (tag) { const m = tag[0].match(/(?:data-src|src)=["'](https:\/\/[^"']+?\.(?:jpe?g|png|webp))["']/i); if (m) image = m[1] }
  }
  out.push({ url, slug: url.replace(/\/$/, '').split('/').pop(), title, image, status: r.s })
  i++; if (i % 10 === 0) console.error(`  ${i}/${sitemap.length}`)
  await sleep(300)
}
fs.writeFileSync('site_products.json', JSON.stringify(out, null, 1))
const ok = out.filter(p => p.image).length
console.error(`Done. ${ok}/${out.length} with image. Missing title: ${out.filter(p=>!p.title).length}`)
