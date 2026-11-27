import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {extractSearchResults,extractJobDetail} from './currentNative.js'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/text-workplace-20261125.json.gz',import.meta.url))))
const packets=new Map(capture.packets.map(packet=>[packet.requestedUrl,packet]))
const body=packet=>Buffer.from(packet.bodyBase64,'base64').toString('utf8')
const feed=capture.packets.find(packet=>packet.requestedUrl.includes('/wp-json/'))
const listing=extractSearchResults(JSON.parse(body(feed))).find(row=>row.jobId==='37296')
const html=body(packets.get(listing.sourceUrl))
const changePosting=update=>html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(whole,open,raw,close)=>{
 const value=JSON.parse(raw)
 if(value['@type']!=='JobPosting')return whole
 update(value)
 return open+JSON.stringify(value)+close
})

test('TeamLease preserves the original textual workplace and full criteria without deriving India from Bengaluru',()=>{
 const job=extractJobDetail(html,listing,{now:capture.completedAt})
 assert.equal(job.jobId,'37296')
 assert.equal(job.title,'Payroll Executive (CSG) – TeamLease Services (Staffing)')
 assert.equal(job.location,'Bengaluru')
 assert.equal(job.city,null)
 assert.equal(job.country,null)
 assert.equal(job.sourceCountryScopeUnresolved,true)
 assert.equal(job.sourceDetailComplete,true)
 assert.ok(job.sourceDescription.length>500)
 assert.deepEqual(job.sourceNativeLocationEvidence.jobLocation,{'@type':'Place',address:'Bengaluru'})
 assert.deepEqual(job.locations[0].raw,{'@type':'Place',address:'Bengaluru'})
 assert.equal(job.lifecycleCleanupAllowed,false)
})

test('TeamLease finishes the twelve captured role descriptions and closing inventory while all native countries remain unresolved',async()=>{
 // The failing live capture ends at this final role. Replay the same complete
 // original feed/archive bodies for controlled closing reads; a fresh live
 // collection independently checks real closing responses after the repair.
 const jobs=await run({now:()=>capture.completedAt,sourceTimeoutMs:20000,requestTimeoutMs:5000,fetchImpl:async url=>{
  const packet=packets.get(url)
  assert.ok(packet,'Only a current captured public URL may be read: '+url)
  return Object.defineProperty(new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 }})
 assert.equal(jobs.length,12)
 assert.ok(jobs.every(job=>job.sourceDetailComplete&&job.country===null&&job.sourceCountryScopeUnresolved))
 assert.equal(jobs.nativeCollectionEvidence.observedPublishedPostCount,12)
 assert.equal(jobs.nativeCollectionEvidence.unknownCountryCount,12)
 assert.equal(jobs.nativeCollectionEvidence.explicitIndiaCountryMatches,0)
 assert.equal(jobs.nativeCollectionEvidence.requests,16)
 assert.equal(jobs.nativeCollectionEvidence.openingClosingNativeRecordsMatch,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('TeamLease retains independently typed native country and city fields',()=>{
 const changed=changePosting(posting=>{posting.jobLocation.address={'@type':'PostalAddress',addressCountry:'India',addressLocality:'Bengaluru'}})
 const job=extractJobDetail(changed,listing,{now:capture.completedAt})
 assert.equal(job.country,'India')
 assert.equal(job.city,'Bengaluru')
 assert.equal(job.sourceCountryScopeUnresolved,false)
})

for(const [label,address] of [['empty',''],['whitespace','   '],['markup','<p>Bengaluru</p>'],['oversized','x'.repeat(1001)],['number',42],['boolean',true],['null',null],['list',['Bengaluru']]]){
 test('TeamLease still rejects a malformed '+label+' native workplace',()=>{
  assert.throws(()=>extractJobDetail(changePosting(posting=>{posting.jobLocation.address=address}),listing,{now:capture.completedAt}),/native workplace/)
 })
}

test('TeamLease textual workplaces cannot bypass native employer binding',()=>{
 assert.throws(()=>extractJobDetail(changePosting(posting=>{posting.hiringOrganization.name='Another employer'}),listing,{now:capture.completedAt}),/employer/)
})

test('TeamLease textual workplaces cannot bypass complete visible and structured criteria agreement',()=>{
 assert.throws(()=>extractJobDetail(changePosting(posting=>{posting.description+='<p>A different mandatory requirement.</p>'}),listing,{now:capture.completedAt}),/description content changed/)
})
