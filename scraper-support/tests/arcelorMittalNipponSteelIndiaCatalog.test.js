import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const arcelorMittalModulePath = path.resolve(
  currentDir,
  '../../scraper/arcelormittalnipponsteelindia/script.js',
)

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/arcelormittalnipponsteelindia/catalog.js')
  } catch {
    assert.fail(
      'Expected ArcelorMittal Nippon Steel India catalog module at ../../scraper/arcelormittalnipponsteelindia/catalog.js',
    )
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/arcelormittalnipponsteelindia/script.js')
  } catch {
    assert.fail(
      'Expected ArcelorMittal Nippon Steel India scraper module at ../../scraper/arcelormittalnipponsteelindia/script.js',
    )
  }
}

test('ArcelorMittal Nippon Steel India local catalog captures the verified first-party careers microsite and public vacancy API', async () => {
  const { ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG } = await loadCatalogModule()
  const arcelorMittal = await loadScriptModule()

  assert.equal(ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.source, 'arcelormittalnipponsteelindia')
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.companyName,
    'ArcelorMittal Nippon Steel India',
  )
  assert.equal(ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.officialBrandName, 'AM/NS India')
  assert.equal(ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.adapter, 'script')
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.companyCareerPage,
    'https://www.amns.in/careers',
  )
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.homepageUrl,
    'https://www.amns.in/',
  )
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.careersMicrositeUrl,
    'https://ace.amns.in/CANDMICROSITE/',
  )
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.publicApplyUrl,
    'https://ace.amns.in/CANDMICROSITE/#/?CompanyID=AMNS&GroupId=defaultOU',
  )
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.publicCompanyLookupUrl,
    'https://ace.amns.in/CANDMICROSITE/CMLandingpage/GetCompanyIDAndOUID',
  )
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.vacancyApiUrl,
    'https://ace.amns.in/CANDMICROSITE/CPVacancyDetails/GetVacancyInformationWithoutToken',
  )
  assert.equal(ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.publicCompanyId, 'AMNS')
  assert.equal(ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.publicGroupId, 'defaultOU')
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.encodedCompanyId,
    'y6k5iZIHLBMb25yRD9bK0A==',
  )
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.encodedGroupId,
    'vrr0nzxsgCyo6GkEF0XU1g==',
  )
  assert.equal(ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.companyDomain, 'amns.in')
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.atsPlatform,
    'first-party-adrenalin-candidate-microsite-api',
  )
  assert.equal(ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.paginationStrategy,
    'verified-careers-redirect-plus-single-public-adrenalin-vacancy-api-post',
  )
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.extractionStrategy,
    'verified-homepage+verified-careers-redirect+verified-company-ou-lookup+public-adrenalin-vacancy-api',
  )
  assert.equal(ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.normalizationProfile,
    'engineering-default',
  )
  assert.equal(ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.dryRunFile,
    'arcelormittalnipponsteelindia/jobs.json',
  )
  assert.equal(ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.modulePath, arcelorMittalModulePath)
  assert.match(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.amns\.in\/careers/i,
  )
  assert.match(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/ace\.amns\.in\/CANDMICROSITE\//i,
  )
  assert.match(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.verifiedSurfaceSummary,
    /GetCompanyIDAndOUID/i,
  )
  assert.match(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.verifiedSurfaceSummary,
    /GetVacancyInformationWithoutToken/i,
  )
  assert.match(
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.verifiedSurfaceSummary,
    /28 live vacancy records/i,
  )

  assert.equal(
    arcelorMittal.PROVIDER_METADATA.source,
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.source,
  )
  assert.equal(
    arcelorMittal.PROVIDER_METADATA.companyName,
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.companyName,
  )
  assert.equal(
    arcelorMittal.PROVIDER_METADATA.publicApplyUrl,
    ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG.publicApplyUrl,
  )
})

test('ArcelorMittal Nippon Steel India local catalog hydrates into coverage without needing an alias entry', async () => {
  const { ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG)

  assert.equal(provider.companyName, 'ArcelorMittal Nippon Steel India')
  assert.equal(provider.companyDomain, 'amns.in')
  assert.match(provider.modulePath, /arcelormittalnipponsteelindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /arcelormittalnipponsteelindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'ArcelorMittal Nippon Steel India\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'ArcelorMittal Nippon Steel India',
      'arcelormittalnipponsteelindia',
      'ArcelorMittal Nippon Steel India',
    ]],
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'ArcelorMittal Nippon Steel India'),
    false,
  )
})

test('buildScrapers and shared company coverage exclude retired ArcelorMittal Nippon Steel India', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arcelormittalnipponsteelindia')
  const scraper = buildScrapers().find((item) => item.name === 'arcelormittalnipponsteelindia')

  assert.equal(provider, undefined)
  assert.equal(scraper, undefined)

  const report = generateCompanyCoverageReport({
    csvText: 'ArcelorMittal Nippon Steel India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 0)
  assert.equal(report.unmatchedCount, 1)
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['ArcelorMittal Nippon Steel India'],
  )
})
