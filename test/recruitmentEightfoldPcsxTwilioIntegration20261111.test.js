import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {buildScrapers,getScraperCatalog} from '../scraper-support/providers/index.js'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'
import {extractActiveDescription} from '../scraper-support/utils/activeNativeHtml.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-pcsx-twilio-four-role-20261111.json.gz',import.meta.url))))
const packetsFor=fixture=>{
  const captured=new Map()
  for(const row of fixture.responses){
    const bytes=Buffer.from(row.bodyBase64,'base64')
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.bodySHA256)
    const rows=captured.get(row.requestedURL)||[]
    rows.push({...row,body:bytes.toString('utf8'),contentType:row.contentType||row.headers?.['content-type']})
    captured.set(row.requestedURL,rows)
  }
  for(const rows of captured.values())rows.sort((a,b)=>(a.phase==='opening'?0:1)-(b.phase==='opening'?0:1))
  return captured
}
const captured=packetsFor(fixture)
const defaultFixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-pcsx-twilio-default-20261111.json.gz',import.meta.url))))
const defaultCaptured=packetsFor(defaultFixture)
const corporateURL='https://www.twilio.com/en-us/careers'
const boardURL='https://jobs.twilio.com/careers'
const firstAPI='https://jobs.twilio.com/api/pcsx/position_details?position_id=1099556746356&domain=twilio.com&hl=en'
const hrAPI='https://jobs.twilio.com/api/pcsx/position_details?position_id=1099556432090&domain=twilio.com&hl=en'
const firstRole='https://jobs.twilio.com/careers/job/1099556746356'
const nativeConfig={source:'twilio',companyName:'Twilio',companyDomain:'twilio.com',companyCareerPage:corporateURL,
  discoverLiteralRecruitmentData:true,allowVerifiedCorporateRedirects:true,requireNativeEmployerName:true,
  sourceScopeComplete:false,lifecycleCleanupAllowed:false,zeroResultPolicy:'evidence-required'}
// Four roles are the finite acquired replay, not a production candidate cap.
// Actual default registered runs must retain the normal twenty-detail budget.
const limits={maxPages:2,maxDetails:4,maxRequests:28,requestIntervalMs:0,now:()=> '2026-11-11T08:00:00.000Z'}
const replay=(change=(_,body)=>body,alterResponse=(_,row)=>row,packets=captured)=>{
  const calls=[],counts=new Map()
  return{calls,fetchImpl:async(url,init={})=>{
    const count=(counts.get(url)||0)+1,rows=packets.get(url)
    assert.ok(rows&&count<=rows.length,'Only this acquired finite native transaction may be read: '+url)
    counts.set(url,count)
    const row=rows[count-1],responseRow=alterResponse(url,row,count)
    calls.push({url,method:init.method||'GET',cache:init.cache,phase:row.phase})
    const response=new Response(change(url,row.body,count),{status:responseRow.status,headers:{'content-type':responseRow.contentType}})
    Object.defineProperty(response,'url',{value:responseRow.finalURL})
    return response
  }}
}
const forbidNetwork=t=>t.mock.method(globalThis,'fetch',()=>assert.fail('No uncontrolled public reads during fixture replay'))
const runShared=r=>createVerifiedRecruitmentScraper(nativeConfig).run({...limits,fetchImpl:r.fetchImpl})
const held=async r=>{
  try{
    const jobs=await runShared(r);assert.equal(jobs.length,0)
    return jobs[RECRUITMENT_OBSERVATIONS]
  }catch(error){
    assert.equal(error.softFailure,true)
    assert.ok(error.recruitmentObservations)
    return error.recruitmentObservations
  }
}

test('current Twilio native client reaches four complete India roles through shared recruitment discovery',async t=>{
  forbidNetwork(t)
  const r=replay(),jobs=await runShared(r)
  assert.deepEqual(jobs.map(job=>Number(job.jobId)),fixture.proof.roles.map(role=>role.roleID))
  assert.equal(r.calls.length,28)
  assert.ok(r.calls.every(call=>call.method==='GET'))
  assert.ok(r.calls.filter(call=>call.phase==='closing').every(call=>call.cache==='no-store'))
  assert.equal(readSourceObservationEvidence(jobs,'twilio').observedRecordCount,14)
  const inventory=readInventoryEvidence(jobs)
  assert.equal(inventory.firstParty,true)
  assert.equal(inventory.listingComplete,false)
  assert.notEqual(inventory.status,'verified-empty')
  for(const job of jobs){
    const original=JSON.parse(captured.get('https://jobs.twilio.com/api/pcsx/position_details?position_id='+job.jobId+'&domain=twilio.com&hl=en')[0].body).data
    assert.equal(job.sourceDescription.startsWith(original.jobDescription+'\n'),true)
    assert.equal(job.nativeSourceRecord.originalNativeRole.jobDescription,original.jobDescription)
    assert.equal(job.country,'India')
    assert.equal(job.sourceScopeComplete,false)
    assert.equal(job.sourceListingComplete,false)
    assert.equal(job.lifecycleCleanupAllowed,false)
    assert.equal(job.sourcePublicationDateUnavailable,true)
    assert.equal(job.postingDate,null)
    assert.equal(job.postedAt,null)
    assert.equal(job.nativePostingDate,null)
  }
  const hr=jobs.find(job=>job.jobId==='1099556432090')
  assert.equal(hr.location,'Remote - India')
  assert.ok(hr.sourceDescription.includes(fixture.proof.exactStateRestriction))
  assert.deepEqual(hr.nativeSourceRecord.nativeLocationRepresentations.additionalOwnSchemaLocations,[fixture.proof.additionalOwnSchemaAddress])
  const normalized=normalizeScrapedJob(hr,nativeConfig)
  assert.equal(normalized.sourceDescription,hr.sourceDescription)
  assert.notEqual(normalized.workArrangement,'On-site')
})

test('normal registered Twilio defaults retain all nine actual roles and literal state criteria through normalization',async t=>{
  forbidNetwork(t)
  const r=replay(undefined,undefined,defaultCaptured)
  const provider=getScraperCatalog().find(row=>row.source==='twilio')
  const jobs=await buildScrapers().find(row=>row.name==='twilio').run({fetchImpl:r.fetchImpl,requestIntervalMs:0})
  assert.deepEqual(jobs.map(job=>Number(job.jobId)),defaultFixture.proof.roles.map(role=>role.roleID))
  assert.equal(jobs.length,9)
  assert.equal(r.calls.length,48)
  assert.equal(readSourceObservationEvidence(jobs,'twilio').observedRecordCount,14)
  assert.ok(r.calls.filter(call=>call.phase==='closing').every(call=>call.cache==='no-store'))
  for(const job of jobs){
    const proof=defaultFixture.proof.roles.find(row=>String(row.roleID)===job.jobId)
    const normalized=normalizeScrapedJob(job,provider)
    assert.equal(normalized.sourceDescription,job.sourceDescription)
    assert.ok(extractActiveDescription(normalized.sourceDescription).includes(proof.authoredLocationContext),
      'Retain the complete authored state restriction, Travel and What We Offer paragraphs')
    assert.equal(normalized.location,'Remote - India')
    assert.equal(normalized.remoteStatus,'Remote','The literal native Remote label supplies the existing positive work-mode evidence')
    assert.equal(normalized.employerPostedAt,null)
    assert.equal(job.nativePostingDate,null)
    assert.equal(job.sourceScopeComplete,false)
    assert.equal(job.lifecycleCleanupAllowed,false)
    assert.equal(job.nativeSourceRecord.nativeLocationRepresentations.allIndiaEligibilityVerified,false)
  }
  const literal=jobs.find(job=>job.jobId==='1099552854135')
  assert.ok(literal)
  assert.ok(literal.nativeSourceRecord.originalPublishedRole.description.includes('<Karnataka,'))
  assert.ok(extractActiveDescription(normalizeScrapedJob(literal,provider).sourceDescription).includes('<Karnataka,'))
})

test('the exact original registered Twilio source uses the current employer-bound native transaction',async t=>{
  forbidNetwork(t)
  const r=replay(),registered=buildScrapers().find(row=>row.name==='twilio')
  assert.ok(registered)
  const jobs=await registered.run({...limits,fetchImpl:r.fetchImpl})
  assert.equal(jobs.length,4)
  assert.equal(jobs.every(job=>job.source==='twilio'),true)
  assert.equal(readSourceObservationEvidence(jobs,'twilio').observedRecordCount,14)
  assert.equal(r.calls.length,28)
  assert.equal(getScraperCatalog().find(row=>row.source==='twilio').companyName,'Twilio')
})

test('raw duplicate Twilio own-role identity survives transport parsing and withholds every staged role',async t=>{
  forbidNetwork(t)
  const r=replay((url,body)=>{
    if(url!==firstAPI)return body
    const serialized=JSON.stringify(JSON.parse(body)),changed=serialized.replace('"id":1099556746356','"id":1,"id":1099556746356')
    assert.notEqual(changed,serialized,'Mutate the acquired own-role identity')
    assert.equal(JSON.parse(changed).data.id,1099556746356)
    return changed
  })
  const observations=await held(r)
  assert.ok(observations.failures.some(row=>row.stage==='native-eightfold'))
})

test('an actual additional India schema address changing to a foreign country withholds the current Twilio batch',async t=>{
  forbidNetwork(t)
  const r=replay((url,body)=>{
    if(url!=='https://jobs.twilio.com/careers/job/1099556432090')return body
    let changed=false
    const next=body.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,(whole,start,json,end)=>{
      const model=JSON.parse(json)
      if(model['@type']!=='JobPosting')return whole
      assert.equal(model.jobLocation[1].address.addressCountry.name,'IN')
      model.jobLocation[1].address.addressCountry.name='US';changed=true
      return start+JSON.stringify(model)+end
    })
    assert.equal(changed,true,'Change the actual additional native country')
    return next
  })
  const observations=await held(r)
  assert.ok(observations.failures.some(row=>row.stage==='native-eightfold'))
  assert.ok(r.calls.some(row=>row.url===hrAPI))
})

test('Twilio native JSON keeps exact response identity and JSON media through shared acquisition',async t=>{
  forbidNetwork(t)
  for(const mutate of [row=>({...row,finalURL:firstRole}),row=>({...row,contentType:'text/html'})]){
    const observations=await held(replay(undefined,(url,row)=>url===firstAPI?mutate(row):row))
    assert.ok(observations.failures.some(row=>row.stage==='native-eightfold'))
  }
})

test('a lost closing corporate Twilio declaration withholds already acquired native roles',async t=>{
  forbidNetwork(t)
  const r=replay((url,body,count)=>{
    if(url!==corporateURL||count!==2)return body
    const changed=body.replaceAll(boardURL,'https://another-employer.example/careers')
    assert.notEqual(changed,body,'Remove the actual employer closing declaration')
    return changed
  })
  const observations=await held(r)
  assert.ok(observations.failures.some(row=>row.stage==='native-eightfold'))
  assert.ok(r.calls.some(row=>row.url===hrAPI))
})
