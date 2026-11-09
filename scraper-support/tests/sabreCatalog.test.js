import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('getScraperCatalog includes Sabre Corporation on the official India Workday board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sabre')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Sabre Corporation')
  assert.equal(provider.companyCareerPage, 'https://www.sabre.com/careers')
  assert.equal(provider.companyDomain, 'sabre.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.match(provider.baseUrl, /sabre\.wd1\.myworkdayjobs\.com\/SabreJobs/i)
})

test('buildScrapers exposes a runnable Sabre Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sabre')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /sabre.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'sabre')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Sabre local Workday config switches the scraper onto the jobs API with the country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/sabre.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://sabre.wd1.myworkdayjobs.com/wday/cxs/sabre/SabreJobs/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://sabre.wd1.myworkdayjobs.com/en-US/SabreJobs',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
  assert.equal(config.maxPages, 10)
})

test('getScraperCatalog includes Aven Hospitality for the former Sabre Hospitality Solutions board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'avenhospitality')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Aven Hospitality')
  assert.equal(provider.companyCareerPage, 'https://www.avenhospitality.com/careers')
  assert.equal(provider.companyDomain, 'avenhospitality.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.match(provider.baseUrl, /ah\.wd108\.myworkdayjobs\.com\/AvenHospitalityJobs/i)
})

test('buildScrapers exposes a runnable Aven Hospitality Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'avenhospitality')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /avenhospitality.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'avenhospitality')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})

test('Aven Hospitality local Workday config switches the scraper onto the jobs API with the country facet', () => {
  const config = loadConfig(path.join(testsDir, '../../scraper/avenhospitality.workday'))

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://ah.wd108.myworkdayjobs.com/wday/cxs/ah/AvenHospitalityJobs/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://ah.wd108.myworkdayjobs.com/en-US/AvenHospitalityJobs',
  )
  assert.equal(config.countryFacetParameter, 'locationCountry')
  assert.equal(config.maxPages, 10)
})
