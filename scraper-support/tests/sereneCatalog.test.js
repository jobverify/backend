import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/serene/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/serene/catalog.js')
  } catch {
    assert.fail('Expected Serene catalog module at ../../scraper/serene/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/serene/script.js')
  } catch {
    assert.fail('Expected Serene scraper module at ../../scraper/serene/script.js')
  }
}

test('Serene local catalog captures the verified first-party careers, jobs, and join-us flow', async () => {
  const { SERENE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const serene = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SERENE_CATALOG)

  assert.equal(defaultCatalog, SERENE_CATALOG)
  assert.equal(provider.source, 'serene')
  assert.equal(provider.companyName, 'Serene')
  assert.equal(provider.officialBrandName, 'Serene Info Solutions Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.sereneinfosolutions.in/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.sereneinfosolutions.in/careers/')
  assert.equal(provider.officialJobsPageUrl, 'https://www.sereneinfosolutions.in/jobs/')
  assert.equal(provider.officialApplicationPageUrl, 'https://www.sereneinfosolutions.in/join-us/')
  assert.equal(provider.companyDomain, 'sereneinfosolutions.in')
  assert.equal(provider.atsPlatform, 'first-party-html-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-first-party-jobs-page+same-domain-job-detail-pages+shared-first-party-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.dryRunFile, /serene[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sereneinfosolutions\.in\/job\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sereneinfosolutions\.in\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /Bench Sales Recruiter/i)
  assert.match(provider.verifiedSurfaceSummary, /Talent Acquisition Associate/i)
  assert.match(provider.verifiedSurfaceSummary, /Resource Executive/i)
  assert.match(provider.verifiedSurfaceSummary, /US IT Recruiter/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Serene'), false)

  assert.equal(serene.PROVIDER_METADATA.source, SERENE_CATALOG.source)
  assert.equal(serene.PROVIDER_METADATA.companyName, SERENE_CATALOG.companyName)
})

test('Serene exact backlog row matches directly from local provider metadata', async () => {
  const { SERENE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Serene\n',
    catalog: [hydrateProviderCatalogEntry(SERENE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Serene', 'serene', 'Serene']],
  )
})

test('Serene hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SERENE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SERENE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Serene')
  assert.equal(provider.companyCareerPage, 'https://www.sereneinfosolutions.in/careers/')
  assert.equal(provider.companyDomain, 'sereneinfosolutions.in')
  assert.equal(provider.atsPlatform, 'first-party-html-board')
  assert.match(provider.modulePath, /serene[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /serene[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
