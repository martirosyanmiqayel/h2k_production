import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://wojnxmeanoxinvorfift.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvam54bWVhbm94aW52b3JmaWZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk0MDY2NCwiZXhwIjoyMDk0NTE2NjY0fQ.B1GLTikNpmn7Rv2zPc9zWTKgt0IhnhCqlZBx5XJfqD0'
)

// These are the old demo product names from setup.sql that need to be removed
const DEMO_NAMES = [
  'ARRI SkyPanel S60-C',
  'Sony FX9 Cinema Camera',
  'Sennheiser MKH 416',
  'Aputure 600D Pro',
  'Canon EF 85mm f/1.4',
  'Rode NTG5 Shotgun Mic',
  'Chimera Softbox Kit',
  'Sony FE 24-70mm GM II',
  'RED KOMODO 6K',
  'Mercedes Sprinter Cargo Van',
  'Godox AD600 Pro',
  'Blackmagic URSA Mini Pro',
  'DJI Focus Pro',
  'Zeiss Milvus 50mm f/1.4',
  'Ford Transit Production Van',
]

async function cleanup() {
  console.log('🔍 Checking all products in database...')
  
  const { data: all, error } = await supabase.from('products').select('id, name, created_at').order('created_at', { ascending: true })
  if (error) { console.error('Error:', error.message); process.exit(1) }
  
  console.log(`📦 Total products: ${all.length}`)
  
  // Find demo products by name
  const toDelete = all.filter(p => DEMO_NAMES.includes(p.name))
  console.log(`🗑️  Demo products to delete: ${toDelete.length}`)
  toDelete.forEach(p => console.log(`   - ${p.name}`))
  
  if (toDelete.length === 0) {
    console.log('✅ No demo products found. Database is already clean!')
    return
  }
  
  const ids = toDelete.map(p => p.id)
  const { error: delErr } = await supabase.from('products').delete().in('id', ids)
  
  if (delErr) { console.error('Delete error:', delErr.message); process.exit(1) }
  
  console.log(`\n✅ Deleted ${toDelete.length} demo products!`)
  
  const { count } = await supabase.from('products').select('*', { count: 'exact', head: true })
  console.log(`📦 Remaining products: ${count}`)
  console.log('\n🎉 Done! Only real products remain.')
}

cleanup().catch(console.error)
