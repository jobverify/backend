import assert from 'node:assert/strict'
import test from 'node:test'
import {transport,HOME,SEARCH} from './native.fixtures.js'
import {corrected,withIndia,editSchema} from './native.synthetic.js'
globalThis.fetch=()=>{throw Error('OFFLINE AutoForm contract network tripwire')}
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const {readInventoryEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
const run=io=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='autoformindia')).run({now:()=> '2026-10-27T10:00:00Z',...io})
const snapshot=async(mutate,options={})=>{
 let audit
 const io=transport(mutate,options),jobs=await run({...io,onAudit:a=>audit=a,...options.run})
 return {audit,jobs,calls:io.calls,evidence:readInventoryEvidence(jobs)}
}
test('synthetic corrected source can prove all five foreign roles and company India zero',async()=>{
 const {audit,evidence}=await snapshot(corrected)
 assert.equal(audit.healthyNative,5);assert.equal(audit.wholeCompanyGlobal,5)
 assert.equal(evidence.listingComplete,true);assert.equal(evidence.indiaFacetCount,0)
})
test('synthetic future India record uses native UID, formal requisition and full detail',async()=>{
 const {jobs,audit,evidence}=await snapshot(p=>{corrected(p);withIndia(p)})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].city,'Pune')
 assert.equal(jobs[0].jobId,'5162');assert.equal(jobs[0].requisitionId,'26/16/pts')
 assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(audit.wholeCompanyGlobal,5)
 assert.equal(evidence.listingComplete,true);assert.equal(evidence.indiaFacetCount,1)
})
test('synthetic healthy India role preserves the unrelated exact foreign conflict and independently complete India count',async()=>{
 const {jobs,audit,evidence}=await snapshot(p=>withIndia(p))
 assert.equal(jobs.length,1);assert.equal(audit.healthyNative,4)
 assert.equal(evidence.listingComplete,true);assert.equal(evidence.indiaFacetCount,1)
 assert.equal(audit.companyComplete,false);assert.equal(audit.wholeCompanyGlobal,null)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('synthetic secondary India schema address is eligible even with foreign primary worksite',async()=>{
 const {jobs}=await snapshot(p=>{corrected(p);const row=Object.values(p).find(r=>r.body.includes('jobuid-single-5162'))
  row.body=editSchema(row.body,s=>{s.jobLocation=[s.jobLocation,{'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'India',addressLocality:'Pune'}}]})})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].city,'Pune')
 assert.deepEqual(jobs[0].sourceCountries,['Switzerland','India'])
})
test('synthetic body mentions India without a role worksite do not select foreign jobs',async()=>{
 const {jobs,audit}=await snapshot(p=>{corrected(p);for(const r of Object.values(p))r.body=r.body.replaceAll('Your Responsibilities','Your Responsibilities for customers in India')})
 assert.equal(jobs.length,0);assert.equal(audit.india,0)
})
test('synthetic output cap is applied after the full native inventory and disables cleanup',async()=>{
 const {jobs,audit,evidence,calls}=await snapshot(p=>{corrected(p);withIndia(p)},{run:{maxJobs:0}})
 assert.equal(jobs.length,0);assert.equal(audit.observedNative,5)
 assert.equal(calls.filter(u=>u.includes('/advertisement/')).length,10)
 assert.equal(evidence.listingComplete,false);assert.ok(audit.issues.includes('output-capped-after-full-native-inventory'))
})
test('synthetic closing foreign body mutation withholds global details while preserving the unchanged India exclusion',async()=>{
 const {audit,evidence}=await snapshot(corrected,{onResponse:(page,{call,url})=>{
  if(call===2&&url.includes('/advertisement/cloud-operations'))page.body=page.body.replace('Your Responsibilities','Changed Responsibilities')
 }})
 assert.equal(evidence.listingComplete,true);assert.equal(evidence.indiaFacetCount,0);assert.equal(audit.companyComplete,false)
 assert.ok(audit.issues.some(i=>i.startsWith('closing-native-detail-drift:')))
})
test('synthetic closing corporate extra channel withholds completion',async()=>{
 const {audit,evidence}=await snapshot(corrected,{onResponse:(page,{call,url})=>{if(call===2&&url===HOME)page.body=page.body.replace('</body>','<a href="https://jobs.example.com/india/">Jobs India</a></body>')}})
 assert.equal(evidence.listingComplete,false);assert.ok(audit.issues.includes('closing-corporate-handoff-drift'))
})
test('synthetic native next link is followed and a cycle cannot prove completion',async()=>{
 const {audit,evidence}=await snapshot(p=>{
  corrected(p);const next=SEARCH+'?page=2',body=p[SEARCH].body
  p[next]={...p[SEARCH],url:next,body:body.replace('</body>','<ul class="pagination"><li class="next"><a href="'+SEARCH+'">Next</a></li></ul></body>')}
  p[SEARCH].body=body.replace('</body>','<ul class="pagination"><li class="next"><a href="'+next+'">Next</a></li></ul></body>')
 })
 assert.equal(evidence.listingComplete,false);assert.ok(audit.issues.includes('native-pagination-cycle'))
})
test('synthetic changed secondary native client cannot prove inventory coverage',async()=>{
 const {audit,evidence}=await snapshot(p=>{corrected(p);const client=Object.values(p).find(r=>r.url.endsWith('/vhs-assets-iasf.js'));client.body+='\nchangedContract()'})
 assert.equal(evidence.listingComplete,false);assert.ok(audit.issues.includes('native-secondary-client-unverified'))
})
test('synthetic unresolved country on the India record is not a healthy eligible role',async()=>{
 const {jobs,audit}=await snapshot(p=>{corrected(p);withIndia(p);for(const r of Object.values(p))r.body=r.body.replaceAll('<strong>India:','<strong>Undisclosed:')})
 assert.equal(jobs.length,0);assert.ok(audit.healthyNative<5)
})

test('synthetic closing India worksite withdrawal cannot return the stale opening job',async()=>{
 const {jobs,audit,evidence}=await snapshot(p=>{corrected(p);withIndia(p)},{onResponse:(page,{call,url})=>{
  if(call===2&&url.includes('/advertisement/cloud-operations'))page.body=page.body.replaceAll('India','Switzerland').replaceAll('Pune','Zurich')
 }})
 assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false)
 assert.equal(audit.nativeJobs.find(j=>j.jobId==='5162').sourceDetailComplete,false)
})
test('synthetic closing native 404 cannot return a removed India posting',async()=>{
 const {jobs,audit,evidence}=await snapshot(p=>{corrected(p);withIndia(p)},{onResponse:(page,{call,url})=>{
  if(call===2&&url.includes('/advertisement/cloud-operations')){page.status=404;page.body='Not found'}
 }})
 assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false)
 assert.equal(audit.nativeJobs.find(j=>j.jobId==='5162').sourceClosingVerified,false)
})
test('synthetic explicitly expired India role is inactive, with its exact native expiry retained',async()=>{
 const {jobs,audit,evidence}=await snapshot(p=>{corrected(p);withIndia(p);const r=Object.values(p).find(r=>r.body.includes('jobuid-single-5162'))
  r.body=editSchema(r.body,s=>s.validThrough='2026-10-01T00:00:00Z')})
 assert.equal(jobs.length,0);assert.equal(audit.activeNative,4)
 const role=audit.nativeJobs.find(j=>j.jobId==='5162')
 assert.equal(role.closingDate,'2026-10-01T00:00:00Z');assert.equal(role.sourceActive,false)
 assert.equal(evidence.listingComplete,true);assert.equal(evidence.indiaFacetCount,0)
})
test('synthetic date-only expiry is not turned into invented midnight precision',async()=>{
 const {jobs}=await snapshot(p=>{corrected(p);withIndia(p);const r=Object.values(p).find(r=>r.body.includes('jobuid-single-5162'))
  r.body=editSchema(r.body,s=>s.validThrough='2026-10-27')})
 assert.equal(jobs.length,1);assert.equal(jobs[0].closingDate,'2026-10-27')
 assert.equal(jobs[0].sourceClosingDateIsExact,false)
})
test('synthetic offset-free timestamp expiry remains unresolved rather than authorizing an India job',async()=>{
 const {jobs,evidence}=await snapshot(p=>{corrected(p);withIndia(p);const r=Object.values(p).find(r=>r.body.includes('jobuid-single-5162'))
  r.body=editSchema(r.body,s=>s.validThrough='2026-10-27T12:00:00')})
 assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false)
})
test('synthetic closing listing withdrawal cannot retain a stale India job',async()=>{
 const {jobs,audit}=await snapshot(p=>{corrected(p);withIndia(p)},{onResponse:(page,{call})=>{
  if(call===2)page.body=page.body.replaceAll('id="jobuid-5162"','id="archived-5162"')
 }})
 assert.equal(jobs.length,0)
 assert.ok(audit.issues.includes('closing-native-posting-membership-or-fields-drift:5162'))
})
test('synthetic closing RSS withdrawal cannot retain a stale India job',async()=>{
 const {jobs,audit}=await snapshot(p=>{corrected(p);withIndia(p)},{onResponse:(page,{call,url})=>{
  if(call===2&&url==='https://careers.autoform.com/en/jobs.rss')page.body=page.body.replace(/<item\b[^>]*>[\s\S]*?<\/item>/g,b=>b.includes('cloud-operations-lead')?'':b)
 }})
 assert.equal(jobs.length,0)
 assert.ok(audit.issues.includes('closing-native-posting-membership-or-fields-drift:5162'))
})
