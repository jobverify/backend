import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'
import TRICON_INFOTECH_CATALOG from '../../scraper/triconinfotech/catalog.js'
import { run, hasPublicJobsSurfaceSignal } from '../../scraper/triconinfotech/script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
test('Tricon Infotech catalog records complete published AWSM inventory and honest India-zero', () => {
  const provider = hydrateProviderCatalogEntry(TRICON_INFOTECH_CATALOG)
  assert.equal(provider.source, 'triconinfotech')
  assert.equal(provider.companyName, 'Tricon Infotech')
  assert.equal(provider.officialBrandName, 'Tricon Infotech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.triconinfotech.com/tricon-careers/')
  assert.equal(provider.companyDomain, 'triconinfotech.com')
  assert.equal(provider.atsPlatform, 'awsm-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'wordpress-count-headers-and-all-pages')
  assert.equal(provider.extractionStrategy, 'official-jobs-handoff+published-feed+all-details+stable-inventory+india-filter')
  assert.equal(provider.modulePath, path.resolve(currentDir, '../../scraper/triconinfotech/script.js'))
  assert.match(provider.verifiedSurfaceSummary, /AWSM/)
  assert.match(provider.verifiedSurfaceSummary, /current India inventory is zero/)
})
test('Tricon Infotech exact backlog row resolves from its local catalog', () => {
  const report = generateCompanyCoverageReport({ csvText: 'Tricon Infotech\n', catalog: [hydrateProviderCatalogEntry(TRICON_INFOTECH_CATALOG)] })
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
test('changed official careers handoff cannot silently return empty', async () => {
  await assert.rejects(run({
    fetchText: async () => '<html><title>Career Opportunities | Tricon Infotech</title></html>',
    fetchFeed: async () => ({ items: [], total: 0, totalPages: 0 }),
  }), /official careers jobs handoff changed/)
})
test('real job anchors and published rows are distinguished from stylesheet selectors', () => {
  assert.equal(hasPublicJobsSurfaceSignal('<style>.awsm-b-job-post-title { color: red }</style>', []), false)
  assert.equal(hasPublicJobsSurfaceSignal('<h2 class="awsm-b-job-post-title">Data Engineer</h2>', []), true)
  assert.equal(hasPublicJobsSurfaceSignal('<a href="https://www.triconinfotech.com/jobs/data-engineer/">Data Engineer</a>', []), true)
  assert.equal(hasPublicJobsSurfaceSignal('', [{ id: 1 }]), true)
})
