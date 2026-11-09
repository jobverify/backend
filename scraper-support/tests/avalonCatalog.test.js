import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const avalonModulePath = path.resolve(currentDir, '../../scraper/avalon/script.js')

const loadAvalonCatalog = async () => {
  try {
    return await import('../../scraper/avalon/catalog.js')
  } catch {
    assert.fail('Expected Avalon catalog module at ../../scraper/avalon/catalog.js')
  }
}

test('Avalon catalog captures the verified first-party public jobs surface', async () => {
  const { AVALON_CATALOG } = await loadAvalonCatalog()
  const provider = hydrateProviderCatalogEntry(AVALON_CATALOG)

  assert.equal(provider.source, 'avalon')
  assert.equal(provider.companyName, 'Avalon')
  assert.equal(provider.officialBrandName, 'Avalon Information Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.avaloninfosys.com/career')
  assert.equal(provider.homepageUrl, 'https://www.avaloninfosys.com/')
  assert.equal(provider.careerAliasUrl, 'https://www.avaloninfosys.com/index.php/career')
  assert.equal(provider.legacyCareersPageUrl, 'https://www.avaloninfosys.com/careers')
  assert.equal(provider.applicationEmail, 'jobs@avaloninfosys.com')
  assert.deepEqual(provider.noPublicJobRouteUrls, [
    'https://www.avaloninfosys.com/jobs',
    'https://www.avaloninfosys.com/join-us',
    'https://www.avaloninfosys.com/work-with-us',
  ])
  assert.deepEqual(provider.verifiedVacancyDetailUrls, [
    'https://www.avaloninfosys.com/vacancies/executive-assistant',
    'https://www.avaloninfosys.com/vacancies/accounts-executive',
    'https://www.avaloninfosys.com/vacancies/ui-ux-internship',
    'https://www.avaloninfosys.com/vacancies/programme-manager',
    'https://www.avaloninfosys.com/vacancies/software-engineer-internship-programme',
  ])
  assert.equal(provider.companyDomain, 'avaloninfosys.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-single-career-table-plus-first-party-vacancy-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-career-table+verified-first-party-vacancy-detail-pages+inline-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-28')
  assert.equal(provider.modulePath, avalonModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 28, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.avaloninfosys\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.avaloninfosys\.com\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.avaloninfosys\.com\/index\.php\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.avaloninfosys\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.avaloninfosys\.com\/vacancies\/executive-assistant/i)
  assert.match(provider.verifiedSurfaceSummary, /jobs@avaloninfosys\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /accordion-style opening teasers/i)
})

test('Avalon backlog row matches directly from provider metadata without aliases', async () => {
  const { AVALON_CATALOG } = await loadAvalonCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Avalon\n',
    catalog: [hydrateProviderCatalogEntry(AVALON_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Avalon', 'avalon', 'Avalon']],
  )
})

test('buildScrapers and company coverage resolve Avalon from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'avalon')
  const scraper = buildScrapers().find((item) => item.name === 'avalon')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Avalon')
  assert.equal(provider.companyCareerPage, 'https://www.avaloninfosys.com/career')
  assert.match(scraper.dryRunFile, /avalon[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Avalon\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Avalon', 'avalon', 'Avalon']],
  )
})
