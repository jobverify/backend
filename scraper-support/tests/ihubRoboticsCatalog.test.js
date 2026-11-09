import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('iHUB Robotics is registered against the verified first-party careers page and API', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ihubrobotics')

  assert.ok(provider, 'Expected iHUB Robotics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'iHUB Robotics')
  assert.equal(provider.companyCareerPage, 'https://www.ihubrobotics.com/careers')
  assert.equal(provider.atsPlatform, 'supabase-public-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-api-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-spa-shell+verified-client-bundle+supabase-job_positions-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ihubrobotics.com')
  assert.match(provider.modulePath, /ihubrobotics[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'iHUB Robotics'), false)
})

test('iHUB Robotics matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'iHUB Robotics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['iHUB Robotics', 'ihubrobotics', 'iHUB Robotics']],
  )
})

test('iHUB Robotics is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ihubrobotics')

  assert.ok(scraper, 'Expected buildScrapers() to return the iHUB Robotics scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ihubrobotics')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.ihubrobotics.com/careers')
  assert.match(scraper.dryRunFile, /ihubrobotics[\\/]jobs\.json$/i)
})
