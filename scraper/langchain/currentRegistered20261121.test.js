import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const originalFetch=globalThis.fetch
// Native public originals are replayed as data; no external request is allowed.
globalThis.fetch=()=>Promise.reject(Error('Network disabled in source-original replay'))
process.on('exit',()=>{globalThis.fetch=originalFetch})
function replay(t,mutate=()=>{}){
 let clock=0;t.mock.method(performance,'now',()=>clock)
 const queue=structuredClone(fixture.responses);mutate(queue)
 const calls=[]
 const fetchImpl=async(url,init)=>{clock+=600;const next=queue.shift();assert.ok(next,'Only captured source HTTP allowed');assert.equal(url,next.requestedUrl);assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');const bytes=Buffer.from(next.bodyBase64,'base64');calls.push(url);const entity=next.stalled?new ReadableStream({pull(){return new Promise(()=>{})}}):bytes;return Object.defineProperty(new Response(entity,{status:next.status,headers:next.headers}),'url',{value:next.url})}
 return {queue,calls,fetchImpl}
}
test('LangChain registered reader consumes its own declared v1 programme and retains all103 complete current native role models',async t=>{
 const r=replay(t),provider=getScraperCatalog().find(p=>p.source==='langchain'),jobs=await createCatalogScraper(provider).run({fetchImpl:r.fetchImpl,now:fixture.observedAt})
 assert.equal(r.queue.length,0);assert.equal(r.calls.length,8)
 assert.equal(jobs.length,0)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.observedVacancyCount,103);assert.equal(audit.wholeNativeRoleModelsClosingReconciled,true)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.nativeOpening.models.length,103)
 for(const model of audit.nativeOpening.models){const raw=model.nativeSourceRecord;assert.equal(raw.applyUrl,'https://jobs.ashbyhq.com/langchain/'+raw.id+'/application');assert.equal(typeof raw.descriptionHtml,'string');assert.equal(typeof raw.descriptionPlain,'string')}
 const emea=audit.nativeOpening.models.find(m=>m.nativeAuthoredLocationRestrictions.some(v=>v.includes('Open to other EMEA locations')));assert.ok(emea);assert.equal(emea.nativeQualification.complete,false);assert.equal(emea.nativeSourceRecord.address.postalAddress.addressCountry,'UK')
})
export {fixture,replay}

const jsonEdit=(responses,index,fn)=>{const r=responses[index],m=JSON.parse(Buffer.from(r.bodyBase64,'base64'));fn(m);r.bodyBase64=Buffer.from(JSON.stringify(m)).toString('base64')}
const feedEdit=(responses,index,fn)=>jsonEdit(responses,index,m=>fn(m.jobs[0],m))
for(const[label,change]of[
 ['native title conflict',r=>feedEdit(r,3,j=>j.title+=' Other')],
 ['native foreign application',r=>feedEdit(r,3,j=>j.applyUrl='https://jobs.ashbyhq.com/other/'+j.id+'/application')],
 ['native unknown authored criteria field',r=>feedEdit(r,3,j=>j.additionalRequirements='A mandatory unreviewed professional licence')],
 ['native employer conflict',r=>feedEdit(r,3,j=>j.employer='Other Employer')],
 ['native explicitly unlisted record',r=>feedEdit(r,3,j=>j.isListed=false)],
 ['native explicit location/country conflict',r=>feedEdit(r,3,j=>{j.address.postalAddress.addressCountry='India';j.location='London, United Kingdom'})]
])test('LangChain '+label+' cannot release qualified cohort',async t=>{const r=replay(t,change);await assert.rejects(run({fetchImpl:r.fetchImpl,now:fixture.observedAt}));assert.ok(r.calls.length<=4)})

test('LangChain complete changed closing criteria retain both native models without reconciliation claim',async t=>{
 const r=replay(t,q=>feedEdit(q,7,j=>{j.descriptionHtml+='<p>A new mandatory professional licence is required.</p>';j.descriptionPlain+='\nA new mandatory professional licence is required.'}))
 await assert.rejects(run({fetchImpl:r.fetchImpl,now:fixture.observedAt}),e=>{
  const a=e.recruitmentObservations;assert.equal(a.wholeNativeRoleModelsClosingReconciled,false);assert.equal(a.nativeOpening.models.length,103);assert.equal(a.nativeClosing.models.length,103)
  assert.notEqual(a.nativeOpening.payload.jobs[0].descriptionHtml,a.nativeClosing.payload.jobs[0].descriptionHtml);return /models changed at closing/.test(e.message)
 })
})
test('LangChain current own authored closure remains a full held native observation',async t=>{
 const r=replay(t,q=>{for(const i of[3,7])feedEdit(q,i,j=>{j.descriptionHtml+='<p>This position is closed.</p>';j.descriptionPlain+='\nThis position is closed.'})})
 const jobs=await run({fetchImpl:r.fetchImpl,now:fixture.observedAt}),m=jobs.nativeCollectionEvidence.nativeOpening.models[0]
 assert.equal(m.nativeQualification.complete,false);assert.equal(m.sourceDetailComplete,false);assert.ok(m.nativeSourceRecord.descriptionHtml.includes('This position is closed.'))
})
for(const reason of[Object.freeze({owner:'exact opaque caller'}),null])test('LangChain exact pre-abort caller '+String(reason),async()=>{const c=new AbortController();c.abort(reason);await assert.rejects(run({signal:c.signal}),e=>e===reason)})
test('LangChain body-only callback cannot admit original native facts',async()=>{await assert.rejects(run({fetchPage:async()=>''}),/original HTTP Response/i)})
test('LangChain caller cancellation during final audit retains exact ownership',async t=>{const c=new AbortController(),reason=Object.freeze({phase:'final audit'}),r=replay(t);await assert.rejects(run({fetchImpl:r.fetchImpl,now:fixture.observedAt,signal:c.signal,onAudit(){c.abort(reason)}}),e=>e===reason)})
test('LangChain a stalled final audit remains bounded by the source deadline',async t=>{
 const r=replay(t);await assert.rejects(run({fetchImpl:r.fetchImpl,now:fixture.observedAt,sourceTimeoutMs:10000,onAudit:()=>new Promise(()=>{})}),e=>e?.name==='TimeoutError')
})

for(const[label,mutate]of[
 ['dormant native v1 programme',text=>{assert.equal(text.split('})();').length,2);return text.replace('})();','});')}],
 ['unconsumed URL builder with a foreign iframe source',text=>{const old='iframe.setAttribute("src", buildIFrameUrl(container));';assert.equal(text.split(old).length,2);return text.replace(old,'iframe.setAttribute("src", "https://jobs.ashbyhq.com/other?embed=js");')}]
])test('LangChain '+label+' cannot establish current own native acquisition',async t=>{const r=replay(t,q=>{const p=q[1],text=Buffer.from(p.bodyBase64,'base64').toString();p.bodyBase64=Buffer.from(mutate(text)).toString('base64')});await assert.rejects(run({fetchImpl:r.fetchImpl,now:fixture.observedAt}));assert.equal(r.calls.length,2)})
test('LangChain duplicate native JSON publication keys remain ambiguous even when the last value is true',async t=>{const r=replay(t,q=>{const p=q[3],text=Buffer.from(p.bodyBase64,'base64').toString(),next=text.replace(/"isListed"\s*:\s*true/,'"isListed":false,"isListed":true');assert.notEqual(next,text);p.bodyBase64=Buffer.from(next).toString('base64')});await assert.rejects(run({fetchImpl:r.fetchImpl,now:fixture.observedAt}),/Duplicate decoded key/);assert.equal(r.calls.length,4)})
test('LangChain failed closing HTTP403 admission retains the full seven-response native prefix before any stalled error-body read',async t=>{const r=replay(t,q=>{q[7].status=403;q[7].stalled=true});await assert.rejects(run({fetchImpl:r.fetchImpl,now:fixture.observedAt}),e=>{const a=e.recruitmentObservations;assert.equal(e.status,403);assert.equal(a.wholeNativeRoleModelsClosingReconciled,false);assert.equal(a.nativeOpening.models.length,103);assert.equal(a.nativeClosing,null);assert.equal(a.rawPublisherResponses.length,7);assert.equal(a.nativeReads.receipts.at(-1).status,403);assert.equal(a.nativeReads.receipts.at(-1).bodyComplete,false);return true});assert.equal(r.calls.length,8)})
