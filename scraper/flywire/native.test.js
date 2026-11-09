import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as source from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
import {normalizeLifecycleDate} from '../../src/utils/jobLifecycle.js'

const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-008.json.gz',import.meta.url))))
const API='https://flywire.wd108.myworkdayjobs.com/wday/cxs/flywire/flywirecareers/jobs'
function options(change=()=>{},map=url=>url){
 const f=fixture(),calls=[]
 return {calls,now:()=> '2026-10-21T20:50:00.000Z',fetchImpl:async(url,init={})=>{
  const method=init.method||'GET',body=init.body??null
  const p=f.packets.find(p=>p.url===map(String(url))&&(p.method??'GET')===method&&(p.requestBody??null)===body)
  assert.ok(p,'Only captured public requests allowed: '+method+' '+url)
  calls.push({url,method,body})
  const current=structuredClone(p);change(current,calls)
  const response=new Response(current.body,{status:current.status,headers:{'content-type':current.contentType||(current.url.endsWith('.js')?'application/javascript':'text/html')}})
  Object.defineProperty(response,'url',{value:map(String(url))!==String(url)?String(url):current.finalURL||current.url});return response
 }}
}
test('replaces sentinel with reconciled India details across three global pages',async()=>{
 const opt=options(),jobs=await source.run(opt)
 assert.equal(jobs.length,19)
 const job=jobs.find(j=>j.jobId==='JR-1062')
 assert.equal(job.country,'India');assert.equal(job.nativeLegalEmployer,'FW Solutions India LLP [India]')
 assert.equal(job.nativeDatePosted,'2026-10-19');assert.equal(job.postedAt,'2026-10-19T00:00:00.000Z')
 assert.match(job.sourceDescription,/<p>/);assert.match(job.jobDescription,/Secure SDLC/)
 assert.equal(job.applicationAccessValidated,false);assert.equal(job.sourceListingComplete,false)
 assert.equal(jobs.find(j=>j.jobId==='R-100006').nativeLegalEmployer,null)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.deepEqual([...new Set(opt.calls.filter(c=>c.url===API).map(c=>JSON.parse(c.body).offset))],[0,20,40])
})

const mutateJSON=(p,fn)=>{if(p.url.includes('/wday/cxs/')){const b=JSON.parse(p.body);fn(b,p);p.body=JSON.stringify(b)}}
test('HTML structured title entities reconcile with the exact native requisition', async () => {
 const jobs = await source.run(options(p => {
  mutateJSON(p, body => {
   for (const row of body.jobPostings || []) if (row.bulletFields?.[0] === 'JR-1062') row.title += ' & Data'
   if (body.jobPostingInfo?.jobReqId === 'JR-1062') body.jobPostingInfo.title += ' & Data'
  })
  mutateLD(p, schema => { schema.title += ' &amp; Data'; schema.identifier.name += ' &amp; Data' })
 }))
 assert.equal(jobs.find(job => job.jobId === 'JR-1062').title, 'Senior Security Engineer (Defensive) & Data')
})
for(const[name,mutate]of[
 ['duplicate page identities',(p)=>mutateJSON(p,(b,p)=>{if(p.requestBody&&JSON.parse(p.requestBody).offset===20)b.jobPostings[0]=fixture().packets.filter(x=>x.requestBody)[0]&&JSON.parse(fixture().packets.find(x=>x.requestBody).body).jobPostings[0]})],
 ['short nonfinal page',(p)=>mutateJSON(p,b=>{if(b.jobPostings?.length)b.jobPostings.pop()})],
 ['upstream failure',(p)=>{if(p.url===API)p.status=503}],
 ['error envelope',(p)=>mutateJSON(p,b=>{b.error='unavailable'})],
 ['native closed status',(p)=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062')b.jobPostingInfo.canApply=false})],
 ['canonical identity mismatch',(p)=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062')b.jobPostingInfo.externalUrl=b.jobPostingInfo.externalUrl.replace('JR-1062','JR-9999')})],
 ['application posting identity mismatch',(p)=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062')b.jobPostingInfo.jobPostingId='another-role_JR-1062'})],
 ['native country contradiction',(p)=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062')b.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='US'})],
 ['foreign location under India country',(p)=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062')b.jobPostingInfo.location='US - Chicago'})],
 ['unscoped remote',(p)=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062'){b.jobPostingInfo.location='Remote';delete b.jobPostingInfo.country;delete b.jobPostingInfo.jobRequisitionLocation.country}})],
 ['HTML country contradiction',(p)=>{if(p.url.includes('/flywirecareers/job/')&&p.url.includes('JR-1062'))p.body=p.body.replace('"addressCountry" : "India"','"addressCountry" : "United States"')}],
 ['HTML identity contradiction',(p)=>{if(p.url.includes('/flywirecareers/job/')&&p.url.includes('JR-1062'))p.body=p.body.replace('"value" : "JR-1062"','"value" : "JR-9999"')}],
])test('rejects '+name,async()=>{await assert.rejects(()=>source.run(options(mutate)))})

test('missing substantive JD stays incomplete without manufactured description',async()=>{
 const jobs=await source.run(options(p=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062')b.jobPostingInfo.jobDescription='<p>Please click Apply</p>'})))
 const job=jobs.find(j=>j.jobId==='JR-1062');assert.equal(job.sourceDetailComplete,false);assert.equal(job.jobDescription,null);assert.equal(job.nativeDescriptionOriginal,'<p>Please click Apply</p>')
})
test('unknown native publication does not promote known startDate',async()=>{
 const jobs=await source.run(options(p=>{if(p.url.includes('/flywirecareers/job/')&&p.url.includes('JR-1062'))p.body=p.body.replace('"datePosted" : "2026-10-19",','')}))
 const job=jobs.find(j=>j.jobId==='JR-1062');assert.equal(job.postedAt,null);assert.equal(job.nativeDatePosted,null);assert.equal(job.nativeStartDate,'2026-10-19')
})
test('known old publication is retained for downstream month guard',async()=>{
 const jobs=await source.run(options(p=>{if(p.url.includes('/flywirecareers/job/')&&p.url.includes('JR-1062'))p.body=p.body.replace('"datePosted" : "2026-10-19"','"datePosted" : "2026-01-01"')}))
 assert.equal(jobs.find(j=>j.jobId==='JR-1062').postedAt,'2026-01-01T00:00:00.000Z')
})
test('listing drift during final reconciliation fails closed',async()=>{
 await assert.rejects(()=>source.run(options((p,calls)=>{if(p.url===API&&calls.filter(c=>c.url===API).length>3){const b=JSON.parse(p.body);b.jobPostings[0].title+=' changed';p.body=JSON.stringify(b)}})))
})
test('public failure never qualifies an empty inventory',async()=>{await assert.rejects(()=>source.run(options(p=>{if(p.url===API){const b=JSON.parse(p.body);b.total=0;b.jobPostings=[];p.body=JSON.stringify(b)}})))})

test('native configured application route retains the posting suffix',async()=>{
 const jobs=await source.run(options()),job=jobs.find(j=>j.jobId==='JR-1067')
 assert.equal(job.applyUrl,'https://flywire.wd108.myworkdayjobs.com/flywirecareers/job/Bangalore%2C-India/Lead-Security-Engineer_JR-1067-1/apply')
 assert.equal(job.nativeDatePosted,'2026-10-13')
})
test('closure in the active description is rejected',async()=>{
 await assert.rejects(()=>source.run(options(p=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062')b.jobPostingInfo.jobDescription='<p>This job is closed.</p>'}))),/closed-role description/)
})
test('native detail drift fails during final reconciliation',async()=>{
 await assert.rejects(()=>source.run(options((p,calls)=>{if(p.url.includes('/wday/cxs/')&&p.url.includes('JR-1062')&&calls.filter(c=>c.url===p.url).length>1)mutateJSON(p,b=>{b.jobPostingInfo.startDate='2026-10-18'})})),/details changed/)
})
test('native HTML canonical cannot substitute a different posting',async()=>{
 await assert.rejects(()=>source.run(options(p=>{if(p.url.includes('/flywirecareers/job/')&&p.url.includes('JR-1062'))p.body=p.body.replace('href="https://flywire.wd108.myworkdayjobs.com/en-US/flywirecareers/job/Senior-Security-Engineer--Defensive-_JR-1062"','href="https://flywire.wd108.myworkdayjobs.com/en-US/flywirecareers/job/Another_JR-1062"')})),/HTML canonical mismatch/)
})
test('invalid calendar publication is rejected',async()=>{
 await assert.rejects(()=>source.run(options(p=>{if(p.url.includes('/flywirecareers/job/')&&p.url.includes('JR-1062'))p.body=p.body.replace('"datePosted" : "2026-10-19"','"datePosted" : "2026-02-30"')})),/native publication date/)
})
test('removed corporate handoff blocks native inventory',async()=>{
 await assert.rejects(()=>source.run(options(p=>{if(p.url==='https://www.flywire.com/company/careers')p.body=p.body.replaceAll('https://flywire.wd108.myworkdayjobs.com/flywirecareers','https://unrelated.example/')})),/corporate job-opening handoff/)
})
test('foreign typed countries must agree exactly',async()=>{
 await assert.rejects(()=>source.run(options(p=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1052')b.jobPostingInfo.jobRequisitionLocation.country={descriptor:'United States of America',id:'bc33aa3152ec42d4995f4791a106ed09',alpha2Code:'US'}}))),/countries conflict/)
})
test('secondary location cannot override its explicit foreign country',async()=>{
 await assert.rejects(()=>source.run(options(p=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='R-100002')b.jobPostingInfo.additionalLocations=[{descriptor:'Bangalore',country:{descriptor:'United States of America',id:'bc33aa3152ec42d4995f4791a106ed09',alpha2Code:'US'}}]}))),/secondary country/)
})
test('past native closing date cannot remain open',async()=>{
 await assert.rejects(()=>source.run(options(p=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062')b.jobPostingInfo.endDate='2026-01-01'}))),/closing date/)
})
test('explicit failure inside native posting rejects the response',async()=>{
 await assert.rejects(()=>source.run(options(p=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062')b.jobPostingInfo.status='closed'}))),/failure status/)
})

const mutateLD=(p,fn)=>{if(!p.url.includes('/wday/')&&p.url.includes('/flywirecareers/job/')&&p.url.includes('JR-1062'))p.body=p.body.replace(/(<script[^>]*application\/ld\+json[^>]*>)([\s\S]*?)(<\/script>)/,(all,open,raw,close)=>{const ld=JSON.parse(raw);fn(ld);return open+JSON.stringify(ld)+close})}
for(const marker of ['Job Summary','Responsibilities and Tasks:'])test('FW058-R1 rejects a JD truncated at '+marker,async()=>{
 await assert.rejects(()=>source.run(options(p=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062'){const i=b.jobPostingInfo,at=i.jobDescription.indexOf(marker);assert.ok(at>300);i.jobDescription=i.jobDescription.slice(0,at+marker.length)}}))),/full JD completeness/)
})
test('FW058-R2 binds matching URLs back to the actual requisition',async()=>{
 await assert.rejects(()=>source.run(options(p=>{
  if(p.requestBody){const b=JSON.parse(p.body);for(const r of b.jobPostings)if(r.bulletFields[0]==='JR-1062')r.externalPath=r.externalPath.replace('JR-1062','JR-9999');p.body=JSON.stringify(b)}
  mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062'){b.jobPostingInfo.externalUrl=b.jobPostingInfo.externalUrl.replace('JR-1062','JR-9999');b.jobPostingInfo.jobPostingId=b.jobPostingInfo.jobPostingId.replace('JR-1062','JR-9999')}})
  if(!p.url.includes('/wday/')&&p.url.includes('JR-1062'))p.body=p.body.replace('href="https://flywire.wd108.myworkdayjobs.com/en-US/flywirecareers/job/Senior-Security-Engineer--Defensive-_JR-1062"','href="https://flywire.wd108.myworkdayjobs.com/en-US/flywirecareers/job/Senior-Security-Engineer--Defensive-_JR-9999"')
 },u=>u.replace('JR-9999','JR-1062'))),/posting requisition suffix/)
})
test('FW058-R3 date-only closing metadata preserves the inclusive closing day',async()=>{
 const jobs=await source.run(options(p=>mutateLD(p,ld=>{ld.validThrough='2026-10-21'}))),job=jobs.find(j=>j.jobId==='JR-1062'),normalized=normalizeScrapedJob(job,{source:'flywire'})
 assert.equal(job.nativeValidThrough,'2026-10-21');assert.equal(normalized.sourceClosingDateIsExact,false)
 const cutoff=normalizeLifecycleDate(normalized.closingDate);if(normalized.sourceClosingDateIsExact===false)cutoff.setUTCHours(24,0,0,0)
 assert.equal(cutoff.toISOString(),'2026-10-22T00:00:00.000Z')
})
test('FW058-R4 rejects conflicting explicit native closing dates',async()=>{
 await assert.rejects(()=>source.run(options(p=>{mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062')b.jobPostingInfo.endDate='2026-10-22'});mutateLD(p,ld=>{ld.validThrough='2026-10-23'})})),/Conflicting native closing dates/)
})
test('FW058-R5 retains known CXS-only closing date and precision',async()=>{
 const jobs=await source.run(options(p=>mutateJSON(p,b=>{if(b.jobPostingInfo?.jobReqId==='JR-1062')b.jobPostingInfo.endDate='2026-10-22'}))),job=jobs.find(j=>j.jobId==='JR-1062')
 assert.equal(job.nativeEndDate,'2026-10-22');assert.equal(job.closingDate,'2026-10-22');assert.equal(job.sourceClosingDateIsExact,false)
 assert.equal(job.closingDateProvenance,'official-workday-cxs-endDate')
})
