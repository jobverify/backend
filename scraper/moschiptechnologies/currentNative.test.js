import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const TENANT='https://moschip.keka.com/careers/',TOKEN='5a91f0e1-2508-41a4-bfbc-849b6299d25e',ACTIVE=TENANT+'api/embedjobs/default/active/'+TOKEN,INFO=TENANT+'api/organization/default/careerportalinfo',EMBED=TENANT+'api/embedjobs/js/'+TOKEN
const fixtures=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
function replay(change=()=>{}){
 const originals=fixtures(),calls=[],seen=new Map()
 return{calls,fetchImpl:async(url,init)=>{
  assert.equal(init.method??'GET','GET');const o=originals.find(row=>row.requestedUrl===url||row.requestedURL===url);assert.ok(o,'Unbound URL '+url)
  const nth=(seen.get(url)||0)+1;seen.set(url,nth);calls.push(url)
  const r={...structuredClone(o),body:Buffer.from(o.bodyBase64,'base64').toString()};change(r,url,nth)
  const response=new Response(r.body,{status:r.status,headers:r.headers});Object.defineProperty(response,'url',{value:r.url});return response
 }}
}
test('current employer-declared Keka cohort reconciles whole native records, criteria and application models',async t=>{
 const transport=replay();t.mock.method(globalThis,'fetch',transport.fetchImpl)
 const jobs=await run({fetchImpl:transport.fetchImpl,now:'2026-11-16T21:00:00Z'})
 assert.equal(jobs.length,22);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const e=jobs.nativeCollectionEvidence;assert.equal(e.observations.length,32);assert.equal(e.wholeObservedNativeBoardClosingReconciled,true)
 assert.equal(readSourceObservationEvidence(jobs,'moschiptechnologies').observedVacancyCount,32)
 assert.equal(e.unknownCountryVacancies,6);assert.equal(e.explicitNonIndiaVacancies,4);assert.equal(e.companyIndiaZeroProven,false)
 assert.equal(e.companyGlobalTotal,null);assert.equal(e.companyIndiaTotal,null);assert.equal(e.originalResponses.length,170)
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.match(job.applyUrl,/\/careers\/applyjob\/\d+$/);assert.ok(job.jobDescription.includes('Relevant Experience'));assert.equal(Object.hasOwn(job,'salary'),false);assert.equal(job.sourceNativeApplicationFields.length,23)}
 const first=jobs.find(row=>row.requisitionId==='93800');assert.equal(first.postingDate,'2026-10-27T07:31:49.75Z');assert.match(first.jobDescription,/3-5 years of experience/i)
 assert.ok(transport.calls.every(url=>!url.includes('upload')&&!url.includes('candidate/create')))
})
test('native cohort parser is dynamic and preserves full unknown fields without freezing current role IDs',async()=>{
 const {parseNativeInventory}=await import('./currentNative20261117.js'),actual=JSON.parse(Buffer.from(fixtures().find(r=>r.requestedUrl===ACTIVE).bodyBase64,'base64'))
 assert.equal(parseNativeInventory(JSON.stringify(actual.slice(1))).length,31)
 const record={...actual[0],id:123456789,newMandatoryCondition:'Full additional native criterion'}
 assert.equal(parseNativeInventory(JSON.stringify([record]))[0].newMandatoryCondition,'Full additional native criterion')
})
test('a numeric experience value retains its explicit native Years label and rejects a different unit',async()=>{
 const {readCurrentMoschipRoleModel}=await import('./currentNative20261117.js'),originals=fixtures(),rows=JSON.parse(Buffer.from(originals.find(r=>r.requestedUrl===ACTIVE).bodyBase64,'base64')),row=rows.find(r=>r.id===76627),html=Buffer.from(originals.find(r=>r.requestedUrl===TENANT+'jobdetails/76627').bodyBase64,'base64').toString()
 assert.equal(row.experience,'10');assert.equal(readCurrentMoschipRoleModel(html,row).nativeExperienceLabel,'10 Years')
 assert.throws(()=>readCurrentMoschipRoleModel(html.replace('>10 Years<','>10 Months<'),row),/experience.*disagree|experience.*unit|banner.*disagree/i)
})
test('changed tenant employer identity or critical embed cannot bind an unrelated inventory',async()=>{
 for(const target of [INFO,EMBED]){
  const {fetchImpl}=replay((r,url)=>{if(url===target)r.body=target===INFO?r.body.replaceAll('MosChip Technologies Limited','Other Employer'):r.body+'/* changed */'})
  await assert.rejects(run({fetchImpl}),/employer|reviewed.*(embed|client)|authority/i)
 }
})
test('own rendered full criteria must agree with the actual native record',async()=>{
 const {fetchImpl}=replay((r,url)=>{if(url===TENANT+'jobdetails/93800')r.body=r.body.replace('3-5 years of experience','15 years of experience')})
 await assert.rejects(run({fetchImpl}),/full.*criteria|whole.*criteria|description.*disagree/i)
})
test('a conflicting native country cannot be silently converted to India',async()=>{
 const {fetchImpl}=replay((r,url)=>{if(url===ACTIVE){const rows=JSON.parse(r.body);rows[0].jobLocations[0].countryCode='US';r.body=JSON.stringify(rows)}})
 await assert.rejects(run({fetchImpl}),/country.*(conflict|disagree)|conflicting.*country/i)
})
test('closing application models compare every field, including a newly added eligibility carrier',async()=>{
 const {fetchImpl}=replay((r,url,nth)=>{if(url===TENANT+'93800/2/applicationform'&&nth===2){const fields=JSON.parse(r.body);fields[fields.length-1].newMandatoryEligibility='New citizenship restriction';r.body=JSON.stringify(fields)}})
 await assert.rejects(run({fetchImpl}),/opening.*closing.*(application|criteria)/i)
})
test('body-only historical missing-route pages cannot establish current native inventory',async()=>{
 await assert.rejects(run({fetchPage:async()=>({status:200,url:'https://moschip.com/careers/',html:'MosChip'})}),/original.*metadata|body-only/i)
})
test('caller pre-cancellation takes priority over metadata callbacks without starting a read',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,label:'MosChip caller stopped'});controller.abort(reason);let reads=0
 await assert.rejects(run({signal:controller.signal,fetchPage:async()=>{reads++}}),error=>error===reason);assert.equal(reads,0)
})
test('an ordinary frozen transport error retains its exact identity',async()=>{
 const reason=Object.freeze(Error('MosChip frozen native transport error'))
 await assert.rejects(run({fetchImpl:async()=>{throw reason}}),error=>error===reason)
})
test('a controlled current native cohort exposes publisher application labels while retaining full untranslated field models',async()=>{
 // Only the cohort length is controlled; the current employer, role, application,
 // and all 23 field originals remain unmodified. This does not claim live scope.
 const {fetchImpl}=replay((r,url)=>{if(url===ACTIVE)r.body=JSON.stringify(JSON.parse(r.body).filter(row=>row.id===93800))})
 const jobs=await run({fetchImpl,now:'2026-11-16T21:00:00Z'});assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceNativeApplicationFields.length,23)
 assert.ok(jobs[0].jobDescription.includes('Publisher application field labels and options (visibility and requiredness unverified):'))
 const originalFields=JSON.parse(Buffer.from(fixtures().find(row=>row.requestedUrl===TENANT+'93800/2/applicationform').bodyBase64,'base64'))
 assert.deepEqual(jobs[0].sourceNativeApplicationFields,originalFields)
 for(const field of jobs[0].sourceNativeApplicationFields){
  assert.ok(jobs[0].jobDescription.includes(field.fieldName))
  for(const option of field.fieldOptions)assert.ok(jobs[0].jobDescription.includes(option.value))
 }
 assert.doesNotMatch(jobs[0].jobDescription,/"(?:identifier|fieldType|requirementType|isVisible|sequenceNumber)"\s*:/)
 assert.equal(jobs[0].sourceNativeApplicationCriteriaVerified,false)
 assert.equal(jobs[0].nativeApplicationFieldModelRetained,true)
 assert.equal(jobs[0].publicApplicationEligibilityQualified,false)
 assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const mode of ['fulfilled','rejected'])test('frozen opaque caller cancellation survives original native header read '+mode,async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,label:'moschiptechnologies '+mode});let reads=0
 const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
 await assert.rejects(run({signal:controller.signal,fetchImpl:async(url,init)=>{
  reads++;controller.abort(reason);assert.equal(init.signal.aborted,true)
  if(mode==='rejected')throw Object.freeze(Error('Replacement transport error'))
  const row=originals.find(r=>(r.requestedUrl??r.requestedURL)===url);assert.ok(row,'Unbound original '+url)
  const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
 }}),error=>error===reason)
 assert.equal(reads,1)
})
