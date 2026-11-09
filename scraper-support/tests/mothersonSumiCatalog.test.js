import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadMothersonSumiCatalog = async () => {
  try {
    return await import('../../scraper/mothersonsumi/catalog.js')
  } catch {
    assert.fail('Expected Motherson Sumi catalog module at ../../scraper/mothersonsumi/catalog.js')
  }
}

test('Motherson Sumi catalog captures the verified first-party Motherson careers surface', async () => {
  const {
    MOTHERSON_SUMI_CATALOG,
    default: defaultCatalog,
  } = await loadMothersonSumiCatalog()

  assert.equal(defaultCatalog, MOTHERSON_SUMI_CATALOG)
  assert.equal(MOTHERSON_SUMI_CATALOG.source, 'mothersonsumi')
  assert.equal(MOTHERSON_SUMI_CATALOG.companyName, 'Motherson Sumi')
  assert.equal(MOTHERSON_SUMI_CATALOG.officialBrandName, 'Motherson')
  assert.equal(MOTHERSON_SUMI_CATALOG.adapter, 'script')
  assert.equal(MOTHERSON_SUMI_CATALOG.homepageUrl, 'https://www.motherson.com/')
  assert.equal(
    MOTHERSON_SUMI_CATALOG.companyCareerPage,
    'https://www.motherson.com/people/careers-and-internships',
  )
  assert.equal(MOTHERSON_SUMI_CATALOG.companyDomain, 'motherson.com')
  assert.equal(
    MOTHERSON_SUMI_CATALOG.handoffBoardUrl,
    'https://careers.motherson.com/en/jobs?country=India',
  )
  assert.equal(
    MOTHERSON_SUMI_CATALOG.verifiedSampleJobUrl,
    'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510',
  )
  assert.equal(MOTHERSON_SUMI_CATALOG.atsPlatform, 'official-company-careers+successfactors-apply')
  assert.equal(MOTHERSON_SUMI_CATALOG.countryFilter, 'India')
  assert.equal(
    MOTHERSON_SUMI_CATALOG.paginationStrategy,
    'first-party-nextjs-embedded-job-index-plus-public-detail-pages',
  )
  assert.equal(
    MOTHERSON_SUMI_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-motherson-jobs-index+embedded-nextjs-job-data+india-detail-pages',
  )
  assert.equal(MOTHERSON_SUMI_CATALOG.parser, 'custom-script')
  assert.equal(MOTHERSON_SUMI_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(MOTHERSON_SUMI_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(MOTHERSON_SUMI_CATALOG.dryRunFile, 'mothersonsumi/jobs.json')
  assert.match(MOTHERSON_SUMI_CATALOG.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(MOTHERSON_SUMI_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.motherson\.com\/people\/careers-and-internships/i)
  assert.match(MOTHERSON_SUMI_CATALOG.verifiedSurfaceSummary, /https:\/\/careers\.motherson\.com\/en\/jobs\?country=India/i)
  assert.match(MOTHERSON_SUMI_CATALOG.verifiedSurfaceSummary, /24 India jobs/i)
  assert.match(MOTHERSON_SUMI_CATALOG.modulePath, /mothersonsumi[\\/]script\.js$/i)
})

test('Motherson Sumi backlog matching works directly from the local catalog metadata', async () => {
  const { MOTHERSON_SUMI_CATALOG } = await loadMothersonSumiCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Motherson Sumi,\n',
    catalog: [MOTHERSON_SUMI_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Motherson Sumi', 'mothersonsumi', 'Motherson Sumi']],
  )
})

test('Samvardhana Motherson resolves to the verified Motherson Sumi provider via alias coverage', async () => {
  const { MOTHERSON_SUMI_CATALOG } = await loadMothersonSumiCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Samvardhana Motherson\n',
    catalog: [MOTHERSON_SUMI_CATALOG],
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Samvardhana Motherson', 'mothersonsumi', 'Motherson Sumi']],
  )
})
