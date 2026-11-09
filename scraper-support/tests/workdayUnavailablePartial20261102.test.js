import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {syncBuiltinESMExports} from 'node:module'
import {fileURLToPath} from 'node:url'
import test from 'node:test'
import {runWorkdayScraper,WorkdayHostCircuitBreaker} from '../myworkday/engine.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {resolveZeroJobOutcome} from '../runner.js'

// Every role, URL and count in these controls is SYNTHETIC, not native company proof.
const source='synthetic-unavailable-partial',company='Synthetic Workday Partial Controls'
const board='https://synthetic-partial.wd5.myworkdayjobs.com/External'
const corporate='https://synthetic-partial.example/careers'
const api='https://synthetic-partial.wd5.myworkdayjobs.com/wday/cxs/synthetic-partial/External/jobs'
const configFile=fileURLToPath(new URL('../myworkday/config.json',import.meta.url))
const scraperDir=path.dirname(configFile),proofSymbol=Symbol.for('jobverify.workday.country-inventory-proof')
const description='<p>Develop reliable enterprise software and maintain distributed systems. Two years of professional software engineering experience required.</p>'
const role=(id,{location='Bengaluru, India',country='IN',additional=[],field=null}={})=>{
 const externalPath=`/job/Synthetic-Office/Engineer_${id}`
 const listing={title:'Engineer',externalPath,locationsText:additional.length?'2 Locations':location,bulletFields:[id],postedOn:'Posted 30+ Days Ago'}
 const info={jobReqId:id,jobPostingId:'Engineer_'+id,jobPostingSiteId:'External',externalUrl:board+externalPath,
  title:'Engineer',location,additionalLocations:[...additional],country:{alpha2Code:country,descriptor:country==='IN'?'India':'United States'},
  jobDescription:description,startDate:'2026-10-21',endDate:'2026-12-01',posted:true,canApply:true}
 if(field)info[field]=false
 return{listing,payload:{jobPostingInfo:info}}
}
const exercise=async(t,models,{optIn=true}={})=>{
 const inputBefore=JSON.stringify(models),config={listingStrategy:'jobs-api',inventoryScope:'complete-board-country-proof',
  officialCareersUrl:corporate,jobsApiUrl:api,detailUrlBase:board,locationCountry:null,searchText:'',...(optIn?{retainProvenIndiaOnUnresolvedLocations:true}:{})}
 const originalRead=fs.readFileSync,configMock=t.mock.method(fs,'readFileSync',(file,...args)=>String(file)===configFile?JSON.stringify(config):originalRead(file,...args))
 syncBuiltinESMExports()
 const calls=[],response=(url,body,type='application/json')=>{const res=new Response(body,{headers:{'content-type':type}});Object.defineProperty(res,'url',{value:url});return res}
 const fetchMock=t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input),method=init.method||'GET';init.signal?.throwIfAborted();calls.push({url,method})
  if(url===corporate)return response(url,`<html><body><a href="${board}">View jobs</a></body></html>`,'text/html')
  if(url===board)return response(url,'<title>Workday careers</title>','text/html')
  if(url===api&&method==='POST'){
   assert.deepEqual(JSON.parse(init.body).appliedFacets,{})
   return response(url,JSON.stringify({total:models.length,facets:[],jobPostings:models.map(model=>model.listing)}))
  }
  const model=models.find(item=>api.replace(/\/jobs$/,'')+item.listing.externalPath===url)
  assert.ok(model,'No replacement HTML, unvisited detail or external request: '+url)
  return response(url,JSON.stringify(model.payload))
 })
 let jobs,error
 try{jobs=await runWorkdayScraper({source,company,baseUrl:board,scraperDir,nativeDetailRecovery:false,requestTimeoutMs:1000,retryBaseDelayMs:0,
  requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}},circuitBreaker:new WorkdayHostCircuitBreaker(),detailCircuitBreaker:new WorkdayHostCircuitBreaker()})}
 catch(failure){error=failure}
 finally{fetchMock.mock.restore();configMock.mock.restore();syncBuiltinESMExports()}
 assert.equal(JSON.stringify(models),inputBefore,'Raw provided identities, state, workplace, full JD and native dates must stay exact')
 return{jobs,error,calls,evidence:readInventoryEvidence(jobs),proof:jobs?.[proofSymbol]}
}
const assertPartial=result=>{
 assert.ifError(result.error)
 assert.equal(result.evidence.status,'coverage-gap');assert.equal(result.evidence.listingComplete,false);assert.equal(result.evidence.indiaFacetCount,null)
 assert.notEqual(resolveZeroJobOutcome({provider:{}},result.jobs,[]),'fetched-zero')
 for(const job of result.jobs){assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)}
}
const assertHealthy=result=>{
 assertPartial(result);assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].requisitionId,'R-3001')
 assert.match(result.jobs[0].sourceDescription,/Develop reliable enterprise software/)
 assert.equal(result.jobs[0].sourceDetailComplete,true)
 assert.deepEqual(result.jobs[0].sourceRawDates,{startDate:'2026-10-21',endDate:'2026-12-01'})
}
for(const field of ['canApply','posted']){
 test(`opt-in ${field}:false retains an independent healthy India role and audit-only unavailable state`,{concurrency:false},async t=>{
  const result=await exercise(t,[role('R-3001'),role('R-3002',{field,country:'US',location:'Campus Q42'})])
  assertHealthy(result)
  const unavailable=result.proof.unresolvedRoles.find(row=>row.requisitionId==='R-3002')
  assert.ok(unavailable);assert.equal(unavailable.code,'WORKDAY_NATIVE_ROLE_UNAVAILABLE');assert.equal(unavailable.nativeStatus[field],false)
  assert.deepEqual(result.proof.roles.find(row=>row.requisitionId==='R-3002').countryScopes,[])
 })
 for(const reversed of [false,true])test(`opt-in ${field}:false never supplies another role's secondary country (reversed=${reversed})`,{concurrency:false},async t=>{
  const models=[role('R-3001'),role('R-3002',{field,country:'US',location:'Campus Q42'}),role('R-3003',{location:'Foreign Primary',country:'US',additional:['Campus Q42']})]
  if(reversed)models.reverse()
  const result=await exercise(t,models)
  assertHealthy(result)
  assert.deepEqual(new Set(result.proof.unresolvedRoles.map(row=>row.requisitionId)),new Set(['R-3002','R-3003']))
  assert.deepEqual(result.proof.roles.find(row=>row.requisitionId==='R-3003').countryScopes,[],'False role cannot lend India to a city-only secondary office')
  assert.equal(result.jobs.some(job=>job.requisitionId==='R-3003'),false)
  const unresolvedForeignPrimary=result.proof.unresolvedRoles.find(row=>row.requisitionId==='R-3003')
  assert.equal(unresolvedForeignPrimary.nativeStatus,undefined,'The healthy foreign-primary role must remain a geography gap, not an unavailable role')
  assert.match(unresolvedForeignPrimary.reason,/scope|country|location/i)
 })
 test(`opt-in all-${field}:false is unknown partial and cannot qualify empty or cleanup`,{concurrency:false},async t=>{
  const result=await exercise(t,[role('R-3001',{field,country:'US',location:'Campus Q41'}),role('R-3002',{field,country:'US',location:'Foreign Primary'})])
  assertPartial(result);assert.equal(result.jobs.length,0);assert.equal(result.proof.unresolvedRoles.length,2)
  assert.ok(result.proof.unresolvedRoles.every(row=>row.nativeStatus[field]===false))
  assert.equal(result.proof.roles.some(row=>row.countryScopes.length),false)
 })
 test(`ordinary ${field}:false still rejects the whole attempt without the existing opt-in`,{concurrency:false},async t=>{
  const result=await exercise(t,[role('R-3001'),role('R-3002',{field})],{optIn:false})
  assert.equal(result.jobs,undefined);assert.equal(result.error?.code,'WORKDAY_NATIVE_ROLE_UNAVAILABLE');assert.equal(result.error?.nativeStatus[field],false)
 })
}
test('opt-in does not downgrade identity, country or date validation failures into unavailable audit', {concurrency:false},async t=>{
 for(const change of [info=>{info.title='Wrong role'},info=>{info.country={alpha2Code:'ZZ'}},info=>{info.startDate='2026-02-30'}]){
  const rejected=role('R-3002',{field:'canApply',location:'Campus Q42'});change(rejected.payload.jobPostingInfo)
  const result=await exercise(t,[role('R-3001'),rejected])
  assert.equal(result.jobs,undefined);assert.ok(result.error);assert.notEqual(result.error.code,'WORKDAY_NATIVE_ROLE_UNAVAILABLE')
 }
})

// These additional models are SYNTHETIC own-role geography/state contracts.
// No company inventory, legal employer, captured response or clock is invented.
const knownUnavailableIndiaCases = [
 {name:'typed primary India with another unresolved secondary',make:field=>role('R-3002',{field,location:'Campus Q42',additional:['Unknown']})},
 {name:'explicit India secondary with another unresolved secondary',make:field=>{
  const model=role('R-3002',{field,location:'Foreign Primary',country:'US',additional:['Bengaluru, India','Unknown']})
  model.listing.locationsText='3 Locations'
  return model
 }},
 {name:'own bound India secondary with another unresolved secondary',make:field=>{
  const model=role('R-3002',{field,location:'Foreign Primary',country:'US',additional:['Campus Q42','Unknown']})
  model.listing.locationsText='3 Locations'
  model.payload.jobPostingInfo.jobRequisitionLocation={descriptor:'Campus Q42',country:{alpha2Code:'IN',descriptor:'India'}}
  return model
 }},
 {name:'explicit public India label without an optional typed country',make:field=>{
  const model=role('R-3002',{field,location:'Bengaluru, India',additional:['Unknown']})
  delete model.payload.jobPostingInfo.country
  return model
 }},
]
for(const field of ['posted','canApply']){
 for(const example of knownUnavailableIndiaCases)test(`opt-in ${field}:false with ${example.name} preserves strict native availability rejection`,{concurrency:false},async t=>{
  const result=await exercise(t,[role('R-3001'),example.make(field)])
  assert.equal(result.error?.code,'WORKDAY_NATIVE_ROLE_UNAVAILABLE')
  assert.equal(result.jobs,undefined)
  assert.equal(result.error.nativeStatus[field],false)
  assert.equal(result.error.abortRetries,true)
  assert.equal(result.error.softFailure,true)
  assert.equal(result.error.partial,true)
  assert.equal(result.error.sourceScopeComplete,false)
  assert.equal(result.error.sourceListingComplete,false)
  assert.equal(result.error.lifecycleCleanupAllowed,false)
 })
 test(`opt-in ${field}:false with truly unresolved own country retains an independent healthy India role`,{concurrency:false},async t=>{
  const model=role('R-3002',{field,location:'Campus Q42'})
  delete model.payload.jobPostingInfo.country
  const result=await exercise(t,[role('R-3001'),model])
  assertHealthy(result)
  const unavailable=result.proof.unresolvedRoles.find(row=>row.requisitionId==='R-3002')
  assert.equal(unavailable.code,'WORKDAY_NATIVE_ROLE_UNAVAILABLE')
  assert.equal(unavailable.nativeStatus[field],false)
  assert.deepEqual(result.proof.roles.find(row=>row.requisitionId==='R-3002').countryScopes,[])
 })
 test(`opt-in ${field}:false cannot hide contradictory own primary country fields as availability uncertainty`,{concurrency:false},async t=>{
  const model=role('R-3002',{field,location:'Campus Q42'})
  model.payload.jobPostingInfo.jobRequisitionLocation={descriptor:'Campus Q42',country:{alpha2Code:'US',descriptor:'United States'}}
  const result=await exercise(t,[role('R-3001'),model])
  assert.equal(result.jobs,undefined)
  assert.ok(result.error)
  assert.notEqual(result.error.code,'WORKDAY_NATIVE_ROLE_UNAVAILABLE')
  assert.match(result.error.message,/country|scope|location/i)
 })
}
