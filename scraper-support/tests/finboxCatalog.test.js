import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const finBoxModulePath = path.resolve(currentDir, '../../scraper/finbox/script.js')

const loadFinBoxCatalog = async () => {
  try {
    return await import('../../scraper/finbox/catalog.js')
  } catch {
    assert.fail('Expected FinBox catalog module at ../../scraper/finbox/catalog.js')
  }
}

const loadFinBoxModule = async () => {
  try {
    return await import('../../scraper/finbox/script.js')
  } catch {
    assert.fail('Expected FinBox scraper module at ../../scraper/finbox/script.js')
  }
}

test('FinBox local catalog captures the verified first-party careers handoff and public Reczee requisitions feed', async () => {
  const { FINBOX_CATALOG } = await loadFinBoxCatalog()
  const finBox = await loadFinBoxModule()

  assert.equal(FINBOX_CATALOG.source, 'finbox')
  assert.equal(FINBOX_CATALOG.companyName, 'FinBox')
  assert.equal(FINBOX_CATALOG.officialBrandName, 'FinBox')
  assert.equal(FINBOX_CATALOG.adapter, 'script')
  assert.equal(FINBOX_CATALOG.homepageUrl, 'https://www.finbox.in/')
  assert.equal(FINBOX_CATALOG.companyCareerPage, 'https://www.finbox.in/careers')
  assert.equal(FINBOX_CATALOG.careersPageUrl, 'https://www.finbox.in/careers')
  assert.equal(FINBOX_CATALOG.jobsEmbedUrl, 'https://jobs.reczee.com/finbox/job-embed')
  assert.equal(
    FINBOX_CATALOG.companyDetailsApiUrl,
    'https://app.reczee.com/api/v1/company/get-careers-page-details?company_slug=finbox',
  )
  assert.equal(
    FINBOX_CATALOG.requisitionsApiUrl,
    'https://app.reczee.com/api/v1/requisitions/get-open-requisitions?company_slug=finbox',
  )
  assert.equal(FINBOX_CATALOG.jobDetailUrlTemplate, 'https://jobs.reczee.com/finbox/{slug}')
  assert.equal(
    FINBOX_CATALOG.jobApplyUrlTemplate,
    'https://jobs.reczee.com/finbox/{slug}/apply',
  )
  assert.equal(FINBOX_CATALOG.sampleJobSlug, 'IGCBY')
  assert.equal(
    FINBOX_CATALOG.sampleJobDetailApiUrl,
    'https://app.reczee.com/api/v1/requisitions/from-slug/IGCBY?company_slug=finbox',
  )
  assert.equal(FINBOX_CATALOG.sampleJobDetailUrl, 'https://jobs.reczee.com/finbox/IGCBY')
  assert.equal(
    FINBOX_CATALOG.sampleJobApplyUrl,
    'https://jobs.reczee.com/finbox/IGCBY/apply',
  )
  assert.equal(FINBOX_CATALOG.companyDomain, 'finbox.in')
  assert.equal(FINBOX_CATALOG.atsPlatform, 'reczee')
  assert.equal(FINBOX_CATALOG.countryFilter, 'Global')
  assert.equal(
    FINBOX_CATALOG.paginationStrategy,
    'first-party-careers-handoff-plus-reczee-open-requisitions-api',
  )
  assert.equal(
    FINBOX_CATALOG.extractionStrategy,
    'verified-first-party-careers-shell+verified-reczee-company-details+verified-reczee-open-requisitions-feed',
  )
  assert.equal(FINBOX_CATALOG.parser, 'custom-script')
  assert.equal(FINBOX_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FINBOX_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(FINBOX_CATALOG.dryRunFile, 'finbox/jobs.json')
  assert.match(FINBOX_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.finbox\.in\/careers/i)
  assert.match(FINBOX_CATALOG.verifiedSurfaceSummary, /https:\/\/jobs\.reczee\.com\/finbox\/job-embed/i)
  assert.match(
    FINBOX_CATALOG.verifiedSurfaceSummary,
    /https:\/\/app\.reczee\.com\/api\/v1\/company\/get-careers-page-details\?company_slug=finbox/i,
  )
  assert.match(
    FINBOX_CATALOG.verifiedSurfaceSummary,
    /https:\/\/app\.reczee\.com\/api\/v1\/requisitions\/get-open-requisitions\?company_slug=finbox/i,
  )
  assert.match(FINBOX_CATALOG.verifiedSurfaceSummary, /https:\/\/jobs\.reczee\.com\/finbox\/IGCBY/i)
  assert.match(
    FINBOX_CATALOG.verifiedSurfaceSummary,
    /https:\/\/jobs\.reczee\.com\/finbox\/IGCBY\/apply/i,
  )
  assert.equal(FINBOX_CATALOG.modulePath, finBoxModulePath)

  assert.equal(finBox.PROVIDER_METADATA.source, FINBOX_CATALOG.source)
  assert.equal(finBox.PROVIDER_METADATA.companyName, FINBOX_CATALOG.companyName)
  assert.equal(finBox.PROVIDER_METADATA.careersPageUrl, FINBOX_CATALOG.careersPageUrl)
  assert.equal(finBox.PROVIDER_METADATA.jobsEmbedUrl, FINBOX_CATALOG.jobsEmbedUrl)
  assert.equal(
    finBox.PROVIDER_METADATA.requisitionsApiUrl,
    FINBOX_CATALOG.requisitionsApiUrl,
  )
})

test('FinBox backlog row hydrates locally without shared-registry edits', async () => {
  const { FINBOX_CATALOG } = await loadFinBoxCatalog()
  const provider = hydrateProviderCatalogEntry(FINBOX_CATALOG)

  assert.equal(provider.companyName, 'FinBox')
  assert.equal(provider.companyDomain, 'finbox.in')
  assert.match(provider.modulePath, /finbox[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /finbox[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'FinBox\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['FinBox', 'finbox', 'FinBox']],
  )
})
