import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mfine/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mfine/catalog.js')
  } catch {
    assert.fail('Expected Mfine catalog module at ../../scraper/mfine/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/mfine/script.js')
  } catch {
    assert.fail('Expected Mfine scraper module at ../../scraper/mfine/script.js')
  }
}

test('Mfine local catalog captures the verified first-party contact-page handoff and broken public Darwinbox tenant state', async () => {
  const { MFINE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const mfine = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MFINE_CATALOG)

  assert.equal(defaultCatalog, MFINE_CATALOG)
  assert.equal(provider.source, 'mfine')
  assert.equal(provider.companyName, 'Mfine')
  assert.equal(provider.officialBrandName, 'mfine')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.mfine.co/')
  assert.equal(provider.companyCareerPage, 'https://www.mfine.co/contact-us/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://www.mfine.co/join-us/')
  assert.equal(provider.darwinboxCareersUrl, 'https://mfine.darwinbox.in/ms/candidate/careers')
  assert.deepEqual(provider.darwinboxShellRouteUrls, [
    'https://mfine.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://mfine.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  ])
  assert.equal(
    provider.darwinboxListingApiUrl,
    'https://mfine.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(provider.companyDomain, 'mfine.co')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-contact-page-plus-broken-darwinbox-blank-shell-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-contact-page+join-us-darwinbox-handoff+blank-darwinbox-shells+tenant-info-api-error-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /mfine[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.mfine\.co\/contact-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.mfine\.co\/join-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mfine\.darwinbox\.in\/ms\/candidate\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mfine\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/mfine\.darwinbox\.in\/ms\/candidateapi\/job\/alljobs\?companyId=main/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /careers at mfine/i)
  assert.match(provider.verifiedSurfaceSummary, /error while getting tenant info/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(mfine.PROVIDER_METADATA.source, MFINE_CATALOG.source)
  assert.equal(mfine.PROVIDER_METADATA.companyName, MFINE_CATALOG.companyName)
  assert.equal(
    mfine.PROVIDER_METADATA.officialCareersHandoffUrl,
    MFINE_CATALOG.officialCareersHandoffUrl,
  )
})

test('Mfine exact backlog name matches directly from local provider metadata', async () => {
  const { MFINE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Mfine\n',
    catalog: [hydrateProviderCatalogEntry(MFINE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mfine', 'mfine', 'Mfine']],
  )
})

test('Mfine hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MFINE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MFINE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Mfine')
  assert.equal(provider.companyCareerPage, 'https://www.mfine.co/contact-us/')
  assert.equal(provider.companyDomain, 'mfine.co')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /mfine[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /mfine[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
