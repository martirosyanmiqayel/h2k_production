import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL='https://wojnxmeanoxinvorfift.supabase.co'
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvam54bWVhbm94aW52b3JmaWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDA2NjQsImV4cCI6MjA5NDUxNjY2NH0.-ASe3qBrlBZg3uWkOJ44wpAPcnbrqCN3pS6iO5aYy7o'
// Replace with your service role key for write operations (Supabase → Settings → API)
const SUPABASE_SERVICE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvam54bWVhbm94aW52b3JmaWZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk0MDY2NCwiZXhwIjoyMDk0NTE2NjY0fQ.B1GLTikNpmn7Rv2zPc9zWTKgt0IhnhCqlZBx5XJfqD0'

// Use service key if available, otherwise fall back to anon key
const activeKey=SUPABASE_SERVICE_KEY==='YOUR_SERVICE_ROLE_KEY'?SUPABASE_ANON_KEY:SUPABASE_SERVICE_KEY
const supabase=createClient(SUPABASE_URL,activeKey)

const CATEGORY_LABELS={lights:'Lights',camera:'Camera',voice:'Voice','light-accessories':'Light Accessories',lenses:'Lenses',cargovan:'Cargo Van'}

// Show warning if service key not set
if(SUPABASE_SERVICE_KEY==='YOUR_SERVICE_ROLE_KEY'){
  const alert=document.getElementById('serviceKeyAlert')
  if(alert)alert.style.display='flex'
}

// --- TOAST ---
function showToast(msg,isError=false){
  const t=document.getElementById('toast')
  t.innerHTML=msg;t.className='toast'+(isError?' error':'')+' active'
  setTimeout(()=>t.classList.remove('active'),3500)
}

// --- CACHE FLAGS ---
let dashboardLoaded = false;
let manageLoaded = false;

// --- SIDEBAR NAV ---
document.querySelectorAll('.sidebar-nav a').forEach(a=>{
  a.addEventListener('click',()=>{
    document.querySelectorAll('.sidebar-nav a').forEach(x=>x.classList.remove('active'))
    a.classList.add('active')
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'))
    document.getElementById('panel-'+a.dataset.panel).classList.add('active')
    if(a.dataset.panel==='manage' && !manageLoaded) loadManageTable()
    if(a.dataset.panel==='dashboard' && !dashboardLoaded) loadDashboard()
  })
})

// Refresh button
document.getElementById('refreshBtn').addEventListener('click',()=>loadManageTable())

// --- DASHBOARD ---
async function loadDashboard(){
  dashboardLoaded = true;
  const el=document.getElementById('stats')
  el.innerHTML='<div class="spinner"></div>'
  try{
    const[{count:total},{count:topRated}]=await Promise.all([
      supabase.from('products').select('*',{count:'exact',head:true}),
      supabase.from('products').select('*',{count:'exact',head:true}).eq('top_rated',true)
    ])
    const cats=Object.entries(CATEGORY_LABELS)
    const catCounts=await Promise.all(cats.map(async([key,label])=>{
      const{count}=await supabase.from('products').select('*',{count:'exact',head:true}).eq('category',key)
      return{label,count:count||0}
    }))
    el.innerHTML=`
      <div class="stat-card"><div class="num">${total||0}</div><div class="label">Total Products</div></div>
      <div class="stat-card"><div class="num">${topRated||0}</div><div class="label">Top Rated</div></div>
      ${catCounts.map(c=>`<div class="stat-card"><div class="num">${c.count}</div><div class="label">${c.label}</div></div>`).join('')}
    `
  }catch(e){el.innerHTML='<p style="color:#e74c3c;padding:1rem">Error loading stats</p>';console.error(e)}
}

// --- IMAGE PREVIEW ---
document.getElementById('pImages').addEventListener('change',()=>{
  const previews=document.getElementById('imgPreviews')
  previews.innerHTML=''
  Array.from(document.getElementById('pImages').files).slice(0,3).forEach(f=>{
    const reader=new FileReader()
    reader.onload=e=>{
      const d=document.createElement('div');d.className='preview'
      d.innerHTML=`<img src="${e.target.result}" alt="">`
      previews.appendChild(d)
    }
    reader.readAsDataURL(f)
  })
})

// --- ADD / EDIT PRODUCT ---
let editMode=false
const form=document.getElementById('productForm')

document.getElementById('cancelEdit').addEventListener('click',resetForm)

function resetForm(){
  editMode=false;form.reset()
  document.getElementById('editId').value=''
  document.getElementById('imgPreviews').innerHTML=''
  document.getElementById('formTitle').innerHTML='<i class="fas fa-plus-circle"></i> Add Product'
  document.getElementById('submitBtn').innerHTML='<i class="fas fa-save"></i> Add Product'
  document.getElementById('cancelEdit').style.display='none'
}

form.addEventListener('submit',async e=>{
  e.preventDefault()
  const name=document.getElementById('pName').value.trim()
  const category=document.getElementById('pCategory').value
  const description=document.getElementById('pDesc').value.trim()
  const topRated=document.getElementById('pTopRated').checked
  const editId=document.getElementById('editId').value
  const files=Array.from(document.getElementById('pImages').files).slice(0,3)
  if(!name||!category){showToast('<i class="fas fa-exclamation"></i> Name and category are required',true);return}

  const btn=document.getElementById('submitBtn')
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving...'

  try{
    let imageUrls=[]

    if(files.length>0){
      for(const file of files){
        const ext=file.name.split('.').pop()
        const path=`${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const{error:upErr}=await supabase.storage.from('product-images').upload(path,file,{cacheControl:'3600',upsert:false})
        if(upErr)throw new Error('Image upload failed: '+upErr.message)
        const{data:urlData}=supabase.storage.from('product-images').getPublicUrl(path)
        imageUrls.push(urlData.publicUrl)
      }
    }

    const productData={name,category,description:description||null,top_rated:topRated}
    if(imageUrls.length>0)productData.images=imageUrls

    let dbError
    if(editMode&&editId){
      const{error}=await supabase.from('products').update(productData).eq('id',editId)
      dbError=error
      if(!error) { showToast('<i class="fas fa-check"></i> Product updated!'); dashboardLoaded=false; manageLoaded=false; }
    }else{
      if(!imageUrls.length)productData.images=[]
      const{error}=await supabase.from('products').insert(productData)
      dbError=error
      if(!error) { showToast('<i class="fas fa-check"></i> Product added!'); dashboardLoaded=false; manageLoaded=false; }
    }
    if(dbError)throw dbError
    resetForm()
  }catch(e){
    showToast('<i class="fas fa-times"></i> Error: '+e.message,true)
    console.error(e)
  }finally{
    btn.disabled=false
    btn.innerHTML=editMode?'<i class="fas fa-save"></i> Update Product':'<i class="fas fa-save"></i> Add Product'
  }
})

// --- MANAGE TABLE ---
async function loadManageTable(){
  manageLoaded = true;
  const wrap=document.getElementById('productsTable')
  wrap.innerHTML='<div class="spinner"></div>'
  try{
    const{data,error}=await supabase.from('products').select('*').order('created_at',{ascending:false})
    if(error)throw error
    if(!data.length){
      wrap.innerHTML='<p style="color:var(--grey);padding:2rem;text-align:center">No products found. Add one!</p>'
      return
    }
    wrap.innerHTML=`<table>
      <thead><tr>
        <th>Image</th><th>Name</th><th>Category</th><th>Top Rated</th><th>Date</th><th>Actions</th>
      </tr></thead>
      <tbody>${data.map(p=>`<tr>
        <td><img src="${p.images?.[0]||'https://picsum.photos/80/60?grayscale'}" loading="lazy" style="width:64px;height:46px;border-radius:4px;object-fit:cover;border:1px solid var(--border)" alt=""></td>
        <td style="font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</td>
        <td><span class="badge badge-orange">${CATEGORY_LABELS[p.category]||p.category}</span></td>
        <td>${p.top_rated?'<span class="badge badge-green">★ Yes</span>':'<span class="badge badge-grey">No</span>'}</td>
        <td style="color:var(--grey);font-size:.75rem">${new Date(p.created_at).toLocaleDateString()}</td>
        <td><div class="actions">
          <button class="btn btn-edit btn-sm edit-btn" data-id="${p.id}"><i class="fas fa-pen"></i></button>
          <button class="btn btn-danger btn-sm del-btn" data-id="${p.id}"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>`).join('')}</tbody>
    </table>`

    // EDIT
    wrap.querySelectorAll('.edit-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const p=data.find(x=>x.id===btn.dataset.id)
        if(!p)return
        editMode=true
        document.getElementById('editId').value=p.id
        document.getElementById('pName').value=p.name
        document.getElementById('pCategory').value=p.category
        document.getElementById('pDesc').value=p.description||''
        document.getElementById('pTopRated').checked=p.top_rated
        document.getElementById('imgPreviews').innerHTML=(p.images||[]).map(u=>`<div class="preview"><img src="${u}" alt=""></div>`).join('')
        document.getElementById('formTitle').innerHTML='<i class="fas fa-pen"></i> Edit Product'
        document.getElementById('submitBtn').innerHTML='<i class="fas fa-save"></i> Update Product'
        document.getElementById('cancelEdit').style.display='inline-flex'
        document.querySelectorAll('.sidebar-nav a').forEach(x=>x.classList.remove('active'))
        document.querySelector('[data-panel="add"]').classList.add('active')
        document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'))
        document.getElementById('panel-add').classList.add('active')
        window.scrollTo({top:0,behavior:'smooth'})
      })
    })

    // DELETE
    wrap.querySelectorAll('.del-btn').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const p=data.find(x=>x.id===btn.dataset.id)
        if(!confirm(`Delete "${p?.name}"?`))return
        btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'
        try{
          const{error}=await supabase.from('products').delete().eq('id',btn.dataset.id)
          if(error)throw error
          showToast('<i class="fas fa-trash"></i> Product deleted')
          dashboardLoaded=false
          loadManageTable()
        }catch(e){showToast('<i class="fas fa-times"></i> Delete failed: '+e.message,true);btn.disabled=false;btn.innerHTML='<i class="fas fa-trash"></i>'}
      })
    })
  }catch(e){
    wrap.innerHTML=`<p style="color:#e74c3c;padding:2rem;text-align:center"><i class="fas fa-exclamation-circle"></i> Error: ${e.message}</p>`
    console.error(e)
  }
}

// --- INIT ---
loadDashboard()
