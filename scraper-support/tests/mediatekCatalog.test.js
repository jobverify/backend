import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes MediaTek as a verified first-party tRPC-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mediatek')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'nextjs-trpc-job-api')
  assert.equal(provider.companyName, 'MediaTek')
  assert.equal(provider.companyCareerPage, 'https://careers.mediatek.com/en/jobs')
  assert.equal(provider.jobsApiUrl, 'https://careers.mediatek.com/api/trpc/job.getJobs')
  assert.equal(provider.companyDomain, 'careers.mediatek.com')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.verifiedPublicJobCount, 24)
  assert.equal(provider.verifiedSampleJobUrl, 'https://careers.mediatek.com/en/jobs/MTB120240926001')
  assert.match(provider.modulePath, /mediatek[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable MediaTek scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mediatek')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mediatek[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'mediatek')
  assert.equal(scraper.provider.atsPlatform, 'nextjs-trpc-job-api')
})
