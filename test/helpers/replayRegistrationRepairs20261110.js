import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {extractionFailureDetails} from '../../scripts/catalogExtractionFailureEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const specs={
  onsemiconductor:{path:'../../scraper/onsemiconductor.workday/test-data/native-20261110.json.gz',reads:83,india:35,native:36},
  lennoxinternational:{path:'../../scraper/lennoxinternational.workday/fixtures/native20261111.json.gz',reads:38,india:15,native:15},
}
function currentFixture(source){
  const spec=specs[source]
  assert.ok(spec,'Unknown registration fixture')
  const fixture=JSON.parse(gunzipSync(readFileSync(new URL(spec.path,import.meta.url))))
  const originals=fixture.packets||fixture.responses
  assert.ok(Array.isArray(originals))
  for(const packet of originals){
    const bytes=Buffer.from(packet.bodyBase64,'base64')
    assert.equal(sha(bytes),packet.bodySHA256)
    if(packet.bodyBytes!==undefined)assert.equal(bytes.length,packet.bodyBytes)
    assert.ok(Date.parse(packet.completedAt)>=Date.parse(packet.requestedAt))
  }
  const packets=source==='onsemiconductor'?originals.filter(packet=>packet.capture==='registered-current'):originals
  assert.equal(packets.length,spec.reads)
  return{spec,packets}
}
const optionsFor=source=>source==='onsemiconductor'
  ?{maxRequests:128,maxDetails:80,maxPages:4,sourceTimeoutMs:180000}:{}

export async function assertRegistrationRepairExtraction(t,provider){
  const {spec,packets}=currentFixture(provider.source),calls=[]
  t.mock.method(globalThis,'fetch',()=>assert.fail('Uncontrolled HTTP refused'))
  const fetchImpl=async(url,init={})=>{
    const packet=packets[calls.length]
    assert.ok(packet,'Extra request exceeds retained original workflow')
    assert.equal(String(url),packet.requestedURL,'Each original global request occurrence must retain its position')
    assert.equal(init.method||'GET',packet.method||'GET')
    assert.equal(init.body,undefined)
    const headers=new Headers(init.headers)
    assert.equal(headers.has('authorization'),false)
    assert.equal(headers.has('cookie'),false)
    calls.push(packet)
    const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,
      headers:packet.headers||{'content-type':packet.contentType}})
    Object.defineProperty(response,'url',{value:packet.finalURL})
    return response
  }
  const jobs=await createCatalogScraper(provider).run({...optionsFor(provider.source),fetchImpl})
  assert.equal(calls.length,spec.reads,'Complete opening and distinct closing workflow required')
  assert.equal(jobs.length,spec.india)
  assert.equal(readSourceObservationEvidence(jobs,provider.source).observedVacancyCount,spec.native)
  const inventory=readInventoryEvidence(jobs)
  assert.equal(inventory.status,'coverage-gap')
  assert.equal(inventory.listingComplete,false)
  assert.equal(inventory.reportedTotal,null)
  assert.equal(inventory.indiaFacetCount,null)
  for(const job of jobs){
    assert.equal(job.source,provider.source)
    assert.equal(job.country,'India')
    assert.equal(job.sourceScopeComplete,false)
    assert.equal(job.sourceListingComplete,false)
    assert.equal(job.lifecycleCleanupAllowed,false)
    assert.equal(job.nativeLegalEmployer,null)
    assert.ok(job.jobDescription.length>100)
    if(provider.source==='onsemiconductor'){
      const url=job.sourceNativeClosingEvidence.detailURL
      const responses=packets.filter(packet=>packet.requestedURL===url)
      assert.equal(responses.length,2)
      const opening=JSON.parse(Buffer.from(responses[0].bodyBase64,'base64')).items[0]
      const closing=JSON.parse(Buffer.from(responses[1].bodyBase64,'base64')).items[0]
      assert.deepEqual(job.nativeSourceRecord.detail,opening)
      assert.deepEqual(opening,closing)
      assert.equal(job.sourceNativeClosingEvidence.detailSHA256,sha(JSON.stringify(closing)))
      assert.equal(job.sourcePublisherBrand,'onsemi')
      assert.equal(job.company,'ON Semiconductor')
      assert.equal(opening.PrimaryLocationCountry,'IN')
      for(const field of ['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr']){
        if(opening[field])assert.ok(job.jobDescription.includes(opening[field]),field+' must remain whole')
      }
    }else{
      const responses=packets.filter(packet=>packet.requestedURL===job.sourceNativeRequestedURL)
      assert.equal(responses.length,2)
      assert.deepEqual(JSON.parse(job.sourceNativeSchemaJSON),job.sourceNativeSchema)
      for(const packet of responses)assert.ok(Buffer.from(packet.bodyBase64,'base64').toString('utf8').includes(job.sourceNativeSchemaJSON))
      assert.equal(job.jobDescription,job.sourceNativeSchema.description)
      assert.ok(job.sourceNativeSchema.jobLocation.every(place=>place.address.addressCountry==='IN'))
      assert.equal(job.sourceNativeSchema.hiringOrganization.name,'Lennox International')
      assert.equal(job.sourceEmployerBinding.legalEntityVerified,false)
    }
  }
  return{jobs,calls}
}

export async function assertRegistrationRepairDenial(t,provider){
  const {packets}=currentFixture(provider.source),calls=[]
  t.mock.method(globalThis,'fetch',()=>assert.fail('Uncontrolled HTTP refused'))
  const fetchImpl=async(url,init={})=>{
    assert.equal(calls.length,0,'No retry or fallback after primary denial')
    assert.equal(String(url),packets[0].requestedURL)
    assert.equal(init.method||'GET','GET')
    calls.push(String(url))
    const response=new Response('Forbidden',{status:403,headers:{'content-type':'text/html'}})
    Object.defineProperty(response,'url',{value:String(url)})
    return response
  }
  await assert.rejects(createCatalogScraper(provider).run({...optionsFor(provider.source),fetchImpl}),error=>{
    assert.equal(extractionFailureDetails(error).failureKind,'blocked_or_access_denied',
      'The standard auditor must retain the actual HTTP denial classification')
    const receipts=[...(error.onsemiTransportReceipts||[]),...(error.nativeOriginalResponses||[]),
      ...(error.recruitmentObservations?.receipts||[]),...(error.nativeEvidence?.transportPackets||[])]
    assert.ok(error.status===403||/403/.test(error.message)||receipts.some(packet=>packet.status===403),'Original access denial remains inspectable')
    if(error.inventoryEvidence){
      assert.equal(error.inventoryEvidence.listingComplete,false)
      assert.equal(error.inventoryEvidence.reportedTotal,null)
    }
    return true
  })
  assert.equal(calls.length,1)
}
