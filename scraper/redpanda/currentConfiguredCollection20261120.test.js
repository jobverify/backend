import test from 'node:test'
import assert from 'node:assert/strict'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import metadata from './catalog.js'
import {fixture,HOME,FEED} from './currentSourceCore20261120.test.js'
import './currentConsumerInvocation20261120.test.js'

const api=await import('./currentConfiguredBoard20261120.js').catch(error=>error.code==='ERR_MODULE_NOT_FOUND'?{}:Promise.reject(error))
async function replay(change,options={}){
 assert.equal(typeof api.runCurrentConfiguredBoard,'function','Current original-Response collector required')
 const counts=new Map(),calls=[],audits=[];let mutations=0
 const jobs=await api.runCurrentConfiguredBoard({now:fixture.observedAt,requestIntervalMs:0,...options,onAudit:async audit=>{audits.push(audit);await options.onAudit?.(audit)},fetchImpl:async(url,init)=>{
  assert.ok([HOME,FEED].includes(url),'Only the actual own page and its connected documented feed may be fetched')
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  const occurrence=counts.get(url)??0;counts.set(url,occurrence+1)
  const original=fixture.responses.filter(row=>row.requestedUrl===url)[occurrence];assert.ok(original,'Only four actual original response occurrences')
  const response={...original,headers:{...original.headers},text:Buffer.from(original.bodyBase64,'base64').toString('utf8')},before=JSON.stringify(response)
  change?.(response,url,occurrence)
  if(JSON.stringify(response)!==before)mutations++
  calls.push({url,occurrence,status:response.status})
  return Object.defineProperties(new Response(response.bytesOverride??Buffer.from(response.text),{status:response.status,headers:response.headers}),{url:{value:response.url},redirected:{value:response.redirected}})
 }})
 if(change)assert.ok(mutations>0,'The actual original response was changed')
 return{jobs,calls,audits,mutations,evidence:readInventoryEvidence(jobs),assessment:assessSoftFailureAcquisition(metadata,jobs)}
}
const feed=change=>(response,url,occurrence)=>{if(url===FEED&&occurrence===1){const value=JSON.parse(response.text);change(value);response.text=JSON.stringify(value)}}
const closing=(url,change)=>(response,current,occurrence)=>{if(current===url&&occurrence===1)change(response)}
test('Redpanda default collector retains all12foreign roles in both observations and qualifies only configured India projection',async()=>{const result=await replay();assert.equal(result.jobs.length,0);assert.equal(result.calls.length,4);assert.deepEqual(result.calls.map(row=>row.url),[HOME,FEED,HOME,FEED]);assert.equal(result.audits.length,1);assert.deepEqual(result.audits[0].observations.map(row=>row.rows.length),[12,12]);assert.equal(result.audits[0].originalResponses.length,4);assert.equal(result.audits[0].companyIndiaTotal,null);assert.equal(result.audits[0].sourceScopeComplete,false);assert.equal(result.audits[0].nativeProgramsExecuted,false);assert.equal(result.evidence.status,'complete-inventory');assert.equal(result.evidence.listingComplete,true);assert.equal(result.evidence.reportedTotal,null);assert.equal(result.evidence.indiaFacetCount,null);assert.equal(result.assessment.runnerOutcome.success,true);assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.assessment.cleanupOptions.replaceExisting,false)})
for(const status of[202,401,402,403,406,407,429,451])test('Redpanda default collector stops at actual origin denial '+status,async()=>{await assert.rejects(replay((response,url,occurrence)=>{if(url===HOME&&occurrence===0)response.status=status}),error=>error.nativeUnavailable===true&&error.status===status)})
for(const status of[500,502,503])test('Redpanda default collector does not turn critical feed HTTP'+status+' into zero',async()=>{await assert.rejects(replay((response,url,occurrence)=>{if(url===FEED&&occurrence===0)response.status=status}),error=>error.nativeUnavailable===true&&error.status===status)})
for(const[label,change]of[
 ['empty claimed feed',value=>{value.jobs=[]}],
 ['feed error envelope',value=>{value.error='unavailable'}],
 ['unknown extra pagination',value=>{value.nextCursor='next'}],
 ['missing native jobs',value=>{delete value.jobs}],
 ['closing role removal',value=>{value.jobs.pop()}],
 ['duplicate current native role',value=>{value.jobs.push(structuredClone(value.jobs[0]))}],
 ['India primary workplace',value=>{value.jobs[0].address.postalAddress.addressCountry='India'}],
 ['missing typed primary country',value=>{delete value.jobs[0].address.postalAddress.addressCountry}],
 ['India secondary workplace',value=>{value.jobs[0].secondaryLocations.push({location:'Bengaluru, India',address:{postalAddress:{addressCountry:'India'}}})}],
 ['known employer replacement',value=>{value.jobs[0].employer='Other Employer'}],
 ['publication withdrawal',value=>{value.jobs[0].isPublished=false}],
 ['known closed publication',value=>{value.jobs[0].postingStatus='withdrawn'}],
 ['native application mismatch',value=>{value.jobs[0].applyUrl='https://other.example/apply'}],
 ['expired current deadline',value=>{value.jobs[0].validThrough='2026-10-01'}],
 ['future original posting',value=>{value.jobs[0].publishedAt='2027-01-01T00:00:00.000Z'}],
 ['same-role semantic employer conflict',value=>{value.jobs[0].descriptionHtml+='<section><div>Employer</div><div>Other Employer</div></section>'}]
])test('Redpanda default collector holds '+label,async()=>assert.rejects(replay(feed(change)),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error'))
for(const[label,url,change]of[
 ['complete200invalidJSON',FEED,response=>{response.text='{"jobs":'}],
 ['complete200duplicateJSONkey',FEED,response=>{response.text=response.text.replace('"apiVersion":','"apiVersion":"0","apiVersion":')}],
 ['complete200invalidUTF8',FEED,response=>{response.bytesOverride=Buffer.from([255,254,255])}],
 ['complete200wrongMIME',FEED,response=>{response.headers['content-type']='text/html'}],
 ['complete200wrongResponseURL',FEED,response=>{response.url='https://other.example/jobs'}],
 ['complete200redirectedResponse',FEED,response=>{response.redirected=true}],
 ['complete200brokenownprogramme',HOME,response=>{response.text=response.text.replace("var ASHBY_BOARD = 'redpanda-data';",'var ASHBY_BOARD = ;')}]
])test('Redpanda default collector classifies '+label+' as parser/contract failure',async()=>assert.rejects(replay(closing(url,change)),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error'))
for(const field of['maxJobs','maxPages'])test('Redpanda default collector zero '+field+' cap remains coverage-gap without requests',async()=>{const result=await replay(undefined,{[field]:0});assert.equal(result.calls.length,0);assert.equal(result.assessment.runnerOutcome.success,false);assert.notEqual(result.assessment.zeroJobEvidence,'fetched-zero')})
for(const[field,value]of[['maxJobs',-1],['maxPages',-1],['maxJobs',1.5],['maxPages','1']])test('Redpanda default collector rejects invalid '+field+' cap '+value,async()=>assert.rejects(replay(undefined,{[field]:value}),error=>error.nativeContradiction===true))
test('Redpanda default collector caller cancellation stops before original requests',async()=>{const controller=new AbortController(),reason=Error('intentional cancellation');controller.abort(reason);await assert.rejects(replay(undefined,{signal:controller.signal}),error=>error===reason)})
test('Redpanda default collector awaited audit failure cannot return configured zero',async()=>assert.rejects(replay(undefined,{onAudit:async()=>{throw Error('intentional observer failure')}}),error=>/intentional observer failure/.test(error.message)))
export{replay,feed,closing}
