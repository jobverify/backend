import test from 'node:test'
import assert from 'node:assert/strict'
import {accessibleNativePackets as packets} from './test-data/accessibleNativePackets.js'
import {run,buildIndiaSearchUrl,extractJobsFromSearchHtml} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const primary=packets.find(r=>r.url.includes('/jobs/program-manager-mapping-operations'))
const replay=(edit=()=>{},calls=[])=>async(url,init)=>{
 const saved=packets.find(r=>r.url===url);assert.ok(saved,'Uncaptured '+url)
 const row=structuredClone(saved);edit(row,calls);calls.push({url,init})
 if(row.status!==200)throw Object.assign(Error('Waymo HTTP '+row.status),{status:row.status,requestUrl:url,finalUrl:row.finalUrl})
 return row.body
}
const now=()=> '2026-10-31T07:30:00.000Z'
const editPosting=(row,edit)=>{const re=/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/i;row.body=row.body.replace(re,(_,a,b,c)=>{const p=JSON.parse(b);edit(p);return a+JSON.stringify(p)+c})}
const isPrimary=row=>row.url===primary.url
test('Waymo listing observations retain unknown country, application, requisition and full description until native proof',()=>{
 const observations=extractJobsFromSearchHtml(packets.find(p=>p.url===buildIndiaSearchUrl()).body,{scrapedAt:now()})
 assert.equal(observations.length,2)
 assert.ok(observations.every(j=>j.country===null&&j.applyUrl===null&&j.requisitionId===null&&j.jobDescription===null&&!j.sourceDetailComplete))
 assert.ok(observations.every(j=>j.nativeListingSummary?.length>100))
})

test('two accessible Waymo native models reconcile full descriptions, dates, employer and explicit countries',async()=>{
 const calls=[],jobs=await run({fetchText:replay(undefined,calls),now})
 assert.equal(jobs.length,2)
 assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.country==='India'&&j.jobDescription.length>1500))
 assert.ok(jobs.every(j=>j.nativeJobPosting?.hiringOrganization?.name==='Waymo'&&j.nativeCountryAddresses.length===1))
 const first=jobs.find(j=>j.sourceUrl===primary.url)
 assert.equal(first.requisitionId,'5535');assert.equal(first.postingDate,'2026-10-06T15:10:46.000Z')
 assert.equal(first.closingDate,'2027-01-28T17:09:06.000Z')
 assert.equal(first.activeApplyVerified,true)
 assert.equal(jobs.filter(j=>j.applicationAccessValidated===false).length,0)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.targetCountry,'IN');assert.equal(jobs.nativeCollectionEvidence.openingIndiaCount,2)
 assert.equal(jobs.nativeCollectionEvidence.closingIndiaCount,2)
 for(const packet of packets.filter(p=>p.status===202))assert.equal(calls.filter(c=>c.url===packet.url).length,0)
 assert.equal(calls.filter(c=>c.url===buildIndiaSearchUrl()).length,2)
})
test('another role in the same current format uses its own native identity and original date',async()=>{
 const jobs=await run({fetchText:replay(),now}),job=jobs.find(j=>j.title==='Program Manager, Vendor Service Delivery Lead')
 assert.ok(job);assert.equal(job.postingDate,'2026-09-29T19:09:38.000Z');assert.notEqual(job.requisitionId,'5535')
 assert.equal(job.activeApplyVerified,true);assert.ok(job.jobDescription.includes('You'))
})
for(const [name,edit]of[
 ['foreign country',r=>editPosting(r,p=>p.jobLocation[0].address.addressCountry='US')],
 ['missing country',r=>editPosting(r,p=>delete p.jobLocation[0].address.addressCountry)],
 ['contradictory native city',r=>editPosting(r,p=>p.jobLocation[0].address.addressLocality='Toronto')],
 ['different employer',r=>editPosting(r,p=>p.hiringOrganization.name='Other employer')],
 ['changed role identifier',r=>editPosting(r,p=>p.identifier.value='a'.repeat(32))],
 ['impossible posting date',r=>editPosting(r,p=>p.datePosted='2026-02-30T00:00:00Z')],
 ['future posting date',r=>editPosting(r,p=>p.datePosted='2030-01-01T00:00:00Z')],
 ['expired role',r=>editPosting(r,p=>p.validThrough='2026-10-01T00:00:00Z')],
 ['changed structured description',r=>editPosting(r,p=>p.description+='<p>Additional location and role criteria.</p>')],
 ['hidden native description',r=>{r.body=r.body.replace('class="job-description"','hidden class="job-description"')}],
 ['hidden native schema',r=>{r.body=r.body.replace('type="application/ld+json"','hidden type="application/ld+json"')}],
 ['duplicate native schema',r=>{const schema=r.body.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/i)[0];r.body=r.body.replace('</body>',schema+'</body>')}],
 ['closed visible role',r=>{r.body=r.body.replace('class="job-description"','class="job-description"');r.body=r.body.replace('Ready to Apply?','This job is no longer available')}],
 ['unbound application frame',r=>{r.body=r.body.replaceAll('job_uid=92ec5f0e26503f37040a9d824f3696a7','job_uid='+'a'.repeat(32))}],
])test('Waymo rejects '+name+' while retaining native conflicts',async()=>{
 await assert.rejects(run({fetchText:replay(r=>{if(isPrimary(r))edit(r)}),now}))
})
test('a hidden employer handoff cannot bind the careers host',async()=>{
 await assert.rejects(run({fetchText:replay(r=>{if(r.url==='https://waymo.com/')r.body=r.body.replaceAll('<a','<a hidden')}),now}))
})
test('the filtered search cannot authorize an unrelated role host',async()=>{
 await assert.rejects(run({fetchText:replay(r=>{if(r.url===buildIndiaSearchUrl())r.body=r.body.replaceAll(primary.url,'https://unrelated.example/jobs/one')}),now}))
})
test('a smaller closing inventory cannot certify the opening roles',async()=>{
 await assert.rejects(run({fetchText:replay((r,calls)=>{if(r.url===buildIndiaSearchUrl()&&calls.some(c=>c.url===r.url))r.body=r.body.replace('all&nbsp;2','all&nbsp;1')}),now}))
})
test('a closing native description change cannot be hidden by unchanged listing cards',async()=>{
 await assert.rejects(run({fetchText:replay((r,calls)=>{if(isPrimary(r)&&calls.some(c=>c.url===r.url))editPosting(r,p=>p.description+='<p>Changed criteria.</p>')}),now}))
})
test('an application form bound to a different role fails closed',async()=>{
 await assert.rejects(run({fetchText:replay(r=>{if(r.roleUrl===primary.url)r.body=r.body.replaceAll('job_id=92ec5f0e26503f37040a9d824f3696a7','job_id='+'a'.repeat(32))}),now}))
})
for(const [name,edit]of[
 ['hidden listing card',r=>{r.body=r.body.replace('<article','<article hidden')}],
 ['inert listing card',r=>{r.body=r.body.replace('<article','<article inert')}],
 ['conflicting selected country',r=>{r.body=r.body.replace(/<input\b[^>]*\bname="country_codes\[\]"[^>]*\bvalue="US"[^>]*>/,tag=>tag.replace('<input','<input checked'))}],
 ['duplicate native listing role',r=>{r.body=r.body.replace('all&nbsp;2','all&nbsp;3').replace('</body>',r.body.match(/<article\b[\s\S]*?<\/article>/)[0]+'</body>')}],
])test('Waymo rejects '+name+' before native scope can qualify',async()=>{
 await assert.rejects(run({fetchText:replay(r=>{if(r.url===buildIndiaSearchUrl())edit(r)}),now}))
})
test('Waymo aggregate deadline also bounds a noncooperative injected transport',async()=>{
 const result=await Promise.race([
  run({fetchText:()=>new Promise(()=>{}),timeoutMs:15,now}).then(()=>({success:true}),error=>({error})),
  new Promise(resolve=>setTimeout(()=>resolve({stillPending:true}),80)),
 ])
 assert.equal(result.error?.code,'WAYMO_NATIVE_TIMEOUT')
 assert.equal(result.error.inventoryEvidence.reportedTotal,null)
 assert.equal(result.error.inventoryEvidence.listingComplete,false)
})
