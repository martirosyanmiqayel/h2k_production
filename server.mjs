// Zero-dependency static dev server for the H2K site.
// Usage: npm run dev   (or: node server.mjs)
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 5173

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
}

// ── Catalog API (admin panel) ────────────────────────────────────────────
const PRODUCTS_FILE = path.join(ROOT, 'products.js')
function readProducts() {
  const t = fs.readFileSync(PRODUCTS_FILE, 'utf-8')
  const a = t.indexOf('['), b = t.lastIndexOf(']')
  return JSON.parse(t.slice(a, b + 1))
}
function writeProducts(arr) {
  const banner = `// H2K Production - local product catalog\n// ${arr.length} products. Managed via the admin panel.\n`
  fs.writeFileSync(PRODUCTS_FILE, banner + 'window.H2K_PRODUCTS = ' + JSON.stringify(arr, null, 2) + '\n')
}
function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) }
function uniqueId(arr, name) {
  const ids = new Set(arr.map(p => p.id)); const base = slugify(name) || 'product'
  let id = base, n = 2; while (ids.has(id)) id = base + '-' + (n++); return id
}
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(obj))
}
function handleApi(req, res) {
  const parts = req.url.split('?')[0].split('/').filter(Boolean) // ['api','products', id?]
  let body = ''
  req.on('data', c => { body += c; if (body.length > 25 * 1024 * 1024) req.destroy() })
  req.on('end', () => {
    let data = null
    if (body) { try { data = JSON.parse(body) } catch { return sendJson(res, 400, { error: 'Invalid JSON' }) } }
    try {
      if (parts[1] === 'products') {
        const id = parts[2] ? decodeURIComponent(parts[2]) : null
        if (req.method === 'GET') return sendJson(res, 200, { products: readProducts() })
        if (req.method === 'POST') {
          const arr = readProducts()
          const name = (data?.name || '').trim()
          if (!name || !data.category) return sendJson(res, 400, { error: 'Name and category are required' })
          const p = { id: uniqueId(arr, name), name, description: data.description || null, category: data.category, images: Array.isArray(data.images) ? data.images.filter(Boolean) : [], top_rated: !!data.top_rated, created_at: new Date().toISOString() }
          arr.unshift(p); writeProducts(arr); return sendJson(res, 200, { product: p })
        }
        if (req.method === 'PUT') {
          const arr = readProducts(); const i = arr.findIndex(p => p.id === id)
          if (i < 0) return sendJson(res, 404, { error: 'Product not found' })
          const p = arr[i]
          if (data.name != null) p.name = data.name.trim()
          if (data.category != null) p.category = data.category
          if (data.description !== undefined) p.description = data.description || null
          if (Array.isArray(data.images)) p.images = data.images.filter(Boolean)
          if (data.top_rated != null) p.top_rated = !!data.top_rated
          arr[i] = p; writeProducts(arr); return sendJson(res, 200, { product: p })
        }
        if (req.method === 'DELETE') {
          let arr = readProducts(); const before = arr.length; arr = arr.filter(p => p.id !== id)
          if (arr.length === before) return sendJson(res, 404, { error: 'Product not found' })
          writeProducts(arr); return sendJson(res, 200, { ok: true })
        }
      }
      if (parts[1] === 'upload' && req.method === 'POST') {
        const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(data?.dataUrl || '')
        if (!m) return sendJson(res, 400, { error: 'Invalid image data' })
        const ext = m[1].includes('png') ? 'png' : m[1].includes('webp') ? 'webp' : m[1].includes('gif') ? 'gif' : m[1].includes('svg') ? 'svg' : 'jpg'
        const buf = Buffer.from(m[2], 'base64')
        fs.mkdirSync(path.join(ROOT, 'product-images'), { recursive: true })
        const fname = (slugify(data.name || '') || 'upload') + '-' + Date.now().toString(36) + '.' + ext
        fs.writeFileSync(path.join(ROOT, 'product-images', fname), buf)
        return sendJson(res, 200, { path: './product-images/' + fname })
      }
      sendJson(res, 404, { error: 'Unknown endpoint' })
    } catch (e) { sendJson(res, 500, { error: String(e.message || e) }) }
  })
}

const server = http.createServer((req, res) => {
  try {
    if (req.url.startsWith('/api/')) return handleApi(req, res)
    let urlPath = decodeURIComponent(req.url.split('?')[0])
    if (urlPath === '/') urlPath = '/index.html'

    // Resolve safely inside ROOT (prevent path traversal)
    const filePath = path.join(ROOT, path.normalize(urlPath))
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        // SPA fallback to index.html for unknown routes
        const html = fs.readFileSync(path.join(ROOT, 'index.html'))
        res.writeHead(200, { 'Content-Type': MIME['.html'] })
        res.end(html)
        return
      }
      const ext = path.extname(filePath).toLowerCase()
      const type = MIME[ext] || 'application/octet-stream'

      // Range support (needed for smooth video playback)
      const range = req.headers.range
      if (range && (ext === '.mp4' || ext === '.webm')) {
        const [s, e] = range.replace(/bytes=/, '').split('-')
        const start = parseInt(s, 10)
        const end = e ? parseInt(e, 10) : stat.size - 1
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': type,
        })
        fs.createReadStream(filePath, { start, end }).pipe(res)
        return
      }

      const noStore = ext === '.html' || ext === '.js' || ext === '.mjs' || ext === '.json'
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': noStore ? 'no-store, must-revalidate' : 'public, max-age=3600' })
      fs.createReadStream(filePath).pipe(res)
    })
  } catch (e) {
    res.writeHead(500); res.end('Server error')
  }
})

server.listen(PORT, () => {
  console.log(`\n  H2K Production - dev server running`)
  console.log(`  ➜  http://localhost:${PORT}\n`)
})
