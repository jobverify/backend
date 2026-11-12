import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import {buildScrapers,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'
import {buildScraperAttemptDiagnostics,resolveZeroJobOutcome} from '../scraper-support/runner.js'
import {finishScraperProcessing,inventoryCleanupOptions} from '../scraper-support/utils/scraperOutcome.js'

// This is a CONTROLLED protocol replay, never a fresh transaction or a
// reconstruction of actual31. All responses/closings reuse the old fixture.
// Only the intake's opaque numeric literal is SYNTHETICALLY changed: opening
// is one below the genuine digits, closing is two below. Original headers,
// every other entity byte and all actual native vacancy models stay intact.
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/immuta-current-programme-20261111.json.gz',import.meta.url))))
const C='https://www.immuta.com/careers',G='https://api.lever.co/v0/postings/immuta?mode=json&group=department'
const A='https://api.lever.co/v0/postings/immuta?mode=json',I='https://jobs.lever.co/immuta/4372d3ba-00d6-4ae0-986c-e65d8dbf9def'
const order=[C,G,A,I,I,A,G,C],originals=new Map(fixture.responses.slice(0,4).map(row=>[row.requestedURL,row]))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const body=row=>Buffer.from(row.bodyBase64,'base64')
for(const url of[C,G,A,I])assert.equal(sha(body(originals.get(url))),originals.get(url).bodySHA256)
const native=JSON.parse(body(originals.get(A))),intakeHTML=body(originals.get(I)).toString('utf8')
const sourceOffset=intakeHTML.lastIndexOf('<script>')+8,literalOffset=sourceOffset+192
assert(intakeHTML.slice(sourceOffset,sourceOffset+1097).includes('__CF$cv$params'))
const originalLiteral=intakeHTML.slice(literalOffset,literalOffset+16)
const originalDigits=Buffer.from(originalLiteral,'base64').toString('ascii')
assert.match(originalDigits,/^[1-9][0-9]{9}$/)
assert.equal(Number(originalDigits),Date.parse(originals.get(I).headers.date)/1000,'Genuine retained Immuta observation has equality; its mismatch is synthetic below')
function controlledBody(delta){
  const digits=String(Number(originalDigits)+delta),literal=Buffer.from(digits,'ascii').toString('base64')
  assert.equal(literal.length,16)
  const changed=intakeHTML.slice(0,literalOffset)+literal+intakeHTML.slice(literalOffset+16)
  assert.equal(changed.slice(0,literalOffset),intakeHTML.slice(0,literalOffset))
  assert.equal(changed.slice(literalOffset+16),intakeHTML.slice(literalOffset+16))
  assert.notEqual(sha(changed),sha(intakeHTML))
  return{body:Buffer.from(changed),digits,literal,delta}
}
const syntheticOpening=controlledBody(-1),syntheticClosing=controlledBody(-2)

test('registered Immuta compares explicitly synthetic opaque literals with full native/prior/non-position proof',async t=>{
  const forbidden=()=>assert.fail('Controlled registered replay forbids public HTTP')
  t.mock.method(globalThis,'fetch',forbidden)
  for(const module of[http,https])for(const name of['get','request'])t.mock.method(module,name,forbidden)
  const calls=[]
  const jobs=await buildScrapers().find(row=>row.name==='immuta').run({
    requestIntervalMs:0,
    fetchPage:async url=>{
      const row=originals.get(url)
      if(!row)throw new Error('No original controlled legacy resource: '+url)
      return{url:row.finalURL,status:row.status,headers:row.headers,html:body(row).toString('utf8')}
    },
    fetchJson:async url=>{assert.equal(url,A);return structuredClone(native)},
    fetchImpl:async(url,init)=>{
      const index=calls.length,row=originals.get(url)
      assert.equal(url,order[index])
      calls.push({url,...init})
      const bytes=url===I?(index===3?syntheticOpening:syntheticClosing).body:body(row)
      const response=new Response(bytes,{status:row.status,headers:row.headers})
      Object.defineProperty(response,'url',{value:row.finalURL})
      return response
    },
  })
  const audit=jobs.nativeCollectionEvidence,inventory=readInventoryEvidence(jobs)
  assert.deepEqual(calls.map(row=>row.url),order)
  assert(calls.every(row=>row.method==='GET'&&row.cache==='no-store'&&row.credentials==='omit'&&row.redirect==='manual'))
  assert.equal(jobs.length,0)
  assert.equal(inventory.status,'complete-inventory')
  assert.equal(inventory.reportedTotal,11)
  assert.equal(inventory.indiaFacetCount,0)
  assert.equal(inventory.lifecycleCleanupAllowed,false)
  assert.equal(audit.priorNativePayloadReconciled,true)
  assert.deepEqual(audit.nativePayload,native)
  assert.deepEqual(audit.priorNativeObservation.nativePayload,native)
  assert.equal(audit.observedVacancyCount,11)
  assert.equal(audit.observedRecordCount,12)
  assert.equal(audit.nonPositionIntakeCount,1)
  assert.equal(audit.rawPages.length,8)
  assert.equal(audit.programmeRequestCount,8)
  assert.equal(audit.totalPublicRequests,null)
  for(const key of['sourceScopeComplete','companyGlobalScopeQualified','lifecycleCleanupAllowed','legalEmployerQualified','ownVacancyUIQualified','applicationVisited','screeningQualified','browserCORSExecutionQualified'])assert.equal(audit[key],false,key)
  for(const[index,intake,synthetic]of[[3,audit.intake,syntheticOpening],[4,audit.intakeClosing,syntheticClosing]]){
    const row=audit.rawPages[index],certificate=intake.requestMetadataCertificate
    assert.equal(row.bodyBase64,synthetic.body.toString('base64'))
    assert.equal(row.bodySHA256,sha(synthetic.body))
    assert.deepEqual(row.headers,originals.get(I).headers)
    assert.equal(certificate.comparisonProfile,'immuta-intake-server-publication-v1')
    assert.equal(certificate.tDateBound,false)
    assert.equal(certificate.sourceTimeSemanticsQualified,false)
    assert.equal(certificate.timeLiteral.rawBase64,synthetic.literal)
    assert.equal(certificate.timeLiteral.decodedDigits,synthetic.digits)
    assert.equal(certificate.timeLiteral.signedDifferenceSeconds,synthetic.delta)
    assert.equal(intake.classification,'explicit-native-general-interest-non-position')
    assert.equal(intake.classificationNotFromAgeCountryOrTitle,true)
    assert.equal(intake.nativeSchema['@type'],'JobPosting')
    assert.equal(intake.nativeCountry,null)
    assert.equal(intake.nativeLocality,'Remote USA or UK')
    assert(intake.fullOwnText.includes('not tied to a specific open position or work location'))
    assert(intake.fullOwnText.includes('Please see all of our current openings on our careers page.'))
  }
  assert.notEqual(audit.rawPages[3].bodySHA256,audit.rawPages[4].bodySHA256)
  assert.equal(audit.intake.requestMetadataCertificate.comparisonFingerprint,audit.intakeClosing.requestMetadataCertificate.comparisonFingerprint)
  const observation=readSourceObservationEvidence(jobs,'immuta')
  assert.equal(observation.observedRecordCount,12)
  assert.equal(observation.observedVacancyCount,11)
  const provider=getScraperCatalog().find(row=>row.source==='immuta')
  assert(provider,'Use the actual original-source registration for terminal diagnostics')
  const terminal=finishScraperProcessing({success:true,...buildScraperAttemptDiagnostics(jobs,undefined,provider),zeroJobEvidence:resolveZeroJobOutcome({provider},jobs,[])})
  assert.equal(terminal.success,true)
  assert.equal(terminal.processingComplete,true)
  assert.equal(terminal.rawRecords,11,'Runner rawRecords uses the observed vacancy total, excluding the separate non-position intake')
  assert.equal(terminal.sourceObservations.observedRecordCount,12)
  assert.equal(terminal.sourceObservations.observedVacancyCount,11)
  assert.equal(terminal.zeroJobEvidence,'fetched-zero')
  assert.deepEqual(inventoryCleanupOptions(JSON.parse(JSON.stringify(terminal))),{replaceExisting:false})
})
