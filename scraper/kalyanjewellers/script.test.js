import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { CAREERS_URL, COMPANY, createKalyanJewellersScraper, extractIndiaOpenings } from './script.js'

const careersHtml = `
  <section class="job-opening">
    <a href="/jobs/sales-executive-123">Sales Executive</a>
    <span>Location: Kochi, India</span>
  </section>
  <section class="job-opening">
    <a href="https://example.com/not-first-party">Overseas Role</a>
    <span>Location: Dubai, UAE</span>
  </section>
`

test('Kalyan Jewellers matches the exact CSV company name through the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'kalyanjewellers')
  const report = generateCompanyCoverageReport({ csvText: 'company_name\nKalyan Jewellers\n', catalog: getScraperCatalog() })
  assert.ok(provider)
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'kalyanjewellers')
})

test('Kalyan extractor keeps only first-party India listings', async () => {
  assert.deepEqual(extractIndiaOpenings(careersHtml), [{
    title: 'Sales Executive',
    location: 'Sales Executive Location: Kochi, India',
    jobId: 'sales-executive-123',
    sourceUrl: 'https://careers.kalyanjewellers.company/jobs/sales-executive-123',
  }])
  const jobs = await createKalyanJewellersScraper().run({ fetchText: async () => careersHtml, now: () => '2026-07-25T00:00:00.000Z' })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].company, COMPANY)
})

test('Kalyan provider is runnable through the scraper catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'kalyanjewellers')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})
