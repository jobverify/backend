import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createAdda247Scraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
globalThis.fetch=async()=>{throw Error('Offline regression cannot access network')}

const captures=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-public-20261103.json.gz',import.meta.url))))
const active='https://adda247.keka.com/careers/api/jobs/default/active'
const original=url=>captures.find(row=>row.url===url)
const nativeRows=()=>JSON.parse(original(active).body)
const run=async(mutate=()=>{},options={})=>{
 const requested=[],counts=new Map();let audit
 const jobs=await createAdda247Scraper().run({fetchText:async()=>{throw Error('Obsolete unbound transport path')},now:()=> '2026-11-03T04:20:00.000Z',requestIntervalMs:0,fetchPage:async(url,request)=>{
  assert.equal(request.method,'GET');assert.equal(request.body,undefined);assert.doesNotMatch(url,/www\.adda247|applyjob|applicationform|candidate|captcha/i)
  const count=(counts.get(url)||0)+1;counts.set(url,count);requested.push(url)
  const row=original(url);assert.ok(row,'undeclared URL '+url)
  const response={status:row.status,url:row.finalURL,headers:row.headers,html:row.body}
  await mutate(response,url,count,requested)
  return response
 },onAudit:value=>{audit=value},...options})
 return{jobs,audit,requested,counts}
}

test('configured Adda247 native board retains14 original rows and11 complete public JDs without a corporate read',async()=>{
 const {jobs,audit,counts}=await run()
 assert.equal(jobs.length,11);assert.equal(audit.observedListingCount,14)
 assert.deepEqual(audit.failures.map(row=>row.id).sort(),['123500','128723','128825'])
 assert.ok(audit.failures.every(row=>row.stage==='native-detail'&&row.kind==='missing-public-description'))
 assert.equal(counts.get(active),3,'final inventory follows both full detail passes')
 assert.equal(audit.corporateHandoffVerified,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readSourceObservationEvidence(jobs,'adda247').observedVacancyCount,14)
 assert.equal(extractionDetailHealth(jobs).complete,false)
 assert.equal(extractionDetailHealth(jobs).nativeCollections[0].unextractedDetailFailures,3)
})
test('Adda binds the role title outside nested JD headings and preserves short actual content, dates and every workplace field',async()=>{
 const {jobs}=await run(),byId=new Map(jobs.map(row=>[row.jobId,row])),raw=nativeRows()
 for(const id of ['143333','140890','134668'])assert.ok(byId.has(id),'nested JD H1 is not the role title '+id)
 const short=byId.get('120977');assert.equal(short.sourceDescription,raw.find(row=>row.id===120977).description)
 assert.match(short.sourceDescription,/Content Developer for GS/);assert.equal(short.postingDate,'2026-05-29T07:33:28.3Z')
 assert.deepEqual(byId.get('143087').nativeCountryEvidence,raw.find(row=>row.id===143087).jobLocations)
 assert.equal(byId.get('143087').nativeCountryEvidence[0].locationIdentifier,'e740b814-5f13-4f83-8848-0f02cd99c689')
 assert.deepEqual(byId.get('133120').nativeCountryEvidence,raw.find(row=>row.id===133120).jobLocations)
 assert.equal(byId.get('143333').city,'Haryana','publisher value is retained, not silently geocorrected')
 assert.equal(short.requisitionId,null);assert.equal(short.nativeRow.jobNumber,'RRF0000002930')
})
test('empty native description never falls back to a summary and cannot leak into returned jobs',async()=>{
 const {jobs,audit}=await run((response,url)=>{if(url===active){const rows=JSON.parse(response.html);rows.find(row=>row.id===128825).excerpt='A tempting summary';response.html=JSON.stringify(rows)}})
 assert.equal(jobs.some(row=>row.jobId==='128825'),false)
 assert.equal(audit.originalNativeRows.find(row=>row.id===128825).excerpt,'A tempting summary')
 assert.ok(jobs.every(row=>/[\p{L}\p{N}]/u.test(row.sourceDescription)))
})
test('exact native authoring placeholders are held rather than exposed as complete public criteria',async()=>{
 const placeholder='Please enter job description'
 const {jobs,audit}=await run((response,url)=>{if(url===active){const rows=JSON.parse(response.html);rows.find(row=>row.id===120977).description='<div>'+placeholder+'</div>';response.html=JSON.stringify(rows)}else if(url.endsWith('/120977')){const doc=document(response.html),node=doc.nodes(node=>doc.hasClass(node,'job-description-container'))[0];response.html=response.html.slice(0,node.openEnd)+'<div>'+placeholder+'</div>'+response.html.slice(node.closeStart)}})
 assert.equal(jobs.some(row=>row.jobId==='120977'),false)
 assert.ok(audit.failures.some(row=>row.id==='120977'&&row.kind==='missing-public-description'))
 assert.equal(audit.originalNativeRows.find(row=>row.id===120977).description,'<div>'+placeholder+'</div>')
})
test('mismatched own detail title holds only that role while healthy peers survive',async()=>{
 const {jobs,audit}=await run((response,url)=>{if(url.endsWith('/143333'))response.html=response.html.replace('>Executive-Telesales</h1>','>Wrong role</h1>')})
 assert.equal(jobs.length,10);assert.equal(jobs.some(row=>row.jobId==='143333'),false)
 assert.ok(audit.failures.some(row=>row.id==='143333'&&row.kind==='public-role-identity'))
})
test('job-owned public skills and client role-title bindings must agree with the native role',async()=>{
 for(const mutate of [html=>html.replace('selectedJobTitle="Executive-Telesales"','selectedJobTitle="Another job"'),html=>html.replace('>communication </span>','>Security clearance</span>')]){
  const {jobs,audit}=await run((response,url)=>{if(url.endsWith('/143333'))response.html=mutate(response.html)})
  assert.equal(jobs.some(row=>row.jobId==='143333'),false);assert.equal(jobs.length,10)
  assert.ok(audit.failures.some(row=>row.id==='143333'))
 }
})
for(const country of [null,'United States'])test('unknown/conflicting workplace alternative is held without losing native location data: '+country,async()=>{
 const {jobs,audit}=await run((response,url)=>{if(url===active){const rows=JSON.parse(response.html);rows[0].jobLocations.push({id:99991,name:'Remote',countryCode:country?'US':null,countryName:country});response.html=JSON.stringify(rows)}})
 assert.equal(jobs.some(row=>row.jobId==='143333'),false)
 assert.equal(audit.originalNativeRows[0].jobLocations.length,2)
 assert.ok(audit.failures.some(row=>row.id==='143333'&&row.kind==='unresolved-native-country'))
})
test('final listing runs after closing details and holds a role removed during those details',async()=>{
 let closingDetails=false
 const {jobs,requested}=await run((response,url,count)=>{
  if(url.endsWith('/jobdetails/115811')&&count===2)closingDetails=true
  if(url===active&&count===3){assert.equal(closingDetails,true);response.html=JSON.stringify(JSON.parse(response.html).filter(row=>row.id!==143333))}
 })
 assert.equal(requested.at(-1),active);assert.equal(jobs.some(row=>row.jobId==='143333'),false);assert.equal(jobs.length,10)
})
test('maxJobs0 is unbounded and a positive cap never truncates native verification',async()=>{
 assert.equal((await run(()=>{},{maxJobs:0})).jobs.length,11)
 const {jobs,counts,audit}=await run(()=>{},{maxJobs:2});assert.equal(jobs.length,2);assert.equal(counts.get(active),3)
 assert.equal(audit.observedListingCount,14);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('hidden or extra public criteria are not accepted as a complete role',async()=>{
 for(const mutate of [html=>html.replace('class="job-description-container "','hidden class="job-description-container "'),html=>html.replace('class="job-description-container "','style="clip-path:inset(100%)" class="job-description-container "'),html=>html.replace('</header>','</header><p>Required qualifications: secret clearance</p>')]){
  const {jobs}=await run((response,url)=>{if(url.endsWith('/143333'))response.html=mutate(response.html)})
  assert.equal(jobs.some(row=>row.jobId==='143333'),false)
 }
})
test('unrelated private client text is not a public-JD prerequisite; changed public listing program is rejected',async()=>{
 const {jobs}=await run((response,url)=>{if(url.includes('/scripts/app/'))response.html=response.html.replace('isemailunique','private-component-changed')});assert.equal(jobs.length,11)
 await assert.rejects(run((response,url)=>{if(url.includes('/scripts/app/'))response.html=response.html.replace('function loadData(){','function loadData(){throw 1;')}),/public listing client/i)
})
test('native tenant/group/inventory contract changes cannot become a verified empty board',async()=>{
 for(const mutate of [(response,url)=>{if(url.includes('careerportalinfo'))response.html=response.html.replace('"name":"Adda247"','"name":"Other employer"')},(response,url)=>{if(url.includes('grouplinkstatus'))response.html='{"isGroupLinked":true}'},(response,url)=>{if(url===active)response.html='{"jobs":[]}' }])await assert.rejects(run(mutate))
 const {jobs}=await run((response,url)=>{if(url===active)response.html='[]'});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
