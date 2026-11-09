import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getScraperCatalog, buildScrapers } from '../../providers/index.js'
import { readSourceObservationEvidence } from '../../utils/sourceObservationEvidence.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { fixture, replay } from './fixtureReplay.js'

globalThis.fetch = async () => { throw Error('Registry controls prohibit all real network') }
for (const [source, profile] of Object.entries(fixture.profiles)) test(source + ': actual registry selects the native reader and clears static verification', () => {
  const provider = getScraperCatalog().find(row => row.source === source)
  const sourceOwnedCurrent = ['buildkite', 'tripadvisor'].includes(source)
  assert.equal(provider.adapter, 'script');assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.zeroResultPolicy, sourceOwnedCurrent || source === 'doximity' ? 'evidence-required' : 'coverage-gap');assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false);assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedInventoryStatus, 'unverified');assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedPublicJobCount, null);assert.equal(provider.scraperTimeoutMs, sourceOwnedCurrent ? 240000 : 900000)
  if (sourceOwnedCurrent) {
    assert.equal(provider.sourcePublicInventoryProgramReviewedOn, '2026-11-03')
    assert.equal(provider.configuredBoardProofRequiresLiveEvidence, true)
    assert.match(provider.paginationStrategy, /final-native-feed-after-details/)
  }
  const directory = ['eqtcorporation', 'financialtimes'].includes(source) ? source + '.workday' : source
  assert.equal(path.normalize(provider.modulePath), path.normalize(fileURLToPath(new URL('../../../scraper/' + directory + '/script.js', import.meta.url))))
  assert.equal(provider.companyCareerPage, profile.primaryURL)
})
test('real registered wrapper preserves bounded observation evidence and cannot default unresolved geography to India', async () => {
  const r = replay(), source = 'eqtcorporation', scraper = buildScrapers().find(row => row.name === source)
  const jobs = await scraper.run(r.options)
  assert.equal(r.audits.length, 1);assert.equal(r.audits[0].observations.length, 65)
  const evidence = readSourceObservationEvidence(jobs, source)
  assert.equal(evidence.observedRecordCount, 65);assert.equal(evidence.observedVacancyCount, 64)
  assert.equal(evidence.companyGlobalTotal, null);assert.equal(evidence.sourceScopeComplete, false)
  for (const job of jobs) assert.equal(isIndiaJob(normalizeScrapedJob(job, scraper.provider)), false)
})
