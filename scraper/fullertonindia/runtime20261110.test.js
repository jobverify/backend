import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {createFullertonIndiaScraper,mapListingRecordToJob,JOBS_API_URL} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {nativePDFRoleIdentity} from './nativeDetails.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime20261110.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.map(packet=>[packet.requestedURL,packet]))
const bytes=packet=>Buffer.from(packet.rawBodyBase64,'base64')
const listing=JSON.parse(JSON.parse(bytes(packets.get(JOBS_API_URL)).toString('utf8')).d.obj1)
const replay=()=>({maxDetails:3,
 fetchPage:async url=>{const packet=packets.get(url);assert.ok(packet,'Only original captured HTML is replayed');return {status:packet.status,url:packet.finalURL,headers:packet.headers,html:bytes(packet).toString('utf8')}},
 fetchJson:async(url,init)=>{const packet=packets.get(url);assert.ok(packet,'Only original native query is replayed');assert.equal(init.method,packet.method);assert.equal(init.body,packet.requestBody);return JSON.parse(bytes(packet).toString('utf8'))},
 fetchPDF:async url=>{const packet=packets.get(url);assert.ok(packet,'Only original captured PDF is replayed');return bytes(packet)},
})

test('genuine ten-packet current fixture retains exact original bytes and full thirteen-row native listing',()=>{
 assert.equal(fixture.packets.length,10)
 assert.equal(listing.length,13)
 for(const packet of fixture.packets){assert.equal(bytes(packet).length,packet.bodyBytes);assert.equal(createHash('sha256').update(bytes(packet)).digest('hex'),packet.bodySHA256)}
})

test('unknown country cannot become India through the public native mapper',()=>{
 for(const country of [undefined,null,'']){
  const job=mapListingRecordToJob({...listing[0],Country_Name:country})
  assert.equal(job.country,null)
  assert.equal(job.sourceCountryScopeUnresolved,true)
  assert.doesNotMatch(job.location,/\bIndia\b/i)
 }
})

test('the native mapper preserves an explicit foreign country',()=>{
 const job=mapListingRecordToJob({...listing[0],Country_Name:'Canada',LOCATIONNAME:'Toronto'})
 assert.equal(job.country,'Canada')
 assert.equal(job.location,'Toronto, Canada')
 assert.equal(job.sourceCountryScopeUnresolved,false)
})

test('listing summaries cannot substitute for full role criteria',()=>{
 const job=mapListingRecordToJob(listing[0])
 assert.equal(job.jobDescription,null)
 assert.equal(job.sourceDetailComplete,false)
 assert.ok(job.sourceListingSummary.includes(listing[0].Field1))
})

test('invalid native calendar days remain unknown',()=>{
 for(const day of ['31-Feb-2026','31-Apr-2026','00-Nov-2026'])assert.equal(mapListingRecordToJob({...listing[0],PublishDate:day}).postingDate,null)
 assert.equal(mapListingRecordToJob(listing[0]).postingDate,'2026-11-06')
})

test('the original detail failure remains the error cause and observed rows are unqualified evidence',async()=>{
 const original=Object.assign(new Error('Synthetic native PDF transport failure'),{code:'SYNTHETIC_NATIVE_READ'})
 await assert.rejects(createFullertonIndiaScraper().run({...replay(),fetchPDF:async()=>{throw original}}),error=>{
  assert.equal(error.cause,original)
  assert.equal(error.nativeEvidence.observedListingCount,13)
  assert.ok(error.nativeEvidence.failures.length>=3)
  assert.equal(error.sourceScopeComplete,false)
  assert.equal(error.lifecycleCleanupAllowed,false)
  return true
 })
})

test('bounded current PDF replay retains all thirteen observations without certifying source inventory',async()=>{
 const jobs=await createFullertonIndiaScraper().run(replay())
 const observed=readSourceObservationEvidence(jobs,'fullertonindia')
 assert.equal(observed.observedRecordCount,13)
 assert.equal(observed.sourceScopeComplete,false)
 assert.equal(observed.companyGlobalTotal,null)
 assert.equal(observed.companyIndiaTotal,null)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.firstParty,false)
})

test('employer-linked PDFs with unresolved explicit role titles retain vacancies without complete criteria',async()=>{
 const jobs=await createFullertonIndiaScraper().run(replay())
 assert.equal(jobs.length,3)
 const byId=new Map(jobs.map(job=>[job.requisitionId,job]))
 for(const id of ['110709','109060']){
  const job=byId.get(id)
  assert.equal(job.jobDescription,null)
  assert.equal(job.sourceDescription,null)
  assert.equal(job.sourceDetailComplete,false)
  assert.equal(job.sourceDescriptionIdentityComplete,false)
  assert.equal(job.sourceDetailFailureKind,'native-description-role-title-unreconciled')
  assert.ok(job.nativeSourceRecord.pdf.text.length>2000)
  assert.equal(job.country,'India')
 }
 const matching=byId.get('110708')
 assert.equal(matching.sourceDescriptionIdentityComplete,true)
 assert.equal(matching.sourceDetailComplete,true)
 assert.ok(matching.jobDescription.includes('Job Title Manager, Data Engineering'))
 assert.equal(matching.sourceNativePDFTitle,'Manager, Data Engineering')
})

test('explicit PDF title comparison allows presentation changes without inferring title aliases',()=>{
 const record={Position_Name:'Manager, Data Engineering'}
 assert.equal(nativePDFRoleIdentity({pages:['Job Title  MANAGER — Data Engineering']},record).complete,true)
 assert.equal(nativePDFRoleIdentity({pages:['Job Title\nManager, Data Engineering']},record).complete,true)
 for(const page of ['Job Title Senior Manager, Data Engineering','Manager, Data Engineering','Job Title Manager, Data Engineering\nJob Title Business Manager']){
  assert.equal(nativePDFRoleIdentity({pages:[page]},record).complete,false)
 }
})

test('ambiguous native country labels remain unresolved in the mapper',()=>{
 const job=mapListingRecordToJob({...listing[0],Country_Name:'Canada / India'})
 assert.equal(job.country,null)
 assert.equal(job.sourceNativeCountryLabel,'Canada / India')
 assert.equal(job.sourceCountryScopeUnresolved,true)
})

test('unknown native countries retain observations without asserting verified zero hiring',async()=>{
 const options=replay(),read=options.fetchJson
 options.fetchJson=async(...args)=>{
  const payload=await read(...args)
  payload.d.obj1=JSON.stringify(JSON.parse(payload.d.obj1).map(record=>({...record,Country_Name:null})))
  return payload
 }
 const jobs=await createFullertonIndiaScraper().run(options)
 assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'fullertonindia').observedRecordCount,13)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('nonprimitive native country fields cannot supply country proof',()=>{
 for(const country of [['India'],{name:'India'},123,true]){
  const job=mapListingRecordToJob({...listing[0],Country_Name:country})
  assert.equal(job.country,null)
  assert.equal(job.sourceCountryScopeUnresolved,true)
  assert.doesNotMatch(job.location,/\bIndia\b/i)
 }
})

test('an array country cannot qualify native India detail acquisition',async()=>{
 const options=replay(),read=options.fetchJson
 options.fetchJson=async(...args)=>{
  const payload=await read(...args)
  payload.d.obj1=JSON.stringify(JSON.parse(payload.d.obj1).map(record=>({...record,Country_Name:['India']})))
  return payload
 }
 const jobs=await createFullertonIndiaScraper().run(options)
 assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'fullertonindia').observedRecordCount,13)
})

test('PDF identity preserves word boundaries and checks contradictory later-page title fields',()=>{
 const record={Position_Name:'Manager, Data Engineering'}
 assert.equal(nativePDFRoleIdentity({pages:['Job Title ManagerDataEngineering']},record).complete,false)
 assert.equal(nativePDFRoleIdentity({pages:['Job Title Manager, Data Engineering','Job Title Business Manager']},record).complete,false)
 assert.equal(nativePDFRoleIdentity({pages:['Job Title Manager, Data Engineering','Job Title MANAGER — Data Engineering']},record).complete,true)
})
