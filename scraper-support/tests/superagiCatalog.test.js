import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes SuperAGI as a verified LinkedIn company-jobs scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'superagi')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-company-jobs')
  assert.equal(provider.companyName, 'SuperAGI')
  assert.equal(provider.companyCareerPage, 'https://www.linkedin.com/jobs/search/?f_C=91427575&geoId=102713980')
  assert.deepEqual(provider.alternateCareerPages, [
    'https://www.linkedin.com/company/superagi/',
    'https://superagi.com/',
    'https://web.superagi.com/',
  ])
  assert.equal(provider.companyDomain, 'superagi.com')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.verifiedSurfaceSummary, /LinkedIn company page/i)
  assert.match(provider.modulePath, /superagi[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable SuperAGI scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'superagi')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'superagi')
  assert.equal(scraper.provider.companyName, 'SuperAGI')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.linkedin.com/jobs/search/?f_C=91427575&geoId=102713980')
  assert.match(scraper.dryRunFile, /superagi[\\/]jobs\.json$/i)
})
