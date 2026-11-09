import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('MOSIL is registered as a verified first-party scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mosillubricantspvtltd')

  assert.ok(provider, 'Expected MOSIL provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Mosil Lubricants Pvt.Ltd.')
  assert.equal(provider.companyCareerPage, 'https://mosil.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-homepage-plus-first-party-careers-form-select')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+public-position-options+shared-resume-upload-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mosil.com')
  assert.match(provider.modulePath, /mosillubricantspvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Mosil Lubricants Pvt.Ltd.'), false)
})

test('MOSIL matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Mosil Lubricants Pvt.Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mosil Lubricants Pvt.Ltd.', 'mosillubricantspvtltd', 'Mosil Lubricants Pvt.Ltd.']],
  )
})

test('MOSIL is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mosillubricantspvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the MOSIL scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mosillubricantspvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://mosil.com/careers')
  assert.match(scraper.dryRunFile, /mosillubricantspvtltd[\\/]jobs\.json$/i)
})
