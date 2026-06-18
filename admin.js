// H2K admin panel - talks to the local catalog API in server.mjs
(function () {
  const CATS = {
    lights: 'Lights',
    'light-accessories': 'Lights accessories',
    camera: 'Camera',
    lenses: 'Lenses',
    voice: 'Voice',
    cargovan: 'Cargo van',
  }
  const CAT_ICONS = {
    lights: 'fa-lightbulb', 'light-accessories': 'fa-sliders', camera: 'fa-camera',
    lenses: 'fa-circle-dot', voice: 'fa-microphone', cargovan: 'fa-truck',
  }
  const $ = id => document.getElementById(id)
  const api = async (url, opts) => {
    const r = await fetch(url, opts)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status))
    return j
  }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  function toast(msg, isError) {
    const t = $('toast'); t.textContent = msg
    t.className = 'toast' + (isError ? ' error' : '') + ' active'
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('active'), 3200)
  }

  let cache = []          // all products
  let currentImages = []  // images for the add/edit form
  let editId = ''

  // ── NAV ──────────────────────────────────────────────
  function showPanel(name) {
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.toggle('active', a.dataset.panel === name))
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name))
    if (name === 'dashboard') renderDashboard()
    if (name === 'manage') renderTable()
  }
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.addEventListener('click', () => showPanel(a.dataset.panel)))

  async function load() {
    try { cache = (await api('/api/products')).products || [] }
    catch (e) { toast('Failed to load products: ' + e.message, true); cache = [] }
  }

  // ── DASHBOARD ────────────────────────────────────────
  async function renderDashboard() {
    const el = $('stats'); el.innerHTML = '<div class="spinner"></div>'
    await load()
    const total = cache.length
    const top = cache.filter(p => p.top_rated).length
    const noImg = cache.filter(p => !p.images || !p.images.length).length
    let html = `
      <div class="stat-card"><i class="fas fa-box ic"></i><div class="num">${total}</div><div class="label">Total Products</div></div>
      <div class="stat-card"><i class="fas fa-star ic"></i><div class="num">${top}</div><div class="label">Top Rated</div></div>
      <div class="stat-card"><i class="fas fa-image ic"></i><div class="num">${total - noImg}</div><div class="label">With Image</div></div>`
    for (const [key, label] of Object.entries(CATS)) {
      const c = cache.filter(p => p.category === key).length
      html += `<div class="stat-card"><i class="fas ${CAT_ICONS[key]} ic"></i><div class="num">${c}</div><div class="label">${label}</div></div>`
    }
    el.innerHTML = html
  }
  $('dashRefresh').addEventListener('click', renderDashboard)

  // ── IMAGE MANAGER ────────────────────────────────────
  function renderImages() {
    const grid = $('imgsGrid')
    grid.innerHTML = currentImages.map((src, i) =>
      `<div class="img-cell${i === 0 ? ' primary' : ''}"><img src="${esc(src)}" alt="" onerror="this.src='./placeholder.svg'"><button type="button" class="rm" data-i="${i}" title="Remove"><i class="fas fa-xmark"></i></button></div>`
    ).join('')
    grid.querySelectorAll('.rm').forEach(b => b.addEventListener('click', () => { currentImages.splice(+b.dataset.i, 1); renderImages() }))
  }
  $('addUrlBtn').addEventListener('click', () => {
    const v = $('imgUrl').value.trim()
    if (!v) return
    currentImages.push(v); $('imgUrl').value = ''; renderImages()
  })
  $('imgUrl').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('addUrlBtn').click() } })
  $('uploadBtn').addEventListener('click', () => $('fileInput').click())
  $('fileInput').addEventListener('change', async () => {
    const files = Array.from($('fileInput').files)
    for (const f of files) {
      try {
        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f) })
        const { path } = await api('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: $('pName').value || f.name, dataUrl }) })
        currentImages.push(path); renderImages()
      } catch (e) { toast('Upload failed: ' + e.message, true) }
    }
    $('fileInput').value = ''
  })

  // ── ADD / EDIT FORM ──────────────────────────────────
  function resetForm() {
    editId = ''; currentImages = []
    $('productForm').reset(); $('editId').value = ''
    renderImages()
    $('formTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Add Product'
    $('submitBtn').innerHTML = '<i class="fas fa-save"></i> Add Product'
    $('cancelEdit').style.display = 'none'
  }
  $('cancelEdit').addEventListener('click', () => { resetForm(); showPanel('manage') })

  function startEdit(id) {
    const p = cache.find(x => x.id === id); if (!p) return
    editId = id
    $('editId').value = id
    $('pName').value = p.name
    $('pCategory').value = p.category
    $('pDesc').value = p.description || ''
    $('pTopRated').checked = !!p.top_rated
    currentImages = (p.images || []).slice(); renderImages()
    $('formTitle').innerHTML = '<i class="fas fa-pen"></i> Edit Product'
    $('submitBtn').innerHTML = '<i class="fas fa-save"></i> Update Product'
    $('cancelEdit').style.display = 'inline-flex'
    showPanel('add')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  $('productForm').addEventListener('submit', async e => {
    e.preventDefault()
    const name = $('pName').value.trim()
    const category = $('pCategory').value
    if (!name || !category) { toast('Name and category are required', true); return }
    const payload = { name, category, description: $('pDesc').value.trim() || null, images: currentImages, top_rated: $('pTopRated').checked }
    const btn = $('submitBtn'); btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'
    try {
      if (editId) { await api('/api/products/' + encodeURIComponent(editId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); toast('Product updated') }
      else { await api('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); toast('Product added') }
      await load(); resetForm(); showPanel('manage')
    } catch (err) { toast('Error: ' + err.message, true) }
    finally { btn.disabled = false; btn.innerHTML = old }
  })

  // ── MANAGE TABLE ─────────────────────────────────────
  function renderTable() {
    const wrap = $('productsTable')
    const q = ($('searchInput').value || '').toLowerCase().trim()
    const cat = $('filterCat').value
    let rows = cache.slice()
    if (cat) rows = rows.filter(p => p.category === cat)
    if (q) rows = rows.filter(p => p.name.toLowerCase().includes(q))
    if (!rows.length) { wrap.innerHTML = '<div class="empty">No products found.</div>'; return }
    wrap.innerHTML = `<table>
      <thead><tr><th>Image</th><th>Name</th><th>Category</th><th class="hide">Top Rated</th><th>Actions</th></tr></thead>
      <tbody>${rows.map(p => `<tr>
        <td><img class="thumb" src="${esc(p.images?.[0] || './placeholder.svg')}" loading="lazy" onerror="this.src='./placeholder.svg'" alt=""></td>
        <td class="name">${esc(p.name)}</td>
        <td><span class="badge badge-cat">${CATS[p.category] || p.category}</span></td>
        <td class="hide">${p.top_rated ? '<span class="badge badge-green">★ Yes</span>' : '<span class="badge badge-grey">No</span>'}</td>
        <td><div class="row-actions">
          <button class="btn-icon edit" data-id="${esc(p.id)}" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="btn-icon del" data-id="${esc(p.id)}" title="Delete"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>`).join('')}</tbody></table>`
    wrap.querySelectorAll('.edit').forEach(b => b.addEventListener('click', () => startEdit(b.dataset.id)))
    wrap.querySelectorAll('.del').forEach(b => b.addEventListener('click', () => del(b.dataset.id)))
  }
  async function del(id) {
    const p = cache.find(x => x.id === id)
    if (!confirm(`Delete "${p?.name}"? This cannot be undone.`)) return
    try { await api('/api/products/' + encodeURIComponent(id), { method: 'DELETE' }); toast('Product deleted'); await load(); renderTable() }
    catch (e) { toast('Delete failed: ' + e.message, true) }
  }
  $('refreshBtn').addEventListener('click', async () => { await load(); renderTable() })
  $('searchInput').addEventListener('input', renderTable)
  $('filterCat').addEventListener('change', renderTable)

  // ── INIT (called after login) ────────────────────────
  window.H2KAdmin = {
    inited: false,
    async init() {
      if (this.inited) return; this.inited = true
      renderImages()
      await renderDashboard()
    }
  }
})()
