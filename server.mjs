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

const server = http.createServer((req, res) => {
  try {
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
  console.log(`\n  H2K Production — dev server running`)
  console.log(`  ➜  http://localhost:${PORT}\n`)
})
