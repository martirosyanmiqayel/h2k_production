// H2K Production - Bulk Product Seeder
// Run: node seed_products.mjs
import { createClient } from '@supabase/supabase-js'
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const SUPABASE_URL = 'https://wojnxmeanoxinvorfift.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvam54bWVhbm94aW52b3JmaWZ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk0MDY2NCwiZXhwIjoyMDk0NTE2NjY0fQ.B1GLTikNpmn7Rv2zPc9zWTKgt0IhnhCqlZBx5XJfqD0'
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Helper: fetch URL with redirect follow ──────────────────────────────────
function fetchBuffer(url, maxRedirects = 7) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.bhphotovideo.com/'
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        const nextUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href
        res.resume()
        resolve(fetchBuffer(nextUrl, maxRedirects - 1))
        return
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'image/jpeg' }))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout: ' + url)) })
  })
}

// ── Helper: get BH photo image URL by scraping OG tag ──────────────────────
async function getBHPhotoImageUrl(productUrl) {
  return new Promise((resolve, reject) => {
    const url = productUrl.replace('http://', 'https://')
    const lib = https
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        getBHPhotoImageUrl(res.headers.location).then(resolve).catch(reject)
        return
      }
      let html = ''
      res.on('data', c => { html += c.toString(); if (html.length > 80000) req.destroy() })
      res.on('end', () => {
        // Try og:image
        const ogMatch = html.match(/og:image[^>]*content="([^"]+)"/)
        if (ogMatch) { resolve(ogMatch[1]); return }
        // Try itemprop image
        const itemMatch = html.match(/itemprop="image"[^>]*content="([^"]+)"/)
        if (itemMatch) { resolve(itemMatch[1]); return }
        // Try data-src in img tags
        const imgMatch = html.match(/class="[^"]*product[^"]*"[^>]*src="([^"]+\.(jpg|jpeg|webp|png))"/)
        if (imgMatch) { resolve(imgMatch[1]); return }
        reject(new Error('No image found in page: ' + url))
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout scraping: ' + url)) })
  })
}

// ── Helper: search DuckDuckGo for an image ──────────────────────────────────
async function searchImage(query) {
  // Use a known CDN image approach for product searches
  // Map common brands to reliable image sources
  const brandMap = {
    'aputure': 'aputure.com',
    'amaran': 'aputure.com', 
    'astera': 'astera-led.com',
    'nanlite': 'nanlite.com',
    'elinchrom': 'elinchrom.com',
    'sennheiser': 'en-us.sennheiser.com',
    'dji': 'dji.com',
    'gopro': 'gopro.com',
    'sigma': 'sigmaphoto.com',
    'sony': 'sony.com',
    'tiffen': 'tiffen.com',
    'hollyland': 'hollyland.com',
    'tilta': 'tilta.com',
  }
  
  // Return null - we'll handle fallback in the upload function
  return null
}

// ── Helper: upload image buffer to Supabase Storage ─────────────────────────
async function uploadImageToStorage(buffer, contentType, fileName) {
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const filePath = `products/${Date.now()}_${fileName}.${ext}`
  
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(filePath, buffer, {
      contentType,
      cacheControl: '3600',
      upsert: false
    })
  
  if (error) throw new Error('Storage upload failed: ' + error.message)
  
  const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath)
  return urlData.publicUrl
}

// ── Helper: get image URL for a product ─────────────────────────────────────
async function getImageUrl(product) {
  if (product.imageUrl) {
    try {
      let imagePageUrl = product.imageUrl
      let directImageUrl = imagePageUrl
      
      // If it's a BH Photo product page, scrape the image
      if (imagePageUrl.includes('bhphotovideo.com/c/product')) {
        console.log(`  → Scraping BH Photo: ${imagePageUrl}`)
        try {
          directImageUrl = await getBHPhotoImageUrl(imagePageUrl)
          console.log(`  → Found image: ${directImageUrl.substring(0, 80)}...`)
        } catch(e) {
          console.log(`  → BH scrape failed: ${e.message}, using fallback`)
          return getFallbackImage(product)
        }
      }
      
      // If it's an Aputure product page
      if (imagePageUrl.includes('aputure.com/products')) {
        console.log(`  → Scraping Aputure page: ${imagePageUrl}`)
        try {
          directImageUrl = await getBHPhotoImageUrl(imagePageUrl)
          console.log(`  → Found image: ${directImageUrl.substring(0, 80)}...`)
        } catch(e) {
          console.log(`  → Aputure scrape failed: ${e.message}, using fallback`)
          return getFallbackImage(product)
        }
      }
      
      // If it's an h2kproduction page
      if (imagePageUrl.includes('h2kproduction.com')) {
        console.log(`  → Scraping H2K page: ${imagePageUrl}`)
        try {
          directImageUrl = await getBHPhotoImageUrl(imagePageUrl)
        } catch(e) {
          return getFallbackImage(product)
        }
      }
      
      // Download the actual image
      console.log(`  → Downloading image...`)
      const { buffer, contentType } = await fetchBuffer(directImageUrl)
      const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30)
      const publicUrl = await uploadImageToStorage(buffer, contentType, slug)
      console.log(`  ✓ Uploaded to Supabase Storage`)
      return [publicUrl]
    } catch (e) {
      console.log(`  ✗ Image error: ${e.message} — using fallback`)
      return getFallbackImage(product)
    }
  }
  
  return getFallbackImage(product)
}

function getFallbackImage(product) {
  // Use picsum with consistent seed based on product name for deterministic fallback
  const seed = product.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return [`https://picsum.photos/seed/${seed}/600/400`]
}

// ── Parse price ──────────────────────────────────────────────────────────────
function parsePrice(priceStr) {
  if (!priceStr) return null
  const num = parseFloat(priceStr.toString().replace(/[^0-9.]/g, ''))
  return isNaN(num) ? null : num
}

// ── ALL PRODUCTS ─────────────────────────────────────────────────────────────
const PRODUCTS = [
  // ── LIGHTS ──────────────────────────────────────────────────────────────
  { name: 'Cargo Van JMC', category: 'lights', price: 35000, imageUrl: null, imageSearch: 'Cargo Van JMC' },
  { name: 'Lightstar Luxed 9, with LumenRadio and Separate Ballast', category: 'lights', price: 50000, imageUrl: 'https://www.bhphotovideo.com/c/product/1869341-REG/' },
  { name: 'Aputure STORM XT52', category: 'lights', price: 50000, imageUrl: 'https://www.bhphotovideo.com/c/product/1889193-REG/' },
  { name: 'Aputure Mount Lantern 120', category: 'lights', price: null, imageUrl: 'https://aputure.com/products/aputure-mount-lantern-120' },
  { name: 'Aputure Electro Storm XT26 Bi-Color', category: 'lights', price: 40000, imageUrl: 'https://www.bhphotovideo.com/c/product/1800068-REG/' },
  { name: 'Aputure Motorized F14 Fresnel for Electro Storm CS15 and XT26', category: 'lights', price: null, imageUrl: 'https://aputure.com/products/motorized-f14-fresnel' },
  { name: 'Aputure STORM 1200x Bi-Color LED Monolight', category: 'lights', price: 30000, imageUrl: 'https://www.bhphotovideo.com/c/product/1849142-REG/' },
  { name: 'Aputure LS 600c Pro II RGB LED Monolight (V-Mount)', category: 'lights', price: 25000, imageUrl: 'https://www.bhphotovideo.com/c/product/1828004-REG/' },
  { name: 'Aputure STORM 400x', category: 'lights', price: null, imageUrl: 'https://aputure.com/products/storm-400x' },
  { name: 'Aputure Light Dome 150', category: 'lights', price: null, imageUrl: 'https://aputure.com/products/light-dome-150' },
  { name: 'Aputure LS 300x Bi-Color LED Monolight (V-Mount)', category: 'lights', price: 10000, imageUrl: null, imageSearch: 'Aputure LS 300x Bi-Color' },
  { name: 'Aputure Light Dome III', category: 'lights', price: null, imageUrl: 'https://aputure.com/products/light-dome-iii' },
  { name: 'Aputure LS 60x Bi-Color LED Focusing Flood Light', category: 'lights', price: 15000, imageUrl: 'https://www.bhphotovideo.com/c/product/1560654-REG/' },
  { name: 'Nanlite Lantern Softbox LT-80 (31")', category: 'lights', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1568680-REG/' },
  { name: 'Aputure Spotlight Mount Set with 36° Lens', category: 'lights', price: 10000, imageUrl: 'https://www.bhphotovideo.com/c/product/1476277-REG/' },
  { name: 'Aputure Spotlight Mount Set with 26° Lens', category: 'lights', price: 10000, imageUrl: null, imageSearch: 'Aputure Spotlight Mount Set 26 Lens' },
  { name: 'Aputure Spotlight Mount Iris', category: 'lights', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1476293-REG/' },
  { name: 'Aputure Fresnel 2X Attachment', category: 'lights', price: null, imageUrl: null, imageSearch: 'Aputure Fresnel 2X Attachment' },
  { name: 'Aputure Nova P600c RGB LED Light Panel', category: 'lights', price: 25000, imageUrl: null, imageSearch: 'Aputure Nova P600c' },
  { name: 'Amaran F22x 2x2 Bi-Color LED Flexible Mat (V-Mount)', category: 'lights', price: 15000, imageUrl: 'https://www.bhphotovideo.com/c/product/1698325-REG/' },
  { name: 'Elinchrom Rotalux Octabox Rotagrid (39")', category: 'lights', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1513528-REG/' },
  { name: 'Elinchrom Rotalux Octabox (39")', category: 'lights', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1352655-REG/' },
  { name: 'Aputure MC 4-Light Travel Kit with Charging Case', category: 'lights', price: 15000, imageUrl: 'https://www.bhphotovideo.com/c/product/1515223-REG/' },
  { name: "Astera Titan Tube RGB LED Tube Light (3.4', 8-Light Kit)", category: 'lights', price: 50000, imageUrl: 'https://www.bhphotovideo.com/c/product/1541959-REG/' },
  { name: 'Astera Snapgrid for Titan and AX1 Tube Lights (40-Degree)', category: 'lights', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1601988-REG/' },
  { name: 'Astera AX2-100-BD Barndoor for PixelBar AX2-100 LED Bar', category: 'lights', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1622346-REG/' },
  { name: "Nanlite PavoTube 15C RGB LED Tube Light (2')", category: 'lights', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1476406-REG/' },
  { name: 'amaran F22c RGB LED Flexible Light Mat (V-Mount)', category: 'lights', price: 899, imageUrl: 'https://www.bhphotovideo.com/c/product/1698323-REG/' },
  { name: 'Aputure Accent B7C RGBWW LED 8-Light Kit with Charging Case', category: 'lights', price: 799, imageUrl: 'https://www.bhphotovideo.com/c/product/1606015-REG/' },
  { name: 'Aputure MT Pro RGB LED Tube Light', category: 'lights', price: 199, imageUrl: 'https://www.bhphotovideo.com/c/product/1718976-REG/' },
  { name: 'Aputure Waterproof Pouch for MT Pro-1', category: 'lights', price: 16, imageUrl: 'https://www.bhphotovideo.com/c/product/1756899-REG/' },
  { name: 'Aputure Baby Pin Adapter to Back Clamp for MT Pro-1', category: 'lights', price: 25, imageUrl: 'https://www.bhphotovideo.com/c/product/1756900-REG/' },
  { name: 'Aputure 1/4"-20 Screw Adapter Absorption Part for MT Pro-1', category: 'lights', price: 25, imageUrl: 'https://www.bhphotovideo.com/c/product/1756901-REG/' },
  { name: 'Aputure MC Pro RGB LED Light Panel (Production 8-Light Kit)', category: 'lights', price: 1899, imageUrl: 'https://www.bhphotovideo.com/c/product/1760351-REG/' },
  { name: 'amaran Ace 25c RGB LED Light Panel', category: 'lights', price: 99, imageUrl: 'https://www.bhphotovideo.com/c/product/1847472-REG/' },
  { name: 'amaran Ace 30° Light Control Grid', category: 'lights', price: 8, imageUrl: 'https://www.bhphotovideo.com/c/product/1857628-REG/' },
  { name: 'Aputure Spotlight Max Kit with 36° Lens', category: 'lights', price: 1390, imageUrl: 'https://www.bhphotovideo.com/c/product/1800072-REG/' },
  { name: 'Aputure Storm 80c LED Monolight 3-Light Kit (US)', category: 'lights', price: 2060, imageUrl: 'https://www.bhphotovideo.com/c/product/1889191-REG/' },
  { name: 'Aputure STORM 80c BLAIR-CG LED Monolight (US)', category: 'lights', price: 599, imageUrl: 'https://www.bhphotovideo.com/c/product/1863228-REG/' },
  { name: 'Aputure Spotlight Mini 36° Lens Kit', category: 'lights', price: 349, imageUrl: 'https://www.bhphotovideo.com/c/product/1909260-REG/' },
  { name: 'Aputure Quick Dome 40 for STORM 80c', category: 'lights', price: 99, imageUrl: 'https://www.bhphotovideo.com/c/product/1930061-REG/' },
  { name: "Aputure INFINIMAT LED & Clear Softbox Pack (4 x 4')", category: 'lights', price: 2600, imageUrl: 'https://www.bhphotovideo.com/c/product/1930065-REG/' },
  { name: "Aputure INFINIMAT LED with Clear Softbox & 400W Control Box Pack (2 x 4', V-Mount)", category: 'lights', price: 2190, imageUrl: 'https://www.bhphotovideo.com/c/product/1930071-REG/' },
  { name: "Aputure INFINIMAT Tunable Color Light Mat with Inflatable Airbag (1 x 4', V-Mount)", category: 'lights', price: 1990, imageUrl: 'https://www.bhphotovideo.com/c/product/1860516-REG/' },

  // ── LIGHTS ACCESSORIES ───────────────────────────────────────────────────
  { name: 'AVH1200M Avenger H1200M 12x12 Modular Butterfly FRA', category: 'light-accessories', price: 15000, imageUrl: 'https://www.bhphotovideo.com/c/product/124712-REG/' },
  { name: "KUPO KH-12 12' X 12'", category: 'light-accessories', price: 15000, imageUrl: null, imageSearch: 'KUPO KH-12 butterfly frame' },
  { name: 'MAF88ASW Matthews 8x8 Artificial Silk white', category: 'light-accessories', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/99341-REG/' },
  { name: 'TRU12 TRP 12x12 Ultrabounce', category: 'light-accessories', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1488634-REG/' },
  { name: 'KUPO 600MR HIGH OVERHEAD ROLLER STAND', category: 'light-accessories', price: null, imageUrl: null, imageSearch: 'KUPO 600MR roller stand' },
  { name: 'MAF1212ASW Matthews 12x12 Artificial Silk white', category: 'light-accessories', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/32997-REG/' },
  { name: 'Matthews Digital Combo Stand', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/443234-REG/' },
  { name: "Matthews Double Riser Hollywood Combo Stand (Silver, 11.3')", category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/187161-REG/' },
  { name: "Impact Turtle Base C-Stand Kit (10.75', Black)", category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/850444-REG/' },
  { name: 'Turtle Base and Grip Arm Kit', category: 'light-accessories', price: null, imageUrl: null, imageSearch: 'Impact Turtle Base Grip Arm Kit' },
  { name: 'Neewer Extension Grip Arm Boom Arm with 2 Pieces Grip Heads', category: 'light-accessories', price: null, imageUrl: null, imageSearch: 'Neewer Extension Grip Arm Boom Arm' },
  { name: 'Neewer 118"/3m Stainless Steel Light Stand', category: 'light-accessories', price: null, imageUrl: null, imageSearch: 'Neewer 118 3m Light Stand' },
  { name: 'KUPO KP-L2137BD EXTENDS FROM 210CM TO 370CM – BLACK', category: 'light-accessories', price: 10000, imageUrl: null, imageSearch: 'KUPO KP-L2137BD light stand' },
  { name: 'KUPO KCP-636B BIG BOOM', category: 'light-accessories', price: 10000, imageUrl: null, imageSearch: 'KUPO KCP-636B big boom' },
  { name: 'Avenger D600 Mini Boom (Chrome-plated)', category: 'light-accessories', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/3599-REG/' },
  { name: 'KUPO Heavy Duty Wind-Up Low Base Steel Stand (485)', category: 'light-accessories', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1466131-REG/' },
  { name: 'Avenger D500L 20" Extension Arm (Chrome-plated)', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/3591-REG/' },
  { name: 'Avenger D200 2.5" Grip Head', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/3581-REG/' },
  { name: 'Impact C Stnd W/Turt Base/Grip Head/ARM-BL', category: 'light-accessories', price: null, imageUrl: null, imageSearch: 'Impact C Stand Turtle Base Grip Head Arm' },
  { name: 'Impact Super Clamp with Ratchet Handle (Black)', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/824360-REG/' },
  { name: 'KUPO KCP-500 LARGE GAFFER GRIP', category: 'light-accessories', price: null, imageUrl: null, imageSearch: 'KUPO KCP-500 gaffer grip' },
  { name: 'Impact 6" End Jaw Vise Grip', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/860794-REG/' },
  { name: 'KUPO KCP-700B CONVI CLAMP BLACK', category: 'light-accessories', price: null, imageUrl: null, imageSearch: 'KUPO KCP-700B convi clamp' },
  { name: 'KUPO KCP-359-BK 9" STELL SPRING A CLAMP BLACK SET FOR 2', category: 'light-accessories', price: null, imageUrl: null, imageSearch: 'KUPO KCP-359 spring clamp' },
  { name: 'Tether Tools Rock Solid Master Articulating Arm', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1033018-REG/' },
  { name: 'Avenger D400 4.5" Grip Head with Junior Pin', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/90439-REG/' },
  { name: 'Neewer UA045 3-Way Clamp for C-Stand', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1817672-REG/' },
  { name: 'Impact 2" End Jaw Vise Grip', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/860795-REG/' },
  { name: 'Impact Super Clamp with T-Handle', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/887347-REG/' },
  { name: 'Impact Baby Triple Header', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1308822-REG/' },
  { name: 'KUPO KT-1824K 18"X24" OPEN END FLAG KIT', category: 'light-accessories', price: null, imageUrl: null, imageSearch: 'KUPO KT-1824K flag kit' },
  { name: 'ProTapes Pro Gaffer Tape (2" x 55 yd, Black)', category: 'light-accessories', price: 20000, imageUrl: 'https://www.bhphotovideo.com/c/product/812203-REG/' },
  { name: 'Magic arm 5,5"', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1593279-REG/' },
  { name: 'Magic arm 9,5"', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1652194-REG/' },
  { name: 'GVM V-Mount Battery with D-Tap and DC Outputs BV-160', category: 'light-accessories', price: 2000, imageUrl: 'https://www.bhphotovideo.com/c/product/1513599-REG/' },
  { name: 'Neewer V-Mount/V Lock Dual Channel Battery Charger with DC 16.5V', category: 'light-accessories', price: null, imageUrl: null, imageSearch: 'Neewer V-Mount Dual Channel Battery Charger' },
  { name: 'Watson Pro Dual Position Li-Ion Battery Charger (V-Mount)', category: 'light-accessories', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1175200-REG/' },
  { name: 'Impact 3" Center Jaw Vise Grip', category: 'light-accessories', price: 45, imageUrl: 'https://www.bhphotovideo.com/c/product/860797-REG/' },
  { name: 'Matthews Vise Grip Plier', category: 'light-accessories', price: 67, imageUrl: 'https://www.bhphotovideo.com/c/product/33159-REG/' },
  { name: 'Matthews C-Clamp, 2 Baby Pins - 8"', category: 'light-accessories', price: 134, imageUrl: 'https://www.bhphotovideo.com/c/product/33202-REG/' },
  { name: 'Aputure Universal Magic Arm', category: 'light-accessories', price: 24, imageUrl: 'https://www.bhphotovideo.com/c/product/1889201-REG/' },
  { name: 'Impact 3" Baby Pin Wall Plate', category: 'light-accessories', price: 10, imageUrl: 'https://www.bhphotovideo.com/c/product/1305586-REG/' },
  { name: 'Impact 6" Baby Pin Wall Plate', category: 'light-accessories', price: 13, imageUrl: 'https://www.bhphotovideo.com/c/product/1305594-REG/' },
  { name: 'Impact Small Clip Clamp with Rubber Rivet Jaw', category: 'light-accessories', price: 14, imageUrl: 'https://www.bhphotovideo.com/c/product/1020688-REG/' },
  { name: 'Matthews Right Angle Baby Pin Adapter', category: 'light-accessories', price: 63, imageUrl: 'https://www.bhphotovideo.com/c/product/33176-REG/' },
  { name: 'Impact Safety Cable (18")', category: 'light-accessories', price: 4, imageUrl: 'https://www.bhphotovideo.com/c/product/1020057-REG/' },
  { name: 'Kupo Apple Box Set (4)', category: 'light-accessories', price: 140, imageUrl: 'https://www.bhphotovideo.com/c/product/1631243-REG/' },
  { name: 'Impact 2" Steel Spring A-Clamp Kit (Red, 20-Pack)', category: 'light-accessories', price: 54, imageUrl: null, imageSearch: 'Impact 2 inch Steel Spring A-Clamp Kit Red 20-Pack' },

  // ── CAMERA ───────────────────────────────────────────────────────────────
  { name: 'Sony fx6', category: 'camera', price: 30000, imageUrl: 'https://www.bhphotovideo.com/c/product/1592066-REG/' },
  { name: 'Card rider (Sony MRW-G2 CFexpress Type A / SD Reader)', category: 'camera', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1578713-REG/' },
  { name: 'Card 80gb (Sony CFexpress Type A)', category: 'camera', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1578709-REG/' },
  { name: 'Card 160gb (Sony CFexpress Type A)', category: 'camera', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1578712-REG/' },
  { name: 'Card 320gb (Sony CFexpress Type A)', category: 'camera', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1729319-REG/' },
  { name: 'Battery fx6 BP-U35', category: 'camera', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1516157-REG/' },
  { name: 'Battery fx6 BP-U70', category: 'camera', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1516158-REG/' },
  { name: 'Battery charger (Sony BCU1A)', category: 'camera', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1760375-REG/' },
  { name: 'Sachtler FSB-8 Fluid Head & flowtech 75mm Tripod System MS Mk II', category: 'camera', price: 10000, imageUrl: 'https://www.bhphotovideo.com/c/product/1869341-REG/' },
  { name: 'SIRUI Video Tripod AM-15S', category: 'camera', price: 5000, imageUrl: null, imageSearch: 'SIRUI Video Tripod AM-15S' },
  { name: 'Hard Case for Sony FX6 Camera', category: 'camera', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1646801-REG/' },
  { name: 'Sony Alpha 7R III', category: 'camera', price: 10000, imageUrl: null, imageSearch: 'Sony Alpha 7R III mirrorless camera' },
  { name: 'Sony NPFZ100 Z-series Rechargeable Battery', category: 'camera', price: null, imageUrl: null, imageSearch: 'Sony NPFZ100 battery' },
  { name: 'GoPro HERO12 Black 5.3K Action Camera', category: 'camera', price: 10000, imageUrl: null, imageSearch: 'GoPro HERO12 Black' },
  { name: 'DJI RS 4 Pro', category: 'camera', price: 10000, imageUrl: null, imageSearch: 'DJI RS 4 Pro gimbal' },
  { name: 'DJI RS 3 Pro Gimbal Stabilizer', category: 'camera', price: 10000, imageUrl: 'https://www.bhphotovideo.com/c/product/1706756-REG/' },
  { name: 'Tilta Professional Slider', category: 'camera', price: 50000, imageUrl: null, imageSearch: 'Tilta Professional Camera Slider' },
  { name: 'Parrot Teleprompter V2 Kit by Padcaster', category: 'camera', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1443042-REG/' },

  // ── LENSES ───────────────────────────────────────────────────────────────
  { name: 'Sigma 18-35mm & 50-100mm T2 Fully Luminous High-Speed Zoom Lens Kit with Case (Sony E)', category: 'lenses', price: 20000, imageUrl: 'https://www.bhphotovideo.com/c/product/1391228-REG/' },
  { name: 'Sigma 24-70 f/2.8 DG DN II Art Lens (Sony E)', category: 'lenses', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1827260-REG/' },
  { name: 'Sigma 14-24 f/2.8 DG DN II Art Lens (Sony E)', category: 'lenses', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1492972-REG/' },
  { name: 'Haida Rear Lens ND Filter Kit for Sigma 14-24mm', category: 'lenses', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1520380-REG/' },
  { name: 'Sigma 24 f/1.4 HSM Art Lens (Sony E)', category: 'lenses', price: 5000, imageUrl: null, imageSearch: 'Sigma 24mm f/1.4 HSM Art Sony E' },
  { name: 'Sigma 35 f/1.4 DG DN II Art Lens (Sony E)', category: 'lenses', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1636130-REG/' },
  { name: 'Sigma 50 f/1.4 HSM Art Lens (Sony E)', category: 'lenses', price: 5000, imageUrl: null, imageSearch: 'Sigma 50mm f/1.4 HSM Art Sony E' },
  { name: 'Sigma 85 f/1.4 DG DN II Art Lens (Sony E)', category: 'lenses', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1581240-REG/' },
  { name: 'Sigma 105mm f/2.8 DG DN Macro Art Lens (Sony E)', category: 'lenses', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1595582-REG/' },
  { name: 'PolarPro Polarizer Filter 82mm', category: 'lenses', price: 2000, imageUrl: 'https://www.bhphotovideo.com/c/product/1418321-REG/' },
  { name: 'Hollywood Black Magic 1/4 Filter 82mm', category: 'lenses', price: 2000, imageUrl: 'https://www.bhphotovideo.com/c/product/1109886-REG/' },
  { name: 'Tiffen ND filter 82mm', category: 'lenses', price: 2000, imageUrl: 'https://www.bhphotovideo.com/c/product/807605-REG/' },
  { name: 'Tiffen 77mm Warm Black Pro-Mist 1/4 Filter', category: 'lenses', price: 2000, imageUrl: 'https://www.bhphotovideo.com/c/product/110347-REG/' },
  { name: 'Vivitar 77mm Close Up Macro Lens Kit', category: 'lenses', price: 2000, imageUrl: 'https://www.bhphotovideo.com/c/product/1278186-REG/' },
  { name: 'B+W XS-Pro MRC-Nano 803 ND Filter (77mm, 3-Stop)', category: 'lenses', price: 2000, imageUrl: 'https://www.bhphotovideo.com/c/product/1298670-REG/' },
  { name: 'B + W Circular Polarizer (77mm)', category: 'lenses', price: 2000, imageUrl: null, imageSearch: 'B+W 77mm Circular Polarizer filter' },

  // ── VOICE ────────────────────────────────────────────────────────────────
  { name: 'Microphone Sennheiser MKH 416-P48U3', category: 'voice', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/79502-REG/' },
  { name: 'Rycote Windshield Kit for Sennheiser', category: 'voice', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1246569-REG/' },
  { name: 'K-Tek KP20TA Mighty Boom 6-Section', category: 'voice', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1685752-REG/' },
  { name: 'Zoom F8n Pro 8-Input', category: 'voice', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1692954-REG/' },
  { name: 'Zoom PCF-8n Protective Case', category: 'voice', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1439212-REG/' },
  { name: 'Sennheiser EW 512P G4', category: 'voice', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1385688-REG/' },
  { name: 'Sennheiser HD 280 Pro Closed Circumaural Headphones and Accessory Kit', category: 'voice', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1253444-REG/' },
  { name: 'Panasonic eneloop pro AA Rechargeable NiMH Batteries', category: 'voice', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/1047695-REG/' },
  { name: 'Watson 8-Bay Rapid Charger for AA', category: 'voice', price: null, imageUrl: 'https://www.bhphotovideo.com/c/product/761843-REG/' },
  { name: 'Hollyland LARK M2 DUO 2-Person Wireless Combo Microphone System', category: 'voice', price: 5000, imageUrl: 'https://www.bhphotovideo.com/c/product/1809525-REG/' },
  { name: 'DJI Mic 2 (2 TX + 1 RX + Charging Case), All-in-one Wireless Microphone, Intelligent Noise Cancelling', category: 'voice', price: 5000, imageUrl: null, imageSearch: 'DJI Mic 2 wireless microphone' },

  // ── CARGO VAN ────────────────────────────────────────────────────────────
  { name: 'Cargo Van', category: 'cargovan', price: null, imageUrl: 'https://h2kproduction.com/product/cargo-van/' },
]

// ── Main seeder ──────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 H2K Product Seeder Starting...')
  console.log(`📦 Total products to insert: ${PRODUCTS.length}\n`)

  let successCount = 0
  let failCount = 0
  const failed = []

  for (let i = 0; i < PRODUCTS.length; i++) {
    const product = PRODUCTS[i]
    console.log(`[${i + 1}/${PRODUCTS.length}] ${product.name}`)
    
    try {
      // Get image
      const images = await getImageUrl(product)
      
      // Insert into database (no price)
      const { error } = await supabase.from('products').insert({
        name: product.name,
        category: product.category,
        images,
        top_rated: false,
      })
      
      if (error) throw error
      
      console.log(`  ✅ Inserted successfully\n`)
      successCount++
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300))
      
    } catch (e) {
      console.log(`  ❌ FAILED: ${e.message}\n`)
      failCount++
      failed.push({ name: product.name, error: e.message })
    }
  }

  console.log('\n════════════════════════════════════')
  console.log(`✅ Inserted: ${successCount}/${PRODUCTS.length}`)
  console.log(`❌ Failed: ${failCount}/${PRODUCTS.length}`)
  
  if (failed.length > 0) {
    console.log('\nFailed products:')
    failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`))
  }
  
  console.log('\n🎉 Done!')
}

main().catch(console.error)
