import {fixture,replay,editJSON,editHTML,mutateNativePost} from '../../scraper-support/native-sources/publicLeverChannels/fixtureReplay.js'
import {syntheticPaginatedVgs} from '../../scraper-support/native-sources/publicLeverChannels/testSupport.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { CAREERS_URL, LEVER_BOARD_URL, extractIndiaLeverJobs, run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const native = JSON.parse(readFileSync(new URL('./test-data/2026-10-31-bay-area.json', import.meta.url), 'utf8'))
const primary = () => structuredClone(native[0])
const secondary = () => structuredClone(native[1])
const careers = '<title>Careers | VGS</title><h1>It Takes Exceptional People to Build VGS</h1><h2>What We Look For In Every Teammate</h2><h2>Discover Opportunities</h2><a href="#lever-jobs-container">Open Roles</a><div id="lever-jobs-container"></div>'
const board = records => '<title>VGS</title><meta property="og:url" content="https://jobs.lever.co/verygoodsecurity">Location type Location Team Work type Powered by Lever' + records.map(job => `<a href="${job.hostedUrl}">${job.text}</a>`).join('')
const runWith = (records, pages = [records]) => run({
  fetchText: async url => url === CAREERS_URL ? careers : url === LEVER_BOARD_URL ? board(records) : assert.fail('Unexpected public URL'),
  fetchJson: async url => pages[Number(new URL(url).searchParams.get('skip')) / 100],
})

test("VGS resolves the actual current secondary Bay Area from explicit native own-country references",async()=>{
   const r=replay(),jobs=await run(r.options),a=r.audits[0]
   const row=a.observations.find(row=>row.jobId==='4f565c0a-7a1c-4f43-ba97-0559658661dc')
   assert.equal(row.country,'United States');assert.equal(row.sourceCountryScopeUnresolved,false)
   assert.ok(row.sourceNativeLocationCountryCorroborations.some(value=>value.location==='San Francisco Bay Area'&&value.nativePostingIds.length))
   assert.equal(jobs.length,0)
  
})

test("VGS retains all current corroborated foreign observations without complete-employer inventory claims",async()=>{
   const r=replay(),jobs=await run(r.options),evidence=readInventoryEvidence(jobs)
   assert.equal(r.audits[0].observations.length,18)
   assert.equal(evidence.status,'discovery-only');assert.equal(evidence.listingComplete,false)
   assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
   assert.equal(r.audits[0].sourceScopeComplete,false)
  
})

test('VGS rejects country conflicts on explicit primary country names', () => {
  const foreign = { ...secondary(), country: 'IN', categories: { location: 'United States', allLocations: ['United States'] } }
  assert.throws(() => extractIndiaLeverJobs([foreign]), /conflict/i)
})

test('VGS does not infer a secondary city from the primary posting country alone', () => {
  assert.throws(() => extractIndiaLeverJobs([secondary()]), /incomplete location scope/)
})

test('VGS rejects conflicting native countries for the same primary location label', () => {
  const conflicting = { ...primary(), id: 'conflict', country: 'GB', hostedUrl: 'https://jobs.lever.co/verygoodsecurity/conflict', applyUrl: 'https://jobs.lever.co/verygoodsecurity/conflict/apply' }
  assert.throws(() => extractIndiaLeverJobs([...native, conflicting]), /conflict|ambiguous/i)
})

test('VGS cannot use placeholder country codes or generic Remote labels to certify secondary scope', () => {
  assert.throws(() => extractIndiaLeverJobs([{ ...primary(), country: 'ZZ' }, secondary()]), /incomplete|country|location/i)
  const remotePrimary = { ...primary(), categories: { location: 'Remote', allLocations: ['Remote'] } }
  const remoteSecondary = { ...secondary(), categories: { location: 'United States', allLocations: ['United States', 'Remote'] } }
  assert.throws(() => extractIndiaLeverJobs([remotePrimary, remoteSecondary]), /incomplete|country|location/i)
})

test('VGS preserves genuine secondary India locations alongside corroborated foreign labels', () => {
  const mixed = secondary()
  mixed.categories.allLocations.push('Bengaluru, India')
  const jobs = extractIndiaLeverJobs([primary(), mixed])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '4f565c0a-7a1c-4f43-ba97-0559658661dc')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Bengaluru, India')
})

test("VGS resolves secondary geography only after reading all native pages and their own models",async()=>{
   const r=syntheticPaginatedVgs(),jobs=await run(r.options),a=r.audits[0]
   assert.equal(a.observations.length,101);assert.equal(jobs.length,0)
   for(const native of r.first){const job=a.observations.find(row=>row.jobId===native.id)
    assert.equal(job.country,'United States');assert.equal(job.sourceCountryScopeUnresolved,false)
    assert.ok(job.sourceNativeLocationCountryCorroborations.some(value=>value.nativePostingIds.includes(r.reference.id)))
   }
   assert.equal(a.sourceScopeComplete,false)
  
})



test('VGS does not reuse global remote placeholders as secondary worksite-country evidence', () => {
  for (const label of ['Global Remote', 'Worldwide (Remote)', 'Remote - Anywhere']) {
    const genericPrimary = { ...primary(), categories: { location: label, allLocations: [label] } }
    const genericSecondary = { ...secondary(), categories: { location: 'United States', allLocations: ['United States', label] } }
    assert.throws(() => extractIndiaLeverJobs([genericPrimary, genericSecondary]), /incomplete location scope/)
  }
})
