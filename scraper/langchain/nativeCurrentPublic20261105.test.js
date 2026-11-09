import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { extractionRawJobMetrics } from '../../scraper-support/utils/extractionRawJobMetrics.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture = new URL('./test-data/native-inventory-current-20261105/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixture)))
const responses = manifest.records.map(record => {
  const bytes = gunzipSync(readFileSync(new URL(record.bodyFile, fixture)))
  assert.equal(bytes.length, record.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256)
  return { ...record, url: record.finalUrl, body: bytes.toString('utf8') }
})

test('genuine current eight-response registered replay retains100 roles and148 typed countries with two worksite gaps', async () => {
  assert.equal(manifest.fixtureProvenance.replayIsFreshNetwork, false)
  assert.equal(responses.length, 8)
  const provider = getScraperCatalog().find(row => row.source === 'langchain')
  let index = 0
  const jobs = await createCatalogScraper(provider).run({ acquisitionMode: 'captured-response-replay',
    fetchDocument: async (url, { signal }) => {
      signal.throwIfAborted()
      const response = responses[index++]
      assert.ok(response); assert.equal(url, response.requestedUrl)
      return response
    } })
  assert.equal(index, 8)
  const audit = jobs[Symbol.for('jobverify.verified-recruitment-observations')].nativeInventoryAudit
  const payload = JSON.parse(responses[4].body)
  assert.equal(payload.jobs.length, 100)
  assert.deepEqual(audit.fullNativeModels.map(model => model.nativeSourceRecord), payload.jobs)
  assert.equal(audit.fullNativeModels.length, 100)
  assert.equal(audit.countryRelations.inspected, 148)
  assert.equal(audit.countryRelations.unresolved, 0)
  assert.equal(audit.countryRelations.worksiteUnresolved, 2)
  assert.deepEqual(audit.fullNativeModels.filter(model => !model.sourceDetailComplete).map(model => model.id),
    ['b23ea9af-c6dc-40fa-86ce-75042b905173', 'e6d2bc1e-e0b9-4076-be01-ef8681863c01'])
  assert.equal(audit.allRoleDetailHealth.contentComplete, true)
  assert.equal(audit.allRoleDetailHealth.missingDescriptions, 0)
  assert.equal(audit.allRoleDetailHealth.complete, false)
  assert.equal(audit.allRoleDetailHealth.incompleteWorksiteJobs, 2)
  assert.equal(audit.configuredBoardInventoryComplete, false)
  assert.equal(audit.configuredBoardIndiaCount, null)
  assert.equal(jobs.length, 0)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(extractionRawJobMetrics(provider, jobs, inventory).rawJobs, 100)
  assert.equal(readSourceObservationEvidence(jobs, 'langchain').observedVacancyCount, 100)
  assert.equal(inventory.listingComplete, false)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.companyGlobalTotal, null); assert.equal(audit.companyIndiaTotal, null)
  assert.equal(audit.lifecycleCleanupAllowed, false); assert.equal(audit.applicationsVisited, false)
  const frontend = audit.reviewedNativeFrontend
  assert.equal(frontend.programsRefetchedDuringThisAttempt, true)
  assert.equal(frontend.downloadedJavaScriptExecuted, false)
  assert.equal(frontend.entryIntegrityVerified, true)
  assert.equal(frontend.manifestSHA256, responses[2].sha256)
  assert.equal(frontend.entrySHA256, responses[3].sha256)
  assert.equal(frontend.normalizedProgramASTSHA256, '82a6e22d0c5ab5fb927fc9bc9f9ee67ef7af293b7e878ab500f0f2cf8ffd95a6')
  assert.equal(audit.physicalAcquisitionStartedAt, manifest.sourceClock.physicalAcquisitionStartedAt)
  assert.equal(audit.physicalAcquisitionCompletedAt, manifest.sourceClock.physicalAcquisitionCompletedAt)
  assert.equal(audit.closingInventoryMatches, true)
  assert.equal(audit.requestCount, 8)
})
