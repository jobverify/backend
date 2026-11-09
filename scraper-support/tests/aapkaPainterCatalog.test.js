import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/aapkapainter/catalog.js')
  } catch {
    assert.fail('Expected Aapka Painter catalog module at ../../scraper/aapkapainter/catalog.js')
  }
}

test('Aapka Painter catalog captures the verified first-party empty-board sentinel metadata', async () => {
  const aapkaPainterCatalog = await loadCatalogModule()

  assert.deepEqual(aapkaPainterCatalog.AAPKA_PAINTER_CATALOG, {
    source: 'aapkapainter',
    companyName: 'Aapka Painter',
    companyCareerPage: 'https://aapkapainter.com/career',
    companyDomain: 'aapkapainter.com',
    adapter: 'script',
    atsPlatform: 'official-company-careers-nonlisting',
    countryFilter: 'India',
    paginationStrategy: 'homepage-plus-career-page-widget-validation-and-common-route-validation',
    extractionStrategy: 'verified-homepage+verified-career-page+embedded-zimyo-widget-hook+dead-zimyo-widget-script+missing-common-job-routes-return-empty',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    modulePath: 'scraper/aapkapainter/script.js',
    verifiedOn: '2026-07-14',
    verifiedSurfaceSummary: 'Official aapkapainter.com links to a branded first-party /career page that embeds a Zimyo widget hook with USERID 1476, but the referenced widget script currently only redirects to ats.zimyo.work and no trustworthy public job listings surface was exposed on the official page or adjacent first-party job routes.',
    homepageUrl: 'https://aapkapainter.com/',
    widgetScriptUrl: 'https://ats.zimyo.com/assets/js/jobwidget.js',
    widgetUserId: '1476',
  })
})

test('buildScrapers and company coverage resolve Aapka Painter from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aapkapainter')
  const scraper = buildScrapers().find((item) => item.name === 'aapkapainter')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aapka Painter')
  assert.equal(provider.companyCareerPage, 'https://aapkapainter.com/career')
  assert.match(scraper.dryRunFile, /aapkapainter[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aapka Painter\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aapka Painter', 'aapkapainter', 'Aapka Painter']],
  )
})
