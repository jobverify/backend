import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import http from 'node:http'
import https from 'node:https'
import {syncBuiltinESMExports} from 'node:module'
import test,{after} from 'node:test'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const fixtureBytes=fs.readFileSync(new URL('./fixtures/role-country-scope-originals-20261121.json.gz',import.meta.url))
assert.equal(sha(fixtureBytes),'a2751293d18873edb89570e370fe663ccf8bc0a2f2da7539132d6d4eadb68caf')
const fixture=JSON.parse(gunzipSync(fixtureBytes)),originals=fixture.responses
assert.equal(originals.length,62)
for(const row of originals){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);assert.equal(row.status,200);assert.equal(row.method,'GET')}
const ID='7950903',AT=fixture.originalAdmissionAt
const PARA='<p><strong><em>Location: This role is </em></strong><strong><em>Remote</em></strong><strong><em>&nbsp;in the U.S.</em></strong></p>'
const CARRIERS=[6,7,22,23,41,56]
const htmlEncoded=value=>value.replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('&nbsp;','&amp;nbsp;')
const serialized=value=>JSON.stringify(value).replaceAll('<','\\u003c')

function replaceRoleContent(text,row,{from=PARA,to=PARA,onlyAPI=false,onlyHosted=false,phase=null}={}){
 if(!CARRIERS.includes(row.index)||phase&&!row.phase.endsWith(phase))return text
 const api=row.url.startsWith('https://boards-api.greenhouse.io/')
 if(onlyAPI&&!api||onlyHosted&&api)return text
 if(api){
  const model=JSON.parse(text),target=Array.isArray(model.jobs)?model.jobs.find(value=>String(value.id)===ID):model
  assert.equal(String(target.id),ID);const before=htmlEncoded(from),after=htmlEncoded(to)
  assert.equal(target.content.split(before).length-1,1,'one actual API role block '+row.index)
  target.content=target.content.replace(before,()=>after);return JSON.stringify(model)
 }
 assert.equal(text.split(from).length-1,1,'one actual visible role block '+row.index)
 text=text.replace(from,()=>to)
 const scripts=[...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(value=>value[1]).filter(value=>value.trim().startsWith('window.__remixContext = '))
 assert.equal(scripts.length,1);const raw=scripts[0],trimmed=raw.trim(),prefix='window.__remixContext = '
 const literal=trimmed.slice(prefix.length).replace(/;$/,''),model=JSON.parse(literal)
 const post=model.state.loaderData['routes/$url_token_.jobs_.$job_post_id'].jobPost
 assert.equal(post.public_url,'https://job-boards.greenhouse.io/doximity/jobs/'+ID)
 assert.equal(post.content.split(from).length-1,1,'one actual hosted-model block '+row.index)
 post.content=post.content.replace(from,()=>to)
 assert.equal(text.split(raw).length-1,1)
 return text.replace(raw,()=>prefix+serialized(model)+';')
}

const phrase=value=>'<p><strong>Location: '+value+'</strong></p>'
const inner=PARA.slice(3,-4)
const controls=[
 {name:'heading-only-assertion-with-leaf-span-cannot-supply-country',change:{to:'<h3><span>'+inner+'</span></h3>'}},
 {name:'heading descendant label cannot supply paragraph authority',change:{to:'<h3><label>'+inner+'</label></h3>'}},
 {name:'nested heading descendant span cannot supply paragraph authority',change:{to:'<h3><strong><span>'+inner+'</span></strong></h3>'}},
 {name:'ordinary body label still supplies whole-role country authority',positive:true,change:{to:'<label>'+inner+'</label>'}},
 {name:'ordinary body leaf span still supplies whole-role country authority',positive:true,change:{to:'<span>'+inner+'</span>'}},
 {name:'heading descendant exclusion preserves explicit foreign heading country veto',change:{from:'<h3><strong>Location: Remote</strong></h3>',to:'<h3><span>Location: Remote, India</span></h3>'},knownConflict:true},
]

let fenceCalls=0
const saved={f:globalThis.fetch,hr:http.request,hg:http.get,sr:https.request,sg:https.get}
const blocked=()=>{fenceCalls++;throw Error('Doximity role-country-scope saved-original network fence')}
globalThis.fetch=blocked;http.request=http.get=https.request=https.get=blocked;syncBuiltinESMExports()
after(()=>{globalThis.fetch=saved.f;http.request=saved.hr;http.get=saved.hg;https.request=saved.sr;https.get=saved.sg;syncBuiltinESMExports();assert.equal(fenceCalls,0)})

for(const control of controls)test(control.name,async()=>{
 const queues=new Map(),edits=[],requests=[]
 for(const row of originals){
  const original=Buffer.from(row.bodyBase64,'base64').toString('utf8')
  let changed=control.change?replaceRoleContent(original,row,control.change):original
  if(control.unknownOffice&&row.url.startsWith('https://boards-api.greenhouse.io/')){
   const json=JSON.parse(changed),visit=value=>{if(!value||typeof value!=='object')return;if(value.id===43270&&Object.hasOwn(value,'parent_id')){value.name='Undisclosed assigned office';value.location='Unknown'};for(const child of Object.values(value))if(child&&typeof child==='object')visit(child)}
   visit(json);changed=JSON.stringify(json)
  }
  if(control.unrelatedPartial&&row.url==='https://boards-api.greenhouse.io/v1/boards/doximity/jobs/8222144?pay_transparency=true'){
   const json=JSON.parse(changed);json.metadata=[...(json.metadata??[]),{name:'Country',value:'Unknown'}];changed=JSON.stringify(json)
  }
  if(changed!==original)edits.push({index:row.index,originalSHA256:row.sha256,counterfactualSHA256:sha(changed),counterfactualNotGenuine:true})
  if(!queues.has(row.url))queues.set(row.url,[])
  queues.get(row.url).push({row,original,changed})
 }
 if(control.positive&&!control.change)assert.equal(edits.length,0,'The genuine baseline is not mutated')
 else assert(edits.length>0,'Counterfactual must alter actual role fields')
 const {createDoximityScraper}=await import('./script.js')
 let jobs=null,error=null
 try{jobs=await createDoximityScraper().run({rateLimitMs:0,maxRequests:128,sourceTimeoutMs:120000,now:()=>new Date(AT),fetchPage:async(url,init={})=>{
  const packet=queues.get(String(url))?.shift();assert(packet,'No extra acquisition may satisfy '+url)
  const {row,original,changed}=packet,bytes=changed===original?Buffer.from(row.bodyBase64,'base64'):Buffer.from(changed),headers=new Headers(row.headers)
  assert.equal(init.method??'GET','GET');assert(init.body==null);assert(init.signal instanceof AbortSignal)
  if(changed!==original&&headers.has('content-length'))headers.set('content-length',String(bytes.length))
  requests.push(row.index);return{url:row.url,status:row.status,headers:Object.fromEntries(headers),bodyBase64:bytes.toString('base64')}
 }})}catch(cause){if(cause.code==='ERR_ASSERTION'||cause.cause?.code==='ERR_ASSERTION')throw cause;error=cause}
 const audit=jobs?.nativeCollectionEvidence??error?.nativeEvidence,inventory=jobs?readInventoryEvidence(jobs):null,target=audit?.observations?.find(row=>row.jobId===ID)
 console.log('ROLE_COUNTRY_SCOPE_CONTROL '+JSON.stringify({name:control.name,genuineBaseline:control.positive&&!control.change,edits,reads:requests.length,error:error?{name:error.name,code:error.code,message:error.message}:null,jobs:jobs?.length??null,inventory:inventory?.status??null,configured:audit?.configuredPublicBoardEvidence?.qualified??null,target:target?{country:target.country,unknown:target.sourceCountryScopeUnresolved,conflict:target.sourceNativeCountryConflict,roleQualified:target.sourceCurrentNativeRoleQualified,scopeQualified:target.sourceNativeRoleCountryScopeEvidence?.qualified??null,scopeReasons:target.sourceNativeRoleCountryScopeEvidence?.reasons??null}:null}))
 assert.equal(fenceCalls,0)
 if(error){assert(control.expectedError);assert.match(error.message,control.expectedError);assert.equal(error.code,'DOXIMITY_NATIVE_PROOF');assert(audit);return}
 assert.equal(control.expectedError,undefined)
 assert.equal(requests.length,62);assert.equal(new Set(requests).size,62);assert([...queues.values()].every(value=>!value.length))
 assert.equal(audit.observations.length,12);assert(target)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(inventory.indiaFacetCount,null);assert.equal(isVerifiedEmptyEvidence(inventory),false)
 assert.equal(target.postingDate,'2026-11-02T16:17:11-05:00');assert.equal(target.activeApplyVerified,false);assert.equal(target.applicationVisited,false)
 assert.equal(target.sourceNativePrimaryLocation.name,'San Francisco, CA or Remote (U.S.)')
 assert.equal(target.sourceNativeCountryEvidence.primary[0].country,null,'Original structured-geography uncertainty must be preserved')
 assert.equal(target.sourceNativeRoleLocationCriteriaEvidence.criteriaUsedToSupplyCountry,false,'Old rejection-only provenance must remain truthful')
 if(control.positive||control.unrelatedPartial){
  assert.equal(target.country,'United States');assert.equal(target.sourceCountryScopeUnresolved,false,'Explicit whole-role country scope must reconcile the retained unknown primary place')
  assert.equal(target.sourceNativeCountryConflict,false);assert.equal(target.sourceCurrentNativeRoleQualified,true)
  assert.equal(target.sourceNativeCountryScopeReconciled,true)
  const scope=target.sourceNativeRoleCountryScopeEvidence
  assert(scope);assert.equal(scope.qualified,true);assert.equal(scope.country,'United States');assert.equal(scope.priorCountryScopeUnresolved,true)
  assert.equal(scope.newCountrySupplied,false);assert.equal(scope.countryInferredFromCity,false);assert.equal(scope.unassignedOfficeUsed,false)
  assert.equal(scope.carriers.length,7);assert(scope.carriers.every(value=>value.qualified&&value.assertions.length>0))
  if(control.unrelatedPartial){const other=audit.observations.find(row=>row.jobId==='8222144');assert(other);assert.equal(other.sourceCountryScopeUnresolved,true);assert.equal(other.sourceCurrentNativeRoleQualified,false);assert.equal(inventory.status,'coverage-gap');assert.equal(audit.configuredPublicBoardEvidence.qualified,false);assert(jobs.some(row=>row.jobId==='8222144'));assert(!jobs.some(row=>row.jobId===ID))}
  else{assert.equal(jobs.length,0);assert.equal(inventory.status,'complete-inventory');assert.equal(inventory.reportedTotal,12);assert.equal(inventory.verifiedAt,AT);assert.equal(inventory.lifecycleCleanupAllowed,false);assert.equal(audit.configuredPublicBoardEvidence.qualified,true)}
 }else{
  assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(audit.configuredPublicBoardEvidence.qualified,false)
  assert.equal(target.sourceCountryScopeUnresolved,true);assert.equal(target.sourceCurrentNativeRoleQualified,false)
  assert.notEqual(target.sourceNativeCountryScopeReconciled,true);if(control.change?.phase==='closing'){assert.equal(target.sourceNativeRoleEvidencePairQualified,false);assert.equal(target.sourceNativeTemporalQualified,false)}else assert(jobs.some(row=>row.jobId===ID))
  if(control.knownConflict)assert.equal(target.sourceNativeCountryConflict,true)
 }
})
