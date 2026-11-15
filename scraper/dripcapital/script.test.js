import assert from 'node:assert/strict'
import test from 'node:test'
import {createDripCapitalScraper} from './script.js'
import {replayNative} from './fixtures/nativeReplay20261114.js'

test('Drip factory fetchPage compatibility follows complete current original HTTP responses instead of historical empty payloads', async () => {
  const replay = replayNative()
  const jobs = await createDripCapitalScraper().run({fetchPage: replay.fetchImpl})
  assert.deepEqual(jobs.map(job => job.sourceJobId), ['fk0znmm', 'fk0zlaf', 'fk0zldg', 'fk0pfc9'])
  assert.equal(replay.reads.length, 14)
  assert.equal(jobs.nativeCollectionEvidence.discoveryResponses, 6)
  assert.equal(jobs.nativeCollectionEvidence.detailResponses, 8)
  assert.equal(jobs.nativeCollectionEvidence.closingCorporateHandoffEqual, true)
  assert.equal(jobs.nativeCollectionEvidence.closingInventoryEqual, true)
  assert.ok(jobs.every(job => job.companyDomain === 'dripcapital.com' && job.careerPage === 'https://www.dripcapital.com/en-in/careers/' && job.atsPlatform === 'trakstar-hire'))
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDescriptionHTML.includes('jobdesciption') && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
})
