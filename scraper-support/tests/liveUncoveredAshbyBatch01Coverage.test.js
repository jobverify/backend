import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, DEFAULT_PROVIDER_EXTENSION_DIR, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const extensionPath = path.join(
  DEFAULT_PROVIDER_EXTENSION_DIR,
  'live-uncovered-ashby-batch-01.json',
)

const providers = JSON.parse(readFileSync(extensionPath, 'utf8'))
const EXPECTED = [
  {
    source: 'cartesia',
    companyName: 'Cartesia',
    companyCareerPage: 'https://jobs.ashbyhq.com/cartesia',
    companyDomain: 'cartesia.ai',
    verifiedPublicJobCount: 30,
    verifiedIndiaJobCount: 5,
  },
  {
    source: 'zapier',
    companyName: 'Zapier',
    companyCareerPage: 'https://zapier.com/jobs',
    companyDomain: 'zapier.com',
    verifiedPublicJobCount: 15,
    verifiedIndiaJobCount: 2,
  },
  {
    source: 'certifyos',
    companyName: 'CertifyOS',
    companyCareerPage: 'https://www.certifyos.com/company/careers',
    companyDomain: 'certifyos.com',
    verifiedPublicJobCount: 9,
    verifiedIndiaJobCount: 6,
  },
  {
    source: 'ema',
    companyName: 'Ema',
    companyCareerPage: 'https://www.ema.ai/careers',
    companyDomain: 'ema.ai',
    verifiedPublicJobCount: 36,
    verifiedIndiaJobCount: 14,
  },
]

test('live uncovered Ashby batch 01 provider shard captures the verified metadata', () => {
  assert.equal(providers.length, EXPECTED.length)

  for (const expected of EXPECTED) {
    const provider = providers.find((item) => item.source === expected.source)
    assert.ok(provider, `Expected provider for ${expected.source}`)
    assert.equal(provider.companyName, expected.companyName)
    assert.equal(provider.adapter, 'script')
    assert.equal(provider.atsPlatform, 'ashby')
    assert.equal(provider.companyCareerPage, expected.companyCareerPage)
    assert.equal(provider.companyDomain, expected.companyDomain)
    assert.equal(provider.verifiedOn, '2026-07-28')
    assert.equal(provider.verifiedPublicJobCount, expected.verifiedPublicJobCount)
    assert.equal(provider.verifiedIndiaJobCount, expected.verifiedIndiaJobCount)
    assert.match(provider.modulePath, new RegExp(`${expected.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\\\/]script\\.js$`, 'i'))
    assert.match(provider.ashbyJobBoardUrl, /^https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\//i)
  }
})

test('live uncovered Ashby batch 01 companies resolve from the shared catalog and build runnable scrapers', () => {
  const csvText = `company_name\n${EXPECTED.map((item) => item.companyName).join('\n')}\n`
  const report = generateCompanyCoverageReport({
    csvText,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, EXPECTED.length)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.unmatched, [])

  const scrapers = buildScrapers().filter((scraper) =>
    EXPECTED.some((item) => item.source === scraper.name))

  assert.equal(scrapers.length, EXPECTED.length)
  for (const expected of EXPECTED) {
    const scraper = scrapers.find((item) => item.name === expected.source)
    assert.ok(scraper, `Expected scraper for ${expected.source}`)
    assert.equal(scraper.provider.companyName, expected.companyName)
    assert.equal(scraper.provider.companyCareerPage, expected.companyCareerPage)
    assert.equal(scraper.provider.verifiedOn, '2026-07-28')
  }
})
