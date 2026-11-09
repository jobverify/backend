import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('NSLHUB (Brane) is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nslhubbrane')

  assert.ok(provider, 'Expected NSLHUB (Brane) provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'NSLHUB (Brane)')
  assert.equal(provider.companyCareerPage, 'https://braneenterprises.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-shell-plus-bundle-identity-plus-legacy-lander-plus-common-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-brane-shell+verified-nslhub-bundle-identity+verified-legacy-nslhub-lander+verified-common-careers-route-shells+no-public-job-signals',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'braneenterprises.com')
  assert.match(provider.modulePath, /nslhubbrane[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'NSLHUB (Brane)'), false)
})

test('NSLHUB (Brane) resolves from exact CSV identity and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'NSLHUB (Brane),\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NSLHUB (Brane)', 'nslhubbrane', 'NSLHUB (Brane)']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'nslhubbrane')

  assert.ok(scraper, 'Expected buildScrapers() to return the NSLHUB (Brane) sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nslhubbrane')
  assert.equal(scraper.provider.companyCareerPage, 'https://braneenterprises.com/')
  assert.match(scraper.dryRunFile, /nslhubbrane[\\/]jobs\.json$/i)
})
