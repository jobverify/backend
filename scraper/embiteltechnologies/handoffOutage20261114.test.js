import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {run,CAREERS_URL,OPENINGS_URL,JOBS_SCRIPT_URL,JOBS_API_URL} from './script.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const retained=name=>readFileSync(new URL('../../scraper-support/tests/fixtures/embiteltechnologies/'+name,import.meta.url),'utf8')
const pages=new Map([[CAREERS_URL,retained('careers.html')],[OPENINGS_URL,retained('openings.html')],[JOBS_SCRIPT_URL,retained('client.txt')]])
const failure=JSON.parse(readFileSync(new URL('./fixtures/handoff-failure-20261114.json',import.meta.url)))
const options=payload=>({fetchText:async url=>{assert.ok(pages.has(url));return pages.get(url)},fetchJson:async url=>{assert.equal(url,JOBS_API_URL,'No native inventory may be requested without an employer handoff');return structuredClone(payload)}})

test('Embitel preserves the declared handoff service connection refusal as an unresolved upstream outage',async()=>{
 await assert.rejects(run(options(failure)),error=>{
  assert.equal(error.code,'EMBITEL_HANDOFF_UPSTREAM_UNAVAILABLE')
  assert.equal(error.upstreamService,'wdhub.embitel.in')
  assert.equal(error.upstreamCode,7)
  assert.equal(error.upstreamMessage,failure.data)
  assert.equal(error.abortRetries,true)
  assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'upstream_unavailable'})
  assert.deepEqual(error.recruitmentObservations.nativeHandoffResponse,failure)
  assert.equal(error.recruitmentObservations.sourceScopeComplete,false)
  assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed,false)
  return true
 })
})

test('Embitel does not mislabel unknown response shapes or unrelated service failures as the known outage',async()=>{
 for(const payload of [{success:true,data:[]},{success:false,data:'Unexpected fields'},{success:false,data:'cURL error 7: Failed to connect to unrelated.example port 443 after 77 ms: Connection refused'}]){
  await assert.rejects(run(options(payload)),error=>error.code!=='EMBITEL_HANDOFF_UPSTREAM_UNAVAILABLE'&&error.softFailure!==true)
 }
})
