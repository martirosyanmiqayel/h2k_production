// Merge Excel catalog with authoritative live-site images; dedup; emit products.js
import fs from 'fs'
const cat = JSON.parse(fs.readFileSync('catalog_pass1.json', 'utf-8'))
const site = JSON.parse(fs.readFileSync('site_products.json', 'utf-8'))

function toks(s) { return String(s).toLowerCase().replace(/&#?\w+;/g, ' ').replace(/[ա-ֆԱ-Ֆ]+/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean) }
function norm(s) { return toks(s).join(' ') }
const stripSlash = u => (u || '').replace(/\/$/, '')

// Authoritative maps from live site
const byUrl = {}, byNorm = {}, bySlug = {}
for (const p of site) {
  if (!p.image) continue
  byUrl[stripSlash(p.url)] = p.image
  bySlug[p.slug] = p.image
  if (p.title) { const k = norm(p.title); if (!byNorm[k]) byNorm[k] = p.image }
}

// Hand-verified overrides for same products listed under a different live title/slug
const manualSlug = {
  'avh1200m avenger h1200m 12x12 modular butterfly frame': 'avh1200m-avenger-h1200m-12x12-modular-butterfly-fra',
  'battery fx6 bp u70': 'battery-fx6',
  'battery fx6 bp u35': 'battery-fx6-2',
}

// Resolve image per Excel item (safe: exact url/slug/title + verified overrides)
for (const p of cat) {
  if (p.image) continue
  if (p.link) {
    const u = stripSlash(p.link)
    if (byUrl[u]) { p.image = byUrl[u]; continue }
    const slug = u.split('/').pop()
    if (bySlug[slug]) { p.image = bySlug[slug]; continue }
  }
  const k = norm(p.name)
  if (manualSlug[k] && bySlug[manualSlug[k]]) { p.image = bySlug[manualSlug[k]]; continue }
  if (byNorm[k]) p.image = byNorm[k]
}

// Dedup by normalized name (prefer item with image, keep Excel order)
const groups = new Map()
for (const p of cat) { const k = norm(p.name); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p) }
const unique = [...groups.values()].map(arr => arr.find(p => p.image) || arr[0]).sort((a, b) => a.num - b.num)

// Emit
function slugify(s) { return toks(s).join('-').slice(0, 60) }
const seen = new Set()
const base = Date.parse('2026-06-17T12:00:00Z')
const FEATURED = ['sony fx6', 'aputure storm xt52', 'lightstar luxed 9']
// Best-effort images fetched from the web for items absent on the live site
const manualImages = fs.existsSync('manual_images.json') ? JSON.parse(fs.readFileSync('manual_images.json', 'utf-8')) : {}
// Manual category corrections by product id
const catOverrides = fs.existsSync('category_overrides.json') ? JSON.parse(fs.readFileSync('category_overrides.json', 'utf-8')) : {}
const out = unique.map((p, idx) => {
  let id = slugify(p.name); let n = 2; while (seen.has(id)) id = slugify(p.name) + '-' + n++; seen.add(id)
  let img = p.image || manualImages[id] || null
  return {
    id, name: p.name, description: null, category: catOverrides[id] || p.category,
    images: img ? [img] : [],
    top_rated: FEATURED.some(k => { const n = norm(p.name); return n === k || n.startsWith(k + ' ') }),
    created_at: new Date(base - idx * 60000).toISOString(),
  }
})
fs.writeFileSync('catalog_final.json', JSON.stringify(out, null, 1))

// Emit products.js consumed by the site (classic script -> window.H2K_PRODUCTS)
const banner = `// H2K Production - local product catalog\n// Auto-generated from H2K_FULL Excel + live-site images. ${out.length} products.\n// Regenerate with: node merge_final.mjs\n`
fs.writeFileSync('products.js', banner + 'window.H2K_PRODUCTS = ' + JSON.stringify(out, null, 2) + '\n')

const wi = out.filter(p => p.images.length).length
console.error(`Unique: ${out.length} | with image: ${wi} | without: ${out.length - wi}`)
console.error('Wrote products.js')
