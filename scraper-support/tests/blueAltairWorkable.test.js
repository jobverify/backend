import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { run } from '../../scraper/bluealtair/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
const captured = JSON.parse(fs.readFileSync(new URL('./fixtures/bluealtair/native.json',import.meta.url)))
const url = 'https://apply.workable.com/api/v3/accounts/blue-altair/jobs'
const options = (fixture = structuredClone(captured)) => ({now: () => '2026-10-20T22:00:00.000Z',fetchJson:async (request, init = {}) => {
  if (request === url) {
    assert.equal(init.method,'POST')
    const body=JSON.parse(init.body)
    assert.deepEqual({...body,token:undefined},{query:'',location:[],department:[],worktype:[],remote:[],token:undefined})
    if (body.token === undefined) return fixture.pages[0]
    assert.equal(body.token,fixture.pages[0].nextPage)
    return fixture.pages[1]
  }
  assert.ok(request.startsWith('https://apply.workable.com/api/v2/accounts/blue-altair/jobs/'))
  const id=request.split('/').at(-1)
  assert.ok(fixture.details[id])
  return fixture.details[id]
}})
test('Blue Altair native twelve-role inventory yields ten complete India details across two pages', async () => {
  const jobs=await run(options())
  assert.equal(jobs.length,10)
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.reportedTotal,12)
  assert.equal(evidence.indiaFacetCount,10)
  assert.equal(evidence.pagesFetched,2)
  assert.equal(evidence.listingComplete,true)
  assert.equal(new Set(jobs.map(j=>j.jobId)).size,10)
  assert.ok(jobs.every(j=>j.company==='Blue Altair' && j.country==='India' && j.jobDescription.includes('Requirements') && j.jobDescription.includes('Benefits')))
  const publication=analyzePublishableJobs(jobs,{now:new Date('2026-10-20T22:00:00.000Z')})
  assert.equal(publication.eligibleJobs.length,0)
  assert.equal(publication.filterCounts.old,10)
})
test('preserves the native 2025 publication date and exact public shortcode URLs', async () => {
  const jobs=await run(options())
  const old=jobs.find(j=>j.jobId==='0770DA56CD')
  assert.equal(old.postingDate,'2025-08-12T00:00:00.000Z')
  assert.equal(old.sourceUrl,'https://apply.workable.com/blue-altair/j/0770DA56CD/')
  assert.equal(old.applyUrl,old.sourceUrl+'apply/')
  assert.equal(old.sourceListingComplete,true)
})
for (const [label, mutate] of [
  ['foreign account', f=>{f.pages[0].results[0].accountUid='other'}],
  ['changed total', f=>{f.pages[1].total=13}],
  ['duplicate role', f=>{f.pages[1].results[0]=structuredClone(f.pages[0].results[0])}],
  ['missing terminal row', f=>{f.pages[1].results.pop()}],
  ['HTTP200 upstream error', f=>{f.pages[0].error='Unavailable'}],
  ['missing full description', f=>{f.details.C0BC7ABDF3.description='<script>teaser only</script>'}],
  ['changed detail country', f=>{f.details.C0BC7ABDF3.location.countryCode='US'}],
  ['refreshed old detail date', f=>{f.details['0770DA56CD'].published='2026-10-20T00:00:00.000Z'}],
]) test(`Blue Altair fails closed for ${label}`, async()=>{const f=structuredClone(captured);mutate(f);await assert.rejects(run(options(f)))})
test('output cap preserves incomplete listing markers and abort never certifies zero', async()=>{
  const jobs=await run({...options(),maxJobs:2})
  assert.equal(jobs.length,2)
  assert.ok(jobs.every(j=>j.sourceListingComplete===false))
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  await assert.rejects(run({...options(),signal:AbortSignal.abort()}))
})
