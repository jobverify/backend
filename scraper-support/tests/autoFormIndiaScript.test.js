import assert from 'node:assert/strict'
import test from 'node:test'
import {original,transport} from '../../scraper/autoformindia/native.fixtures.js'
globalThis.fetch=()=>{throw Error('OFFLINE AutoForm shared tests network tripwire')}
const m=await import('../../scraper/autoformindia/script.js')
const {readInventoryEvidence}=await import('../utils/inventoryEvidence.js')

test('AutoForm India exposes current company identity and native first-party URLs',()=>{
 assert.equal(m.SOURCE,'autoformindia');assert.equal(m.COMPANY_NAME,'AutoForm India')
 assert.equal(m.VERIFIED_AT,'2026-11-03')
 assert.equal(m.JOBS_RSS_URL,'https://careers.autoform.com/en/jobs.rss')
 assert.match(m.VERIFIED_SURFACE_SUMMARY,/conflicting work countries/)
})
test('AutoForm India actual native RSS keeps publication offset and complete item identity',()=>{
 const rss=m.extractRssItems(original()[m.JOBS_RSS_URL].body)
 assert.equal(rss.items.length,5);assert.equal(rss.items[0].postingDate,'2026-10-13T14:33:28.000Z')
 assert.match(rss.items[0].rawPublication,/\+0200$/)
 assert.ok(rss.items.every(r=>r.title&&r.sourceUrl&&r.descriptionHtml))
 // URL slugs are navigation, never a replacement for native posting/req IDs.
 assert.ok(rss.items.every(r=>r.requisitionId===undefined&&r.jobId===undefined))
})
test('AutoForm India rejects an RSS feed outside the evidenced native envelope',()=>{
 assert.throws(()=>m.extractRssItems(original()[m.JOBS_RSS_URL].body.replace('TYPO3 EXT:news','Unexpected Feed')),/RSS envelope/)
})
test('AutoForm India exact global country conflict is retained while all native alternatives exclude India',async()=>{
 let audit
 const jobs=await m.createAutoFormIndiaScraper().run({...transport(),onAudit:a=>audit=a})
 assert.equal(audit.observedNative,5);assert.equal(audit.healthyNative,4)
 assert.equal(audit.nativeJobs.find(j=>j.jobId==='5162').requisitionId,'26/16/pts')
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0)
 assert.equal(audit.companyComplete,false)
})
test('AutoForm India fetchText injection is used through all native detail and closing reads',async()=>{
 const io=transport();let audit
 await m.createAutoFormIndiaScraper().run({fetchText:io.fetchText,onAudit:a=>audit=a})
 assert.equal(audit.observedNative,5);assert.equal(io.calls.length,32)
 assert.equal(io.calls.filter(u=>u.includes('/advertisement/')).length,10)
})
test('AutoForm India all-surface timeout is unknown and propagates at the first request',async()=>{
 const io=transport(null,{failure:Object.assign(Error('Connect timeout'),{code:'UND_ERR_CONNECT_TIMEOUT'})})
 await assert.rejects(m.createAutoFormIndiaScraper().run(io),/timeout/)
 assert.deepEqual(io.calls,[m.HOMEPAGE_URL])
})
