import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const provider = getScraperCatalog().find((item) => item.source === 'citiustech')

test(
  'getScraperCatalog includes CitiusTech as an official RippleHire-backed script provider',
  () => {
    assert.ok(provider)
    assert.equal(provider.companyName, 'CitiusTech')
    assert.equal(provider.adapter, 'script')
    assert.equal(provider.atsPlatform, 'ripplehire')
    assert.equal(provider.companyCareerPage, 'https://www.citiustech.com/careers')
    assert.equal(provider.companyDomain, 'citiustech.com')
    assert.equal(provider.countryFilter, 'India')
    assert.equal(provider.paginationStrategy, 'page-param-on-public-ripplehire-board')
    assert.equal(provider.extractionStrategy, 'official-careers-handoff+ripplehire-list-detail-api')
    assert.equal(provider.parser, 'custom-script')
    assert.equal(provider.normalizationProfile, 'engineering-default')
    assert.match(provider.modulePath, /citiustech[\\/]script\.js$/i)
  },
)

test(
  'buildScrapers and company coverage resolve CitiusTech to the citiustech source',
  () => {
    const scraper = buildScrapers().find((item) => item.name === 'citiustech')

    assert.ok(scraper)
    assert.equal(typeof scraper.run, 'function')
    assert.match(scraper.dryRunFile, /citiustech[\\/]jobs\.json$/i)
    assert.equal(scraper.provider.source, 'citiustech')
    assert.equal(scraper.provider.atsPlatform, 'ripplehire')

    const report = generateCompanyCoverageReport({
      csvText: 'CitiusTech,\n',
      catalog: getScraperCatalog(),
    })

    assert.equal(report.matchedCount, 1)
    assert.equal(report.unmatchedCount, 0)
    assert.deepEqual(
      report.matched.map((item) => [
        item.companyName,
        item.source,
        item.provider?.companyName ?? null,
      ]),
      [['CitiusTech', 'citiustech', 'CitiusTech']],
    )
  },
)
