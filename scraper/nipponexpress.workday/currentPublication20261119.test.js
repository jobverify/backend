import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-publication-20261119.json.gz',import.meta.url))))
const listing='https://www.nipponexpress.com/careers/jobs/',contact='https://www.nipponexpress.com/form/special/global_career_south_asia/'
const text=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8')
function replay(change,extra={}){const counts=new Map();return run({requestIntervalMs:0,now:()=> '2026-11-19T18:00:00Z',...extra,fetchImpl:async(url,init)=>{
 assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
 const index=counts.get(url)||0;counts.set(url,index+1)
 const row=fixture.responses.filter(r=>r.requestedUrl===url)[index];assert.ok(row,'Only currently declared first-party reads '+url)
 const response=new Response(change?change(text(row),url,index):text(row),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
}})}
test('Nippon keeps its two actual India publications distinct from group employers without inventing requisitions, dates or role-specific application URLs',async()=>{
 const jobs=await replay();assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(j=>j.title),['Assistant Manager – Sales & Customer Support','Business Development Manager'])
 for(const j of jobs){assert.equal(j.jobId,null);assert.equal(j.requisitionId,null);assert.equal(j.country,'India');assert.equal(j.sourceUrl,listing);assert.equal(j.applyUrl,contact);assert.equal(j.postingDate,null);assert.equal(j.closingDate,null);assert.equal(j.sourceDetailComplete,false);assert.equal(j.nativeRolePreselectionVerified,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.sourceClosingQualified,true);assert.equal(j.nativeHiringOrganization,'NIPPON EXPRESS (INDIA) PRIVATE LIMITED.')}
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.openingCards.length,24);assert.equal(audit.closingCards.length,24);assert.equal(audit.originalResponses.length,8);assert.equal(audit.held.length,22);assert.equal(audit.companyIndiaTotal,null)
})
test('Nippon holds a scoped other employer, mixed foreign worksite, visible closure and disabled handoff',async()=>{
 for(const [from,to] of[
  ['NIPPON EXPRESS (INDIA) PRIVATE LIMITED.','CARGO PARTNER LOGISTICS INDIA PVT LTD.'],
  ['Chennai, Sri City, India','Toronto, Canada / Chennai, India'],
  ['Primary contact for Japanese clients in Chennai, managing sales, service, and logistics solutions.','This position has been filled.'],
 ]){const jobs=await replay((s,u)=>u===listing?s.replace(from,to):s);assert.equal(jobs.length,1,from);assert.equal(jobs[0].title,'Business Development Manager')}
 const disabled=await replay((s,u)=>u===listing?s.replaceAll('class="btnSecondary" href="'+contact+'"','class="btnSecondary" aria-disabled="true" href="'+contact+'"'):s);assert.equal(disabled.length,0)
})
test('Nippon preserves a separately published vacancy when authored criteria are missing',async()=>{
 const start='Primary contact for Japanese clients in Chennai, managing sales, service, and logistics solutions.',end='You will also provide Japanese-English translation/interpretation for cross-cultural teams.'
 const jobs=await replay((s,u)=>{if(u!==listing)return s;const a=s.indexOf(start),b=s.indexOf(end,a);assert.ok(a>=0&&b>a);return s.slice(0,a)+s.slice(b+end.length)})
 assert.equal(jobs.length,2);assert.equal(jobs[0].sourceDescription,null);assert.equal(jobs[0].sourceDetailComplete,false)
})
test('Nippon withholds changed closing publications and ambiguous duplicates without merging native cards by title',async()=>{
 const changed=await replay((s,u,n)=>u===listing&&n===1?s.replace('Chennai, Sri City, India','Mumbai, India'):s);assert.equal(changed.length,1);assert.equal(changed[0].title,'Business Development Manager')
 const duplicate=await replay((s,u)=>{if(u!==listing)return s;const marker='<div class="cardJob">',a=s.indexOf('Assistant Manager   – Sales'),start=s.lastIndexOf(marker,a),next=s.indexOf(marker,a),end=s.lastIndexOf('</li>',next);assert.ok(start>=0&&end>start);return s.slice(0,next)+s.slice(start,end)+s.slice(next)})
 assert.ok(duplicate.length<=1);assert.ok(duplicate.nativeCollectionEvidence.held.some(r=>/ambiguous|duplicate/i.test(r.reason)))
})
test('Nippon respects scoped native expiry/status declarations and never treats unavailable contact consent as a successful application',async()=>{
 const insertion='<li class="cardJobInfoRow"><h3 class="cardJobInfoHead">Closing Date</h3><div class="cardJobInfoTxt">2020-01-01</div></li>'
 const jobs=await replay((s,u)=>u===listing?s.replace('Chennai, Sri City, India</div>','Chennai, Sri City, India</div>'+insertion):s);assert.equal(jobs.length,1)
 await assert.rejects(replay((s,u)=>u===contact?s.replace('action="/form/special/global_career_south_asia/"','action="https://unrelated.invalid/apply"'):s),/form|target|handoff/i)
})
test('Nippon refuses metadata-free callbacks and preserves an opaque caller abort reason',async()=>{
 await assert.rejects(run({fetchText:async()=>''}),/metadata|transport/i)
 const c=new AbortController(),reason={cancel:'caller'};c.abort(reason);await assert.rejects(run({signal:c.signal}),e=>e===reason)
})
test('Nippon honors additional scoped country/employer fields, authored date labels and disabled consent',async()=>{
 const field=(s,label,value)=>{const at=s.indexOf('Chennai, Sri City, India'),end=s.indexOf('</li>',at)+5;assert.ok(at>=0&&end>at);return s.slice(0,end)+'<li class="cardJobInfoRow"><h3 class="cardJobInfoHead">'+label+'</h3><div class="cardJobInfoTxt">'+value+'</div></li>'+s.slice(end)}
 for(const[label,value]of[['Workplace','Toronto, Canada'],['Employer','CARGO PARTNER LOGISTICS INDIA PVT LTD.'],['Work Country','Canada']]){
  const jobs=await replay((s,u)=>u===listing?field(s,label,value):s);assert.equal(jobs.length,1,label)
 }
 const foreignLocation=await replay((s,u)=>{if(u!==listing)return s;const a=s.indexOf('Assistant Manager   – Sales'),b=s.indexOf('Chennai, Sri City, India',a),old='Southeast Asia, South Asia, and Oceania',at=s.indexOf(old,a);assert.ok(a>=0&&at>a&&at<b);return s.slice(0,at)+'Toronto, Canada'+s.slice(at+old.length)})
 assert.equal(foreignLocation.length,1,'Existing Location field cannot contradict the scoped Country field')
 for(const value of['Closing Date: 2020-01-01','Date Posted: 2099-01-01']){
  const jobs=await replay((s,u)=>u===listing?s.replace('Primary contact for Japanese clients in Chennai, managing sales, service, and logistics solutions.','<p>'+value+'</p>'):s);assert.equal(jobs.length,1,value)
 }
 await assert.rejects(replay((s,u)=>u===contact?s.replace('name="privacy_agree"','name="privacy_agree" aria-disabled="true"'):s),/consent|disabled/i)
})
test('Nippon cancels denied and stalled response bodies and preserves caller cancellation',async()=>{
 let deniedCancel=0
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async url=>{const r=new Response(new ReadableStream({cancel(){deniedCancel++}}),{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r}}),/403/)
 assert.equal(deniedCancel,1)
 const controller=new AbortController(),reason={cancel:'midstream'};let stalledCancel=0
 const pending=run({signal:controller.signal,requestIntervalMs:0,fetchImpl:async url=>{const r=new Response(new ReadableStream({start(){setTimeout(()=>controller.abort(reason),20)},cancel(){stalledCancel++}}),{status:200,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r}})
 await assert.rejects(pending,e=>e===reason);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(stalledCancel,1)
})
