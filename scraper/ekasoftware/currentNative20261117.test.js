import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {setTimeout as delay} from 'node:timers/promises'
import {run} from './script.js'
import {runCurrentEka} from './currentNative20261117.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
const changeText=(p,fn)=>({...p,bodyBase64:Buffer.from(fn(Buffer.from(p.bodyBase64,'base64').toString())).toString('base64')})
const changeJSON=(p,fn)=>changeText(p,s=>{const j=JSON.parse(s);fn(j);return JSON.stringify(j)})
const key=url=>{const u=new URL(url);if(u.origin==='https://assets1.freshteam.com'&&u.pathname==='/assets/job_widget.js'){assert.equal(u.searchParams.size,1);assert.match(u.searchParams.get('t'),/^\d{13}$/);u.searchParams.set('t','fixture-clock')}return u.href}
function replay(change=p=>p){const calls=[],counts=new Map();return {calls,requestIntervalMs:0,fetchImpl:async(url,init)=>{
 assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
 const k=key(url),rows=fixture.originals.filter(p=>key(p.requestedURL)===k),n=counts.get(k)??0;assert.ok(n<rows.length,'No guessed query/path/extra native request: '+url);counts.set(k,n+1);const p=change(structuredClone(rows[n]));calls.push(p)
 return Object.defineProperty(new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers}),'url',{value:p.finalURL===rows[n].requestedURL?String(url):p.finalURL})
}}}
test('registered Eka source retains15 current Quoreka native vacancy observations with8 explicit native IN branches but no Eka/legal employer promotion',async()=>{
 const io=replay(),provider=getScraperCatalog().find(p=>p.source==='ekasoftware'),jobs=await createCatalogScraper(provider).run(io),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(io.calls.length,56);assert.equal(audit.observations.length,15);assert.equal(audit.explicitNativeIndiaBranchRows,8);assert.equal(audit.wholeRawNativeModelsClosingReconciled,true);assert.equal(audit.companyScopeComplete,false)
 assert.deepEqual(readSourceObservationEvidence(jobs,'ekasoftware'),{source:'ekasoftware',recordKind:'vacancy-rows',observedRecordCount:15,observedVacancyCount:15,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 for(const o of audit.observations){assert.equal(o.company,'Quoreka');assert.equal(o.sourceTargetCompany,'Eka Software');assert.equal(o.sourceEmployerQualified,false);assert.equal(o.country,null);assert.equal(o.sourceDetailComplete,false);assert.equal(o.nativeListModel.id,o.nativeOwnRoleModel.job.id);assert.ok(o.nativePublishedDescriptionHTML.length>300);assert.equal(o.lifecycleCleanupAllowed,false);assert.ok(o.qualificationHolds.includes('per-role-Eka-legal-employer-unqualified;Quoreka-brand-and-policy-reference-not-employment-proof'))}
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 const assessment=assessSoftFailureAcquisition(provider,jobs);assert.equal(assessment.runnerOutcome.rawRecords,15);assert.equal(assessment.eligibleJobs,0);assert.equal(assessment.cleanupOptions.replaceExisting,false)
})
test('dynamic native role data flows through current typed contract without freezing titles or15 IDs',async()=>{
 const io=replay(p=>p.requestedURL.startsWith('https://careers.quoreka.com/hire/widgets/jobs')&&p.headers['content-type']?.includes('json')?changeJSON(p,d=>{if(d.jobs)d.jobs.forEach(j=>{j.title+=' current'});if(d.job)d.job.title+=' current'}):p),jobs=await run(io)
 assert.ok(jobs.nativeCollectionEvidence.observations.every(o=>o.title.endsWith(' current')));assert.equal(jobs.length,0)
})
test('an explicitly deleted native job remains observed but is excluded from current vacancy and India-branch counts',async()=>{
 const id=4000064934,io=replay(p=>p.requestedURL==='https://careers.quoreka.com/hire/widgets/jobs.json'?changeJSON(p,d=>{d.jobs.find(j=>j.id===id).deleted=true}):p.requestedURL===`https://careers.quoreka.com/hire/widgets/jobs/${id}.json`?changeJSON(p,d=>{d.job.deleted=true}):p),jobs=await run(io),a=jobs.nativeCollectionEvidence
 assert.equal(a.observedRecordCount,15);assert.equal(a.recordKind,'mixed');assert.equal(a.observedVacancyCount,14);assert.equal(a.explicitNativeIndiaBranchRows,7);assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'ekasoftware').observedVacancyCount,14)
})
for(const [name,change,pattern]of [
 ['missing native widget authority',p=>p.requestedURL==='https://quoreka.com/careers'?changeText(p,s=>s.replaceAll('files.freshteam.com/','files.foreign.example/')):p,/widget/],
 ['foreign native tenant in loader',p=>p.requestedURL.includes('files.freshteam.com/')?changeText(p,s=>s.replace('careers.quoreka.com','foreign.example')):p,/loader/],
 ['unreviewed loader MIME',p=>p.requestedURL.includes('files.freshteam.com/')?{...p,headers:{...p.headers,'content-type':'application/javascript'}}:p,/MIME/],
 ['whole client program changed',p=>p.requestedURL.includes('/assets/job_widget.js?')?changeText(p,s=>s+'\n/*changed*/'):p,/program/],
 ['whole client stylesheet changed',p=>p.requestedURL.endsWith('/assets/job_widget.css')?changeText(p,s=>s+'\n/*changed*/'):p,/program/],
 ['native duplicate job identity',p=>p.phase==='opening-native'&&p.requestedURL.endsWith('/hire/widgets/jobs.json')?changeJSON(p,d=>d.jobs[1]=d.jobs[0]):p,/duplicate|identity/],
 ['wrong native branch account binding',p=>p.requestedURL.endsWith('/hire/widgets/jobs.json')?changeJSON(p,d=>d.branches[0].account_id++):p,/account/],
 ['foreign native role URL',p=>p.requestedURL.endsWith('/hire/widgets/jobs.json')?changeJSON(p,d=>d.jobs[0].url=d.jobs[0].url.replace('quoreka.com','foreign.example')):p,/role URL/],
 ['own role/form response ID mismatch',p=>p.phase==='opening-details'?changeJSON(p,d=>d.job.id++):p,/own-role/],
 ['own role description differs from its listing',p=>p.phase==='opening-details'?changeJSON(p,d=>d.job.description+='changed'):p,/own-role/],
 ['closing ordered native rows change',p=>p.phase==='closing-native'&&p.requestedURL.endsWith('/hire/widgets/jobs.json')?changeJSON(p,d=>d.jobs.reverse()):p,/closing/],
 ['closing actual applicant field constraint changes',p=>p.phase==='closing-details'?changeJSON(p,d=>d.applicant_form_fields[0].required_in_external_form=!d.applicant_form_fields[0].required_in_external_form):p,/closing/],
 ['closing custom field/unknown native DTO changes',p=>p.phase==='closing-native'&&p.requestedURL.endsWith('/hire/widgets/jobs.json')?changeJSON(p,d=>d.jobs[0].custom_field_attributes={changed:'criteria'}):p,/closing/],
])test(name,async()=>{await assert.rejects(run(replay(change)),pattern)})
test('zero output cap preserves unknown inventory without fabricated observations',async()=>{const jobs=await run({maxJobs:0,fetchImpl:async()=>assert.fail('no request')});assert.equal(readSourceObservationEvidence(jobs,'ekasoftware'),null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)})
test('body-only callbacks cannot certify the new declared native authority',async()=>{await assert.rejects(runCurrentEka({fetchPage:async()=>({status:200,html:'India'})}),/original HTTP metadata|body-only/i)})
test('opaque preaborted caller object survives without network',async()=>{const c=new AbortController(),r=Object.freeze({owner:'eka'});c.abort(r);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>assert.fail('no request')}),e=>e===r)})
for(const status of [403,429,202])test('observed '+status+' survives stalled denied body and local deadline',async()=>{await assert.rejects(run({requestIntervalMs:0,requestTimeoutMs:20,fetchImpl:async url=>({status,url,headers:new Headers({'content-type':'text/html',...(status===202?{'x-amzn-waf-action':'challenge'}:{})}),body:{cancel:()=>new Promise(()=>{}),getReader:()=>assert.fail('no error body')}})}),e=>(e.status??e.httpStatus)===status)})
for(const mode of ['caller','source-deadline'])test('paced native reads preserve '+mode+' and stop before next fetch',async()=>{const io=replay(),c=new AbortController(),r=Object.freeze({owner:'eka-pacing'});let timer;if(mode==='caller')timer=setTimeout(()=>c.abort(r),100);try{await assert.rejects(run({...io,requestIntervalMs:500,sourceTimeoutMs:mode==='caller'?2000:100,signal:c.signal}),e=>mode==='caller'?e===r:e.name==='TimeoutError');assert.equal(io.calls.length,1)}finally{clearTimeout(timer)}})
test('opaque in-flight caller abort disposes body and remains exact',async()=>{const c=new AbortController(),r=Object.freeze({owner:'eka-body'});let cancels=0;const pending=run({signal:c.signal,requestIntervalMs:0,fetchImpl:async url=>({status:200,url,headers:new Headers({'content-type':'text/html'}),body:new ReadableStream({pull(){},cancel(){cancels++}})})});await delay(20);c.abort(r);await assert.rejects(pending,e=>e===r);await delay(1);assert.equal(cancels,1)})
