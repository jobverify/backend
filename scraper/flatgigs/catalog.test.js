import test from 'node:test'
import assert from 'node:assert/strict'
import metadata from './catalog.js'
import { getScraperCatalog, loadProviderExtensions, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { fixtureReader } from './test-data/fixture.mjs'
test('the existing registered slot points at this exact source script and preserves raw native partial evidence', async () => {
  const actual = getScraperCatalog().find(provider => provider.source === 'flatgigs')
  assert.equal(actual.adapter, 'script'); assert.match(actual.modulePath.replaceAll('\\', '/'), /\/scraper\/flatgigs\/script\.js$/)
  const jobs = await createCatalogScraper(actual).run({ fetchPacket: fixtureReader().read })
  assert.equal(jobs.length, 3); assert.ok(jobs.every(job => job.nativeLegalEmployer === null && job.nativeCurrentAvailabilityQualified === false))
  assert.equal(readSourceObservationEvidence(jobs, 'flatgigs').observedVacancyCount, 73)
  assert.equal(readInventoryEvidence(jobs).verifiedAt, null)
})
test('source-local catalog proposal contains no zero/freshness/source-complete authority', () => {
  assert.equal(metadata.verifiedPublicJobCount, null); assert.equal(metadata.verifiedIndiaJobCount, null)
  assert.equal(metadata.verifiedOn, null); assert.equal(metadata.verifiedAt, null); assert.equal(metadata.zeroResultPolicy, 'coverage-gap')
  assert.equal(metadata.atsPlatform, 'workable-widget-v1')
})
test('a labelled proposed final provider overlay works without changing JSON catalog precedence', () => {
  const hypothetical = getScraperCatalog({ providerExtensions: [...loadProviderExtensions(), metadata] }).find(provider => provider.source === 'flatgigs')
  assert.equal(hypothetical.atsPlatform, 'workable-widget-v1'); assert.equal(hypothetical.verifiedPublicJobCount, null)
  assert.equal(hypothetical.verifiedInventoryStatus, 'unverified')
})
