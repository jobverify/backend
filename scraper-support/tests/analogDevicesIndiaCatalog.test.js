import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

test('Analog Devices India resolves exactly to its verified first-party Workday provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'analogdevicesindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Analog Devices India')
  assert.equal(provider.companyCareerPage, 'https://www.analog.com/en/careers/career-opportunities.html')
  assert.equal(provider.baseUrl, 'https://analogdevices.wd1.myworkdayjobs.com/External')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyDomain, 'analog.com')

  const config = loadConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scraper/analogdevicesindia.workday'))
  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(config.countryFacetParameter, 'locationCountry')

  const report = generateCompanyCoverageReport({
    csvText: 'Analog Devices India,\n',
    catalog,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Analog Devices India', 'analogdevicesindia', 'Analog Devices India']],
  )
})

test('Analog Devices India is runnable through the shared Workday scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'analogdevicesindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /analogdevicesindia\.workday[\\/]jobs\.json$/i)
})
