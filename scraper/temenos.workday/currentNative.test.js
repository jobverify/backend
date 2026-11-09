import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCurrentTemenosScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {TEMENOS_CAREERS,TEMENOS_JOBS,TEMENOS_OFFICES} from './worksites.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/worksites-native-20261103.json.gz',import.meta.url))))
async function exercise(t,{change=()=>{},before=()=>{},options={}}={}){
 const rows=structuredClone(fixture.responses),calls=[];change(rows)
 const mock=t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input),method=init.method||'GET',offset=init.body?JSON.parse(init.body).offset:null;calls.push({url,method,offset});before(rows,calls)
  const row=rows.find(r=>r.url===url&&(r.method||'GET')===method&&(method!=='POST'||r.requestBody.offset===offset));assert.ok(row,'Unexpected current Temenos request '+url)
  const response=new Response(row.body,{status:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:url});return response
 })
 try{return{result:await createCurrentTemenosScraper().collect({requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{}},...options}),calls}}
 finally{mock.mock.restore()}
}
test('Temenos configured board reconciles22 full public details and51 explicit-country worksites without claiming company totals',async t=>{
 const {result:r,calls}=await exercise(t)
 assert.equal(r.nativeRoles.length,22);assert.equal(r.closingNativeRoles.length,22);assert.equal(r.nativeDetails.length,22);assert.equal(r.closingNativeDetails.length,22);assert.equal(r.closingStable,true)
 assert.equal(r.directorySnapshots.length,3);assert.ok(r.directorySnapshots.every(d=>d.records.length===51&&d.pages.length===6))
 assert.equal(r.jobs.length,0);assert.equal(r.inventoryEvidence.listingComplete,true);assert.equal(r.inventoryEvidence.reportedTotal,22);assert.equal(r.inventoryEvidence.indiaFacetCount,0);assert.equal(r.companyGlobalTotal,null);assert.equal(r.companyIndiaTotal,null);assert.equal(r.lifecycleCleanupAllowed,false)
 assert.deepEqual(r.worksiteCountryBindings.map(r=>r.label).sort(),['Dubai','Johannesburg','Mexico City'])
 assert.ok(r.nativeDetails.every(r=>r.nativePayload.jobPostingInfo.jobDescription&&r.nativePayload.jobPostingInfo.startDate))
 assert.equal(calls.filter(r=>r.url.startsWith(TEMENOS_OFFICES)).length,18);assert.equal(calls.filter(r=>r.url===TEMENOS_JOBS).length,8)
 const lastDetail=calls.findLastIndex(r=>r.url.includes('/wday/cxs/')&&r.url.includes('/job/'));assert.ok(calls.findLastIndex(r=>r.url===TEMENOS_JOBS)>lastDetail)
})
test('Temenos missing/ambiguous worksite country cannot certify India zero',async t=>{
 for(const transform of[
  body=>body.replace('United Arab Emirates','India'),
  body=>body.replace('>51</span> Results','>52</span> Results'),
 ])await assert.rejects(exercise(t,{change:rows=>{const r=rows.find(r=>r.url===TEMENOS_OFFICES+'page/2/');const original=r.body;r.body=transform(r.body);assert.notEqual(r.body,original)}}))
})
test('Temenos changed final native role criteria keeps original observations and withdraws configured completion',async t=>{
 const {result:r}=await exercise(t,{before:(rows,calls)=>{const url=calls.at(-1).url;if(url.includes('/wday/cxs/')&&url.endsWith('CPQ-Transformation-Manager_JR2345')&&calls.filter(c=>c.url===url).length===2){const row=rows.find(r=>r.url===url),p=JSON.parse(row.body);p.jobPostingInfo.jobDescription+='<p>A new mandatory public qualification.</p>';row.body=JSON.stringify(p)}}})
 assert.equal(r.nativeDetails.length,22);assert.equal(r.closingStable,false);assert.equal(r.inventoryEvidence.listingComplete,false);assert.equal(r.inventoryEvidence.reportedTotal,null);assert.equal(r.jobs.length,0)
})
test('Temenos directory must be an active declared current employer link',async t=>{
 await assert.rejects(exercise(t,{change:rows=>{const row=rows.find(r=>r.url===TEMENOS_CAREERS);row.body=row.body.replaceAll('https://www.temenos.com/offices/','https://www.temenos.com/not-offices/')}}),/directory|office/i)
})
test('Temenos observer rejection and caller abort of an ignoring observer are bounded',async t=>{
 const rejected=Error('observer failure');await assert.rejects(exercise(t,{options:{onAudit:async()=>{throw rejected}}}),e=>e===rejected)
 const c=new AbortController(),reason={stop:'Temenos observer'};let timer
 try{await assert.rejects(exercise(t,{options:{signal:c.signal,onAudit:()=>{timer=setTimeout(()=>c.abort(reason),10);return new Promise(()=>{})}}}),e=>e===reason)}finally{clearTimeout(timer)}
})
test('Temenos denied public reader retains exact failed URL and completed native response receipts without retrying it',async t=>{
 await assert.rejects(exercise(t,{change:rows=>{rows.find(r=>r.url===TEMENOS_OFFICES+'page/2/').status=403}}),e=>e.status===403&&e.nativeEvidence.requestedUrl===TEMENOS_OFFICES+'page/2/'&&e.nativeEvidence.retainedResponses.length>0)
})
