import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAvalonTechnologiesCatalog = async () => {
  try {
    return await import('../../scraper/avalontechnologies/catalog.js')
  } catch {
    assert.fail('Expected Avalon Technologies catalog module at ../../scraper/avalontechnologies/catalog.js')
  }
}

test('Avalon Technologies provider metadata captures the verified first-party careers form and no-public-jobs surface without aliases', async () => {
  const { AVALON_TECHNOLOGIES_CATALOG } = await loadAvalonTechnologiesCatalog()
  const provider = hydrateProviderCatalogEntry(AVALON_TECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'avalontechnologies')
  assert.equal(provider.companyName, 'Avalon Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.avalontec.com/careers/')
  assert.equal(provider.homepageUrl, 'https://www.avalontec.com/')
  assert.equal(provider.careerAliasUrl, 'https://www.avalontec.com/career/')
  assert.equal(provider.robotsTxtUrl, 'https://www.avalontec.com/robots.txt')
  assert.equal(provider.sitemapUrl, 'https://www.avalontec.com/sitemap.xml')
  assert.equal(provider.companyDomain, 'avalontec.com')
  assert.equal(provider.atsPlatform, 'official-company-site-general-resume-intake')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'current-public-intake-model-and-closing-reconciliation;vacancy-count-unknown',
  )
  assert.equal(
    provider.extractionStrategy,
    'current-corporate-careers+native-general-resume-intake+structural-executable-script-observations+bounded-audit',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, null)
  assert.match(provider.modulePath, /avalontechnologies[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /avalontechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /fresh runtime evidence/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.avalontec\.com\/careers\//i)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.match(provider.verifiedSurfaceSummary, /Post your Resume/i)
  assert.match(provider.verifiedSurfaceSummary, /vacancy totals and criteria unknown/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Avalon Technologies'), false)
})

test('Avalon Technologies backlog row matches directly from provider metadata without alias churn', async () => {
  const { AVALON_TECHNOLOGIES_CATALOG } = await loadAvalonTechnologiesCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Avalon Technologies\n',
    catalog: [hydrateProviderCatalogEntry(AVALON_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Avalon Technologies', 'avalontechnologies', 'Avalon Technologies']],
  )
})

test('buildScrapers and company coverage resolve Avalon Technologies from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'avalontechnologies')
  const scraper = buildScrapers().find((item) => item.name === 'avalontechnologies')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Avalon Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.avalontec.com/careers/')
  assert.match(scraper.dryRunFile, /avalontechnologies[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Avalon Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Avalon Technologies', 'avalontechnologies', 'Avalon Technologies']],
  )
})
