// Build local product catalog from Excel dump.
// Pass 1: parse rows, map categories, scrape og:image from h2kproduction.com links.
// Output: catalog_pass1.json  (name, category, link, image, source)
import fs from 'fs'
import https from 'https'

const dump = JSON.parse(fs.readFileSync('xlsx_dump.json', 'utf-8'))
const rows = dump[0].rows.slice(1) // drop header

// ── Category mapping ────────────────────────────────────────────────────────
function mapCategory(rawCat, name, source) {
  const c = (rawCat || '').toLowerCase().trim()
  if (c === 'lights') return 'lights'
  if (c === 'lights accessories') return 'light-accessories'
  if (c === 'camera') return 'camera'
  if (c === 'lenses') return 'lenses'
  if (c === 'voice') return 'voice'
  if (c === 'cargo van') return 'cargovan'
  // "Excel only" -> infer from source hint, then name keywords
  const s = (source || '').toLowerCase()
  if (s.includes('(camera')) return 'camera'
  if (s.includes('lenses')) return 'lenses'
  if (s.includes('voice')) return 'voice'
  if (s.includes('lights accessories')) return 'light-accessories'
  if (s.includes('(lights')) return 'lights'
  return inferFromName(name)
}

function inferFromName(name) {
  const n = name.toLowerCase()
  if (/\b(lens|sigma|filter|polarizer|nd filter|pro-mist|close up|macro lens)\b/.test(n)) return 'lenses'
  if (/\b(mic|microphone|sennheiser|zoom|headphone|boom|wireless|lark|eneloop|charger for aa|windshield)\b/.test(n)) return 'voice'
  if (/\b(camera|gimbal|tripod|slider|fx6|gopro|alpha|gimbal|teleprompter|cfexpress|card|battery|monitor|cage|shoulder rig)\b/.test(n)) return 'camera'
  if (/\b(clamp|stand|grip|silk|apple box|box set|wall plate|cable|arm|boom|sandbag|spigot|pin|vise|mafer|gridcloth|ultrabounce|muslin|matthpole|scrim|coupler|header|frame|butterfly|diffusion|gaffer|tape)\b/.test(n)) return 'light-accessories'
  if (/\b(softbox|light mat|led|monolight|fresnel|dome|lantern|tube light|panel|grid|barndoor|infinimat|spotlight)\b/.test(n)) return 'lights'
  return 'lights'
}

// ── Name normalization for dedup & matching ────────────────────────────────
function normName(name) {
  return name
    .toLowerCase()
    .replace(/[ա-ֆԱ-Ֆ]+/g, ' ') // armenian letters
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b\d+hat\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// ── og:image scraper ────────────────────────────────────────────────────────
function scrapeOgImage(url, redirects = 5) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume()
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href
        scrapeOgImage(next, redirects - 1).then(resolve)
        return
      }
      if (res.statusCode !== 200) { res.resume(); resolve(null); return }
      let html = ''
      res.on('data', c => { html += c; if (html.length > 300000) req.destroy() })
      res.on('end', () => {
        // WooCommerce featured image carries the wp-post-image class (1 per product page)
        const tag = html.match(/<img[^>]*wp-post-image[^>]*>/i)
        if (tag) {
          const m = tag[0].match(/(?:data-src|src)=["'](https:\/\/[^"']+?\.(?:jpe?g|png|webp))["']/i)
          if (m) { resolve(m[1]); return }
        }
        // fallback: og:image if present
        const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        resolve(og ? og[1] : null)
      })
      res.on('error', () => resolve(null))
    })
    req.on('error', () => resolve(null))
    req.setTimeout(20000, () => { req.destroy(); resolve(null) })
  })
}

// ── Build ───────────────────────────────────────────────────────────────────
const products = rows.map(r => {
  const [num, name, rawCat, price, currency, qty, source, link] = r
  return {
    num, name: String(name).replace(/\s{2,}.*$/, '').trim(), // strip trailing armenian notes after big gap
    rawName: String(name),
    category: mapCategory(rawCat, String(name), source),
    link: link && String(link).startsWith('http') ? String(link) : null,
    source: source || '',
    image: null,
  }
})

// Concurrency-limited scrape of links
const linked = products.filter(p => p.link)
console.error(`Scraping ${linked.length} product pages for og:image...`)
let done = 0
const CONC = 6
async function worker(queue) {
  while (queue.length) {
    const p = queue.shift()
    p.image = await scrapeOgImage(p.link)
    done++
    if (done % 10 === 0) console.error(`  ${done}/${linked.length}`)
  }
}
const queue = [...linked]
await Promise.all(Array.from({ length: CONC }, () => worker(queue)))
console.error(`Scrape done. With image: ${linked.filter(p => p.image).length}/${linked.length}`)

fs.writeFileSync('catalog_pass1.json', JSON.stringify(products.map(p => ({ ...p, norm: normName(p.name) })), null, 1))
console.error('Wrote catalog_pass1.json')
