import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadCatalog = async (relativePath, constantName) => {
  try {
    const module = await import(relativePath)
    return {
      constant: module[constantName],
      defaultExport: module.default,
    }
  } catch {
    assert.fail(`Expected catalog module at ${relativePath}`)
  }
}

const assertCatalogMatchesBacklogRow = ({ provider, companyName, modulePath, countryFilter }) => {
  assert.equal(provider.companyName, companyName)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.countryFilter, countryFilter)
  assert.equal(provider.modulePath, modulePath)

  const report = generateCompanyCoverageReport({
    csvText: `${companyName}\n`,
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
}

const assertHydratedCatalogLoadsScript = async (provider) => {
  const module = await import(pathToFileURL(provider.modulePath).href)
  assert.equal(typeof module.run, 'function')
}

test('thinkbridge local catalog captures the verified first-party job-search page', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/thinkbridge/catalog.js', 'THINKBRIDGE_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'thinkbridge')
  assert.equal(provider.officialBrandName, 'thinkbridge')
  assert.equal(provider.companyCareerPage, 'https://www.thinkbridge.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.ok(Number.isSafeInteger(provider.verifiedPublicJobCount) && provider.verifiedPublicJobCount > 0)
  assert.match(provider.verifiedSurfaceSummary, /Customer Success Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /same-domain role page exposes a matching title, description, and application link/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'thinkbridge',
    modulePath: path.resolve(currentDir, '../../scraper/thinkbridge/script.js'),
    countryFilter: 'Global',
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Algonomy local catalog retains unverified parent-company migration scope and historical Paycor references', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/algonomy/catalog.js', 'ALGONOMY_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'algonomy')
  assert.equal(provider.companyCareerPage, 'https://algonomy.com/careers/')
  assert.equal(provider.paycorClientId, '8a7883c6606d030901607ae3719c71a6')
  assert.equal(provider.atsPlatform, 'official-careers-migration-unverified-scope')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.paginationStrategy, 'unavailable-until-algonomy-scope-is-verified')
  assert.equal(provider.extractionStrategy, 'reject-parent-company-migration-without-verified-algonomy-inventory')
  assert.match(provider.verifiedSurfaceSummary, /redirects to https:\/\/adaglobal\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Algonomy-specific inventory cannot be established/i)
  assert.match(provider.verifiedSurfaceSummary, /unlinked legacy Paycor board is not trusted/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Algonomy',
    modulePath: path.resolve(currentDir, '../../scraper/algonomy/script.js'),
    countryFilter: 'Global',
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('FCI CCM local catalog captures the verified first-party careers page and official Zoho board', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/fciccm/catalog.js', 'FCI_CCM_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'fciccm')
  assert.equal(provider.companyCareerPage, 'https://www.fci-ccm.com/company/careers.php')
  assert.equal(provider.officialZohoBoardUrl, 'https://fci-ccm.zohorecruit.in/jobs/Careers')
  assert.equal(provider.officialBrandName, 'Friends Color Images Pvt Ltd')
  assert.equal(provider.atsPlatform, 'zoho-recruit-careers-site')
  assert.equal(provider.verifiedPublicJobCount, 11)
  assert.match(provider.verifiedSurfaceSummary, /Noida, India/i)
  assert.match(provider.verifiedSurfaceSummary, /Zoho/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'FCI CCM',
    modulePath: path.resolve(currentDir, '../../scraper/fciccm/script.js'),
    countryFilter: 'India',
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Loylty Rewardz Mngt local catalog stays fail-closed against the culture-only first-party page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/loyltyrewardzmngt/catalog.js',
    'LOYLTY_REWARDZ_MNGT_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'loyltyrewardzmngt')
  assert.equal(provider.companyCareerPage, 'https://loylty.com/about/careers/')
  assert.equal(provider.atsPlatform, 'official-careers-culture-page-no-public-jobs')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /well-rounded worklife/i)
  assert.match(provider.verifiedSurfaceSummary, /Health & Wellness/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Loylty Rewardz Mngt',
    modulePath: path.resolve(currentDir, '../../scraper/loyltyrewardzmngt/script.js'),
    countryFilter: 'India',
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Xoxoday local catalog captures the verified first-party shell and Keka jobs API', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/xoxoday/catalog.js', 'XOXODAY_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'xoxoday')
  assert.equal(provider.companyCareerPage, 'https://www.xoxoday.com/careers')
  assert.equal(provider.kekaCareerPageUrl, 'https://nreach.keka.com/careers/')
  assert.equal(provider.jobsApiUrl, 'https://nreach.keka.com/careers/api/embedjobs/default/active/1d58bf68-c78d-495e-8a38-d17ff1298707')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.verifiedPublicJobCount, 51)
  assert.match(provider.verifiedSurfaceSummary, /Vercel Security Checkpoint/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 429/i)
  assert.match(provider.verifiedSurfaceSummary, /Product Manager - Empuls/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Manager - Business & Commercial Intelligence/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Xoxoday',
    modulePath: path.resolve(currentDir, '../../scraper/xoxoday/script.js'),
    countryFilter: 'Global',
  })
  await assertHydratedCatalogLoadsScript(provider)
})
