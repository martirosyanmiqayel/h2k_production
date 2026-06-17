// Retry og/wp-post-image scrape for linked items still missing an image.
import fs from 'fs'
import https from 'https'

const cat = JSON.parse(fs.readFileSync('catalog_pass1.json', 'utf-8'))

function scrape(url, redirects = 5) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Accept': 'text/html' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume(); const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href
        scrape(next, redirects - 1).then(resolve); return
      }
      if (res.statusCode !== 200) { res.resume(); resolve(null); return }
      let html = ''
      res.on('data', c => { html += c; if (html.length > 400000) req.destroy() })
      res.on('end', () => {
        const tag = html.match(/<img[^>]*wp-post-image[^>]*>/i)
        if (tag) { const m = tag[0].match(/(?:data-src|src)=["'](https:\/\/[^"']+?\.(?:jpe?g|png|webp))["']/i); if (m) { resolve(m[1]); return } }
        const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        resolve(og ? og[1] : null)
      })
      res.on('error', () => resolve(null))
    })
    req.on('error', () => resolve(null))
    req.setTimeout(25000, () => { req.destroy(); resolve(null) })
  })
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

const todo = cat.filter(p => p.link && !p.image)
console.error(`Retrying ${todo.length} items (CONC=2, up to 3 attempts)...`)
let done = 0
async function worker(q) {
  while (q.length) {
    const p = q.shift()
    for (let a = 0; a < 3 && !p.image; a++) {
      p.image = await scrape(p.link)
      if (!p.image) await sleep(800)
    }
    done++; if (done % 10 === 0) console.error(`  ${done}/${todo.length}`)
  }
}
const q = [...todo]
await Promise.all([worker(q), worker(q)])
fs.writeFileSync('catalog_pass1.json', JSON.stringify(cat, null, 1))
console.error(`Done. Linked with image now: ${cat.filter(p => p.link && p.image).length}/${cat.filter(p => p.link).length}`)
