import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createSentryScraper} from './script.js'

// Original current responses provide the structure. India and changed criteria
// below are controlled mutations, never a claim that a current India role exists.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-cohort-20261113.json.gz',import.meta.url))))
const CAREERS='https://sentry.io/careers/',API='https://api.ashbyhq.com/posting-api/job-board/sentry'
const ID='81f09568-da7d-4ed1-8283-614f846c9b00'
const protocol=[CAREERS,API,API,CAREERS]
const originalHTML=fixture.packets[0].body,originalPayload=JSON.parse(fixture.packets[1].body)
function indiaModel(criterion=''){
 const payload=structuredClone(originalPayload),role=payload.jobs.find(j=>j.id===ID)
 role.location='Bengaluru, Karnataka, India'
 role.address={postalAddress:{addressCountry:'India',addressRegion:'Karnataka',addressLocality:'Bengaluru'}}
 role.secondaryLocations=[]
 if(criterion){role.descriptionHtml+='<p>'+criterion+'</p>';role.descriptionPlain+='\n'+criterion}
 let corporate=originalHTML.replace(/(\bprops=")([^"]*)(")/,(_m,a,raw,b)=>{
  const props=JSON.parse(decodeNativeEntities(raw)),row=props.jobs[1].find(tuple=>tuple[1].id[1]===ID)[1]
  row.info[1].locationName=[0,role.location]
  if(criterion)row.info[1].descriptionHtml[1]+='<p>'+criterion+'</p>'
  return a+JSON.stringify(props).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;')+b
 })
 const visible=new RegExp('(<a\\b[^>]*href="/careers/'+ID+'/"[^>]*>[\\s\\S]*?<span\\b[^>]*class="[^"]*_jobLocation_[^"]*"[^>]*>)([\\s\\S]*?)(</span>)')
 assert.match(corporate,visible)
 corporate=corporate.replace(visible,(_m,a,_location,b)=>a+role.location+b)
 return{corporate,payload}
}
const cohort=model=>[model.corporate,model.payload,model.payload,model.corporate]
function collect(bodies,{controller,abortAt}={}){
 const calls=[],reason=Object.freeze({caller:'stop fresh Sentry cohort'})
 const fetchImpl=async(url,init)=>{
  const index=calls.length
  assert.equal(url,protocol[index%4])
  assert.ok(index<bodies.length,'source exceeded its two complete acquisition cohorts')
  calls.push({url,headers:init.headers})
  if(calls.length===abortAt)controller.abort(reason)
  const body=bodies[index],response=new Response(typeof body==='string'?body:JSON.stringify(body),{headers:{'content-type':url===API?'application/json':'text/html'}})
  Object.defineProperty(response,'url',{value:url});return response
 }
 return{calls,reason,pending:createSentryScraper({fetchImpl}).run({signal:controller?.signal,totalBudgetMs:20000,requestTimeoutMs:3000})}
}

test('Sentry discards an incoherent first criteria cohort and returns only a fresh coherent complete cohort',async()=>{
 const stale=indiaModel(),fresh=indiaModel('Current Delta licence is required.'),wrong=structuredClone(stale.payload)
 wrong.jobs.find(j=>j.id===ID).descriptionHtml+='<p>In-flight first deployment criteria.</p>'
 const attempt=collect([stale.corporate,wrong,wrong,stale.corporate,...cohort(fresh)])
 const jobs=await attempt.pending
 assert.equal(attempt.calls.length,8)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceDescription,fresh.payload.jobs.find(j=>j.id===ID).descriptionHtml)
 assert.deepEqual(jobs[0].sourceNativeListingRecord,fresh.payload.jobs.find(j=>j.id===ID))
 assert.equal(jobs[0].country,'India')
 assert.ok(!jobs[0].sourceDescription.includes('In-flight first deployment'))
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.cohortAttempts,2)
 assert.equal(audit.discardedCohorts.length,1)
 assert.equal(audit.receipts.length,8)
 assert.deepEqual(audit.opening.payload,fresh.payload)
 assert.deepEqual(audit.closing.payload,fresh.payload)
 assert.equal(audit.nativeRecords.length,38)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 for(const call of attempt.calls.slice(4))assert.equal(new Headers(call.headers).get('cache-control'),'no-cache')
})

test('Sentry restarts the whole cohort when fully matching closing criteria changed from opening',async()=>{
 const opening=indiaModel(),fresh=indiaModel('New Epsilon certification is required.')
 const attempt=collect([opening.corporate,opening.payload,fresh.payload,fresh.corporate,...cohort(fresh)])
 const jobs=await attempt.pending
 assert.equal(attempt.calls.length,8)
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceDescription,fresh.payload.jobs.find(j=>j.id===ID).descriptionHtml)
 assert.deepEqual(jobs.nativeCollectionEvidence.opening.payload,fresh.payload)
 assert.equal(jobs.nativeCollectionEvidence.discardedCohorts.length,1)
})

test('Sentry discards a changed native inventory model before accepting a fresh stable full inventory',async()=>{
 const opening=indiaModel(),fresh=indiaModel()
 fresh.payload.jobs.at(-1).newNativeCriterion={required:true}
 const attempt=collect([opening.corporate,opening.payload,fresh.payload,opening.corporate,...cohort(fresh)])
 const jobs=await attempt.pending
 assert.equal(attempt.calls.length,8)
 assert.deepEqual(jobs.nativeCollectionEvidence.nativeRecords,fresh.payload.jobs)
 assert.deepEqual(jobs.nativeCollectionEvidence.opening.payload,fresh.payload)
 assert.deepEqual(jobs.nativeCollectionEvidence.closing.payload,fresh.payload)
})

test('Sentry persistent full criteria contradictions remain hard after exactly one fresh cohort retry',async()=>{
 const model=indiaModel(),wrong=structuredClone(model.payload)
 wrong.jobs.find(j=>j.id===ID).descriptionHtml+='<p>Unreconciled mandatory licence.</p>'
 const attempt=collect([model.corporate,wrong,wrong,model.corporate,model.corporate,wrong,wrong,model.corporate])
 await assert.rejects(attempt.pending,error=>{
  assert.match(error.message,/corporate\/API full job criteria disagree/)
  assert.equal(error.failureKind,'parser_or_contract_error')
  return true
 })
 assert.equal(attempt.calls.length,8)
})

for(const abortAt of [4,5])test('Sentry caller abort stops cohort reads at request '+abortAt,async()=>{
 const opening=indiaModel(),fresh=indiaModel('Current certification is required.'),controller=new AbortController()
 const attempt=collect([opening.corporate,opening.payload,fresh.payload,fresh.corporate,...cohort(fresh)],{controller,abortAt})
 await assert.rejects(attempt.pending,error=>error===attempt.reason)
 assert.equal(attempt.calls.length,abortAt)
})

test('Sentry title and country contradictions cannot qualify for the deployment-cohort retry',async()=>{
 for(const field of ['title','country']){
  const model=indiaModel()
  if(field==='title')model.payload.jobs.find(j=>j.id===ID).title='Another employer role'
  else model.payload.jobs.find(j=>j.id===ID).address.postalAddress.addressCountry='United States'
  const attempt=collect([...cohort(model),...cohort(model)])
  await assert.rejects(attempt.pending)
  assert.equal(attempt.calls.length,2)
 }
})
