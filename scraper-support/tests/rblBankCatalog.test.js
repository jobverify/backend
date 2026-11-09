import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rblbankModulePath = path.resolve(currentDir, '../../scraper/rblbank/script.js')

const loadRblBankCatalog = async () => {
  try {
    return await import('../../scraper/rblbank/catalog.js')
  } catch {
    assert.fail('Expected RBL Bank catalog module at ../../scraper/rblbank/catalog.js')
  }
}

test('RBL Bank local catalog captures the verified official PeopleStrong handoff and live API', async () => {
  const {
    RBLBANK_CATALOG,
    default: defaultCatalog,
  } = await loadRblBankCatalog()
  const provider = hydrateProviderCatalogEntry(RBLBANK_CATALOG)

  assert.equal(defaultCatalog, RBLBANK_CATALOG)
  assert.equal(provider.source, 'rblbank')
  assert.equal(provider.companyName, 'RBL Bank')
  assert.equal(provider.officialBrandName, 'RBL Bank Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialBrandSiteUrl, 'https://www.rbl.bank.in/')
  assert.equal(provider.companyCareerPage, 'https://www.rbl.bank.in/careers')
  assert.equal(provider.portalOrigin, 'https://rblcareers.peoplestrong.com')
  assert.equal(provider.jobListingsUrl, 'https://rblcareers.peoplestrong.com/')
  assert.equal(
    provider.jobsApiUrl,
    'https://rblcareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(provider.atsPlatform, 'peoplestrong')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, 4)
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-peoplestrong-offset-limit-api')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+direct-peoplestrong-handoff+peoplestrong-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'rblcareers.peoplestrong.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /rblbank[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /rblbank[\\/]script\.js$/i)
  assert.equal(provider.modulePath, rblbankModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.rbl\.bank\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/rblcareers\.peoplestrong\.com\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /api\/cp\/rest\/altone\/cp\/jobs\/v1\?offset=0&limit=20/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /4 public jobs/i)
})

test('RBL Bank exact backlog row matches directly from the local catalog without aliases', async () => {
  const { RBLBANK_CATALOG } = await loadRblBankCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'RBL Bank\n',
    catalog: [hydrateProviderCatalogEntry(RBLBANK_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['RBL Bank', 'rblbank', 'RBL Bank']],
  )
})
