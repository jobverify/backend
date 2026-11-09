import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{createAccoliteDigitalScraper,extractSearchResults}from'./script.js'
import{readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{readInventoryDelegationEvidence}from'../../scraper-support/utils/inventoryDelegationEvidence.js'
import{generateFingerprint}from'../../scraper-support/utils/applicationIdentity.js'
const records=['bounteous','accolitedigital'].flatMap(source=>JSON.parse(gunzipSync(readFileSync(new URL('../'+source+'/test-data/native-20261103.json.gz',import.meta.url)))))
const pages=new Map(records.map(row=>[row.requestedUrl,row])),feed='https://www.bounteous.com/turbohire/api/',news='https://www.bounteous.com/about/company-news'
// Only unit controls simulate a current response clock. Archived fixture clocks
// remain unchanged and are never reused as a current live delegation receipt.
const seam=(mutate=()=>{})=>({fetchJson:async()=>JSON.parse(pages.get(feed).body),fetchPage:async(url,request)=>{assert.ok(pages.has(url),'missing '+url);const row={...structuredClone(pages.get(url)),capturedAt:new Date().toISOString()};await mutate(row,{url,request});return row}})
test('current Accolite history delegates one canonical Bounteous inventory without obsolete departments or employer relabeling',async()=>{
 const jobs=await createAccoliteDigitalScraper({maxJobs:null}).run(seam()),proof=readInventoryDelegationEvidence(jobs)
 assert.equal(jobs.length,69);assert.ok(jobs.every(job=>job.source==='bounteous'&&job.company==='Bounteous'))
 assert.ok(proof);assert.equal(proof.source,'accolitedigital');assert.deepEqual(proof.sources,['bounteous'])
 assert.equal(proof.preservesChildSourceAndCompany,true);assert.equal(proof.evidence.url,news)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 const canonical=await import('../bounteous/script.js'),native=await canonical.run(seam())
 assert.deepEqual(jobs.map(generateFingerprint),native.map(generateFingerprint))
 assert.equal(new Set([...jobs,...native].map(generateFingerprint)).size,69)
})
test('historical pure parser preserves canonical Bounteous identity and includes current BU/Practice/Corporate departments',()=>{
 const jobs=extractSearchResults(JSON.parse(pages.get(feed).body));assert.equal(jobs.length,69)
 assert.ok(jobs.every(job=>job.source==='bounteous'&&job.company==='Bounteous'&&job.requisitionId===null))
})
test('current corporate relationship is required even when historical merger prose remains available',async()=>{
 await assert.rejects(createAccoliteDigitalScraper().run(seam((page,{url})=>{if(url===news)page.body=page.body.replaceAll('The merger with Accolite Digital','A marketing partnership')})),/relationship|merger|continuity/i)
})
test('a replay without original observation clocks cannot become fresh delegation proof',async()=>{
 const jobs=await createAccoliteDigitalScraper().run(seam(page=>{delete page.capturedAt;page.sha256='a'.repeat(64)}))
 assert.equal(jobs.length,69);assert.equal(readInventoryDelegationEvidence(jobs),null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('an HTTP200 redirected unrelated corporate page cannot certify historical continuity',async()=>{
 await assert.rejects(createAccoliteDigitalScraper().run(seam((page,{url})=>{if(url===news)page.url='https://example.com/'})),/URL|identity/i)
})
test('historical wrapper passes caller cancellation through before any native work',async()=>{
 const controller=new AbortController(),reason=Error('cancel historical source');controller.abort(reason);let calls=0
 await assert.rejects(createAccoliteDigitalScraper().run({signal:controller.signal,fetchPage:()=>{calls++;return new Promise(()=>{})},fetchJson:async()=>({response:[]})}),error=>error===reason);assert.equal(calls,0)
})
