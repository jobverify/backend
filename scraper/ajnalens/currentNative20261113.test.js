import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { decorateJobsWithProviderMetadata, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'
const packets = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261113.json.gz', import.meta.url))))
const replay = mutate => run({ fetchPage: async url => {
  const page = structuredClone(packets.find(row => row.requestedUrl === url || row.url === url))
  assert.ok(page, 'captured native AjnaLens URL ' + url)
  mutate?.(page, url)
  return page
} })

test('AjnaLens current two title-only native openings retain an unresolved runner outcome', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 0)
  assert.equal(readSourceObservationEvidence(jobs, 'ajnalens').observedVacancyCount, 2)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  const provider = getScraperCatalog().find(row => row.source === 'ajnalens')
  const assessment = assessSoftFailureAcquisition(provider, decorateJobsWithProviderMetadata(jobs, provider))
  assert.equal(assessment.zeroJobEvidence, 'coverage-gap')
  assert.equal(assessment.runnerOutcome.success, false)
  assert.equal(assessment.cleanupOptions.replaceExisting, false)
})
test('AjnaLens foreign final URL cannot qualify the current native employer', async () => {
  await assert.rejects(replay(page => { if (page.status === 200) page.url = 'https://another-employer.example/careers' }), /identity|employer|URL/i)
})
test('AjnaLens unreviewed native title-only client remains fail closed', async () => {
  await assert.rejects(replay((page, url) => { if (url.endsWith('.js')) page.html += '\nthrow Error("changed");' }), /client|contract/i)
})
