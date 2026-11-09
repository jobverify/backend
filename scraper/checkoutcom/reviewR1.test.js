import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { fixture, transport, specs } from './native.fixtures.js'

globalThis.fetch = async () => { throw Error('NETWORK_TRIPWIRE_BEFORE_REVIEW_SOURCE_IMPORT') }
const { getScraperCatalog, createCatalogScraper } = await import('../../scraper-support/providers/index.js')
const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
const catalog = getScraperCatalog()
const run = (source, io, options={}) => createCatalogScraper(catalog.find(p=>p.source===source)).run({...io,now:()=> '2026-10-27T10:07:21.634Z',...options})
const prefixes=['ar-ae','de-de','es-es','fr-fr','it-it','ja-jp','pt-pt','zh-cn']
const routes=prefixes.flatMap(prefix=>['careers','early-careers','jobs'].map(p=>`https://www.checkout.com/${prefix}/${p}`)).sort()
const retained=new Map(['careers','early-careers','jobs'].map(p=>[`https://www.checkout.com/${p}`,readFileSync(new URL(`./fixtures/current-${p}-20261027.html`,import.meta.url),'utf8')]))
const currentCorporate = options => {
  const io=transport('checkoutcom'),fallback=io.fetchText
  io.fetchText=async url=>{
    if(retained.has(url)){io.calls.push(url);return retained.get(url)}
    if(routes.includes(url)){
      io.calls.push(url)
      if(options?.denial===url)throw Object.assign(Error('HTTP 403 current locale access denial'),{status:403})
      if(!options?.resolved)throw Error('NO_RETAINED_RESPONSE_FOR_CURRENT_ADVERTISED_ROUTE')
      return `<html><body>Checkout.com Careers<script>fetch("https://ashby-careers-checkout-production.up.railway.app/api/jobs")</script></body></html>`
    }
    return fallback(url)
  }
  return io
}

test('Checkout current exact language client advertises24 unresolved concrete hiring routes and cannot authorize cleanup',async()=>{
  const io=currentCorporate();let audit
  const jobs=await run('checkoutcom',io,{onNativeAudit:a=>{audit=a}})
  assert.equal(jobs.length,1) // Synthetic control, never a live India observation.
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
  assert.deepEqual([...new Set(io.calls.filter(url=>routes.includes(url)))].sort(),routes)
  assert.deepEqual([...new Set(audit.unresolvedCorporateRoutes)].sort(),routes)
})

test('Checkout current language routes can become complete once every advertised route is actually reconciled',async()=>{
  const io=currentCorporate({resolved:true})
  const jobs=await run('checkoutcom',io)
  assert.equal(jobs.length,1)
  assert.deepEqual([...new Set(io.calls.filter(url=>routes.includes(url)))].sort(),routes)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(jobs[0].lifecycleCleanupAllowed,true)
})

test('Checkout first derived locale denial stops that entire source before native or alternate requests',async()=>{
  const first='https://www.checkout.com/ar-ae/careers',io=currentCorporate({resolved:true,denial:first})
  await assert.rejects(()=>run('checkoutcom',io),/403/)
  assert.equal(io.calls.at(-1),first)
  assert.equal(io.calls.some(url=>url.startsWith('https://api.ashbyhq.com/')),false)
  assert.equal(io.calls.some(url=>url.includes('/de-de/')),false)
})

test('Vanta exact role-owned DenverCO and AustinTX labels use official USPS state evidence with explicit inference provenance',async()=>{
  const bytes=readFileSync(new URL('../vanta/fixtures/usps-state-abbreviations-20261027.html',import.meta.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'0ba863b726007dc640f6f25b849830119a80f5d3056e4e5e472ce4793b2f997b')
  const rows=[...bytes.toString().matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)].map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())
  assert.ok(rows.some(row=>/\bColorado\s+CO\b/.test(row)))
  assert.ok(rows.some(row=>/\bTexas\s+TX\b/.test(row)))
  let audit
  const jobs=await run('vanta',transport('vanta',[fixture('vanta',{index:1,country:null,location:'Denver, CO'}),fixture('vanta',{index:2,country:null,location:'Austin, TX'})]),{onNativeAudit:a=>{audit=a}})
  assert.equal(jobs.length,0)
  assert.equal(audit.fullyHealthyCount,2)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0)
  for(const row of audit.rows){
    const loc=row.nativeLocations[0]
    assert.equal(loc.country,'United States')
    assert.equal(loc.addressCountry,undefined)
    assert.equal(loc.countryProvenance,'role-worksite-and-official-postal-state-inference')
    assert.equal(loc.countryEvidence.referenceUrl,'https://pe.usps.com/text/pub28/pub28apb.htm')
    assert.equal(loc.countryEvidence.referenceSha256,'0ba863b726007dc640f6f25b849830119a80f5d3056e4e5e472ce4793b2f997b')
  }
})

test('Vanta postal proof does not infer from city-only labels, unvalidated states or unknown typed native country fields',async()=>{
  for(const [location,country]of [['Denver',null],['Austin',null],['Denver, CA',null],['Austin, XX',null],['Denver, CO','APAC']]){
    const jobs=await run('vanta',transport('vanta',[fixture('vanta',{country,location})]))
    assert.equal(jobs.length,0)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  }
})

test('Vanta qualified state labels cannot silently accept a conflicting explicit native country',async()=>{
  for(const country of ['India','Canada','CO']){
    const jobs=await run('vanta',transport('vanta',[fixture('vanta',{country,location:'Denver, CO'})]))
    assert.equal(jobs.length,0)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  }
})
