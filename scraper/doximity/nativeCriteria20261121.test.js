import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import http from 'node:http'
import https from 'node:https'
import {syncBuiltinESMExports} from 'node:module'
import test,{after} from 'node:test'
const sha=value=>createHash('sha256').update(value).digest('hex')
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-label-originals-20261119.json.gz',import.meta.url))))
const rows=fixture.responses
assert.equal(rows.length,58)
for(const row of rows){const body=Buffer.from(row.bodyBase64,'base64');assert.equal(body.length,row.bytes);assert.equal(sha(body),row.sha256)}
const ID='8337921',APIROLE='https://boards-api.greenhouse.io/v1/boards/doximity/jobs/'+ID+'?pay_transparency=true'
const APILIST='https://boards-api.greenhouse.io/v1/boards/doximity/jobs?content=true',HOSTED='https://job-boards.greenhouse.io/doximity/jobs/'+ID
const PRIMARY='Remote, U.S. (New York or New Jersey Strongly Preferred)'
function apiTarget(row,html,change){
 if(row.url!==APIROLE&&row.url!==APILIST)return html;
 const model=JSON.parse(html),target=row.url===APIROLE?model:model.jobs.find(job=>String(job.id)===ID);
 assert(target&&String(target.id)===ID,'Reviewer target native API model missing');
 change(target);return JSON.stringify(model);
}
const PEER_CONTROL={name:'full-selected-Location-criterion-India-vs-US-primary',kind:'negative',expected:'unresolved',mutate:(row,html)=>{if(row.url===HOSTED){assert(html.includes('Location: Remote U.S. ('));return html.replaceAll('Location: Remote U.S. (','Location: Remote, India (');}return apiTarget(row,html,target=>{assert(target.content.includes('Location: Remote U.S. ('));target.content=target.content.replaceAll('Location: Remote U.S. (','Location: Remote, India (');});}}
const BASELINE={name:'genuine-retained-58-response-public-factory-baseline',kind:'baseline',expected:'qualified-US',mutate:(_row,html)=>html}
const compact=row=>row?{
 jobId:row.jobId,internalJobId:row.internalJobId,requisitionId:row.requisitionId,title:row.title,country:row.country,city:row.city,state:row.state,
 sourceCountryScopeUnresolved:row.sourceCountryScopeUnresolved,sourceNativeCountryConflict:row.sourceNativeCountryConflict,sourceCurrentNativeRoleQualified:row.sourceCurrentNativeRoleQualified,sourceCurrentNativePostingIdentityQualified:row.sourceCurrentNativePostingIdentityQualified,sourceNativeTemporalQualified:row.sourceNativeTemporalQualified,
 rawPrimary:row.sourceNativePrimaryLocation,rawAPIPrimary:row.sourceNativeRecord?.location,rawPublishedPrimary:row.sourceNativePublishedModel?.job_post_location,rawClosingPublishedPrimary:row.sourceNativePublishedClosingModel?.job_post_location,
 primaryLabelEvidence:row.sourceNativePrimaryLabelEvidence??null,nativeCountryEvidence:row.sourceNativeCountryEvidence,nativeCountries:row.sourceNativeCountries,
 sourcePostingDate:row.sourcePostingDate,postingDate:row.postingDate,rawAPIFirstPublished:row.sourceNativeRecord?.first_published,rawHostedPublishedAt:row.sourceNativePublishedModel?.published_at,currentPublishedAt:row.sourceNativeCurrentPublishedAt,
 ownDescriptionLocationLine:row.sourceNativeOwnDescription?.match(/Location:[^.]{0,180}/g)??null,
 sourceScopeComplete:row.sourceScopeComplete,lifecycleCleanupAllowed:row.lifecycleCleanupAllowed,activeApplyVerified:row.activeApplyVerified,applicationVisited:row.applicationVisited,
}:null;
const EXPECTED_OTHERS=[{"jobId":"8262005","country":"United States","unknown":false,"conflict":false,"currentNativeRoleQualified":true},{"jobId":"8222144","country":"United States","unknown":false,"conflict":false,"currentNativeRoleQualified":true},{"jobId":"8155070","country":"United States","unknown":false,"conflict":false,"currentNativeRoleQualified":true},{"jobId":"8222141","country":"United States","unknown":false,"conflict":false,"currentNativeRoleQualified":true},{"jobId":"8379024","country":"United States","unknown":false,"conflict":false,"currentNativeRoleQualified":true},{"jobId":"8159875","country":"United States","unknown":false,"conflict":false,"currentNativeRoleQualified":true},{"jobId":"8311167","country":"United States","unknown":false,"conflict":false,"currentNativeRoleQualified":true},{"jobId":"8126522","country":"United States","unknown":false,"conflict":false,"currentNativeRoleQualified":true},{"jobId":"8331642","country":"United States","unknown":false,"conflict":false,"currentNativeRoleQualified":true},{"jobId":"8372697","country":"United States","unknown":false,"conflict":false,"currentNativeRoleQualified":true}]
let networkCalls=0
const saved={f:globalThis.fetch,hr:http.request,hg:http.get,sr:https.request,sg:https.get}
const blocked=()=>{networkCalls++;throw Error('Doximity original-criteria regression network fence')}
globalThis.fetch=blocked;http.request=http.get=https.request=https.get=blocked;syncBuiltinESMExports()
after(()=>{globalThis.fetch=saved.f;http.request=saved.hr;http.get=saved.hg;https.request=saved.sr;https.get=saved.sg;syncBuiltinESMExports();assert.equal(networkCalls,0)})
async function runCase(control){
 const queues=new Map(),requests=[],edits=[]
 for(const row of rows){
  const original=Buffer.from(row.bodyBase64,'base64').toString('utf8'),changed=control.mutate(row,original)
  assert.equal(typeof changed,'string')
  if(changed!==original)edits.push({index:row.index,originalSHA256:row.sha256,counterfactualSHA256:sha(changed),counterfactualNotGenuine:true})
  if(!queues.has(row.url))queues.set(row.url,[]);queues.get(row.url).push({row,changed,original})
 }
 if(control.kind!=='baseline')assert(edits.length>0)
 const {createDoximityScraper}=await import('./script.js')
 const jobs=await createDoximityScraper().run({rateLimitMs:0,maxRequests:58,sourceTimeoutMs:120000,now:()=>new Date('2026-11-19T02:59:26.974Z'),
 fetchPage:async(url,init={})=>{
  const packet=queues.get(String(url))?.shift();assert(packet,'No extra or synthetic acquisition may satisfy '+url)
  const {row,changed,original}=packet,bytes=changed===original?Buffer.from(row.bodyBase64,'base64'):Buffer.from(changed),headers=new Headers(row.headers)
  assert.equal(init.method??'GET','GET');assert(init.body==null);assert(init.signal instanceof AbortSignal)
  if(changed!==original&&headers.has('content-length'))headers.set('content-length',String(bytes.length))
  requests.push(row.index);return{url:row.url,status:row.status,headers:Object.fromEntries(headers),bodyBase64:bytes.toString('base64')}
 }})
 assert.equal(requests.length,58);assert.equal(new Set(requests).size,58);assert([...queues.values()].every(value=>value.length===0))
 const audit=jobs.nativeCollectionEvidence,observations=audit.observations,rawTarget=observations.find(row=>row.jobId===ID),target=compact(rawTarget),error=null
 assert(rawTarget)
 const actualOthers=observations.filter(row=>row.jobId!==ID).map(row=>({jobId:row.jobId,country:row.country,unknown:row.sourceCountryScopeUnresolved,conflict:row.sourceNativeCountryConflict,currentNativeRoleQualified:row.sourceCurrentNativeRoleQualified}))
 assert.deepEqual(actualOthers,EXPECTED_OTHERS)
 const othersStable=true
 const policy=audit&&audit.sourceScopeComplete===false&&audit.lifecycleCleanupAllowed===false&&audit.companyGlobalTotal===null&&audit.companyIndiaTotal===null
 const unresolved=Boolean(error||target&&(target.sourceCountryScopeUnresolved===true||target.sourceNativeCountryConflict===true||target.sourceCurrentNativeRoleQualified!==true))
 const qualified=Boolean(!error&&target&&target.country==='United States'&&target.sourceCountryScopeUnresolved===false&&target.sourceNativeCountryConflict===false&&target.sourceCurrentNativeRoleQualified===true&&target.city===null&&target.state===null&&target.primaryLabelEvidence?.qualified===true&&jobs.length===0)
 const identity=Boolean(!error&&target&&target.jobId===ID&&target.requisitionId==='661-SPH'&&target.internalJobId===3604022&&target.rawAPIPrimary?.name===(control.label??PRIMARY)&&target.rawPublishedPrimary===(control.label??PRIMARY)&&target.rawClosingPublishedPrimary===(control.label??PRIMARY))
 const rawDate=Boolean(!error&&target&&target.sourcePostingDate===(control.earlier??'2026-11-04T20:01:07-05:00')&&target.rawAPIFirstPublished===(control.earlier??'2026-11-04T20:01:07-05:00')&&target.rawHostedPublishedAt==='2026-11-04T20:01:07-05:00')
 const expectedOutcome=control.expected==='qualified-US'?qualified&&identity&&rawDate&&policy&&observations.length===11&&requests.length===58&&othersStable:unresolved&&(error||policy&&observations.length===11&&othersStable);
 console.log('CRITERIA_REGRESSION '+JSON.stringify({name:control.name,reads:requests.length,edits,otherTenUnchanged:true,country:rawTarget.country,unknown:rawTarget.sourceCountryScopeUnresolved,conflict:rawTarget.sourceNativeCountryConflict,roleQualified:rawTarget.sourceCurrentNativeRoleQualified,returnedJobs:jobs.length,guard:rawTarget.sourceNativeRoleLocationCriteriaEvidence?{countries:rawTarget.sourceNativeRoleLocationCriteriaEvidence.criterionCountries,conflict:rawTarget.sourceNativeRoleLocationCriteriaEvidence.conflict,carriers:rawTarget.sourceNativeRoleLocationCriteriaEvidence.carriers.map(value=>({source:value.source,phase:value.phase,paragraphs:value.paragraphs.length}))}:null}))
 assert(expectedOutcome,control.name+' retained original peer oracle failed')
 assert(policy);assert.equal(rawTarget.postingDate,'2026-11-04T20:01:07-05:00');assert.equal(rawTarget.requisitionId,'661-SPH')
 assert.equal(rawTarget.activeApplyVerified,false);assert.equal(rawTarget.applicationVisited,false)
 return {jobs,audit,row:rawTarget,edits}
}
test('coherent original US Location criterion preserves the original preference supplement and every unrelated role',async()=>{
 const {row,jobs}=await runCase(BASELINE)
 assert.equal(row.country,'United States');assert.equal(row.sourceCountryScopeUnresolved,false);assert.equal(jobs.length,0)
 assert.match(row.sourceNativeOwnDescription,/Location: Remote U[.]S[.]/)
})
test('original peer full-selected-Location-criterion-India-vs-US-primary is held with exact raw criteria',async()=>{
 const {row,jobs}=await runCase(PEER_CONTROL)
 assert.equal(row.country,null);assert.equal(row.sourceCountryScopeUnresolved,true);assert.equal(row.sourceNativeCountryConflict,true);assert.equal(row.sourceCurrentNativeRoleQualified,false)
 assert.equal(row.sourceNativePrimaryLabelEvidence.qualified,true,'The original label supplement itself remains retained')
 assert.match(row.sourceNativeOwnDescription,/Location: Remote, India/)
 assert.match(row.sourceNativeClosingOwnDescription,/Location: Remote, India/)
 assert(row.sourceNativeRecord.content.includes('Location: Remote, India ('))
 assert(row.sourceNativePublishedModel.content.includes('Location: Remote, India ('))
 assert(row.sourceNativePublishedClosingModel.content.includes('Location: Remote, India ('))
 assert.equal(row.sourceNativeRoleLocationCriteriaEvidence.criteriaUsedToSupplyCountry,false)
 assert(row.sourceNativeRoleLocationCriteriaEvidence.carriers.filter(value=>value.paragraphs.some(p=>p.countries.includes('India'))).length>=5)
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,null)
})
test('already-resolved plain native US worksite still checks conflicting role-owned Location criteria',async()=>{
 const control={...PEER_CONTROL,name:'already-resolved-plain-US-Location-criterion-conflict',label:'Remote, U.S.',mutate:(row,html)=>PEER_CONTROL.mutate(row,html.replaceAll(PRIMARY,'Remote, U.S.'))}
 const {row,jobs}=await runCase(control)
 assert(row.sourceNativeCountryEvidence.primary.every(value=>value.country==='United States'),'This case must start with a natively resolved primary')
 assert.equal(row.sourceNativePrimaryLabelEvidence,undefined,'Already-resolved native country bypasses the original preference-repair branch')
 assert.equal(row.country,null);assert.equal(row.sourceCountryScopeUnresolved,true);assert.equal(row.sourceNativeCountryConflict,true);assert.equal(row.sourceCurrentNativeRoleQualified,false)
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,null)
})
