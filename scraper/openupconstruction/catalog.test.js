import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'openupconstruction'
const COMPANY = 'Open Up Construction'
const CAREERS_URL = 'https://goodwork.openupgroup.co.jp/job-info/opc/'

test('Open Up Construction is registered against its verified first-party careers hub without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Open Up Construction provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.deepEqual(provider.alternateCareerPages, [
    'https://goodwork.openupgroup.co.jp/job-info/opc/application/',
    'https://goodwork.openupgroup.co.jp/job-info/opc/newgraduate/',
  ])
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'Japan')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-hub-plus-linked-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-hub+verified-linked-detail-pages+rpm-sys-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'openupgroup.co.jp')
  assert.match(provider.modulePath, /openupconstruction[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Open Up Construction resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY},\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Open Up Construction scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, CAREERS_URL)
  assert.match(scraper.dryRunFile, /openupconstruction[\\/]jobs\.json$/i)
})
