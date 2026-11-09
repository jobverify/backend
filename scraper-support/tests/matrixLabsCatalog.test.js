import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/matrixlabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/matrixlabs/catalog.js')
  } catch {
    assert.fail('Expected Matrix Labs catalog module at ../../scraper/matrixlabs/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/matrixlabs/script.js')
  } catch {
    assert.fail('Expected Matrix Labs scraper module at ../../scraper/matrixlabs/script.js')
  }
}

test('Matrix Labs local catalog captures the verified first-party resume-only careers surface', async () => {
  const { MATRIX_LABS_CATALOG } = await loadCatalogModule()
  const matrixLabs = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MATRIX_LABS_CATALOG)

  assert.equal(provider.source, 'matrixlabs')
  assert.equal(provider.companyName, 'Matrix Labs')
  assert.equal(provider.officialBrandName, 'Matrix Labs Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://matrixlabs.co.in/')
  assert.equal(provider.companyCareerPage, 'https://matrixlabs.co.in/career/')
  assert.equal(provider.applicationEmail, 'hr@matrixlabs.co.in')
  assert.equal(provider.applicationUrl, 'mailto:hr@matrixlabs.co.in')
  assert.equal(provider.companyDomain, 'matrixlabs.co.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-resume-only-career-page-plus-missing-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-resume-only-career-page+verified-missing-career-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.modulePath, /matrixlabs[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/matrixlabs\.co\.in\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /hr@matrixlabs\.co\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/matrixlabs\.co\.in\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/matrixlabs\.co\.in\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Matrix Labs'), false)

  assert.equal(matrixLabs.PROVIDER_METADATA.source, MATRIX_LABS_CATALOG.source)
  assert.equal(matrixLabs.PROVIDER_METADATA.companyName, MATRIX_LABS_CATALOG.companyName)
  assert.equal(matrixLabs.PROVIDER_METADATA.applicationEmail, MATRIX_LABS_CATALOG.applicationEmail)
})

test('Matrix Labs exact backlog row matches directly from local provider metadata', async () => {
  const { MATRIX_LABS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Matrix Labs\n',
    catalog: [hydrateProviderCatalogEntry(MATRIX_LABS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Matrix Labs', 'matrixlabs', 'Matrix Labs']],
  )
})

test('Matrix Labs hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MATRIX_LABS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MATRIX_LABS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Matrix Labs')
  assert.equal(provider.companyCareerPage, 'https://matrixlabs.co.in/career/')
  assert.equal(provider.companyDomain, 'matrixlabs.co.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /matrixlabs[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /matrixlabs[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
