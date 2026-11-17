import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {readHome,readOffices,HOME,CAREERS,CONTACT} from './nativeModels.js'
import {inspectInventory} from './script.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-home-20261117.json.gz',import.meta.url))))
const packet=fixture.requests[0],bytes=Buffer.from(packet.bodyBase64,'base64'),html=bytes.toString('utf8')
assert.equal(packet.requestedURL,HOME);assert.equal(packet.url,HOME);assert.equal(packet.status,200)
assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)

test('EaseMyTrip current exact title retains its active own careers handoff and same relative document base',()=>{
 const model=readHome(html)
 assert.equal(model.title,'EaseMyTrip : Book Flights, Hotels, Trains, Bus & Holidays')
 assert.equal(model.currentHandoff,true);assert.equal(model.careersURL,CAREERS)
 assert.deepEqual(model.bases,[{href:'/'}])
 assert.ok(model.links.length>0)
})

test('EaseMyTrip current homepage title admission retains employer and base authority guards',()=>{
 for(const changed of [html.replace('EaseMyTrip : Book Flights','Other Company : Book Flights'),html.replace('<base href="/">','<base href="https://other.example/">')]){
  assert.notEqual(changed,html)
  assert.throws(()=>readHome(changed),/official homepage identity\/base changed/)
 }
})

const officeFixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-office-20261117.json.gz',import.meta.url))))
const officePacket=officeFixture.requests.find(row=>row.requestedURL===CONTACT),officeBytes=Buffer.from(officePacket.bodyBase64,'base64'),officeHTML=officeBytes.toString('utf8')
assert.equal(createHash('sha256').update(officeBytes).digest('hex'),officePacket.sha256)

test('EaseMyTrip current owned office title preserves the full explicit India office universe',()=>{
 const model=readOffices(officeHTML)
 assert.equal(model.title,'EaseMyTrip Customer Care Number & Contact Details')
 assert.equal(model.canonical,CONTACT)
 assert.equal(model.indiaCountryHeading,'Our Offices Within India')
 assert.ok(model.offices.some(office=>office.inIndia))
 assert.equal(model.cityDictionaryUsed,false)
})

test('EaseMyTrip office title variant cannot supply a missing native India country region',()=>{
 const changed=officeHTML.replace('Our Offices Within <em>India</em>','Our Offices <em>Worldwide</em>')
 assert.ok(changed!==officeHTML,'must remove the real active India office heading')
 assert.throws(()=>readOffices(changed),/office|India|region|publisher/)
})

test('EaseMyTrip current whole native responses reconcile twelve observations and ten India roles with cleanup held',async()=>{
 const original=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
 let index=0
 const result=await inspectInventory({minIntervalMs:0,fetchImpl:async url=>{
  const packet=original.requests[index++]
  assert.ok(packet,'no uncaptured current read')
  assert.equal(String(url),packet.requestedURL)
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
  const response=new Response(bytes,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.url})
  return response
 }})
 assert.equal(index,6);assert.equal(index,original.requests.length)
 assert.equal(result.roles.length,12);assert.equal(result.jobs.length,10)
 assert.equal(readSourceObservationEvidence(result.jobs,'easemytrip')?.observedRecordCount,12)
 assert.equal(readSourceObservationEvidence(result.jobs,'easemytrip')?.observedVacancyCount,12)
 assert.equal(result.roles.filter(role=>role.country===null).length,2)
 assert.equal(result.audit.nativeRoleClosingReconciled,10)
 assert.ok(result.jobs.every(job=>job.nativeRoleClosingReconciled&&job.sourceDetailComplete))
 assert.equal(result.audit.sourceScopeComplete,false)
 assert.equal(result.audit.lifecycleCleanupAllowed,false)
 assert.equal(sourceLifecycleCleanupForbidden(result.jobs),true)
})
