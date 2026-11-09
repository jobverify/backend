import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createCatalogScraper } from '../../scraper-support/providers/index.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'
import { decodeGemList, parseGemJSON } from '../../scraper/bigeye/nativeGemCurrent20261108.js'

const HOME='https://www.bigeye.com/'
const sha=value=>createHash('sha256').update(value).digest('hex')
const fixture=()=>{
 const bytes=readFileSync(new URL('../../scraper/bigeye/test-data-20261108/native-gem-public.json.gz',import.meta.url))
 assert.equal(sha(bytes),'e41d06a57dd81485fee5b1dc40a4e3d5ef9c6d7fade0ca48c550b0f50c29e033')
 const data=JSON.parse(gunzipSync(bytes))
 assert.equal(data.actualEmpty.body,'[]\n')
 assert.equal(Buffer.byteLength(data.actualEmpty.body),3)
 assert.equal(sha(data.actualEmpty.body),data.actualEmpty.sha256)
 assert.equal(data.actualEmpty.sha256,'37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570')
 assert.equal(data.synthetic.label,'DOC_SCHEMA_CONTROL_ONLY_NOT_GENUINE_VACANCY')
 return data
}

// Portable contract controls, not a fabricated India/default publisher workflow.
// Whole publisher programmes/HTML remain private. The separate source gate and
// actual registered capture provide dated integration evidence outside this
// portable cohort. Neither a decoded[] nor a synthetic hold is company-zero.
export async function assertBigeyeGemContract(_t,provider){
 assert.equal(provider.source,'bigeye')
 const data=fixture(),controlledClock='2026-11-08T00:00:00.000Z'
 const native=decodeGemList(parseGemJSON(data.actualEmpty.body),controlledClock)
 assert.deepEqual(native,{models:[],observations:[],holds:[]})
 const model=structuredClone(data.synthetic.row)
 const held=decodeGemList([model],controlledClock)
 assert.deepEqual(held.models,[model])
 assert.equal(held.observations.length,1)
 assert.equal(held.holds.length,1)
 assert.deepEqual(held.observations[0].model,model)
 assert.deepEqual(held.holds[0].model,model)
 assert.equal(held.observations[0].nativeId,model.id)
 assert.equal(held.observations[0].nativeURL,model.absolute_url)
 assert.equal(held.observations[0].country,null)
 assert.equal(held.observations[0].legalEmployer,null)
 assert.equal(held.observations[0].qualification,'discovery-only')
 const hold=held.holds[0]
 assert.equal(hold.country,null);assert.equal(hold.legalEmployer,null)
 assert.equal(hold.postingDate,model.first_published_at)
 assert.deepEqual(hold.rawDates,{first_published_at:model.first_published_at,created_at:model.created_at,updated_at:model.updated_at})
 assert.deepEqual(hold.rawCriteria,{content:model.content,content_plain:model.content_plain})
 assert.deepEqual(hold.rawLocations,{location:model.location,offices:model.offices})
 assert.deepEqual(hold.reasons,['no-native-typed-country-carrier','no-native-legal-employer-carrier','full-role-country-and-criteria-evidence-unreviewed'])
 assert.equal(Object.hasOwn(hold,'job'),false)
 assert.notEqual(model.id,model.internal_job_id)
 assert.notEqual(model.id,model.requisition_id)
 const unknown=structuredClone(model)
 unknown.unreviewedMandatoryBusinessCriterion={text:'Synthetic unknown carrier remains raw and unqualified.'}
 const unknownResult=decodeGemList([unknown],controlledClock)
 assert.deepEqual(unknownResult.models,[unknown]);assert.deepEqual(unknownResult.holds[0].model,unknown)
 assert.equal(unknownResult.holds[0].country,null);assert.equal(unknownResult.holds[0].legalEmployer,null)
 assert.ok(unknownResult.holds[0].reasons.includes('unsupported-native-fields'))
 return {native,syntheticHeld:held,qualification:'Portable native decoder/explicit-hold controls only; no live/default publisher positive, qualified India role, company-zero or cleanup proof.'}
}

const assertRequest=(input,init)=>{
 assert.equal(String(input),HOME)
 assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined)
 const headers=new Headers(init.headers)
 assert.equal(headers.get('accept'),'text/html')
 assert.equal(headers.get('user-agent'),'Mozilla/5.0 (compatible; Jobverify careers inventory check)')
 assert.equal(headers.has('authorization'),false);assert.equal(headers.has('cookie'),false)
}
const ownDenied=response=>{Object.defineProperty(response,'url',{value:HOME});return response}
const assertDenied=error=>{
 assert.equal(error.status,403);assert.equal(error.statusCode,403)
 assert.equal(error.failureKind,'blocked_or_access_denied')
 assert.equal(error.softFailure,true);assert.equal(error.upstreamOutage,true);assert.equal(error.abortRetries,true)
 assert.equal(error.inventoryCleanupAllowed,false)
 assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'})
 assert.equal(error.receipt.requestedURL,HOME);assert.equal(error.receipt.finalURL,HOME);assert.equal(error.receipt.status,403)
 assert.equal(error.inventoryEvidence,undefined)
 return true
}
export async function assertBigeyeGemDenial(_t,provider){
 assert.equal(provider.source,'bigeye')
 const body='Controlled synthetic Bigeye HTTP403, not a current live denial.';let calls=0
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:async(input,init)=>{
  calls++;assertRequest(input,init)
  return ownDenied(new Response(body,{status:403,headers:{'content-type':'text/html'}}))
 }}),error=>{
  assertDenied(error);assert.equal(error.receipt.complete,true);assert.equal(error.receipt.body,body)
  assert.equal(error.receipt.bodyBytes,Buffer.byteLength(body));assert.equal(error.receipt.bodySHA256,sha(body));assert.equal(error.cause,undefined)
  return true
 })
 assert.equal(calls,1,'No retry/fallback/empty result after own primary403')
 const reason=Object.freeze({syntheticOpaqueBodyError:true});let failedBodyCalls=0
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:async(input,init)=>{
  failedBodyCalls++;assertRequest(input,init)
  return ownDenied(new Response(new ReadableStream({start(controller){controller.error(reason)}}),{status:403,headers:{'content-type':'text/html'}}))
 }}),error=>{assertDenied(error);assert.equal(error.cause,reason);assert.equal(error.receipt.complete,false);return true})
 assert.equal(failedBodyCalls,1)
 for(const callerReason of[null,Symbol('synthetic-opaque-caller'),Object.freeze(Object.create(null))]){
  const controller=new AbortController();controller.abort(callerReason);let reads=0,caught=false
  try{await createCatalogScraper(provider).run({signal:controller.signal,fetchImpl:async()=>{reads++;assert.fail('Caller abort must precede all HTTP')}})}catch(error){caught=true;assert.equal(error,callerReason)}
  assert.equal(caught,true);assert.equal(reads,0)
 }
}
