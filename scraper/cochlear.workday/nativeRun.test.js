import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261021.json.gz',import.meta.url))))
async function replay(t,change,options={}){
 const {packets,checkedAt}=fixture(),counts={listing:0,detail:0,bootstrap:0}
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const packet=packets.find(p=>p.url===String(url)&&p.method===(init.method??'GET')&&(p.method!=='POST'||p.requestBody===init.body))
  assert.ok(packet,'Only actual advertised native requests: '+url)
  const p=structuredClone(packet);if(p.method==='POST')counts.listing++;else if(p.url.includes('/job/'))counts.detail++;else counts.bootstrap++
  change?.(p,counts)
  const r=new Response(p.body,{status:p.status});Object.defineProperty(r,'url',{value:p.finalURL});return r
 })
 const jobs=await run({now:()=>checkedAt,requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{},minIntervalMs:0},retryBaseDelayMs:0,...options})
 return{jobs,counts}
}
test('actual finite India location union yields9 current native India roles with full JDs and original dates, retaining unknown company scope',async t=>{
 const {jobs,counts}=await replay(t);assert.equal(jobs.length,9);assert.equal(counts.listing,3);assert.equal(counts.detail,18)
 const details=fixture().packets.filter(p=>p.url.includes('/job/')).map(p=>JSON.parse(p.body))
 for(const j of jobs){
  const p=details.find(p=>p.jobPostingInfo.jobReqId===j.jobId);assert.ok(p)
  assert.equal(j.source,'cochlear');assert.equal(j.company,'Cochlear');assert.equal(j.country,'India')
  assert.equal(j.nativeEmployer,p.hiringOrganization.name);assert.equal(j.sourceDescription,p.jobPostingInfo.jobDescription)
  assert.equal(j.postedAt,p.jobPostingInfo.startDate+'T00:00:00.000Z');assert.equal(j.closingDate,p.jobPostingInfo.endDate?p.jobPostingInfo.endDate+'T00:00:00.000Z':null)
  assert.equal(j.sourceUrl,p.jobPostingInfo.externalUrl);assert.equal(j.applyUrl,j.sourceUrl)
  assert.equal(j.sourceListingComplete,false);assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceGlobalJobCount,null)
  assert.equal(j.sourceObservedNativeLocationFacetCount,9);assert.ok(j.jobDescription.length>1000)
 }
 assert.deepEqual([...new Set(jobs.map(j=>j.nativeEmployer))].sort(),['C71 Cochlear Medical Device Company India Private Limited (India)'])
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
for(const [name,change]of [
 ['wrong legal employer',p=>{p.hiringOrganization.name='Unrelated Exchange Inc.'}],
 ['wrong requisition',p=>{p.jobPostingInfo.jobReqId='WRONG'}],
 ['wrong board',p=>{p.jobPostingInfo.jobPostingSiteId='other'}],
 ['array UID',p=>{p.jobPostingInfo.id=[p.jobPostingInfo.id]}],
 ['foreign country contradicting native Bangalore',p=>{p.jobPostingInfo.country.descriptor='United States of America'}],
 ['foreign code in native India label',p=>{p.jobPostingInfo.location='New York, US'}],
 ['future publication',p=>{p.jobPostingInfo.startDate='2099-01-01'}],
 ['invalid closing calendar',p=>{p.jobPostingInfo.endDate='2026-02-30'}],
 ['inactive application',p=>{p.jobPostingInfo.canApply=false}],
 ['markup title',p=>{p.jobPostingInfo.title='<b>Engineer</b>'}],
 ['missing full description',p=>{p.jobPostingInfo.jobDescription=''}],
 ['hidden full description',p=>{p.jobPostingInfo.jobDescription='<div hidden>'+p.jobPostingInfo.jobDescription+'</div>'}],
 ['inert full description',p=>{p.jobPostingInfo.jobDescription='<div inert>'+p.jobPostingInfo.jobDescription+'</div>'}],
 ['closed role notice',p=>{p.jobPostingInfo.jobDescription='<p>This job is no longer available. We are no longer accepting applications for this position. Please visit our careers page to find other current opportunities.</p>'}],
 ['instruction-only description',p=>{p.jobPostingInfo.jobDescription='<p>Click Apply Now to view the full job description and learn more about this opportunity.</p>'}],
 ['HTTP200 error envelope',p=>{p.ERROR='upstream unavailable'}],
])test(name+' cannot become a publishable current native inventory',async t=>{
 await assert.rejects(()=>replay(t,p=>{if(p.url.includes('/job/')){const j=JSON.parse(p.body);change(j);p.body=JSON.stringify(j)}}))
})
test('final native listing identity drift rejects',async t=>{
 await assert.rejects(()=>replay(t,(p,c)=>{if(p.method==='POST'&&c.listing===3){const j=JSON.parse(p.body);j.jobPostings[0].title+=' changed';p.body=JSON.stringify(j)}}))
})
test('a capped/cancelled native check cannot return successful empty',async()=>{
 await assert.rejects(()=>run({maxJobs:1}));await assert.rejects(()=>run({timeoutMs:0}));await assert.rejects(()=>run({signal:AbortSignal.abort(Error('cancelled'))}),/cancelled/)
})
test('explicit empty India location subset remains partial with unknown whole-company India total',async t=>{
 const {jobs}=await replay(t,p=>{if(p.method==='POST')p.body=JSON.stringify({total:0,jobPostings:[],facets:[]})})
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('full description with an application footer remains valid',async t=>{
 const {jobs}=await replay(t,p=>{if(p.url.includes('/job/')){const j=JSON.parse(p.body);j.jobPostingInfo.jobDescription+='<p>Click Apply Now to view the full job description.</p>';p.body=JSON.stringify(j)}})
 assert.equal(jobs.length,9)
})
test('The role closure notice cannot masquerade as a full native description',async t=>{
 const closure='<p>The role is no longer available. We invite interested candidates to explore other positions through our public careers website and return in the future when new vacancies are advertised by the organization.</p>'
 await assert.rejects(()=>replay(t,p=>{if(p.url.includes('/job/')){const j=JSON.parse(p.body);j.jobPostingInfo.jobDescription=closure;p.body=JSON.stringify(j)}}),/unavailable/)
})

test('long application instructions do not supply the full native description',async t=>{
 const instruction='<p>Please click the Apply now button to access the complete details about this position, the requirements, the application instructions and the recruitment process. Please submit your application to view further information.</p>'
 await assert.rejects(()=>replay(t,p=>{if(p.url.includes('/job/')){const j=JSON.parse(p.body);j.jobPostingInfo.jobDescription=instruction;p.body=JSON.stringify(j)}}),/description missing/)
})
