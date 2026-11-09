import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Ogmen Robotics is registered against its verified first-party careers and detail surfaces', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ogmenrobotics')

  assert.ok(provider, 'Expected Ogmen Robotics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Ogmen Robotics')
  assert.equal(provider.companyCareerPage, 'https://www.ogmenrobotics.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-careers-page-plus-current-openings-json-plus-detail-apply-surface',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+inline-role-cards+verified-current-openings-json+detail-route-apply-surface',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ogmenrobotics.com')
  assert.match(provider.modulePath, /ogmenrobotics[\\/]script\.js$/i)
})

test('Ogmen Robotics matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Ogmen Robotics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ogmen Robotics', 'ogmenrobotics', 'Ogmen Robotics']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'ogmenrobotics')

  assert.ok(scraper, 'Expected buildScrapers() to return the Ogmen Robotics scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ogmenrobotics')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.ogmenrobotics.com/careers')
  assert.match(scraper.dryRunFile, /ogmenrobotics[\\/]jobs\.json$/i)
})
