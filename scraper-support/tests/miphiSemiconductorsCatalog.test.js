import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('MiPhi Semiconductors is registered against the verified official homepage with no public careers routes', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'miphisemiconductors')

  assert.ok(provider, 'Expected MiPhi Semiconductors provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MiPhi Semiconductors')
  assert.equal(provider.companyCareerPage, 'https://www.miphi.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemap-plus-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-sitemap-without-careers+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'miphi.in')
  assert.match(provider.modulePath, /miphisemiconductors[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'MiPhi Semiconductors'), false)
})

test('MiPhi Semiconductors matches the backlog directly from provider metadata without adding a company alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'MiPhi Semiconductors,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MiPhi Semiconductors', 'miphisemiconductors', 'MiPhi Semiconductors']],
  )
})

test('MiPhi Semiconductors is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'miphisemiconductors')

  assert.ok(scraper, 'Expected buildScrapers() to return the MiPhi Semiconductors scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'miphisemiconductors')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.miphi.in/')
  assert.match(scraper.dryRunFile, /miphisemiconductors[\\/]jobs\.json$/i)
})
