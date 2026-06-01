import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const SUPABASE_URL='https://wojnxmeanoxinvorfift.supabase.co'
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvam54bWVhbm94aW52b3JmaWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDA2NjQsImV4cCI6MjA5NDUxNjY2NH0.-ASe3qBrlBZg3uWkOJ44wpAPcnbrqCN3pS6iO5aYy7o'
const supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY)
const app=document.getElementById('app')
const ITEMS_PER_PAGE=12
const CATEGORIES=[
  {key:'all',label:'All Products',icon:'fas fa-th'},
  {key:'lights',label:'Lights',icon:'fas fa-lightbulb'},
  {key:'camera',label:'Camera',icon:'fas fa-camera'},
  {key:'voice',label:'Voice',icon:'fas fa-microphone'},
  {key:'light-accessories',label:'Light Accessories',icon:'fas fa-sliders-h'},
  {key:'lenses',label:'Lenses',icon:'fas fa-circle'},
  {key:'cargovan',label:'Cargo Van',icon:'fas fa-truck'}
]

// --- UTILS ---
function showToast(msg,isError=false){
  const t=document.getElementById('toast');t.textContent=msg;t.className='toast'+(isError?' error':'')+' active'
  setTimeout(()=>t.classList.remove('active'),3000)
}
function spinnerHTML(){return'<div class="inline-spinner"></div>'}
function categoryLabel(key){return CATEGORIES.find(c=>c.key===key)?.label||key}
function categoryIcon(key){return CATEGORIES.find(c=>c.key===key)?.icon||'fas fa-box'}

// --- ROUTER ---
function getRoute(){
  const h=location.hash.slice(1)||'home';
  if(h.startsWith('product/')){return{page:'product',id:h.split('/')[1]}}
  if(h.startsWith('products')){
    const p=new URLSearchParams(h.includes('?')?h.split('?')[1]:'')
    return{page:'products',category:p.get('category')||'all',search:p.get('search')||'',pg:parseInt(p.get('pg'))||1}
  }
  return{page:h}
}
function navigate(hash){location.hash=hash}
window.addEventListener('hashchange',()=>route())
function route(){
  const r=getRoute();updateNav(r.page)
  app.classList.remove('page');void app.offsetWidth;app.classList.add('page')
  if(r.page==='home')renderHome()
  else if(r.page==='products')renderProducts(r.category,r.search,r.pg)
  else if(r.page==='product')renderProductDetail(r.id)
  else if(r.page==='contact')renderContact()
  else renderHome()
}
function updateNav(page){
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a=>{
    a.classList.toggle('active',a.dataset.page===page)
  })
}

// --- NAV & SEARCH ---
const hamburger=document.getElementById('hamburger')
const mobileMenu=document.getElementById('mobileMenu')
hamburger.addEventListener('click',()=>{hamburger.classList.toggle('active');mobileMenu.classList.toggle('active')})
mobileMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{hamburger.classList.remove('active');mobileMenu.classList.remove('active')}))

let searchTimer
const searchInput=document.getElementById('searchInput')
const searchDropdown=document.getElementById('searchDropdown')
searchInput.addEventListener('input',()=>{
  clearTimeout(searchTimer)
  const q=searchInput.value.trim()
  if(!q){searchDropdown.classList.remove('active');return}
  searchTimer=setTimeout(async()=>{
    try{
      const{data,error}=await supabase.from('products').select('*').ilike('name','%'+q+'%').limit(8)
      if(error)throw error
      if(!data.length){searchDropdown.innerHTML='<div class="search-no-results">No products found</div>';searchDropdown.classList.add('active');return}
      searchDropdown.innerHTML=data.map(p=>`<div class="search-dropdown-item" data-id="${p.id}"><img src="${p.images?.[0]||'https://picsum.photos/100/75'}" alt=""><div class="info"><div class="name">${p.name}</div><div class="cat">${categoryLabel(p.category)}</div></div></div>`).join('')
      searchDropdown.classList.add('active')
      searchDropdown.querySelectorAll('.search-dropdown-item').forEach(el=>el.addEventListener('click',()=>{navigate('product/'+el.dataset.id);searchDropdown.classList.remove('active');searchInput.value=''}))
    }catch(e){console.error(e)}
  },300)
})
searchInput.addEventListener('keydown',e=>{if(e.key==='Enter'){const q=searchInput.value.trim();if(q){navigate('products?search='+encodeURIComponent(q));searchDropdown.classList.remove('active');searchInput.value=''}}})
document.addEventListener('click',e=>{if(!document.getElementById('searchContainer').contains(e.target))searchDropdown.classList.remove('active')})

// --- LIGHTBOX ---
const lightbox=document.getElementById('lightbox')
document.getElementById('lightboxClose').addEventListener('click',()=>lightbox.classList.remove('active'))
lightbox.addEventListener('click',e=>{if(e.target===lightbox)lightbox.classList.remove('active')})
function openLightbox(src){document.getElementById('lightboxImg').src=src;lightbox.classList.add('active')}

// --- HERO PARTICLES ---
function initParticles(canvas){
  const ctx=canvas.getContext('2d');let w,h,particles=[]
  function resize(){w=canvas.width=canvas.parentElement.offsetWidth;h=canvas.height=canvas.parentElement.offsetHeight}
  resize();window.addEventListener('resize',resize)
  for(let i=0;i<50;i++)particles.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.5+.3,dx:(Math.random()-.5)*.35,dy:(Math.random()-.5)*.35,a:Math.random()*.35+.05})
  function draw(){
    ctx.clearRect(0,0,w,h)
    particles.forEach(p=>{
      p.x+=p.dx;p.y+=p.dy
      if(p.x<0)p.x=w;if(p.x>w)p.x=0;if(p.y<0)p.y=h;if(p.y>h)p.y=0
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
      ctx.fillStyle=`rgba(232,75,23,${p.a})`;ctx.fill()
    })
    for(let i=0;i<particles.length;i++)for(let j=i+1;j<particles.length;j++){
      const dx=particles[i].x-particles[j].x,dy=particles[i].y-particles[j].y,dist=Math.sqrt(dx*dx+dy*dy)
      if(dist<100){ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(particles[j].x,particles[j].y);ctx.strokeStyle=`rgba(232,75,23,${.05*(1-dist/100)})`;ctx.stroke()}
    }
    requestAnimationFrame(draw)
  }
  draw()
}

// --- RENDER HOME ---
function renderHome(){
  app.innerHTML=`
  <section class="hero"><div class="hero-bg"><canvas id="hero-canvas"></canvas><div class="hero-overlay"></div></div>
    <div class="hero-content"><h1>Professional Production Equipment</h1><p>Lights. Camera. Action.</p>
    <a href="#products" class="btn-primary"><i class="fas fa-film"></i> Explore Equipment</a></div></section>
  <section class="section" id="categoriesSection"><h2 class="section-title">Top Categories</h2>
    <div class="categories-grid">${CATEGORIES.filter(c=>c.key!=='all').map(c=>`<div class="category-card" data-cat="${c.key}"><div class="icon"><i class="${c.icon}"></i></div><div class="name">${c.label}</div></div>`).join('')}</div></section>
  <section class="section" id="featuredSection"><h2 class="section-title">Featured Equipment</h2>
    <div class="carousel-wrapper"><button class="carousel-btn prev" id="carPrev"><i class="fas fa-chevron-left"></i></button>
    <div class="carousel-track" id="carTrack">${spinnerHTML()}</div>
    <button class="carousel-btn next" id="carNext"><i class="fas fa-chevron-right"></i></button></div></section>
  <footer class="footer"><div class="footer-content"><div class="footer-brand"><span class="logo-text">h<span class="logo-2">2</span>k<span class="logo-sub">PRODUCTION</span></span><p>H2K Production — Professional gear for professional creators.</p>
    <div class="footer-socials"><a href="#"><i class="fab fa-instagram"></i></a><a href="#"><i class="fab fa-youtube"></i></a><a href="#"><i class="fab fa-facebook"></i></a><a href="#"><i class="fab fa-twitter"></i></a></div></div>
    <div class="footer-links"><h4>Quick Links</h4><a href="#home">Home</a><a href="#products">Products</a><a href="#contact">Contact</a></div>
    <div class="footer-links"><h4>Contact</h4><a href="tel:+37433107107">+374 33 107 107</a><a href="mailto:info@h2kproduction.com">info@h2kproduction.com</a></div></div>
    <div class="footer-bottom">&copy; ${new Date().getFullYear()} H2K Production. All rights reserved.</div></footer>`
  initParticles(document.getElementById('hero-canvas'))
  document.querySelectorAll('.category-card').forEach(c=>c.addEventListener('click',()=>navigate('products?category='+c.dataset.cat)))
  loadFeatured()
}

async function loadFeatured(){
  try{
    const{data,error}=await supabase.from('products').select('*').limit(12)
    if(error)throw error
    const track=document.getElementById('carTrack')
    if(!data.length){track.innerHTML='<p class="error-message">No products yet.</p>';return}
    track.innerHTML=data.map(p=>productCardHTML(p)).join('')
    track.querySelectorAll('.product-card').forEach(c=>c.addEventListener('click',()=>navigate('product/'+c.dataset.id)))
    let pos=0;const prev=document.getElementById('carPrev'),next=document.getElementById('carNext')
    function slide(){track.style.transform=`translateX(-${pos*280}px)`}
    const maxPos=Math.max(0,data.length-4)
    next.addEventListener('click',()=>{pos=Math.min(pos+1,maxPos);slide()})
    prev.addEventListener('click',()=>{pos=Math.max(pos-1,0);slide()})
  }catch(e){document.getElementById('carTrack').innerHTML='<p class="error-message">Error loading products.</p>';console.error(e)}
}

function productCardHTML(p){
  return`<div class="product-card" data-id="${p.id}"><div class="product-card-img-wrap"><img class="product-card-img" src="${p.images?.[0]||'https://picsum.photos/600/400'}" alt="${p.name}" loading="lazy"></div><div class="product-card-body"><div class="product-card-name">${p.name}</div><span class="category-badge">${categoryLabel(p.category)}</span></div></div>`
}

// --- RENDER PRODUCTS ---
async function renderProducts(cat='all',search='',pg=1){
  app.innerHTML=`<div class="products-page"><div class="products-main">
    <div class="products-header"><h1>${search?'Search: "'+search+'"':'All Products'}</h1>
    <div class="view-toggle"><button class="view-btn active" id="gridBtn" title="Grid"><i class="fas fa-th"></i></button><button class="view-btn" id="listBtn" title="List"><i class="fas fa-list"></i></button></div></div>
    <div class="filter-tabs">${CATEGORIES.map(c=>`<button class="filter-tab${c.key===cat?' active':''}" data-cat="${c.key}">${c.label}</button>`).join('')}</div>
    <div id="productGrid" class="product-grid">${spinnerHTML()}</div>
    <div id="pagination" class="pagination"></div></div>
    <aside class="products-sidebar"><div class="sidebar-card"><h3><i class="fas fa-star"></i> Top Rated</h3><div id="topRated">${spinnerHTML()}</div></div></aside></div>
    <footer class="footer"><div class="footer-bottom">&copy; ${new Date().getFullYear()} H2K Production. All rights reserved.</div></footer>`
  let view='grid'
  document.querySelectorAll('.filter-tab').forEach(t=>t.addEventListener('click',()=>{const c=t.dataset.cat;navigate('products?category='+c)}))
  document.getElementById('gridBtn').addEventListener('click',()=>{view='grid';updateView()})
  document.getElementById('listBtn').addEventListener('click',()=>{view='list';updateView()})
  function updateView(){
    const g=document.getElementById('productGrid')
    g.className=view==='grid'?'product-grid':'product-list'
    document.getElementById('gridBtn').classList.toggle('active',view==='grid')
    document.getElementById('listBtn').classList.toggle('active',view==='list')
  }
  loadProducts(cat,search,pg)
  loadTopRated()
}

async function loadProducts(cat,search,pg){
  const grid=document.getElementById('productGrid'),pagDiv=document.getElementById('pagination')
  try{
    let q=supabase.from('products').select('*',{count:'exact'})
    if(cat&&cat!=='all')q=q.eq('category',cat)
    if(search)q=q.ilike('name','%'+search+'%')
    q=q.order('created_at',{ascending:false}).range((pg-1)*ITEMS_PER_PAGE,pg*ITEMS_PER_PAGE-1)
    const{data,error,count}=await q
    if(error)throw error
    if(!data.length){grid.innerHTML='<p class="error-message">No products found.</p>';pagDiv.innerHTML='';return}
    grid.innerHTML=data.map(p=>productCardHTML(p)+(document.getElementById('productGrid')?.classList.contains('product-list')?'':'')).join('')
    // Add descriptions for list view
    grid.querySelectorAll('.product-card').forEach((c,i)=>{
      if(data[i].description){
        const body=c.querySelector('.product-card-body')
        const d=document.createElement('div');d.className='product-card-desc';d.textContent=data[i].description;body.appendChild(d)
      }
      c.addEventListener('click',()=>navigate('product/'+c.dataset.id))
    })
    const totalPages=Math.ceil(count/ITEMS_PER_PAGE)
    if(totalPages>1){
      let html=`<button class="page-btn" ${pg<=1?'disabled':''} data-pg="${pg-1}">‹ Prev</button>`
      for(let i=1;i<=totalPages;i++)html+=`<button class="page-btn${i===pg?' active':''}" data-pg="${i}">${i}</button>`
      html+=`<button class="page-btn" ${pg>=totalPages?'disabled':''} data-pg="${pg+1}">Next ›</button>`
      pagDiv.innerHTML=html
      pagDiv.querySelectorAll('.page-btn').forEach(b=>b.addEventListener('click',()=>{if(!b.disabled)navigate(`products?category=${cat}&search=${encodeURIComponent(search||'')}&pg=${b.dataset.pg}`)}))
    }else pagDiv.innerHTML=''
  }catch(e){grid.innerHTML='<p class="error-message">Error loading products.</p>';console.error(e)}
}

async function loadTopRated(){
  const el=document.getElementById('topRated')
  try{
    const{data,error}=await supabase.from('products').select('*').eq('top_rated',true).limit(3)
    if(error)throw error
    if(!data.length){el.innerHTML='<p style="color:var(--text-muted);font-size:.8rem">None yet</p>';return}
    el.innerHTML=data.map(p=>`<div class="sidebar-product" data-id="${p.id}"><img src="${p.images?.[0]||'https://picsum.photos/100/75'}" alt="${p.name}"><div><div class="name">${p.name}</div><div class="cat">${categoryLabel(p.category)}</div></div></div>`).join('')
    el.querySelectorAll('.sidebar-product').forEach(s=>s.addEventListener('click',()=>navigate('product/'+s.dataset.id)))
  }catch(e){el.innerHTML='<p class="error-message">Error</p>'}
}

// --- PRODUCT DETAIL ---
async function renderProductDetail(id){
  app.innerHTML=`<div class="product-detail">${spinnerHTML()}</div>`
  try{
    const{data:product,error}=await supabase.from('products').select('*').eq('id',id).single()
    if(error)throw error
    const imgs=product.images||[]
    app.innerHTML=`<div class="product-detail page">
      <div class="breadcrumb"><a href="#home">Home</a><span class="sep">/</span><a href="#products">All Products</a><span class="sep">/</span><span>${product.name}</span></div>
      <div class="detail-layout">
        <div class="gallery">
          <div class="gallery-main-wrap" id="mainWrap">
            <img class="gallery-main-img" id="mainImg" src="${imgs[0]||'https://picsum.photos/600/400'}" alt="${product.name}">
            <button class="gallery-fullscreen-btn" id="fsBtn"><i class="fas fa-expand"></i></button>
            ${imgs.length>1?'<button class="gallery-nav prev" id="imgPrev"><i class="fas fa-chevron-left"></i></button><button class="gallery-nav next" id="imgNext"><i class="fas fa-chevron-right"></i></button>':''}
            <div class="zoom-panel" id="zoomPanel"><img id="zoomImg" src="${imgs[0]||''}" alt="Zoom"></div>
          </div>
          <div class="gallery-thumbs">${imgs.map((img,i)=>`<div class="gallery-thumb${i===0?' active':''}" data-idx="${i}"><img src="${img}" alt="Thumb ${i+1}"></div>`).join('')}</div>
        </div>
        <div class="detail-info">
          <span class="category-badge" style="margin-bottom:1rem">${categoryLabel(product.category)}</span>
          <h1>${product.name}</h1>
          ${product.description?`<div class="detail-description">${product.description}</div>`:''}
          <div class="share-section"><h4>Share this product</h4><div class="share-buttons">
            <a class="share-btn" href="https://wa.me/?text=${encodeURIComponent(product.name+' '+location.href)}" target="_blank" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>
            <a class="share-btn" href="https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(product.name)}" target="_blank" title="Telegram"><i class="fab fa-telegram"></i></a>
            <button class="share-btn" id="copyLinkBtn" title="Copy Link"><i class="fas fa-link"></i></button>
            <a class="share-btn" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(product.name)}&url=${encodeURIComponent(location.href)}" target="_blank" title="X"><i class="fab fa-x-twitter"></i></a>
            <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}" target="_blank" title="Facebook"><i class="fab fa-facebook-f"></i></a>
          </div></div>
          <div class="product-nav" id="productNav"></div>
        </div>
      </div>
      <section class="related-section"><h2 class="section-title">Related Products</h2><div class="related-grid" id="relatedGrid">${spinnerHTML()}</div></section>
    </div>
    <footer class="footer"><div class="footer-bottom">&copy; ${new Date().getFullYear()} H2K Production. All rights reserved.</div></footer>`

    // Image gallery logic
    let currentIdx=0
    const mainImg=document.getElementById('mainImg')
    const thumbs=document.querySelectorAll('.gallery-thumb')
    function setImage(idx){
      currentIdx=idx;mainImg.src=imgs[idx]||mainImg.src
      thumbs.forEach((t,i)=>t.classList.toggle('active',i===idx))
      const zoomImg=document.getElementById('zoomImg');if(zoomImg)zoomImg.src=imgs[idx]||''
    }
    thumbs.forEach(t=>t.addEventListener('click',()=>setImage(parseInt(t.dataset.idx))))
    if(document.getElementById('imgPrev')){
      document.getElementById('imgPrev').addEventListener('click',()=>setImage((currentIdx-1+imgs.length)%imgs.length))
      document.getElementById('imgNext').addEventListener('click',()=>setImage((currentIdx+1)%imgs.length))
    }
    document.getElementById('fsBtn').addEventListener('click',()=>openLightbox(mainImg.src))

    // Zoom
    const mainWrap=document.getElementById('mainWrap'),zoomPanel=document.getElementById('zoomPanel'),zoomImg=document.getElementById('zoomImg')
    if(window.innerWidth>1024){
      mainWrap.addEventListener('mouseenter',()=>zoomPanel.classList.add('active'))
      mainWrap.addEventListener('mouseleave',()=>zoomPanel.classList.remove('active'))
      mainWrap.addEventListener('mousemove',e=>{
        const rect=mainWrap.getBoundingClientRect()
        const x=(e.clientX-rect.left)/rect.width,y=(e.clientY-rect.top)/rect.height
        const zw=zoomPanel.offsetWidth,zh=zoomPanel.offsetHeight
        const iw=rect.width*2.5,ih=rect.height*2.5
        zoomImg.style.width=iw+'px';zoomImg.style.height=ih+'px'
        zoomImg.style.left=-(x*iw-zw/2)+'px';zoomImg.style.top=-(y*ih-zh/2)+'px'
      })
    }

    // Copy link
    document.getElementById('copyLinkBtn').addEventListener('click',()=>{navigator.clipboard.writeText(location.href);showToast('Link copied!')})

    // Prev/Next product nav
    loadProductNav(product)
    // Related products
    loadRelated(product)
  }catch(e){app.innerHTML='<div class="product-detail"><p class="error-message">Product not found.</p></div>';console.error(e)}
}

async function loadProductNav(product){
  const nav=document.getElementById('productNav')
  try{
    const{data:prev}=await supabase.from('products').select('id,name').eq('category',product.category).lt('created_at',product.created_at).order('created_at',{ascending:false}).limit(1)
    const{data:next}=await supabase.from('products').select('id,name').eq('category',product.category).gt('created_at',product.created_at).order('created_at',{ascending:true}).limit(1)
    let html=''
    if(prev?.length)html+=`<button class="product-nav-btn" data-id="${prev[0].id}"><i class="fas fa-arrow-left"></i> ${prev[0].name}</button>`
    else html+='<span></span>'
    if(next?.length)html+=`<button class="product-nav-btn" data-id="${next[0].id}">${next[0].name} <i class="fas fa-arrow-right"></i></button>`
    nav.innerHTML=html
    nav.querySelectorAll('.product-nav-btn').forEach(b=>b.addEventListener('click',()=>navigate('product/'+b.dataset.id)))
  }catch(e){console.error(e)}
}

async function loadRelated(product){
  const grid=document.getElementById('relatedGrid')
  try{
    const{data,error}=await supabase.from('products').select('*').eq('category',product.category).neq('id',product.id).limit(4)
    if(error)throw error
    if(!data.length){grid.innerHTML='<p class="error-message">No related products.</p>';return}
    grid.innerHTML=data.map(p=>productCardHTML(p)).join('')
    grid.querySelectorAll('.product-card').forEach(c=>c.addEventListener('click',()=>navigate('product/'+c.dataset.id)))
  }catch(e){grid.innerHTML='<p class="error-message">Error loading related products.</p>'}
}

// --- CONTACT ---
function renderContact(){
  app.innerHTML=`<div class="contact-page page">
    <h1 class="section-title">Contact Us</h1>
    <div class="contact-card">
      <h3><i class="fas fa-headset"></i> Get in Touch</h3>
      <a href="mailto:info@h2kproduction.com" class="contact-info-item"><i class="fas fa-envelope icon"></i><span>info@h2kproduction.com</span></a>
      <a href="tel:+37433107107" class="contact-info-item"><i class="fas fa-phone icon"></i><span>+374 33 107 107</span></a>
    </div></div>
    <footer class="footer"><div class="footer-bottom">&copy; ${new Date().getFullYear()} H2K Production. All rights reserved.</div></footer>`
}

// --- SCROLL REVEAL ---
function initReveal(){
  const obs=new IntersectionObserver((entries)=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');obs.unobserve(e.target)}})},{threshold:.15})
  document.querySelectorAll('.reveal').forEach(el=>obs.observe(el))
}

// --- INIT ---
route()
