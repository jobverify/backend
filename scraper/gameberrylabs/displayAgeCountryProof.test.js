import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createGameberryLabsScraper} from './script.js'
import {transport,retainedFixture,retainedBody} from '../acciojob/current.fixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const ageFixtures=retainedFixture('gameberry-display-age-real-responses.json.gz').responsesByAge
const currentBody=retainedBody(ageFixtures['70'])
const capturedRows=JSON.parse(currentBody),captured=capturedRows.find(row=>row.id===85579)
const hash=value=>createHash('sha256').update(value).digest('hex')
const fetchRows=(change=()=>{},rendererChange=body=>body)=>transport((url,body)=>{
  if(url.includes('/api/embedjobs/js/'))return rendererChange(body)
  if(!url.includes('/active'))return body
  const rows=JSON.parse(currentBody);change(rows.find(row=>row.id===85579));return JSON.stringify(rows)
})
const execute=fetchImpl=>createGameberryLabsScraper().run({fetchImpl})

test('actual retained UTC-rollover display age70 preserves exact stable country signature and original full raw counter',async()=>{
  assert.equal(captured.publishedSinceDays,70)
  const reference=JSON.parse(retainedBody(ageFixtures['69'])).find(row=>row.id===85579)
  const {publishedSinceDays:referenceAge,...referenceStable}=reference
  const {publishedSinceDays:actualAge,...actualStable}=captured
  assert.equal(referenceAge,69);assert.deepEqual(actualStable,referenceStable)
  const jobs=await execute(fetchRows())
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,10)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,9)
  const raw=jobs[0].sourceNativeResolvedForeignPayloads[0],proof=jobs[0].sourceNativeCountryResolutionProofs[0]
  assert.deepEqual(raw,captured)
  assert.equal(raw.jobLocations[0].countryCode,'SP')
  assert.equal(proof.rawRecordSha256,hash(JSON.stringify(captured)))
  assert.equal(proof.allowOnlyThisDisplayAgeField,'publishedSinceDays')
  assert.equal(proof.actualPublishedSinceDays,70)
  const {publishedSinceDays,...stable}=captured
  assert.equal(proof.stableSignatureSha256,hash(JSON.stringify(stable)))
})

for(const[name,change]of[
  ['description',r=>r.description+='<p>New mandatory criterion</p>'],
  ['publishedOn',r=>r.publishedOn='2026-08-23T10:00:00.000Z'],
  ['title',r=>r.title+=' changed'],
  ['location',r=>r.jobLocations[0].name='Madrid'],
  ['country',r=>r.jobLocations[0].countryName='India'],
  ['new nested criteria',r=>r.salaryRange.requiredCertification={mandatory:true}],
  ['skills',r=>r.skillNames.push('Mandatory certification')],
  ['location alternative',r=>r.jobLocations.push({...r.jobLocations[0],id:12812})],
  ['negative age',r=>r.publishedSinceDays=-1],
  ['fractional age',r=>r.publishedSinceDays=70.5],
  ['string age',r=>r.publishedSinceDays='70'],
  ['unsafe age',r=>r.publishedSinceDays=Number.MAX_SAFE_INTEGER+1],
  ['missing age',r=>delete r.publishedSinceDays],
  ['object age',r=>r.publishedSinceDays={mandatoryLicense:'Required'}]
])test(`display-age allowance cannot admit ${name} drift`,async()=>{
  let jobs
  try{jobs=await execute(fetchRows(change))}catch(error){assert.match(error.message,/country|conflict|criteria|identity|detail|location|native/i);return}
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.ok(jobs[0].sourceNativeUnresolvedPayloads.some(r=>r.id===85579))
  assert.equal(jobs[0].sourceNativeResolvedForeignPayloads,undefined)
})

test('display-age allowance still requires exact reviewed country-name-only renderer',async()=>{
  const jobs=await execute(fetchRows(()=>{},body=>body+'\n/* changed renderer */'))
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(jobs[0].sourceNativeResolvedForeignPayloads,undefined)
})

test('display-age allowance never ignores a counter change during closing full-array reconciliation',async()=>{
  const calls=new Map(),base=fetchRows()
  const fetchImpl=async(url,options)=>{
    const response=await base(url,options),count=(calls.get(url)||0)+1;calls.set(url,count)
    if(url.includes('/active')&&count===2){const rows=JSON.parse(await response.text());rows.find(r=>r.id===85579).publishedSinceDays=71;return {...response,text:async()=>JSON.stringify(rows)}}
    return response
  }
  await assert.rejects(execute(fetchImpl),/closing|inventor.*disagree/i)
})
