import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCollectiveArtistsNetworkModule = async () => {
  try {
    return await import('../../scraper/collectiveartistsnetwork/script.js')
  } catch {
    assert.fail('Expected Collective Artists Network scraper module at ../../scraper/collectiveartistsnetwork/script.js')
  }
}

test('getScraperCatalog includes Collective Artists Network as a first-party paginated jobs scraper', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'collectiveartistsnetwork')
  const collective = await loadCollectiveArtistsNetworkModule()

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Collective Artists Network')
  assert.equal(provider.companyCareerPage, 'https://www.collectiveartists.com/contact/')
  assert.equal(provider.atsPlatform, 'official-company-careers-email-apply')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'canonical-contact-page-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-root-handoff+verified-canonical-contact-pages+inline-job-cards+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'collectiveartists.com')
  assert.match(provider.modulePath, /collectiveartistsnetwork[\\/]script\.js$/i)

  assert.equal(collective.SOURCE, provider.source)
  assert.equal(collective.COMPANY, provider.companyName)
  assert.equal(collective.JOBS_SURFACE_URL, provider.companyCareerPage)
})

test('buildScrapers and company coverage resolve Collective Artists Network from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'collectiveartistsnetwork')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'collectiveartistsnetwork')
  assert.match(scraper.dryRunFile, /collectiveartistsnetwork[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Collective Artists Network,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Collective Artists Network', 'collectiveartistsnetwork', 'Collective Artists Network']],
  )
})
