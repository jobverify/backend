import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Schnell Energy Equipments as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'schnellenergyequipments')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Schnell Energy Equipments Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://schnellenergy.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'official-current-openings-page+inline-role-sections+shared-apply-form')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'schnellenergy.com')
  assert.match(provider.modulePath, /schnellenergyequipments[\\/]script\.js$/i)
})

test('Schnell Energy Equipments coverage matches the CSV company row tied to the official careers surface', () => {
  const scraper = buildScrapers().find((item) => item.name === 'schnellenergyequipments')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /schnellenergyequipments[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'schnellenergyequipments')

  const report = generateCompanyCoverageReport({
    csvText: [
      'Schnell Energy Equipments,',
      'Schnell Energy Equipments Private Limited,',
    ].join('\n'),
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Schnell Energy Equipments', 'schnellenergyequipments', 'Schnell Energy Equipments Private Limited'],
      ['Schnell Energy Equipments Private Limited', 'schnellenergyequipments', 'Schnell Energy Equipments Private Limited'],
    ],
  )
})
