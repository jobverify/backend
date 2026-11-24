import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import http from 'node:http'
import https from 'node:https'
import {syncBuiltinESMExports} from 'node:module'
import test,{after} from 'node:test'
import {readInventoryEvidence,isFreshCompleteInventoryEvidence,isVerifiedEmptyEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

// Original-response seam adapted from the frozen nativeCriteria regression.
// These nine cases exercise the actual factory; they never import a proposed
// completeness helper or supply a completeness flag to the producer.
const sha=value=>createHash('sha256').update(value).digest('hex')
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-label-originals-20261119.json.gz',import.meta.url))))
const originals=fixture.responses
assert.equal(originals.length,58)
for(const row of originals){const body=Buffer.from(row.bodyBase64,'base64');assert.equal(body.length,row.bytes);assert.equal(sha(body),row.sha256);assert.equal(row.status,200);assert.equal(row.method,'GET')}
const ID='8337921',APILIST='https://boards-api.greenhouse.io/v1/boards/doximity/jobs?content=true'
const APIROLE='https://boards-api.greenhouse.io/v1/boards/doximity/jobs/'+ID+'?pay_transparency=true'
const HOSTED='https://job-boards.greenhouse.io/doximity/jobs/'+ID
const BOARD='https://job-boards.greenhouse.io/embed/job_board?for=doximity'
const PRIMARY='Remote, U.S. (New York or New Jersey Strongly Preferred)'
const ORIGINAL_AT='2026-11-19T02:59:26.974Z',FUTURE='2099-01-01T00:00:00Z'
const unchanged=(_row,html)=>html
function apiTarget(row,html,change){
 if(row.url!==APIROLE&&row.url!==APILIST)return html
 const model=JSON.parse(html),target=row.url===APIROLE?model:model.jobs.find(value=>String(value.id)===ID)
 assert(target&&String(target.id)===ID);change(target);return JSON.stringify(model)
}
function contextChange(html,change){
 let changed=0
 const output=html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(whole,open,source,close)=>{
  if(!source.includes('window.__remixContext'))return whole
  const ast=parse(source,{ecmaVersion:'latest'}),assignment=ast.body[0]?.expression
  assert.equal(ast.body.length,1);assert.equal(assignment?.type,'AssignmentExpression');assert.equal(assignment.right.type,'ObjectExpression')
  const model=JSON.parse(source.slice(assignment.right.start,assignment.right.end))
  change(model);changed++
  return open+source.slice(0,assignment.right.start)+JSON.stringify(model)+source.slice(assignment.right.end)+close
 })
 assert.equal(changed,1,'The original active native context must be selected exactly once')
 return output
}
let networkCalls=0
const saved={f:globalThis.fetch,hr:http.request,hg:http.get,sr:https.request,sg:https.get}
const blocked=()=>{networkCalls++;throw Error('Doximity configured-board saved-original network fence')}
globalThis.fetch=blocked;http.request=http.get=https.request=https.get=blocked;syncBuiltinESMExports()
after(()=>{globalThis.fetch=saved.f;http.request=saved.hr;http.get=saved.hg;https.request=saved.sr;https.get=saved.sg;syncBuiltinESMExports();assert.equal(networkCalls,0)})

async function runCase(name,{mutate=unchanged,options={},mutationRequired=false,expectedError=null}={}){
 const queues=new Map(),requests=[],edits=[]
 for(const row of originals){
  const original=Buffer.from(row.bodyBase64,'base64').toString('utf8'),changed=mutate(row,original)
  assert.equal(typeof changed,'string')
  if(changed!==original)edits.push({index:row.index,url:row.url,originalSHA256:row.sha256,counterfactualSHA256:sha(changed),counterfactualNotGenuine:true})
  if(!queues.has(row.url))queues.set(row.url,[])
  queues.get(row.url).push({row,original,changed})
 }
 if(mutationRequired)assert(edits.length>0,'An actual retained carrier must change')
 const {createDoximityScraper}=await import('./script.js')
 let jobs=null,error=null
 try{jobs=await createDoximityScraper().run({rateLimitMs:0,maxRequests:58,sourceTimeoutMs:120000,now:()=>new Date(ORIGINAL_AT),...options,
  fetchPage:async(url,init={})=>{
   const packet=queues.get(String(url))?.shift();assert(packet,'No extra or synthetic acquisition may satisfy '+url)
   const {row,original,changed}=packet,bytes=changed===original?Buffer.from(row.bodyBase64,'base64'):Buffer.from(changed),headers=new Headers(row.headers)
   assert.equal(init.method??'GET','GET');assert(init.body==null);assert(init.signal instanceof AbortSignal)
   if(changed!==original&&headers.has('content-length'))headers.set('content-length',String(bytes.length))
   requests.push(row.index)
   return {url:row.url,status:row.status,headers:Object.fromEntries(headers),bodyBase64:bytes.toString('base64')}
  }
 })}catch(cause){error=cause}
 const audit=jobs?.nativeCollectionEvidence??error?.nativeEvidence,inventory=jobs?readInventoryEvidence(jobs):null
 console.log('CONFIGURED_BOARD_CONTROL '+JSON.stringify({name,readCount:requests.length,edits,returnedJobs:jobs?.length??null,inventory,error:error?{code:error.code,message:error.message}:null,apiAudit:!error?{keys:Object.keys(audit.apiAudit),openingQualified:audit.apiAudit.opening?.qualified,closingQualified:audit.apiAudit.closing?.qualified}:null}))
 assert.equal(new Set(requests).size,requests.length);assert.equal(networkCalls,0)
 if(expectedError){
  assert(error,'Original source guard must reject this acquisition')
  assert.equal(error.code,expectedError.code);assert.match(error.message,expectedError.message)
  assert(audit&&audit.source==='doximity');assert.equal(jobs,null)
  assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
  assert.equal(requests.length,expectedError.reads)
  return {jobs,error,audit,inventory,edits,requests}
 }
 if(error)throw error
 assert.equal(requests.length,58);assert([...queues.values()].every(value=>value.length===0))
 assert.equal(audit.observations.length,11);assert.equal(audit.nativeBoardTotal,11)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(audit.authoritativeSourceTotal,null);assert.equal(audit.authoritativeIndiaFacetCount,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 for(const row of audit.observations){assert.equal(row.sourceScopeComplete,false);assert.equal(row.lifecycleCleanupAllowed,false);assert.equal(row.activeApplyVerified,false);assert.equal(row.applicationVisited,false)}
 assert.equal(inventory.indiaFacetCount,null)
 return {jobs,error,audit,inventory,edits,requests,target:audit.observations.find(row=>row.jobId===ID)}
}
function complete(result){
 const {inventory,audit,jobs,target}=result
 assert(audit.observations.every(row=>row.country==='United States'&&row.sourceCountryScopeUnresolved===false&&row.sourceNativeCountryConflict===false&&row.sourceCurrentNativeRoleQualified===true))
 assert.equal(target.postingDate,'2026-11-04T20:01:07-05:00');assert.equal(target.requisitionId,'661-SPH')
 assert.equal(target.sourceNativeRecord.first_published,'2026-11-04T20:01:07-05:00')
 assert.equal(target.sourceNativePublishedModel.published_at,'2026-11-04T20:01:07-05:00')
 assert.equal(jobs.length,0)
 assert.equal(inventory.status,'complete-inventory','Full declared account remains misclassified as an incomplete inventory')
 assert.equal(inventory.surface,BOARD);assert.equal(inventory.firstParty,true);assert.equal(inventory.listingComplete,true)
 assert.equal(inventory.reportedTotal,11);assert.equal(inventory.indiaFacetCount,null);assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.equal(inventory.pagesFetched,58);assert.equal(inventory.verifiedAt,ORIGINAL_AT)
 assert.equal(isVerifiedEmptyEvidence(inventory),false)
 assert.equal(isFreshCompleteInventoryEvidence(inventory,{now:new Date('2026-11-21T05:45:37.372Z')}),false,'A new replay cannot refresh the old original Responses')
}
function held(result){assert.equal(result.inventory.status,'coverage-gap');assert.equal(result.inventory.listingComplete,false);assert.equal(result.inventory.reportedTotal,null)}

test('genuine58 complete declared board has historical configured-account evidence without a company or current zero claim',async()=>{
 complete(await runCase('genuine58-unfiltered-complete-board'))
})
test('an unknown primary country retains the affected partial and blocks configured completeness',async()=>{
 const result=await runCase('unknown-primary-country',{mutationRequired:true,mutate:(_row,html)=>html.replaceAll(PRIMARY,'Unknown location')})
 held(result);assert.equal(result.target.sourceCountryScopeUnresolved,true);assert.equal(result.target.sourceCurrentNativeRoleQualified,false)
 assert.equal(result.audit.observations.filter(row=>row.jobId!==ID&&row.country==='United States'&&row.sourceCurrentNativeRoleQualified===true).length,10)
 assert(result.jobs.some(row=>row.jobId===ID))
})
test('the unchanged calibrated full Location India contradiction blocks configured completeness',async()=>{
 const result=await runCase('full-selected-Location-criterion-India-vs-US-primary',{mutationRequired:true,mutate:(row,html)=>{
  if(row.url===HOSTED){assert(html.includes('Location: Remote U.S. ('));return html.replaceAll('Location: Remote U.S. (','Location: Remote, India (')}
  return apiTarget(row,html,target=>{assert(target.content.includes('Location: Remote U.S. ('));target.content=target.content.replaceAll('Location: Remote U.S. (','Location: Remote, India (')})
 }})
 held(result);assert.equal(result.target.country,null);assert.equal(result.target.sourceNativeCountryConflict,true);assert.equal(result.target.sourceCurrentNativeRoleQualified,false)
 assert.equal(result.audit.observations.filter(row=>row.jobId!==ID&&row.country==='United States'&&row.sourceCurrentNativeRoleQualified===true).length,10)
})
test('a closing API cohort mismatch preserves the actual source error rather than empty completeness',async()=>{
 await runCase('closing-api-cohort-mismatch',{mutationRequired:true,mutate:(row,html)=>{
  if(row.url!==APILIST||row.index!==21)return html
  const model=JSON.parse(html);assert.equal(model.jobs.length,11);model.jobs=model.jobs.filter(value=>String(value.id)!==ID);model.meta.total=10;return JSON.stringify(model)
 },expectedError:{code:'DOXIMITY_NATIVE_PROOF',message:/API\/current hosted listing cohort conflict/,reads:22}})
})
test('a native selected office filter cannot supply a complete unfiltered configured board',async()=>{
 await runCase('selected-native-office-filter',{mutationRequired:true,mutate:(row,html)=>row.url!==BOARD?html:contextChange(html,model=>{const route=model.state.loaderData['routes/embed.job_board'];assert.deepEqual(route.officeIds,[]);route.officeIds=[43270]}),expectedError:{code:'DOXIMITY_NATIVE_PROOF',message:/filtered listing cannot establish a complete cohort/,reads:3}})
})
test('an explicit output limit keeps the full observation audit but cannot promote inventory scope',async()=>{
 const result=await runCase('explicit-maxJobs0-limit',{options:{maxJobs:0}})
 held(result);assert.equal(result.jobs.length,0);assert(result.audit.observations.every(row=>row.sourceCurrentNativeRoleQualified===true))
})
test('an incomplete request budget retains its admitted prefix and never invents a closing observation',async()=>{
 await runCase('request-budget57',{options:{maxRequests:57},expectedError:{code:'DOXIMITY_REQUEST_BUDGET',message:/request budget exhausted/,reads:57}})
})
test('a future original publication remains unqualified and cannot support a complete inventory',async()=>{
 const result=await runCase('future-native-first-publication',{mutationRequired:true,mutate:(row,html)=>apiTarget(row,html,target=>{assert.equal(target.first_published,'2026-11-04T20:01:07-05:00');target.first_published=FUTURE})})
 held(result);assert.equal(result.target.sourceNativeRecord.first_published,FUTURE);assert.equal(result.target.sourceNativeTemporalQualified,false);assert.equal(result.target.sourceCurrentNativeRoleQualified,false)
})
test('coherent confirmation metadata leaves the configured board boundary and all role criteria intact',async()=>{
 complete(await runCase('coherent-confirmation-message',{mutationRequired:true,mutate:(row,html)=>row.url!==HOSTED?html:contextChange(html,model=>{const post=model.state.loaderData['routes/$url_token_.jobs_.$job_post_id'].jobPost;assert(Object.hasOwn(post,'confirmation_message'));post.confirmation_message='Thank you for considering this role.'})}))
})
