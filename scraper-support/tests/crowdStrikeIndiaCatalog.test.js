import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes CrowdStrike India as a Workday source with an explicit jobs API config', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'crowdstrikeindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'CrowdStrike India')
  assert.equal(provider.baseUrl, 'https://crowdstrike.wd5.myworkdayjobs.com/crowdstrikecareers')
  assert.equal(provider.companyCareerPage, 'https://crowdstrike.wd5.myworkdayjobs.com/crowdstrikecareers')
  assert.equal(provider.companyDomain, 'crowdstrike.wd5.myworkdayjobs.com')

  const config = JSON.parse(
    readFileSync(new URL('../../scraper/crowdstrikeindia.workday/config.json', import.meta.url), 'utf8'),
  )

  assert.deepEqual(config, {
    listingStrategy: 'jobs-api',
    jobsApiUrl: 'https://crowdstrike.wd5.myworkdayjobs.com/wday/cxs/crowdstrike/crowdstrikecareers/jobs',
    detailUrlBase: 'https://crowdstrike.wd5.myworkdayjobs.com/en-US/crowdstrikecareers',
    countryFacetParameter: 'locationCountry',
  })
})

test('buildScrapers and company coverage resolve CrowdStrike India rows', () => {
  const scraper = buildScrapers().find((item) => item.name === 'crowdstrikeindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'crowdstrikeindia')
  assert.match(scraper.dryRunFile, /crowdstrikeindia.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'CrowdStrike India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CrowdStrike India', 'crowdstrikeindia', 'CrowdStrike India']],
  )
})
